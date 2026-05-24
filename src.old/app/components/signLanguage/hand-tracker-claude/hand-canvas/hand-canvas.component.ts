import {
  Component, ElementRef, ViewChild, OnInit, OnDestroy,
  inject, effect, input
} from '@angular/core';
import { HandTrackerService } from '../../../../services/hand-tracker.service';
import { HandData, Landmark } from '../../../../interfaces/hand-tracking.interface';

const CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],         // thumb
  [0,5],[5,6],[6,7],[7,8],         // index
  [0,9],[9,10],[10,11],[11,12],    // middle
  [0,13],[13,14],[14,15],[15,16],  // ring
  [0,17],[17,18],[18,19],[19,20],  // pinky
  [5,9],[9,13],[13,17],            // palm
];

const FINGER_COLORS = ['#38bdf8','#34d399','#a78bfa','#fb923c','#f472b6'];

@Component({
  selector: 'app-hand-canvas',
  standalone: true,
  template: `
    <canvas
      #canvasRef
      class="hand-canvas"
      [width]="width()"
      [height]="height()"
    ></canvas>
  `,
  styleUrl: './hand-canvas.component.scss',
})
export class HandCanvasComponent implements OnInit, OnDestroy {
  readonly tracker = inject(HandTrackerService);

  readonly width  = input<number>(640);
  readonly height = input<number>(480);

  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private animId: number | null = null;

  constructor() {
    // React to new detection results
    effect(() => {
      const result = this.tracker.result();
      if (result) this.draw(result.hands);
      else this.clear();
    });
  }

  ngOnInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
  }

  ngOnDestroy(): void {
    if (this.animId) cancelAnimationFrame(this.animId);
  }

  // ─── Drawing ────────────────────────────────────────────────────────────

  private clear(): void {
    this.ctx.clearRect(0, 0, this.width(), this.height());
  }

  private draw(hands: HandData[]): void {
    this.clear();
    for (const hand of hands) {
      this.drawConnections(hand.landmarks);
      this.drawLandmarks(hand.landmarks);
    }
  }

  private lmToCanvas(lm: Landmark): { x: number; y: number } {
    // MediaPipe returns normalized coords; mirror X since video is mirrored
    return {
      x: (1 - lm.x) * this.width(),
      y: lm.y * this.height(),
    };
  }

  private drawConnections(landmarks: Landmark[]): void {
    const ctx = this.ctx;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';

    for (const [a, b] of CONNECTIONS) {
      const from = this.lmToCanvas(landmarks[a]);
      const to   = this.lmToCanvas(landmarks[b]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
  }

  private drawLandmarks(landmarks: Landmark[]): void {
    const ctx = this.ctx;
    const fingerGroups = [
      [1,2,3,4],    // thumb
      [5,6,7,8],    // index
      [9,10,11,12], // middle
      [13,14,15,16],// ring
      [17,18,19,20],// pinky
    ];

    // Wrist
    const wrist = this.lmToCanvas(landmarks[0]);
    ctx.beginPath();
    ctx.arc(wrist.x, wrist.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Fingers
    fingerGroups.forEach((group, fi) => {
      for (const idx of group) {
        const isTip = [4, 8, 12, 16, 20].includes(idx);
        const pos   = this.lmToCanvas(landmarks[idx]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isTip ? 7 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isTip ? FINGER_COLORS[fi] : 'rgba(255,255,255,0.7)';
        ctx.fill();

        if (isTip) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
          ctx.strokeStyle = FINGER_COLORS[fi] + '66';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    });
  }
}
