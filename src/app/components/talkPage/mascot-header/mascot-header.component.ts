import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VocalLetter, PracticeState } from '../../../pages/talkPage/talkpage.component';

@Component({
  selector: 'app-mascot-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mascot-header.component.html',
  styleUrl: './mascot-header.component.scss',
})
export class MascotHeaderComponent {
  // ── Inputs ──────────────────────────────────────────────
  practiceState = input<PracticeState>('idle');
  selectedVocal = input<VocalLetter | null>(null);

  // ── Computados ──────────────────────────────────────────
  message = computed(() => {
    const state = this.practiceState();
    const vocal = this.selectedVocal();

    if (state === 'listening') return `¡Escucho! Di la "${vocal}"... 👂`;
    if (state === 'success')   return '¡Genial! ¡Lo lograste! 🌟';
    if (state === 'failure')   return '¡Tú puedes! Inténtalo de nuevo 💪';
    if (vocal)                 return `Ahora practica la vocal "${vocal}"`;
    return '¡Elige una vocal y practica!';
  });

  // Clase CSS del estado para animaciones de la mascota
  mascotStateClass = computed(() => `mascot--${this.practiceState()}`);
}
