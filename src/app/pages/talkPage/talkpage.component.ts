import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VocalSelectorComponent } from '../../components/talkPage/vocal-selector/vocal-selector.component';
import { PracticeButtonComponent } from '../../components/talkPage/practice-button/practice-button.component';
import { MascotHeaderComponent } from '../../components/talkPage/mascot-header/mascot-header.component';
import { WaveformVisualizerComponent } from '../../components/talkPage/waveform-visualizer/waveform-visualizer.component';
import { AvisoModoPracticaComponent } from '../../components/shared/aviso-modo-practica/aviso-modo-practica.component';
import { VowelDetectorService } from '../../services/vowel-detector.service';
import { ActividadesService } from '../../services/actividades.service';
import {
  DUDOSA,
  NINGUNA,
  ResultadoPronunciacion,
  apruebaPronunciacion,
} from '../../interfaces/pronunciacion.interface';

export type VocalLetter = 'A' | 'E' | 'I' | 'O' | 'U';
/** 'repeat': el detector no está seguro, o la vocal fue muy corta. Se pide
 *  repetir sin decir que estuvo mal. */
export type PracticeState = 'idle' | 'listening' | 'success' | 'failure' | 'repeat';
/** Por qué se pide repetir (o por qué no se escuchó nada). */
export type MotivoRepetir = 'dudosa' | 'muy-corta' | 'sin-voz' | null;

@Component({
  selector: 'app-talk-page',
  standalone: true,
  imports: [
    CommonModule,
    VocalSelectorComponent,
    PracticeButtonComponent,
    MascotHeaderComponent,
    WaveformVisualizerComponent,
    AvisoModoPracticaComponent,
  ],
  templateUrl: './talkpage.component.html',
  styleUrl: './talkpage.component.scss',
})
export class TalkPageComponent {
  private detector = inject(VowelDetectorService);
  private actividadesService = inject(ActividadesService);

  /** true solo cuando el micrófono ya está abierto. Mientras el navegador pide
   *  permiso, practiceState ya es 'listening' pero esto sigue en false. */
  microfonoAbierto = this.detector.isListening;
  /** true desde que el niño empieza a hablar. */
  oyendoVoz = this.detector.oyendoVoz;
  /** 1 → 0: tiempo que queda de escucha. */
  progresoEscucha = this.detector.progreso;

  /** Por qué no se pudo usar el micrófono (permiso negado, no hay micrófono...). */
  errorMicrofono = this.detector.error;

  selectedVocal = signal<VocalLetter | null>(null);
  detectedVocal = signal<VocalLetter | null>(null);
  practiceState = signal<PracticeState>('idle');
  motivoRepetir = signal<MotivoRepetir>(null);
  guardando = signal(false);
  errorGuardado = signal(false);

  /** Último intento que no se pudo guardar, para el botón de reintento. */
  private pendienteDeGuardar: ResultadoPronunciacion | null = null;

  /** Cuenta los intentos, para no aplicar la respuesta del servidor a un
   *  intento que el niño ya dejó atrás. */
  private intentoActual = 0;

  onVocalSelected(vocal: VocalLetter): void {
    this.selectedVocal.set(vocal);
    this.practiceState.set('idle');
    this.detectedVocal.set(null);
    this.motivoRepetir.set(null);
  }

  async onPracticeStart(): Promise<void> {
    const vocal = this.selectedVocal();
    if (!vocal) return;

    this.practiceState.set('listening');
    this.detectedVocal.set(null);
    this.motivoRepetir.set(null);
    this.errorGuardado.set(false);

    // Duración del intento: de tocar "Practicar" al resultado (incluye la
    // espera del permiso del micrófono la primera vez).
    const inicio = performance.now();

    try {
      const result = await this.detector.listen(vocal);
      // El detector devuelve 0..1 y la columna espera 0..100.
      const porcConfianza = Math.round(result.confidence * 100);

      // Lo que se guarda como "detectada":
      // - correcta u otra vocal: la vocal reconocida;
      // - dudosa o muy corta: DUDOSA (se pide repetir, no cuenta como fallo);
      // - sin voz: NINGUNA, igual que en señas. Distingue "se equivocó de
      //   vocal" de "no llegó a hablar", que para la profesora son distintos.
      const textoDetectado =
        result.resultado === 'correcta' || result.resultado === 'otra'
          ? result.detected!
          : result.resultado === 'sin-voz'
            ? NINGUNA
            : DUDOSA;

      // Misma regla que el servidor (vocal correcta Y confianza mínima): lo
      // que ve el niño es lo que queda en Mis logros. Se decide aquí, sin
      // esperar la respuesta, para que el resultado aparezca al instante y
      // también funcione en modo práctica, donde no se guarda nada.
      const aprobado = apruebaPronunciacion(vocal, textoDetectado, porcConfianza);
      this.intentoActual++;
      this.detectedVocal.set(result.resultado === 'otra' ? result.detected : null);
      if (aprobado) {
        this.practiceState.set('success');
      } else if (textoDetectado === DUDOSA) {
        this.motivoRepetir.set(result.resultado === 'muy-corta' ? 'muy-corta' : 'dudosa');
        this.practiceState.set('repeat');
      } else {
        this.motivoRepetir.set(textoDetectado === NINGUNA ? 'sin-voz' : null);
        this.practiceState.set('failure');
      }

      // El intento se guarda SIEMPRE, acierte o no: un fallo es un dato
      // pedagógico tan válido como un acierto (con qué vocal se confunde).
      const m = result.medidas;
      this.guardarIntento({
        textoEsperado: vocal,
        textoDetectado,
        porcConfianza,
        duracion: Math.round((performance.now() - inicio) / 1000),
        versionDetector: result.versionDetector,
        ...(m && {
          f0Hz: Math.round(m.f0),
          f1Hz: Math.round(m.f1),
          f2Hz: Math.round(m.f2),
          ...(m.f3 > 0 && { f3Hz: Math.round(m.f3) }),
          snrDb: Math.round(m.snrDb * 10) / 10,
          msVoz: Math.round(m.msVoz),
        }),
      });
    } catch {
      // No se pudo abrir el micrófono: no hubo intento, así que no se guarda
      // nada ni se muestra "no te escuché". El motivo lo muestra errorMicrofono.
      this.practiceState.set('idle');
    }
  }

  private guardarIntento(datos: ResultadoPronunciacion): void {
    // Modo práctica: el backend respondería 403 para este rol.
    if (!this.actividadesService.puedeGuardarProgreso()) return;

    this.pendienteDeGuardar = datos;
    this.guardando.set(true);
    this.errorGuardado.set(false);
    const intento = this.intentoActual;

    this.actividadesService.guardarPronunciacion(datos).subscribe({
      next: (guardado) => {
        this.guardando.set(false);
        this.pendienteDeGuardar = null;

        // El servidor tiene la última palabra. Si alguna vez las reglas
        // quedaran distintas (umbral cambiado en un lado y no en el otro), la
        // pantalla se corrige para mostrar lo que de verdad se guardó. Solo si
        // el niño sigue viendo este mismo intento.
        const estado = this.practiceState();
        if (intento === this.intentoActual && estado !== 'listening' && estado !== 'repeat') {
          this.practiceState.set(guardado.aprobadoPronun ? 'success' : 'failure');
        }
      },
      error: () => {
        this.guardando.set(false);
        this.errorGuardado.set(true);
      },
    });
  }

  reintentarGuardado(): void {
    if (this.pendienteDeGuardar) this.guardarIntento(this.pendienteDeGuardar);
  }
}
