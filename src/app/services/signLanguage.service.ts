import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HandTrackerComponent } from '../../components/signLanguage/hand-tracker/hand-tracker.component';
import { BackButtonComponent } from '../../components/shared/back-button/back-button.component';
import { SignLanguageService } from '../../services/signLanguage.service';

@Component({
  selector: 'sign-page',
  standalone: true,
  imports: [CommonModule, HandTrackerComponent, BackButtonComponent],
  templateUrl: './signLanguage.component.html',
  styleUrls: ['./signLanguage.component.scss'],
})
export class SignLanguageComponent {
  isPracticeActive = signal<boolean>(false);

  constructor(public signService: SignLanguageService) {}

  togglePractice() {
    this.isPracticeActive.update((value) => !value);
  }
}