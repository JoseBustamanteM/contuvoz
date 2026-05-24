import { Component } from '@angular/core';
import { LetterSelectorComponent} from "../../components/drawPage/letter-selector/letter-selector.component";
import { LetterTracerComponent} from "../../components/drawPage/letter-tracer/letter-tracer.component";


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LetterTracerComponent, LetterSelectorComponent],
  templateUrl: './drawPage.component.html',
  styleUrls: ['./drawPage.component.scss']
})
export class DrawPageComponent {
  // Letra seleccionada por defecto
  currentLetter: string = 'A';
}
