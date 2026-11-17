import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VocalLetter, PracticeState, MotivoRepetir } from '../../../pages/talkPage/talkpage.component';

@Component({
  selector: 'app-result-feedback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './result-feedback.component.html',
  styleUrl: './result-feedback.component.scss',
})
export class ResultFeedbackComponent {
  practiceState = input<PracticeState>('idle');
  selectedVocal = input<VocalLetter | null>(null);
  /** La vocal que se reconoció en su lugar (solo cuando fue otra vocal). */
  detectedVocal = input<VocalLetter | null>(null);
  motivo = input<MotivoRepetir>(null);

  retry = output<void>();

  isSuccess = computed(() => this.practiceState() === 'success');
  /** No estuvo mal: el detector no está seguro y pide repetir. */
  isRepeat = computed(() => this.practiceState() === 'repeat');

  icon = computed(() => (this.isSuccess() ? '🌟' : this.isRepeat() ? '👂' : '🔄'));

  title = computed(() => {
    if (this.isSuccess()) return '¡Muy bien! 🎉';
    if (this.isRepeat()) return '¡Dila otra vez!';
    return '¡Casi! Inténtalo de nuevo 💪';
  });

  subtitle = computed(() => {
    const target = this.selectedVocal();
    const said = this.detectedVocal();

    if (this.isSuccess()) {
      return `Dijiste la "${target}" perfectamente`;
    }
    if (this.motivo() === 'muy-corta') {
      return `Fue muy cortita. Di la "${target}" más larga: "${target}${target}${target}"`;
    }
    if (this.isRepeat()) {
      return `No alcancé a escucharla bien. Di la "${target}" fuerte y larga`;
    }
    if (!said) {
      return 'No te escuché bien. Acércate al micrófono e inténtalo 🎤';
    }
    return `Dijiste la "${said}" en lugar de la "${target}"`;
  });

  onRetry(): void {
    this.retry.emit();
  }
}