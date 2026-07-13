import { ChangeDetectionStrategy, Component } from '@angular/core';
import { OptionComponent } from "../../components/homePage/option/option.component";
import { BackButtonComponent } from '../../components/shared/back-button/back-button.component';  
@Component({
  selector: 'homePage',
  imports: [OptionComponent],
  templateUrl: './homePage.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent { }
