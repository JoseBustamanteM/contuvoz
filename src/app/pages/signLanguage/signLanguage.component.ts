import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HandTrackerComponent } from '../../components/signLanguage/hand-tracker/hand-tracker.component';
import { BackButtonComponent } from '../../components/shared/back-button/back-button.component';
import { ActividadesService } from '../../services/actividades.service';
import { ResultadoSign, ResultadoSignGuardado } from '../../interfaces/sign-language.interface';

@Component({
  selector: 'sign-page',
  standalone: true,
  imports: [CommonModule, HandTrackerComponent, BackButtonComponent],
  templateUrl: './signLanguage.component.html',
  styleUrls: ['./signLanguage.component.scss'],
})
export class SignLanguageComponent {
  private actividadesService = inject(ActividadesService);

  evaluacionActiva = signal(false);
  resumen = signal<ResultadoSignGuardado[]>([]);
  errorGuardado = signal(false);

  iniciarEvaluacion() {
    this.resumen.set([]);
    this.errorGuardado.set(false);
    this.evaluacionActiva.set(true);
  }

  onResultadoListo(resultado: ResultadoSign) {
    this.actividadesService.guardarSign(resultado).subscribe({
      next: (guardado) => this.resumen.update((r) => [...r, guardado]),
      error: () => this.errorGuardado.set(true),
    });
  }

  onTestTerminado() {
    // Se deja la cámara encendida un momento para mostrar el resumen final;
    // al volver a "Iniciar evaluación" se desmonta y se reinicia todo.
  }

  volverAIntentar() {
    this.evaluacionActiva.set(false);
  }
}
