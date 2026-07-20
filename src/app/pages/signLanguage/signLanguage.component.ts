import { Component, signal } from '@angular/core'; // Importar signal
import { CommonModule } from '@angular/common';
import { HandTrackerComponent } from '../../components/signLanguage/hand-tracker/hand-tracker.component';
import { SignLanguageService } from '../../services/signLanguage.service';
import { BackButtonComponent } from '../../components/shared/back-button/back-button.component';

@Component({
  selector: 'sign-page',
  standalone: true,
  imports: [CommonModule, HandTrackerComponent, BackButtonComponent],
  templateUrl: './signLanguage.component.html',
  styleUrls: ['./signLanguage.component.scss']
  
})
export class SignLanguageComponent {
  
  // Signal local para controlar la intención del usuario
  isPracticeActive = signal<boolean>(false);

  constructor(public signService: SignLanguageService) {}

  togglePractice() {
    // Invertimos el valor actual
    this.isPracticeActive.update(value => !value);
  }
}
