import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VocalSelectorComponent } from '../../components/talkPage/vocal-selector/vocal-selector.component';
import { PracticeButtonComponent } from '../../components/talkPage/practice-button/practice-button.component';
import { ResultFeedbackComponent } from '../../components/talkPage/result-feedback/result-feedback.component';
import { MascotHeaderComponent } from '../../components/talkPage/mascot-header/mascot-header.component';
import { WaveformVisualizerComponent } from '../../components/talkPage/waveform-visualizer/waveform-visualizer.component';
import { BackButtonComponent } from '../../components/shared/back-button/back-button.component';
import { AvisoModoPracticaComponent } from '../../components/shared/aviso-modo-practica/aviso-modo-practica.component';
import { VowelDetectorService } from '../../services/vowel-detector.service';
import { ActividadesService } from '../../services/actividades.service';

export type VocalLetter = 'A' | 'E' | 'I' | 'O' | 'U';
export type PracticeState = 'idle' | 'listening' | 'success' | 'failure';

@Component({
  selector: 'app-talk-page',
  standalone: true,
  imports: [
    CommonModule,
    VocalSelectorComponent,
    PracticeButtonComponent,
    ResultFeedbackComponent,
    MascotHeaderComponent,
    WaveformVisualizerComponent,
    BackButtonComponent,
    AvisoModoPracticaComponent,
  ],
  templateUrl: './talkpage.component.html',
  styleUrl: './talkpage.component.scss',
})
export class TalkPageComponent {
  private detector = inject(VowelDetectorService);
  private actividadesService = inject(ActividadesService);

  selectedVocal = signal<VocalLetter | null>(null);
  detectedVocal = signal<VocalLetter | null>(null);
  practiceState = signal<PracticeState>('idle');
  guardando = signal(false);
  errorGuardado = signal(false);


  onVocalSelected(vocal: VocalLetter): void {
    this.selectedVocal.set(vocal);
    this.practiceState.set('idle');
    this.detectedVocal.set(null);
  }

  async onPracticeStart(): Promise<void> {
    const vocal = this.selectedVocal();
    if (!vocal) return;

    this.practiceState.set('listening');
    this.detectedVocal.set(null);
    this.errorGuardado.set(false);

    try {
      const result = await this.detector.listen(vocal, 2000);
      this.detectedVocal.set(result.detected as VocalLetter | null);
      this.practiceState.set(result.success ? 'success' : 'failure');

      // El intento se guarda SIEMPRE, acierte o no: un fallo es un dato
      // pedagógico tan válido como un acierto (con qué vocal se confunde).
      this.guardarIntento(vocal, result.detected, result.confidence);
    } catch {
      // Permiso de micrófono denegado: no hay intento que guardar.
      this.practiceState.set('failure');
    }
  }

  private guardarIntento(
    esperada: VocalLetter,
    detectada: VocalLetter | null,
    confianza: number,
  ): void {
    // Modo práctica: el backend respondería 403 para este rol.
    if (!this.actividadesService.puedeGuardarProgreso()) return;

    this.guardando.set(true);

    this.actividadesService
      .guardarPronunciacion({
        textoEsperado: esperada,
        // La columna es NOT NULL: cuando no hubo voz suficiente se guarda
        // 'NINGUNA', igual que en señas. Distingue "se equivocó de vocal"
        // de "no llegó a hablar", que son cosas distintas para la profesora.
        textoDetectado: detectada ?? 'NINGUNA',
        // El detector devuelve 0..1 y la columna espera 0..100.
        porcConfianza: Math.round(confianza * 100),
      })
      .subscribe({
        next: () => this.guardando.set(false),
        error: () => {
          this.guardando.set(false);
          this.errorGuardado.set(true);
        },
      });
  }


  onRetry(): void {
    this.practiceState.set('idle');
  }
}
