import { Component, input, output, OnChanges, SimpleChanges, signal } from '@angular/core';

@Component({
  selector: 'app-gecko-celebration',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="gecko-overlay" (click)="dismiss()">
        <div class="gecko-card">

          <div class="gecko-stars">
            <span class="star s1">⭐</span>
            <span class="star s2">✨</span>
            <span class="star s3">⭐</span>
          </div>

          <!-- SVG Gecko celebrando -->
          <div class="gecko-figure">
            <svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg">
              <!-- Sombra -->
              <ellipse cx="100" cy="250" rx="40" ry="8" fill="#00000022"/>

              <!-- Cola -->
              <path d="M85 200 Q60 230 45 220 Q35 215 50 205 Q65 195 80 185" fill="#4a9e2f" stroke="#2d6b1a" stroke-width="2"/>

              <!-- Cuerpo -->
              <ellipse cx="100" cy="175" rx="38" ry="50" fill="#5cb832" stroke="#2d6b1a" stroke-width="2"/>

              <!-- Panza -->
              <ellipse cx="100" cy="185" rx="24" ry="34" fill="#a8e063"/>

              <!-- Pierna izquierda (saltando) -->
              <path d="M72 210 Q55 225 50 240 Q60 245 68 232 Q74 220 80 215" fill="#4a9e2f" stroke="#2d6b1a" stroke-width="1.5"/>
              <!-- Pie izquierdo -->
              <ellipse cx="52" cy="242" rx="10" ry="5" transform="rotate(-20 52 242)" fill="#3d8a25"/>

              <!-- Pierna derecha (saltando) -->
              <path d="M128 210 Q145 225 150 240 Q140 245 132 232 Q126 220 120 215" fill="#4a9e2f" stroke="#2d6b1a" stroke-width="1.5"/>
              <!-- Pie derecho -->
              <ellipse cx="148" cy="242" rx="10" ry="5" transform="rotate(20 148 242)" fill="#3d8a25"/>

              <!-- Brazo izquierdo (arriba celebrando) -->
              <path d="M68 155 Q45 130 35 110 Q30 100 40 98 Q50 96 55 108 Q65 128 75 148" fill="#4a9e2f" stroke="#2d6b1a" stroke-width="2"/>
              <!-- Mano izquierda -->
              <circle cx="37" cy="96" r="9" fill="#4a9e2f" stroke="#2d6b1a" stroke-width="1.5"/>
              <line x1="28" y1="90" x2="22" y2="82" stroke="#2d6b1a" stroke-width="2" stroke-linecap="round"/>
              <line x1="35" y1="87" x2="32" y2="78" stroke="#2d6b1a" stroke-width="2" stroke-linecap="round"/>
              <line x1="42" y1="87" x2="42" y2="78" stroke="#2d6b1a" stroke-width="2" stroke-linecap="round"/>

              <!-- Brazo derecho (arriba celebrando) -->
              <path d="M132 155 Q155 130 165 110 Q170 100 160 98 Q150 96 145 108 Q135 128 125 148" fill="#4a9e2f" stroke="#2d6b1a" stroke-width="2"/>
              <!-- Mano derecha -->
              <circle cx="163" cy="96" r="9" fill="#4a9e2f" stroke="#2d6b1a" stroke-width="1.5"/>
              <line x1="172" y1="90" x2="178" y2="82" stroke="#2d6b1a" stroke-width="2" stroke-linecap="round"/>
              <line x1="165" y1="87" x2="168" y2="78" stroke="#2d6b1a" stroke-width="2" stroke-linecap="round"/>
              <line x1="158" y1="87" x2="158" y2="78" stroke="#2d6b1a" stroke-width="2" stroke-linecap="round"/>

              <!-- Cuello -->
              <ellipse cx="100" cy="128" rx="22" ry="16" fill="#5cb832" stroke="#2d6b1a" stroke-width="2"/>

              <!-- Cabeza -->
              <ellipse cx="100" cy="105" rx="35" ry="30" fill="#5cb832" stroke="#2d6b1a" stroke-width="2"/>

              <!-- Mejillas -->
              <ellipse cx="74" cy="112" rx="10" ry="7" fill="#ff9999" opacity="0.5"/>
              <ellipse cx="126" cy="112" rx="10" ry="7" fill="#ff9999" opacity="0.5"/>

              <!-- Ojos blancos -->
              <ellipse cx="86" cy="96" rx="13" ry="14" fill="white" stroke="#2d6b1a" stroke-width="1.5"/>
              <ellipse cx="114" cy="96" rx="13" ry="14" fill="white" stroke="#2d6b1a" stroke-width="1.5"/>

              <!-- Iris -->
              <circle cx="89" cy="98" r="8" fill="#1a6b00"/>
              <circle cx="117" cy="98" r="8" fill="#1a6b00"/>

              <!-- Pupilas -->
              <circle cx="90" cy="98" r="4" fill="#111"/>
              <circle cx="118" cy="98" r="4" fill="#111"/>

              <!-- Brillo ojos -->
              <circle cx="93" cy="94" r="2" fill="white"/>
              <circle cx="121" cy="94" r="2" fill="white"/>

              <!-- Sonrisa -->
              <path d="M85 118 Q100 132 115 118" fill="none" stroke="#2d6b1a" stroke-width="2.5" stroke-linecap="round"/>
              <!-- Dientes -->
              <path d="M88 120 Q100 130 112 120" fill="white"/>

              <!-- Lengua -->
              <path d="M97 128 Q100 134 103 128" fill="#ff6b6b" stroke="#cc4444" stroke-width="1"/>

              <!-- Franja dorsal -->
              <path d="M100 130 Q97 155 96 175 Q97 195 98 210" fill="none" stroke="#3d8a25" stroke-width="3" stroke-dasharray="4 3"/>
            </svg>
          </div>

          <div class="gecko-message">
            <span class="gecko-message__letter">{{ letter() }}</span>
            <span class="gecko-message__text">¡Muy bien! 🎉</span>
          </div>

        </div>
      </div>
    }
  `,
  styleUrl: './gecko-celebration.component.scss',
})
export class GeckoCelebrationComponent implements OnChanges {
  readonly letter  = input<string>('');
  readonly show    = input<boolean>(false);
  readonly hidden  = output<void>();

  readonly visible = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show']?.currentValue === true) {
      this.visible.set(true);
      this.timer = setTimeout(() => this.dismiss(), 2800);
    }
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.visible.set(false);
    this.hidden.emit();
  }
}
