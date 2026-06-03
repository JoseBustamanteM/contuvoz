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
  // ── Inputs ──────────────────────────────────────────────
  practiceState = input<PracticeState>('idle');
  selectedVocal = input<VocalLetter | null>(null);

  // ── Outputs ─────────────────────────────────────────────
  retry = output<void>();

  // ── Computados ──────────────────────────────────────────
  isSuccess = computed(() => this.practiceState() === 'success');

  title = computed(() =>
    this.isSuccess() ? '¡Muy bien! 🎉' : '¡Casi! Inténtalo de nuevo 💪'
  );

  subtitle = computed(() => {
    const vocal = this.selectedVocal();
    return this.isSuccess()
      ? `Dijiste la "${vocal}" perfectamente`
      : `La vocal "${vocal}" suena un poco diferente`;
  });

  // ── Handler ──────────────────────────────────────────────
  onRetry(): void {
    this.retry.emit();
  }
}
