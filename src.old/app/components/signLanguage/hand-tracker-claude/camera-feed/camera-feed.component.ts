import {
  Component, ElementRef, ViewChild, OnInit, OnDestroy,
  inject, output, input
} from '@angular/core';
import { HandTrackerService } from '../../../../services/hand-tracker.service'
import { CameraConfig } from '../../../../interfaces/hand-tracking.interface';

@Component({
  selector: 'app-camera-feed',
  standalone: true,
  template: `
    <div class="camera-feed">
      <video
        #videoRef
        class="camera-feed__video"
        playsinline
        muted
        autoplay
        [class.camera-feed__video--mirrored]="mirrored()"
      ></video>

      @if (!tracker.isActive()) {
        <div class="camera-feed__placeholder">
          <div class="camera-feed__placeholder-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/>
            </svg>
          </div>
          <span>Cámara inactiva</span>
        </div>
      }
    </div>
  `,
  styleUrl: './camera-feed.component.scss',
})
export class CameraFeedComponent implements OnInit, OnDestroy {
  readonly tracker = inject(HandTrackerService);

  readonly mirrored = input<boolean>(true);
  readonly config   = input<CameraConfig>({ width: 640, height: 480, facingMode: 'user' });

  readonly videoReady = output<HTMLVideoElement>();

  @ViewChild('videoRef', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;

  async ngOnInit(): Promise<void> {
    const video = this.videoRef.nativeElement;
    await this.tracker.startCamera(video, this.config());
    this.videoReady.emit(video);
  }

  ngOnDestroy(): void {
    this.tracker.stopCamera();
  }
}
