import {
  Component, ElementRef, ViewChild, AfterViewInit,
  signal, Input, Output, EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResultadoPintado } from '../../../interfaces/actividad.interface';

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
  /**
   * La letra con que se evalúa, en un lienzo que no se ve. Es exactamente la
   * que antes se dibujaba a la vista (relleno + borde de 5 px), así el
   * puntaje no cambia con el diseño de pizarra: lo que se ve es solo tiza.
   */
  private mascaraCtx!: CanvasRenderingContext2D;

  private canvasSize = 700;
  private _currentLetter = 'A';
  private isDrawing = false;
  private isViewInitialized = false;

  private inicioTrazado: number | null = null;

  public resultMessage = signal<string>('');
  public resultColor = signal<string>('#f4f7ef');
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
    // Tiza amarilla: se distingue de la letra guía (blanca) sobre la pizarra.
    this.drawCtx.strokeStyle = 'rgba(255, 221, 87, 0.92)';

    const mascara = document.createElement('canvas');
    mascara.width = this.canvasSize;
    mascara.height = this.canvasSize;
    this.mascaraCtx = mascara.getContext('2d', { willReadFrequently: true })!;
  }

  private drawGuideLetter() {
    // Nombre con que la declara @fontsource-variable/playwrite-cu (angular.json).
    const fontName = 'Playwrite CU Variable';
    const fontSize = '310px';
    const letterToDraw = this._currentLetter.toLowerCase();

    document.fonts
      .load(`${fontSize} "${fontName}"`)
      .then(() => this.pintarGuia(letterToDraw, fontSize, fontName))
      .catch(() => this.pintarGuia(letterToDraw, fontSize, 'sans-serif'));
  }

  private pintarGuia(letra: string, fontSize: string, fontName: string) {
    const x = this.canvasSize / 2;
    const y = this.canvasSize / 2 - 30;
    const fuente = `${fontSize} "${fontName}"`;

    // Máscara para evaluar: igual que siempre.
    const m = this.mascaraCtx;
    m.clearRect(0, 0, this.canvasSize, this.canvasSize);
    m.fillStyle = '#e0e0ff';
    m.strokeStyle = '#e0e0ff';
    m.lineWidth = 5;
    m.textAlign = 'center';
    m.textBaseline = 'middle';
    m.font = fuente;
    m.fillText(letra, x, y);
    m.strokeText(letra, x, y);

    // Lo que se ve: la letra en tiza, con relleno tenue y borde punteado.
    const g = this.bgCtx;
    g.clearRect(0, 0, this.canvasSize, this.canvasSize);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = fuente;
    g.fillStyle = 'rgba(255, 255, 255, 0.16)';
    g.fillText(letra, x, y);
    g.setLineDash([14, 12]);
    g.lineCap = 'round';
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    g.strokeText(letra, x, y);
    g.setLineDash([]);
  }



  private resetCanvas() {
    this.clear();
    this.bgCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);
    this.mascaraCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);
    this.drawGuideLetter();
  }

  startDrawing(event: MouseEvent | TouchEvent) {
    // El cronómetro parte con el primer trazo, no al abrir la página
    // y el cartel del intento anterior se quita para no tapar la letra.
    if (this.inicioTrazado === null) {
      this.inicioTrazado = Date.now();
      this.resultMessage.set('');
    }

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

    const bgData = this.mascaraCtx.getImageData(0, 0, this.canvasSize, this.canvasSize).data;
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
      this.resultColor.set('#ffc2b8');
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

    const duracion = this.inicioTrazado
      ? Math.round((Date.now() - this.inicioTrazado) / 1000)
      : 0;

    this.showResult(puntajeFinal);

    // Se guardan TODOS los intentos, también los malos. Antes solo se emitía con
    // un 50% de área cubierta, y la profesora veía un progreso mejor que el real
    // (Hablemos y Comunícate ya registraban cada intento).
    this.resultadoListo.emit({
      letraEsperada: this._currentLetter,
      trazoInterno: this.redondear(trazoInterno),
      trazoExterno: this.redondear(trazoExterno),
      areaCompletada: this.redondear(areaCompletada),
      puntajeFinal: this.redondear(puntajeFinal),
      duracion,
    });

    // Lienzo limpio para el próximo intento, con el mensaje de resultado a la
    // vista. También evita que verificar dos veces el mismo dibujo lo guarde dos veces.
    this.limpiarTrazo();
  }

  private redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
  }

  private showResult(score: number) {
    let status = '';
    let color = '';

    // Colores de tiza: se leen sobre la pizarra verde oscuro.
    if (score > 90) { status = '¡Perfecto! 🌟'; color = '#b9f6a0'; }
    else if (score > 80) { status = '¡Muy bien! 🎉'; color = '#b9f6a0'; }
    else if (score > 40) { status = 'Casi: cuidado con los bordes'; color = '#ffe066'; }
    else { status = 'Inténtalo otra vez, siguiendo la letra'; color = '#ffc2b8'; }

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
