import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ImageItem } from '../../../interfaces/option.interface';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'option-component',
  imports: [RouterLink],
  templateUrl: './option.component.html',
  host: { class: 'block w-full h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionComponent {
  images: ImageItem[] = [
    { id: 1, name: 'Pinta Letras', img: 'images/gecko dibujando.png',  alt: 'Gecko con pincel',   icon: '🎨', url: '/drawPage' },
    { id: 2, name: 'Comunícate',   img: 'images/gecko comunicate.png', alt: 'Gecko saludando',    icon: '✋', url: '/signPage' },
    { id: 3, name: 'Hablemos',     img: 'images/gecko-hablemos.png',   alt: 'Gecko saludando',    icon: '👨‍🏫', url: '/talkPage' },
    { id: 4, name: 'Biblioteca',   img: 'images/gecko biblioteca.png', alt: 'Gecko con libros',   icon: '📚' },
    { id: 5, name: 'Mi progreso',  img: 'images/gecko logistico.png',  alt: 'Gecko con gráficas', icon: '📐', url: 'dashboard-page' },
  ];
}