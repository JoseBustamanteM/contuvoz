import { Component, input } from '@angular/core';
import { LschLetter } from '../../../../types/hand-tracking.types';

@Component({
  selector: 'app-sign-reference',
  standalone: true,
  templateUrl: 'sign-reference.component.html',
  styleUrl: './sign-reference.component.scss',
})
export class SignReferenceComponent {
  readonly letter = input.required<LschLetter>();
}
