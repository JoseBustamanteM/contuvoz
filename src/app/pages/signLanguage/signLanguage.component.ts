import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HandTrackerComponent } from '../../components/signLanguage/hand-tracker/hand-tracker.component';
import { BackButtonComponent } from '../../components/shared/back-button/back-button.component';
import { ActividadesService } from '../../services/actividades.service';
import { ResultadoSign } from '../../interfaces/sign-language.interface';

const UMBRAL_APROBADO = 70;

/** Entrada del resumen. Se crea apenas termina la letra, con datos LOCALES, y
 *  después se actualiza el estado de guardado. Así el niño ve su resultado
 *  aunque la BD esté caída. */
export interface EntradaResumen {
  letraEsperada: string;
  letraDetectada: string;
  porcConfianza: number;
  aprobado: boolean;
  guardado: 'pendiente' | 'ok' | 'error';
  /** Se conserva para poder reintentar el POST sin rehacer la seña. */
  datos: ResultadoSign;
}

@Component({
  selector: 'sign-page',
  standalone: true,
  imports: [CommonModule, HandTrackerComponent, BackButtonComponent],
  templateUrl: './signLanguage.component.html',
  styleUrls: ['./signLanguage.component.scss'],
})
export class SignLanguageComponent {
  private actividadesService = inject(ActividadesService);

  /** Arranca en true: se llega acá eligiendo la actividad en el menú, así que el
   *  botón "Iniciar evaluación" era un clic de más. La cámara se enciende sola. */
  evaluacionActiva = signal(true);
  resumen = signal<EntradaResumen[]>([]);

  /** El resumen se muestra cuando la evaluación terminó y hay resultados.
   *  Al terminar se desmonta el tracker, así que la cámara ya está apagada. */
  mostrarResumen = computed(() => !this.evaluacionActiva() && this.resumen().length > 0);

  /** Cuántas letras logró de las 5, para el mensaje de cierre. */
  totalAprobadas = computed(() => this.resumen().filter((e) => e.aprobado).length);

  /** Cuántas letras no lograron guardarse. Habilita el botón de reintento. */
  fallosDeGuardado = computed(
    () => this.resumen().filter((e) => e.guardado === 'error').length,
  );

  reintentando = signal(false);

  /** "Practicar de nuevo" desde la pantalla de resumen. */
  reiniciarEvaluacion() {
    this.resumen.set([]);
    this.evaluacionActiva.set(true);
  }

  onResultadoListo(resultado: ResultadoSign) {
    // 1) El resultado entra al resumen INMEDIATAMENTE, con el veredicto calculado
    //    localmente. Antes la entrada solo aparecía si el POST respondía bien, así
    //    que un fallo de red borraba la letra del resumen del niño.
    const entrada: EntradaResumen = {
      letraEsperada: resultado.letraEsperada,
      letraDetectada: resultado.letraDetectada,
      porcConfianza: resultado.porcConfianza,
      // Mismo criterio que aplica el servidor: umbral Y sostenida. Así el ✅ que
      // ve el niño coincide siempre con el aprobado_sign que queda en la BD.
      aprobado: resultado.porcConfianza >= UMBRAL_APROBADO && resultado.sostenida,
      guardado: 'pendiente',
      datos: resultado,
    };

    this.resumen.update((r) => [...r, entrada]);

    // 2) El guardado corre aparte y solo actualiza el estado de esa fila.
    this.guardarEntrada(entrada);
  }

  private guardarEntrada(entrada: EntradaResumen) {
    this.actividadesService.guardarSign(entrada.datos).subscribe({
      next: (guardado) =>
        this.actualizarEntrada(entrada.letraEsperada, {
          guardado: 'ok',
          // El servidor tiene la última palabra sobre la aprobación.
          aprobado: guardado.aprobadoSign,
        }),
      error: () => this.actualizarEntrada(entrada.letraEsperada, { guardado: 'error' }),
    });
  }

  /** Actualiza por letra esperada: las respuestas HTTP pueden llegar desordenadas
   *  (el retry con backoff puede tardar hasta 4s), así que no sirve usar el índice. */
  private actualizarEntrada(letra: string, cambios: Partial<EntradaResumen>) {
    this.resumen.update((r) =>
      r.map((e) => (e.letraEsperada === letra ? { ...e, ...cambios } : e)),
    );
  }

  /** Reintenta solo las letras que fallaron, sin rehacer las señas. */
  reintentarGuardado() {
    const fallidas = this.resumen().filter((e) => e.guardado === 'error');
    if (fallidas.length === 0) return;

    this.reintentando.set(true);
    for (const entrada of fallidas) {
      this.actualizarEntrada(entrada.letraEsperada, { guardado: 'pendiente' });
      this.guardarEntrada(entrada);
    }
    this.reintentando.set(false);
  }

  onTestTerminado() {
    // Desmonta el tracker: su ngOnDestroy corta el bucle de detección y apaga la
    // cámara. Antes esto quedaba vacío y la cámara seguía encendida mientras el
    // niño miraba el resumen.
    this.evaluacionActiva.set(false);
  }

  /** Salir a mitad de la evaluación. Desmonta el tracker (apaga la cámara) y
   *  descarta el resumen parcial: las letras ya guardadas quedan en la BD, pero
   *  no tiene sentido mostrar un resumen incompleto como si fuera el resultado. */
  abandonar() {
    this.evaluacionActiva.set(false);
    this.resumen.set([]);
  }
}
