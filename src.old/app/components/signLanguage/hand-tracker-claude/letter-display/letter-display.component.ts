import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HandTrackerService } from '../../../../services/hand-tracker.service';

@Component({
  selector: 'app-letter-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="letter-display" [class]="statusClass()">
      <div class="letter-display__card">

        <div class="letter-display__letter" [attr.data-letter]="displayLetter()">
          {{ displayLetter() }}
        </div>

        <div class="letter-display__meta">
          <span class="letter-display__status-dot"></span>
          <span class="letter-display__status-text">{{ statusText() }}</span>
        </div>

        @if (confidence() > 0) {
          <div class="letter-display__confidence">
            <div
              class="letter-display__confidence-bar"
              [style.width.%]="confidence() * 100"
            ></div>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './letter-display.component.scss',
})
export class LetterDisplayComponent {
  readonly tracker = inject(HandTrackerService);

  readonly displayLetter = computed(() => {
    const l = this.tracker.letter();
    return l && l !== 'UNKNOWN' ? l : '—';
  });

  readonly confidence = computed(() => this.tracker.result()?.confidence ?? 0);

  readonly statusClass = computed(() => {
    const s = this.tracker.status();
    return `letter-display--${s}`;
  });

  readonly statusText = computed(() => {
    const map: Record<string, string> = {
      idle:      'Esperando...',
      detecting: 'Detectando mano...',
      detected:  'Letra reconocida',
      no_hand:   'Sin mano detectada',
      error:     'Error de cámara',
    };
    return map[this.tracker.status()] ?? '';
  });
}
