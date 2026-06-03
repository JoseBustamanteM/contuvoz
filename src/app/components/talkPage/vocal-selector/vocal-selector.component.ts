import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VocalLetter, PracticeState } from '../../../pages/talkPage/talkpage.component';

interface VocalCard {
  letter: VocalLetter;
  emoji: string;   // Imagen representativa (se puede cambiar por asset real)
  word: string;    // Palabra ejemplo para refuerzo visual
  color: string;   // Color temático de la tarjeta
}

@Component({
  selector: 'app-vocal-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vocal-selector.component.html',
  styleUrl: './vocal-selector.component.scss',
})
export class VocalSelectorComponent {
  // ── Inputs ──────────────────────────────────────────────
  selectedVocal = input<VocalLetter | null>(null);
  practiceState = input<PracticeState>('idle');

  // ── Outputs ─────────────────────────────────────────────
  vocalSelected = output<VocalLetter>();

  // ── Datos de las tarjetas ────────────────────────────────
  readonly vocals: VocalCard[] = [
    { letter: 'A', emoji: '🦅', word: 'Águila',   color: '#FF6B6B' },
    { letter: 'E', emoji: '⭐', word: 'Estrella',  color: '#FFD93D' },
    { letter: 'I', emoji: '🏝', word: 'Isla',      color: '#6BCB77' },
    { letter: 'O', emoji: '🐻', word: 'Oso',       color: '#FF922B' },
    { letter: 'U', emoji: '🍇', word: 'Uvas',      color: '#845EF7' },
  ];

  // ── Helpers ──────────────────────────────────────────────
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
