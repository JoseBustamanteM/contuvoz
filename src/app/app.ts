import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BarraSuperiorComponent } from './components/barra-superior/barra-superior.component';
import { AuthService } from './services/auth.service';
import { PrecargaService } from './services/precarga.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BarraSuperiorComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private authService = inject(AuthService);
  private precarga = inject(PrecargaService);

  constructor() {
    // Apenas hay sesión (login o sesión restaurada), se prepara en segundo plano
    // lo pesado de las actividades. Corre una sola vez por sesión del navegador.
    effect(() => {
      if (this.authService.usuario()) this.precarga.iniciar();
    });
  }
}
