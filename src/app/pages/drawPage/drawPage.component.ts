import { Component } from '@angular/core';
import { LetterSelectorComponent } from '../../components/drawPage/letter-selector/letter-selector.component';
import { LetterTracerComponent } from '../../components/drawPage/letter-tracer/letter-tracer.component';
import { BackButtonComponent } from '../../components/shared/back-button/back-button.component';

@Component({
  selector: 'app-draw-page',
  standalone: true,
  imports: [LetterTracerComponent, LetterSelectorComponent, BackButtonComponent],
  templateUrl: './drawPage.component.html',
  styleUrls: ['./drawPage.component.scss'],
})
export class DrawPageComponent {
  currentLetter: string = 'A';
}