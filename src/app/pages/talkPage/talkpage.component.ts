import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VocalSelectorComponent } from '../../components/talkPage/vocal-selector/vocal-selector.component';
import { PracticeButtonComponent } from '../../components/talkPage/practice-button/practice-button.component';
import { ResultFeedbackComponent } from '../../components/talkPage/result-feedback/result-feedback.component';
import { MascotHeaderComponent } from '../../components/talkPage/mascot-header/mascot-header.component';
import { WaveformVisualizerComponent } from '../../components/talkPage/waveform-visualizer/waveform-visualizer.component';
import { BackButtonComponent } from '../../components/shared/back-button/back-button.component';
import { VowelDetectorService } from '../../services/vowel-detector.service';

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
  ],
  templateUrl: './talkpage.component.html',
  styleUrl: './talkpage.component.scss',
})
export class TalkPageComponent {
  private detector = inject(VowelDetectorService);

  selectedVocal = signal<VocalLetter | null>(null);
  detectedVocal = signal<VocalLetter | null>(null);
  practiceState = signal<PracticeState>('idle');

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
    try {
      const result = await this.detector.listen(vocal, 2000);
      this.detectedVocal.set(result.detected as VocalLetter | null);
      this.practiceState.set(result.success ? 'success' : 'failure');
    } catch {
      this.practiceState.set('failure');
    }
  }

  onRetry(): void {
    this.practiceState.set('idle');
  }
}