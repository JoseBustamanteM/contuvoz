import { Component, input, output } from '@angular/core';
import { VocalLetter, PracticeState } from '../../../pages/talkPage/talkpage.component';

export interface VocalHablemos {
  letter: VocalLetter;
  /** Dibujo y palabra de ejemplo, para la burbuja del gecko. */
  emoji: string;
  word: string;
  /** Color del globo. */
  color: string;
  /** Sombra (más oscura) del globo. */
  sombra: string;
}

export const VOCALES_HABLEMOS: readonly VocalHablemos[] = [
  { letter: 'A', emoji: '🦅', word: 'Águila', color: '#ff6b6b', sombra: '#c94545' },
  { letter: 'E', emoji: '⭐', word: 'Estrella', color: '#f2b705', sombra: '#b88a00' },
  { letter: 'I', emoji: '🏝', word: 'Isla', color: '#4cb860', sombra: '#2f8a40' },
  { letter: 'O', emoji: '🐻', word: 'Oso', color: '#ff922b', sombra: '#c86a10' },
  { letter: 'U', emoji: '🍇', word: 'Uvas', color: '#845ef7', sombra: '#5b37c4' },
];

/** Las cinco vocales como globos; el elegido sube. */
@Component({
  selector: 'app-vocal-selector',
  standalone: true,
  templateUrl: './vocal-selector.component.html',
  styleUrl: './vocal-selector.component.scss',
})
export class VocalSelectorComponent {
  selectedVocal = input<VocalLetter | null>(null);
  practiceState = input<PracticeState>('idle');

  vocalSelected = output<VocalLetter>();

  readonly vocals = VOCALES_HABLEMOS;

  isSelected(letter: VocalLetter): boolean {
    return this.selectedVocal() === letter;
  }

  isDisabled(): boolean {
    return this.practiceState() === 'listening';
  }

  selectVocal(letter: VocalLetter): void {
    if (this.isDisabled()) return;
    this.vocalSelected.emit(letter);
  }
}
