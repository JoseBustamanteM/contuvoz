import { Component, inject, computed } from '@angular/core';
import { HandTrackerService } from '../../../../services/hand-tracker.service';

const FINGER_LABELS = ['Muñeca', 'Pulgar', '', '', '',
  'Índice', '', '', '',
  'Medio', '', '', '',
  'Anular', '', '', '',
  'Meñique', '', '', ''];

@Component({
  selector: 'app-landmark-debug',
  standalone: true,
  template: `
    @if (tracker.debugMode()) {
      <div class="debug-panel">
        <div class="debug-panel__header">
          <span class="debug-panel__title">Debug · Landmarks</span>
          <span class="debug-panel__hand">{{ handedness() }}</span>
        </div>

        <div class="debug-panel__grid">
          @for (lm of landmarks(); track $index) {
            <div class="debug-panel__row" [class.debug-panel__row--tip]="isTip($index)">
              <span class="debug-panel__idx">{{ $index }}</span>
              <span class="debug-panel__label">{{ label($index) }}</span>
              <span class="debug-panel__val">x {{ fmt(lm.x) }}</span>
              <span class="debug-panel__val">y {{ fmt(lm.y) }}</span>
              <span class="debug-panel__val muted">z {{ fmt(lm.z) }}</span>
            </div>
          }
        </div>

        <div class="debug-panel__footer">
          Confianza: {{ confidencePct() }}% · {{ status() }}
        </div>
      </div>
    }
  `,
  styleUrl: './landmark-debug.component.scss',
})
export class LandmarkDebugComponent {
  readonly tracker = inject(HandTrackerService);

  readonly landmarks  = computed(() => this.tracker.result()?.hands[0]?.landmarks ?? []);
  readonly handedness = computed(() => this.tracker.result()?.hands[0]?.handedness ?? '—');
  readonly status     = computed(() => this.tracker.status());
  readonly confidencePct = computed(() =>
    Math.round((this.tracker.result()?.confidence ?? 0) * 100)
  );

  readonly TIP_INDICES = new Set([4, 8, 12, 16, 20]);

  isTip(idx: number): boolean { return this.TIP_INDICES.has(idx); }
  fmt(n: number): string       { return n.toFixed(3); }
  label(idx: number): string   { return FINGER_LABELS[idx] ?? ''; }
}
