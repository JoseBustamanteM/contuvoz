import { Component, ElementRef, ViewChild, AfterViewInit, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'letter-tracer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './letter-tracer.component.html',
  styleUrls: ['./letter-tracer.component.scss'],
})
export class LetterTracerComponent implements AfterViewInit {
  @ViewChild('bgCanvas') bgCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('drawCanvas') drawCanvasRef!: ElementRef<HTMLCanvasElement>;

  private bgCtx!: CanvasRenderingContext2D;
  private drawCtx!: CanvasRenderingContext2D;

  private canvasSize = 500;

  private _currentLetter = 'A';
  private isDrawing = false;
  private isViewInitialized = false;

  public resultMessage = signal<string>('');
  public resultColor = signal<string>('black');

  @Input()
  set letter(value: string) {
    this._currentLetter = value;
    if (this.isViewInitialized) {
      this.resetCanvas();
    }
  }

  ngAfterViewInit(): void {
    this.setupCanvases();
    this.isViewInitialized = true;
    this.drawGuideLetter();
  }

  private setupCanvases() {
    const bgCanvas = this.bgCanvasRef.nativeElement;
    const drawCanvas = this.drawCanvasRef.nativeElement;

    bgCanvas.width = this.canvasSize;
    bgCanvas.height = this.canvasSize;
    drawCanvas.width = this.canvasSize;
    drawCanvas.height = this.canvasSize;

    this.bgCtx = bgCanvas.getContext('2d', { willReadFrequently: true })!;
    this.drawCtx = drawCanvas.getContext('2d', { willReadFrequently: true })!;

    this.drawCtx.lineWidth = 20;
    this.drawCtx.lineCap = 'round';
    this.drawCtx.lineJoin = 'round';
    this.drawCtx.strokeStyle = 'rgba(0, 0, 255, 0.6)';
  }

  private drawGuideLetter() {
    const fontName = 'Playwrite CU';
    const fontSize = '220px';
    const letterToDraw = this._currentLetter.toLowerCase();

    document.fonts.load(`${fontSize} "${fontName}"`).then(() => {
      this.bgCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);
      this.bgCtx.fillStyle = '#e0e0ff';
      this.bgCtx.strokeStyle = '#e0e0ff';
      this.bgCtx.lineWidth = 5;
      this.bgCtx.textAlign = 'center';
      this.bgCtx.textBaseline = 'middle';
      this.bgCtx.font = `${fontSize} "${fontName}"`;

      const x = this.canvasSize / 2;
      const y = this.canvasSize / 2 - 30;

      this.bgCtx.fillText(letterToDraw, x, y);
      this.bgCtx.strokeText(letterToDraw, x, y);
    });
  }

  private resetCanvas() {
    this.clear();
    this.bgCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);
    this.drawGuideLetter();
  }

  startDrawing(event: MouseEvent | TouchEvent) {
    this.isDrawing = true;
    const { x, y } = this.getCoordinates(event);
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(x, y);
  }

  draw(event: MouseEvent | TouchEvent) {
    if (!this.isDrawing) return;
    event.preventDefault();
    const { x, y } = this.getCoordinates(event);
    this.drawCtx.lineTo(x, y);
    this.drawCtx.stroke();
  }

  stopDrawing() {
    this.isDrawing = false;
    this.drawCtx.closePath();
  }

  // 👇 Escala las coordenadas: el canvas mide 500px pero en pantalla se ve más chico.
  private getCoordinates(event: MouseEvent | TouchEvent) {
    const canvas = this.drawCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    let clientX: number, clientY: number;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  verify() {
    const bgData = this.bgCtx.getImageData(0, 0, this.canvasSize, this.canvasSize).data;
    const drawData = this.drawCtx.getImageData(0, 0, this.canvasSize, this.canvasSize).data;

    let targetPixels = 0;
    let coveredPixels = 0;
    let outsidePixels = 0;

    for (let i = 0; i < bgData.length; i += 4) {
      const isLetter = bgData[i + 3] > 50;
      const isPainted = drawData[i + 3] > 50;

      if (isLetter) {
        targetPixels++;
        if (isPainted) coveredPixels++;
      } else if (isPainted) {
        outsidePixels++;
      }
    }

    if (targetPixels === 0) return;

    const coveragePercent = (coveredPixels / targetPixels) * 100;
    const penaltyPercent = (outsidePixels / targetPixels) * 100;
    let finalScore = coveragePercent - penaltyPercent * 0.75;
    if (finalScore < 0) finalScore = 0;

    this.showResult(finalScore);
  }

  private showResult(score: number) {
    let status = '';
    let color = '';

    if (score > 90) { status = '¡Perfecto!'; color = '#27ae60'; }
    else if (score > 80) { status = '¡Muy bien!'; color = '#2ecc71'; }
    else if (score > 40) { status = 'Ten cuidado con los bordes.'; color = '#f39c12'; }
    else { status = 'Inténtalo de nuevo, concéntrate en la letra.'; color = '#e74c3c'; }

    this.resultMessage.set(status);
    this.resultColor.set(color);
  }

  clear() {
    if (this.drawCtx) {
      this.drawCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);
      this.resultMessage.set('');
    }
  }
}