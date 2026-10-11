import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VocalLetter, PracticeState } from '../../../pages/talkPage/talkpage.component';

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
  detectedVocal = input<VocalLetter | null>(null);   // 👈 NUEVO

  retry = output<void>();

  isSuccess = computed(() => this.practiceState() === 'success');

  title = computed(() =>
    this.isSuccess() ? '¡Muy bien! 🎉' : '¡Casi! Inténtalo de nuevo 💪'
  );

  subtitle = computed(() => {
    const target = this.selectedVocal();
    const said = this.detectedVocal();

    if (this.isSuccess()) {
      return `Dijiste la "${target}" perfectamente`;
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