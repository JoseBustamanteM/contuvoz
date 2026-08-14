import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OptionComponent } from "../../components/homePage/option/option.component";
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'homePage',
  imports: [OptionComponent,],
  templateUrl: './homePage.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {

  constructor(private auth: AuthService) {
  console.log('¿Logueado?', this.auth.isLoggedIn());
}



}
