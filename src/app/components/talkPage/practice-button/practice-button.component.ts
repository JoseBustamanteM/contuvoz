import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VocalLetter, PracticeState } from '../../../pages/talkPage/talkpage.component';

@Component({
  selector: 'app-practice-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './practice-button.component.html',
  styleUrl: './practice-button.component.scss',
})
export class PracticeButtonComponent {
  // ── Inputs ──────────────────────────────────────────────
  selectedVocal = input<VocalLetter | null>(null);
  practiceState = input<PracticeState>('idle');
  /** true mientras el micrófono está abierto. Entre el clic y el micrófono
   *  abierto puede estar el diálogo de permiso del navegador. */
  escuchando = input(false);
  /** true desde que el niño empieza a hablar. */
  oyendoVoz = input(false);
  /** 1 → 0: tiempo que queda de escucha. Lo calcula el detector, que es quien
   *  decide cuándo terminar: espera a que el niño hable y corta cuando calla. */
  progreso = input(1);

  // ── Outputs ─────────────────────────────────────────────
  practiceStart = output<void>();

  // ── Computados ──────────────────────────────────────────
  isListening = computed(() => this.practiceState() === 'listening');
  isDisabled = computed(() => !this.selectedVocal() || this.isListening());
  progresoPorcentaje = computed(() => Math.round(this.progreso() * 100));

  buttonLabel = computed(() => {
    if (this.isListening() && !this.escuchando()) return '🎙️ Preparando micrófono...';
    if (this.isListening() && this.oyendoVoz()) return '👂 Te escucho...';
    if (this.isListening()) return `🎙️ ¡Di la ${this.selectedVocal()}!`;
    if (!this.selectedVocal()) return '🎤 Elige una vocal';
    return `🎤 ¡Practicar la ${this.selectedVocal()}!`;
  });

  // ── Handler ──────────────────────────────────────────────
  onButtonClick(): void {
    if (this.isDisabled()) return;
    this.practiceStart.emit();
  }
}
