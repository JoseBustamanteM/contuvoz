import { Component, input, output, computed } from '@angular/core';
import { VocalLetter, PracticeState } from '../../../pages/talkPage/talkpage.component';

/**
 * El micrófono gigante de Hablemos. Mientras escucha, un anillo alrededor
 * muestra el tiempo que queda (lo calcula el detector, que espera a que el
 * niño hable y corta cuando calla). Después de un intento, el anillo toma
 * el color del resultado.
 */
@Component({
  selector: 'app-practice-button',
  standalone: true,
  templateUrl: './practice-button.component.html',
  styleUrl: './practice-button.component.scss',
})
export class PracticeButtonComponent {
  selectedVocal = input<VocalLetter | null>(null);
  practiceState = input<PracticeState>('idle');
  /** true mientras el micrófono está abierto. Entre el clic y el micrófono
   *  abierto puede estar el diálogo de permiso del navegador. */
  escuchando = input(false);
  /** true desde que el niño empieza a hablar. */
  oyendoVoz = input(false);
  /** 1 → 0: tiempo que queda de escucha. */
  progreso = input(1);

  practiceStart = output<void>();

  isListening = computed(() => this.practiceState() === 'listening');
  isDisabled = computed(() => !this.selectedVocal() || this.isListening());
  progresoPorcentaje = computed(() => Math.round(this.progreso() * 100));

  /** El texto bajo el micrófono: siempre dice qué pasa ahora. */
  etiqueta = computed(() => {
    const vocal = this.selectedVocal();
    if (this.isListening() && !this.escuchando()) return 'Preparando el micrófono…';
    if (this.isListening() && this.oyendoVoz()) return 'Te escucho…';
    if (this.isListening()) return `¡Di la ${vocal}!`;
    if (!vocal) return 'Elige una vocal arriba';
    if (this.practiceState() === 'idle') return 'Toca y habla';
    return 'Toca para intentar otra vez';
  });

  ariaLabel = computed(() => {
    const vocal = this.selectedVocal();
    if (!vocal) return 'Micrófono: primero elige una vocal';
    if (this.isListening()) return 'Escuchando';
    return `Practicar la ${vocal}`;
  });

  onButtonClick(): void {
    if (this.isDisabled()) return;
    this.practiceStart.emit();
  }
}
