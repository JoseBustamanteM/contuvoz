import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LogoutButtonComponent } from "./components/logout-button/logout-button.component";
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LogoutButtonComponent, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('contuvoz');
  private authService = inject(AuthService);
  usuario = this.authService.usuario;


}
