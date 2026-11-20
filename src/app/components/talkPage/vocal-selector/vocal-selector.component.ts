import { Component, input, output } from '@angular/core';
import { VocalLetter, PracticeState } from '../../../pages/talkPage/talkpage.component';

export interface VocalHablemos {
  letter: VocalLetter;
  /** Dibujo y palabra de ejemplo, para la burbuja del gecko. */
  emoji: string;
  word: string;
}

export const VOCALES_HABLEMOS: readonly VocalHablemos[] = [
  { letter: 'A', emoji: '🦅', word: 'Águila' },
  { letter: 'E', emoji: '⭐', word: 'Estrella' },
  { letter: 'I', emoji: '🏝', word: 'Isla' },
  { letter: 'O', emoji: '🐻', word: 'Oso' },
  { letter: 'U', emoji: '🍇', word: 'Uvas' },
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
