import { Component, inject, computed, signal, OnDestroy } from '@angular/core';
import { HandTrackerService } from '../../../services/hand-tracker.service';
import { CameraFeedComponent } from '../../../components/signLanguage/hand-tracker-claude/camera-feed/camera-feed.component';
import { HandCanvasComponent } from '../../../components/signLanguage/hand-tracker-claude/hand-canvas/hand-canvas.component';
import { LetterDisplayComponent } from '../../../components/signLanguage/hand-tracker-claude/letter-display/letter-display.component';
import { SignReferenceComponent } from '../../../components/signLanguage/hand-tracker-claude/sign-reference/sign-reference.component';
import { LandmarkDebugComponent } from '../../../components/signLanguage/hand-tracker-claude/landmark-debug/landmark-debug.component';
import { GeckoCelebrationComponent } from '../../../animations/gecko-celebration/gecko-celebration.component';
import { LschLetter } from '../../../types/hand-tracking.types';


const ALPHABET: LschLetter[] = [
  'A','B','C','D','E','F','G','H','I','J','K','L',
  'M','N','Ñ','O','P','Q','R','S','T','U',
  'V','W','X','Y','Z',
];

const HOLD_FRAMES = 18;
const CHECK_INTERVAL_MS = 100; // cada 100ms revisamos la letra detectada

@Component({
  selector: 'app-hand-tracker-page',
  standalone: true,
 imports: [
  CameraFeedComponent,
  HandCanvasComponent,
  LetterDisplayComponent,
  LandmarkDebugComponent,
  GeckoCelebrationComponent,
  SignReferenceComponent,
],
  templateUrl: './hand-tracker-claude.page.html',
  styleUrl: './hand-tracker-claude.page.scss',
})
export class HandTrackerClaudePage implements OnDestroy {
  readonly tracker = inject(HandTrackerService);

  readonly alphabet       = ALPHABET;
  readonly selectedLetter = signal<LschLetter | null>(null);
  readonly showGecko      = signal(false);
  readonly celebrating    = signal(false);
  readonly holdCount      = signal(0);

  readonly hasError    = computed(() => this.tracker.status() === 'error');
  readonly errorMsg    = computed(() => this.tracker.error());
  readonly progressPct = computed(() => Math.round((this.holdCount() / HOLD_FRAMES) * 100));

  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.intervalId = setInterval(() => this.checkLetter(), CHECK_INTERVAL_MS);
  }

  private checkLetter(): void {
    const detected = this.tracker.letter();
    const selected = this.selectedLetter();

    if (!selected || this.celebrating()) return;
    if (!detected || detected === 'UNKNOWN') return;

    if (detected === selected) {
      const next = this.holdCount() + 1;
      this.holdCount.set(next);
      if (next >= HOLD_FRAMES) {
        this.triggerCelebration();
      }
    } else {
      this.holdCount.set(0);
    }
  }

  selectLetter(letter: LschLetter): void {
    if (this.celebrating()) return;
    this.selectedLetter.set(letter);
    this.holdCount.set(0);
  }

  onGeckoHidden(): void {
    this.celebrating.set(false);
    this.showGecko.set(false);
    this.holdCount.set(0);
  }

  private triggerCelebration(): void {
    this.holdCount.set(0);
    this.celebrating.set(true);
    this.showGecko.set(true);
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
