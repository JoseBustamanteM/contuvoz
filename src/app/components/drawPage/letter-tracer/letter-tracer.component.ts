import {
  Component, ElementRef, ViewChild, AfterViewInit,
  signal, Input, Output, EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResultadoPintado } from '../../../interfaces/actividad.interface';

const UMBRAL_GUARDADO = 50;

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

  @Output() resultadoListo = new EventEmitter<ResultadoPintado>();

  private bgCtx!: CanvasRenderingContext2D;
  private drawCtx!: CanvasRenderingContext2D;

  private canvasSize = 700;
  private _currentLetter = 'A';
  private isDrawing = false;
  private isViewInitialized = false;

  private inicioTrazado: number | null = null;

  public resultMessage = signal<string>('');
  public resultColor = signal<string>('black');
  public tieneTrazo = signal<boolean>(false);

  @Input()
  set letter(value: string) {
    this._currentLetter = value;
    if (this.isViewInitialized) this.resetCanvas();
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

    this.drawCtx.lineWidth = 28;
    this.drawCtx.lineCap = 'round';
    this.drawCtx.lineJoin = 'round';
    this.drawCtx.strokeStyle = 'rgba(0, 0, 255, 0.6)';
  }

  private drawGuideLetter() {
    const fontName = 'Playwrite CU';
    const fontSize = '310px';
    const letterToDraw = this._currentLetter.toLowerCase();

    document.fonts
      .load(`${fontSize} "${fontName}"`)
      .then(() => this.pintarGuia(letterToDraw, fontSize, fontName))
      .catch(() => this.pintarGuia(letterToDraw, fontSize, 'sans-serif'));
  }

  private pintarGuia(letra: string, fontSize: string, fontName: string) {
    this.bgCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);
    this.bgCtx.fillStyle = '#e0e0ff';
    this.bgCtx.strokeStyle = '#e0e0ff';
    this.bgCtx.lineWidth = 5;
    this.bgCtx.textAlign = 'center';
    this.bgCtx.textBaseline = 'middle';
    this.bgCtx.font = `${fontSize} "${fontName}"`;

    const x = this.canvasSize / 2;
    const y = this.canvasSize / 2 - 30;

    this.bgCtx.fillText(letra, x, y);
    this.bgCtx.strokeText(letra, x, y);
    this.bgCtx.font = `${fontSize} "${fontName}"`;
console.log('Font aplicado:', this.bgCtx.font);
  }



  private resetCanvas() {
    this.clear();
    this.bgCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);
    this.drawGuideLetter();
  }

  startDrawing(event: MouseEvent | TouchEvent) {
    // El cronómetro parte con el primer trazo, no al abrir la página
    if (this.inicioTrazado === null) this.inicioTrazado = Date.now();

    this.isDrawing = true;
    this.tieneTrazo.set(true);

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

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  verify() {
    if (!this.tieneTrazo()) return;

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

    if (targetPixels === 0) {
      this.resultMessage.set('No se pudo cargar la letra, recarga la página');
      this.resultColor.set('#e74c3c');
      return;
    }

    const totalPintado = coveredPixels + outsidePixels;

    // Cuánto de la letra alcanzó a cubrir
    const areaCompletada = (coveredPixels / targetPixels) * 100;

    // De todo lo que pintó, cuánto cayó dentro y cuánto fuera (suman 100)
    const trazoInterno = totalPintado > 0 ? (coveredPixels / totalPintado) * 100 : 0;
    const trazoExterno = totalPintado > 0 ? (outsidePixels / totalPintado) * 100 : 0;

    // Puntaje con penalización (fórmula original)
    const penaltyPercent = (outsidePixels / targetPixels) * 100;
    const puntajeFinal = Math.max(0, Math.min(100, areaCompletada - penaltyPercent * 0.75));

    const duracionPintado = this.inicioTrazado
      ? Math.round((Date.now() - this.inicioTrazado) / 1000)
      : 0;

    this.showResult(puntajeFinal);

    if (areaCompletada >= UMBRAL_GUARDADO) {
      this.resultadoListo.emit({
        letraEsperada: this._currentLetter,
        trazoInterno: this.redondear(trazoInterno),
        trazoExterno: this.redondear(trazoExterno),
        areaCompletada: this.redondear(areaCompletada),
        puntajeFinal: this.redondear(puntajeFinal),
        duracionPintado,
      });

      // Se guardó: dejamos el lienzo limpio para el próximo intento,
      // pero mantenemos el mensaje de resultado a la vista
      this.limpiarTrazo();
    }
  }

  private redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
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

  /** Borra el trazo y reinicia el cronómetro, sin tocar el mensaje */
  private limpiarTrazo() {
    if (!this.drawCtx) return;
    this.drawCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);
    this.tieneTrazo.set(false);
    this.inicioTrazado = null;
  }

  /** Botón "Borrar": limpia todo, incluido el mensaje */
  clear() {
    this.limpiarTrazo();
    this.resultMessage.set('');
  }
}
