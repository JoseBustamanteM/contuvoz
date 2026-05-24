import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'letter-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './letter-selector.component.html',
  styleUrls: ['./letter-selector.component.scss']
})
export class LetterSelectorComponent {
  // Generamos el abecedario automáticamente
  alphabet: string[] = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

  @Output() letterSelected = new EventEmitter<string>();

  onChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.letterSelected.emit(value);
  }
}
