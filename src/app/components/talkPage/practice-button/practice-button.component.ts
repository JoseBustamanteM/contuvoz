import { Component, input, output, computed, signal, effect, OnDestroy } from '@angular/core';
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
  /** Duración real de la escucha (la define la página, la misma que usa el detector). */
  duracionMs = input.required<number>();
  /** true mientras el micrófono está abierto. La cuenta regresiva arranca con
   *  esto y no con el clic: entre el clic y el micrófono abierto puede estar el
   *  diálogo de permiso del navegador. */
  escuchando = input(false);

  // ── Outputs ─────────────────────────────────────────────
  practiceStart = output<void>();

  // ── Estado interno del contador ──────────────────────────
  countdown = signal(0);
  progressWidth = signal(100); // % de la barra (100 → 0)

  private _interval: ReturnType<typeof setInterval> | null = null;

  // ── Computados ──────────────────────────────────────────
  isListening = computed(() => this.practiceState() === 'listening');
  isDisabled = computed(() => !this.selectedVocal() || this.isListening());
  segundosTotales = computed(() => Math.ceil(this.duracionMs() / 1000));

  buttonLabel = computed(() => {
    if (this.isListening() && !this.escuchando()) return '🎙️ Preparando micrófono...';
    if (this.isListening()) return `🎙️ Escuchando... ${this.countdown()}s`;
    if (!this.selectedVocal()) return '🎤 Elige una vocal';
    return `🎤 ¡Practicar la ${this.selectedVocal()}!`;
  });

  constructor() {
    effect(() => {
      if (this.escuchando()) this._startCountdown();
      else this._stopCountdown();
    });
  }

  // ── Handler ──────────────────────────────────────────────
  onButtonClick(): void {
    if (this.isDisabled()) return;
    this.practiceStart.emit();
  }

  private _startCountdown(): void {
    this._stopCountdown();

    const total = this.duracionMs();
    const TICK_MS = 50; // refresco suave para la barra
    const inicio = performance.now();

    this.countdown.set(this.segundosTotales());
    this.progressWidth.set(100);

    this._interval = setInterval(() => {
      // Con el reloj real y no sumando ticks: setInterval se atrasa en equipos
      // lentos y la barra terminaba después que la escucha.
      const restante = Math.max(0, total - (performance.now() - inicio));
      this.countdown.set(Math.ceil(restante / 1000));
      this.progressWidth.set((restante / total) * 100);
      if (restante === 0) this._stopCountdown();
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
