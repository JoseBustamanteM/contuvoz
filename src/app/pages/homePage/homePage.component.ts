import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OptionComponent } from "../../components/homePage/option/option.component";
import { BackButtonComponent } from '../../components/shared/back-button/back-button.component';
import { LogoutButtonComponent } from '../../components/logout-button/logout-button.component';
import { AuthService } from '../../services/auth.service';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'homePage',
  imports: [OptionComponent, LogoutButtonComponent, RouterLink,],
  templateUrl: './homePage.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {

  constructor(private auth: AuthService) {
  console.log('¿Logueado?', this.auth.isLoggedIn());
}


private authService = inject(AuthService);
  usuario = this.authService.usuario;

  ngOnInit() {
    this.authService.cargarUsuario().subscribe();
  }
}
