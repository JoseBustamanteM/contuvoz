import { Component, input, computed } from '@angular/core';
import {
  VocalLetter,
  PracticeState,
  MotivoRepetir,
} from '../../../pages/talkPage/talkpage.component';
import { VOCALES_HABLEMOS } from '../vocal-selector/vocal-selector.component';

/**
 * El gecko de Hablemos con su burbuja. La burbuja dice qué hacer y, después
 * de cada intento, cómo le fue: es lo primero que el niño mira, así que el
 * resultado va ahí y no en una tarjeta aparte.
 */
@Component({
  selector: 'app-mascot-header',
  standalone: true,
  templateUrl: './mascot-header.component.html',
  styleUrl: './mascot-header.component.scss',
})
export class MascotHeaderComponent {
  practiceState = input<PracticeState>('idle');
  selectedVocal = input<VocalLetter | null>(null);
  /** La vocal que se reconoció en su lugar (solo cuando fue otra vocal). */
  detectedVocal = input<VocalLetter | null>(null);
  motivo = input<MotivoRepetir>(null);
  /** Por qué no se pudo usar el micrófono. */
  errorMicrofono = input<string | null>(null);

  private ejemplo = computed(() => VOCALES_HABLEMOS.find((v) => v.letter === this.selectedVocal()));

  /** Título (grande) y detalle de la burbuja. */
  mensaje = computed((): { titulo: string; detalle?: string } => {
    const vocal = this.selectedVocal();
    const dijo = this.detectedVocal();
    const error = this.errorMicrofono();

    if (error) return { titulo: 'No pudimos usar el micrófono 🎙️', detalle: error };

    switch (this.practiceState()) {
      case 'listening':
        return { titulo: `¡Te escucho! Di la «${vocal}» 👂` };
      case 'success':
        return { titulo: '¡Muy bien! 🎉', detalle: `Dijiste la «${vocal}» perfectamente` };
      case 'repeat':
        return this.motivo() === 'muy-corta'
          ? { titulo: '¡Dila otra vez!', detalle: `Fue muy cortita. Dila más larga: «${vocal}${vocal}${vocal}»` }
          : { titulo: '¡Dila otra vez!', detalle: `No alcancé a escucharla bien. Di la «${vocal}» fuerte y larga` };
      case 'failure':
        if (!dijo) return { titulo: 'No te escuché 👂', detalle: 'Acércate al micrófono y habla fuerte' };
        return { titulo: '¡Casi! 💪', detalle: `Dijiste la «${dijo}» en lugar de la «${vocal}»` };
    }

    const e = this.ejemplo();
    if (!e) return { titulo: '¡Elige una vocal!', detalle: 'Toca un globo de arriba' };
    return { titulo: `Di la «${e.letter}» bien larga`, detalle: `${e.emoji} ${e.letter} de ${e.word}` };
  });

  tono = computed(() => {
    if (this.errorMicrofono()) return 'error';
    const estado = this.practiceState();
    return estado === 'success' ? 'exito' : estado === 'failure' ? 'fallo' : estado === 'repeat' ? 'repetir' : 'normal';
  });
}
