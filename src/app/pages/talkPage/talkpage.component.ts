import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VocalSelectorComponent } from '../../components/talkPage/vocal-selector/vocal-selector.component';
import { PracticeButtonComponent } from '../../components/talkPage/practice-button/practice-button.component';
import { ResultFeedbackComponent } from '../../components/talkPage/result-feedback/result-feedback.component';
import { MascotHeaderComponent } from '../../components/talkPage/mascot-header/mascot-header.component';
import { WaveformVisualizerComponent } from '../../components/talkPage/waveform-visualizer/waveform-visualizer.component';
import { BackButtonComponent } from '../../components/shared/back-button/back-button.component';
import { AvisoModoPracticaComponent } from '../../components/shared/aviso-modo-practica/aviso-modo-practica.component';
import { VowelDetectorService } from '../../services/vowel-detector.service';
import { ActividadesService } from '../../services/actividades.service';
import { ResultadoPronunciacion } from '../../interfaces/pronunciacion.interface';

export type VocalLetter = 'A' | 'E' | 'I' | 'O' | 'U';
export type PracticeState = 'idle' | 'listening' | 'success' | 'failure';

/** Cuánto escucha el detector. Es la ÚNICA fuente de la duración: el botón la
 *  recibe como input para su cuenta regresiva. Antes cada uno tenía la suya y
 *  los comentarios y la barra decían 5 s mientras se escuchaba 2. */
export const DURACION_ESCUCHA_MS = 2000;

@Component({
  selector: 'app-talk-page',
  standalone: true,
  imports: [
    CommonModule,
    VocalSelectorComponent,
    PracticeButtonComponent,
    ResultFeedbackComponent,
    MascotHeaderComponent,
    WaveformVisualizerComponent,
    BackButtonComponent,
    AvisoModoPracticaComponent,
  ],
  templateUrl: './talkpage.component.html',
  styleUrl: './talkpage.component.scss',
})
export class TalkPageComponent {
  private detector = inject(VowelDetectorService);
  private actividadesService = inject(ActividadesService);

  readonly duracionEscuchaMs = DURACION_ESCUCHA_MS;

  /** true solo cuando el micrófono ya está abierto. Mientras el navegador pide
   *  permiso, practiceState ya es 'listening' pero esto sigue en false: así la
   *  cuenta regresiva no se gasta esperando que el niño acepte el permiso. */
  microfonoAbierto = this.detector.isListening;

  /** Por qué no se pudo usar el micrófono (permiso negado, no hay micrófono...). */
  errorMicrofono = this.detector.error;

  selectedVocal = signal<VocalLetter | null>(null);
  detectedVocal = signal<VocalLetter | null>(null);
  practiceState = signal<PracticeState>('idle');
  guardando = signal(false);
  errorGuardado = signal(false);

  /** Último intento que no se pudo guardar, para el botón de reintento. */
  private pendienteDeGuardar: ResultadoPronunciacion | null = null;

  onVocalSelected(vocal: VocalLetter): void {
    this.selectedVocal.set(vocal);
    this.practiceState.set('idle');
    this.detectedVocal.set(null);
  }

  async onPracticeStart(): Promise<void> {
    const vocal = this.selectedVocal();
    if (!vocal) return;

    this.practiceState.set('listening');
    this.detectedVocal.set(null);
    this.errorGuardado.set(false);

    try {
      const result = await this.detector.listen(vocal, DURACION_ESCUCHA_MS);
      this.detectedVocal.set(result.detected as VocalLetter | null);
      this.practiceState.set(result.success ? 'success' : 'failure');

      // El intento se guarda SIEMPRE, acierte o no: un fallo es un dato
      // pedagógico tan válido como un acierto (con qué vocal se confunde).
      this.guardarIntento({
        textoEsperado: vocal,
        // La columna es NOT NULL: cuando no hubo voz suficiente se guarda
        // 'NINGUNA', igual que en señas. Distingue "se equivocó de vocal"
        // de "no llegó a hablar", que son cosas distintas para la profesora.
        textoDetectado: result.detected ?? 'NINGUNA',
        // El detector devuelve 0..1 y la columna espera 0..100.
        porcConfianza: Math.round(result.confidence * 100),
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

    this.actividadesService.guardarPronunciacion(datos).subscribe({
      next: () => {
        this.guardando.set(false);
        this.pendienteDeGuardar = null;
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
