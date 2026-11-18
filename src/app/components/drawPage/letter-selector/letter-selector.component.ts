import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

/**
 * Carrete de letras: la actual en grande, la anterior y la siguiente a los
 * lados, y flechas para avanzar. Reemplaza al menú desplegable, difícil de
 * usar para un niño. Da la vuelta: después de la Z viene la A.
 */
@Component({
  selector: 'letter-selector',
  standalone: true,
  templateUrl: './letter-selector.component.html',
  styleUrls: ['./letter-selector.component.scss'],
})
export class LetterSelectorComponent {
  readonly alphabet: string[] = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

  private indice = signal(0);

  @Input() set letra(valor: string) {
    const i = this.alphabet.indexOf(valor.toUpperCase());
    if (i >= 0) this.indice.set(i);
  }

  @Output() letterSelected = new EventEmitter<string>();

  actual = computed(() => this.alphabet[this.indice()]);
  anterior = computed(() => this.alphabet[this.mover(-1)]);
  siguiente = computed(() => this.alphabet[this.mover(1)]);

  cambiar(paso: 1 | -1) {
    this.indice.set(this.mover(paso));
    this.letterSelected.emit(this.actual());
  }

  private mover(paso: number): number {
    const n = this.alphabet.length;
    return (this.indice() + paso + n) % n;
  }
}
