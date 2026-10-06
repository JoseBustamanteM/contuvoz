import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BarraSuperiorComponent } from './components/barra-superior/barra-superior.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BarraSuperiorComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
