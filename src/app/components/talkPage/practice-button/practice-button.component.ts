import { Component, input, output, computed, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VocalLetter, PracticeState } from '../../../pages/talkPage/talkpage.component';

@Component({
  selector: 'app-practice-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './practice-button.component.html',
  styleUrl: './practice-button.component.scss',
})
export class PracticeButtonComponent implements OnDestroy {
  // ── Inputs ──────────────────────────────────────────────
  selectedVocal = input<VocalLetter | null>(null);
  practiceState = input<PracticeState>('idle');

  // ── Outputs ─────────────────────────────────────────────
  practiceStart  = output<void>();
  practiceFinish = output<void>(); // emitido al acabar los 5 segundos

  // ── Estado interno del contador ──────────────────────────
  countdown     = signal<number>(5);
  progressWidth = signal<number>(100); // % de la barra (100 → 0)

  private _interval: ReturnType<typeof setInterval> | null = null;

  // ── Computados ──────────────────────────────────────────
  isListening = computed(() => this.practiceState() === 'listening');
  isDisabled  = computed(() => !this.selectedVocal() || this.isListening());

  buttonLabel = computed(() => {
    if (this.isListening()) return `🎙️ Escuchando... ${this.countdown()}s`;
    if (!this.selectedVocal()) return '🎤 Elige una vocal';
    return `🎤 ¡Practicar la ${this.selectedVocal()}!`;
  });

  // ── Handler ──────────────────────────────────────────────
  onButtonClick(): void {
    if (this.isDisabled()) return;
    this.practiceStart.emit();
    this._startCountdown();
  }

  private _startCountdown(): void {
    this.countdown.set(2);
    this.progressWidth.set(100);

    const TOTAL_MS = 2000;
    const TICK_MS  = 50; // refresco suave para la barra
    let elapsed    = 0;

    this._interval = setInterval(() => {
      elapsed += TICK_MS;
      const remaining = Math.ceil((TOTAL_MS - elapsed) / 1000);
      const pct       = Math.max(0, ((TOTAL_MS - elapsed) / TOTAL_MS) * 100);

      this.countdown.set(remaining > 0 ? remaining : 0);
      this.progressWidth.set(pct);

      if (elapsed >= TOTAL_MS) {
        this._stopCountdown();
        this.practiceFinish.emit(); // la page decide éxito/fallo
      }
    }, TICK_MS);
  }

  private _stopCountdown(): void {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  ngOnDestroy(): void {
    this._stopCountdown();
  }
}
