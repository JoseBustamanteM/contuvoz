import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a routerLink="/" class="back-btn" aria-label="Volver al inicio">
      <span aria-hidden="true">🏠</span>
      <span class="back-btn__text">Inicio</span>
    </a>
  `,
  styleUrl: './back-button.component.scss',
})
export class BackButtonComponent {}