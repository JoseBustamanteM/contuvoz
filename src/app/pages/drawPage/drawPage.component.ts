import { Component, inject, signal } from '@angular/core';
import { LetterSelectorComponent } from '../../components/drawPage/letter-selector/letter-selector.component';
import { LetterTracerComponent } from '../../components/drawPage/letter-tracer/letter-tracer.component';
import { AvisoModoPracticaComponent } from '../../components/shared/aviso-modo-practica/aviso-modo-practica.component';
import { ActividadesService } from '../../services/actividades.service';
import { ResultadoPintado } from '../../interfaces/actividad.interface';

/** Mismo umbral que UMBRAL_APROBADO en el backend (actividades.service.ts). */
const UMBRAL_APROBADO = 80;

@Component({
  selector: 'app-draw-page',
  standalone: true,
  imports: [
    LetterTracerComponent,
    LetterSelectorComponent,
    AvisoModoPracticaComponent,
  ],
  templateUrl: './drawPage.component.html',
  styleUrls: ['./drawPage.component.scss'],
})
export class DrawPageComponent {
  private actividadesService = inject(ActividadesService);

  currentLetter: string = 'A';
  estadoGuardado = signal<'idle' | 'guardando' | 'ok' | 'error'>('idle');
  ultimoResultado = signal<(ResultadoPintado & { aprobadoPintado: boolean }) | null>(null);

  // Guardamos el payload que falló, para poder reintentar sin perder el dato
  private pendienteDeGuardar: ResultadoPintado | null = null;

  onResultadoListo(resultado: ResultadoPintado) {
    // Modo práctica: el backend respondería 403, así que se muestra el resultado
    // calculado localmente y no se intenta guardar.
    if (!this.actividadesService.puedeGuardarProgreso()) {
      this.ultimoResultado.set({
        ...resultado,
        aprobadoPintado: resultado.puntajeFinal >= UMBRAL_APROBADO,
      });
      return;
    }

    this.pendienteDeGuardar = resultado;
    this.intentarGuardar(resultado);
  }

  reintentarManualmente() {
    if (this.pendienteDeGuardar) {
      this.intentarGuardar(this.pendienteDeGuardar);
    }
  }

  private intentarGuardar(resultado: ResultadoPintado) {
    this.estadoGuardado.set('guardando');
    this.ultimoResultado.set(null);

    this.actividadesService.guardarPintado(resultado).subscribe({
      next: (guardado) => {
        this.estadoGuardado.set('ok');
        this.ultimoResultado.set(guardado);
        this.pendienteDeGuardar = null;   // ya se guardó, no hace falta reintentar más
        setTimeout(() => this.estadoGuardado.set('idle'), 3000);
      },
      error: (err) => {
        console.error('Error al guardar la actividad:', err);
        this.estadoGuardado.set('error');
        // pendienteDeGuardar se mantiene: el botón de reintento manual puede usarlo
      },
    });
  }

  onLetraCambiada(letra: string) {
    this.currentLetter = letra;
    this.ultimoResultado.set(null);
    this.pendienteDeGuardar = null;   // si cambia de letra, ya no tiene sentido reintentar la anterior
  }
}
