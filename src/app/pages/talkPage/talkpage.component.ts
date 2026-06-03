import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VocalSelectorComponent } from '../../components/talkPage/vocal-selector/vocal-selector.component';
import { PracticeButtonComponent } from '../../components/talkPage/practice-button/practice-button.component';
import { ResultFeedbackComponent } from '../../components/talkPage/result-feedback/result-feedback.component';
import { MascotHeaderComponent } from '../../components/talkPage/mascot-header/mascot-header.component';

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
  ],
  templateUrl: './talkpage.component.html',
  styleUrl: './talkpage.component.scss',
})
export class TalkPageComponent {
  /** Vocal actualmente seleccionada por el niño */
  selectedVocal = signal<VocalLetter | null>(null);

  /** Estado global de la práctica */
  practiceState = signal<PracticeState>('idle');

  // ─── Handlers (se conectarán al servicio de audio en la siguiente fase) ───

  onVocalSelected(vocal: VocalLetter): void {
    this.selectedVocal.set(vocal);
    this.practiceState.set('idle');
  }

  onPracticeStart(): void {
    if (!this.selectedVocal()) return;
    this.practiceState.set('listening');
    // TODO: llamar SpeechRecognitionService.startListening(this.selectedVocal())
  }

  onAudioResult(success: boolean): void {
    this.practiceState.set(success ? 'success' : 'failure');
  }

  onRetry(): void {
    this.practiceState.set('idle');
  }
}
