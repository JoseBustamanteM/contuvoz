import { Component, ElementRef, ViewChild, AfterViewInit, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'letter-tracer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './letter-tracer.component.html',
  styleUrls: ['./letter-tracer.component.scss']
})
export class LetterTracerComponent implements AfterViewInit {

  // Referencias a los lienzos en el HTML
  @ViewChild('bgCanvas') bgCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('drawCanvas') drawCanvasRef!: ElementRef<HTMLCanvasElement>;

  private bgCtx!: CanvasRenderingContext2D;
  private drawCtx!: CanvasRenderingContext2D;

  // Configuración del tamaño
  private canvasSize = 500;

  // Variables de estado
  private _currentLetter = 'A';
  private isDrawing = false;
  private isViewInitialized = false;

  // Señales para mostrar mensajes en la pantalla
  public resultMessage = signal<string>('');
  public resultColor = signal<string>('black');

  // Este código se ejecuta cuando el padre cambia la letra seleccionada
  @Input()
  set letter(value: string) {
    this._currentLetter = value;
    if (this.isViewInitialized) {
      this.resetCanvas();
    }
  }

  ngAfterViewInit(): void {
    // Configuración inicial cuando carga la página
    this.setupCanvases();
    this.isViewInitialized = true;
    this.drawGuideLetter();
  }

  // Configura el tamaño y estilos de los pinceles
  private setupCanvases() {
    const bgCanvas = this.bgCanvasRef.nativeElement;
    const drawCanvas = this.drawCanvasRef.nativeElement;

    bgCanvas.width = this.canvasSize;
    bgCanvas.height = this.canvasSize;
    drawCanvas.width = this.canvasSize;
    drawCanvas.height = this.canvasSize;

    this.bgCtx = bgCanvas.getContext('2d', { willReadFrequently: true })!;
    this.drawCtx = drawCanvas.getContext('2d', { willReadFrequently: true })!;

    // Estilo del pincel del usuario
    this.drawCtx.lineWidth = 20;
    this.drawCtx.lineCap = 'round';
    this.drawCtx.lineJoin = 'round';
    this.drawCtx.strokeStyle = 'rgba(0, 0, 255, 0.6)'; // Azul transparente
  }

  // Dibuja la letra de fondo




private drawGuideLetter() {
  const fontName = 'Playwrite CU';
  // 2. Aumenta el tamaño de la letra proporcionalmente al canvas
  const fontSize = '220px';
  const letterToDraw = this._currentLetter.toLowerCase();

  document.fonts.load(`${fontSize} "${fontName}"`).then(() => {
    this.bgCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);

    // Configuración de estilo
    this.bgCtx.fillStyle = '#e0e0ff';
    this.bgCtx.strokeStyle = '#e0e0ff';
    this.bgCtx.lineWidth = 5; // Un poco más grueso ya que el canvas es más grande
    this.bgCtx.textAlign = 'center';
    this.bgCtx.textBaseline = 'middle';
    this.bgCtx.font = `${fontSize} "${fontName}"`;

    // 3. Cálculo dinámico para centrar:
    // La coordenada X es siempre la mitad del canvas.
    const x = this.canvasSize / 2;
    // La coordenada Y es la mitad menos un pequeño ajuste para subirla
    const y = (this.canvasSize / 2) - 30;

    this.bgCtx.fillText(letterToDraw, x, y);
    this.bgCtx.strokeText(letterToDraw, x, y);

  });
}

  // Reinicia todo cuando cambia la letra
  private resetCanvas() {
    this.clear();
    this.bgCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);
    this.drawGuideLetter();
  }

  // --- EVENTOS DE DIBUJO (MOUSE Y TOUCH) ---

  startDrawing(event: MouseEvent | TouchEvent) {
    this.isDrawing = true;
    const { x, y } = this.getCoordinates(event);
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(x, y);
  }

  draw(event: MouseEvent | TouchEvent) {
    if (!this.isDrawing) return;
    event.preventDefault(); // Evita que se mueva la pantalla en el celular
    const { x, y } = this.getCoordinates(event);
    this.drawCtx.lineTo(x, y);
    this.drawCtx.stroke();
  }

  stopDrawing() {
    this.isDrawing = false;
    this.drawCtx.closePath();
  }

  // Calcula dónde está el dedo o el mouse relativo al canvas
  private getCoordinates(event: MouseEvent | TouchEvent) {
    const canvas = this.drawCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;

    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  // --- LÓGICA DE VERIFICACIÓN (CALIFICAR) ---
 verify() {
  const bgData = this.bgCtx.getImageData(0, 0, this.canvasSize, this.canvasSize).data;
  const drawData = this.drawCtx.getImageData(0, 0, this.canvasSize, this.canvasSize).data;

  let targetPixels = 0;    // Píxeles totales de la letra
  let coveredPixels = 0;   // Píxeles correctos (dentro)
  let outsidePixels = 0;   // Píxeles incorrectos (fuera)

  for (let i = 0; i < bgData.length; i += 4) {
    const isLetter = bgData[i + 3] > 50;
    const isPainted = drawData[i + 3] > 50;

    if (isLetter) {
      targetPixels++;
      if (isPainted) {
        coveredPixels++;
      }
    } else {
      // Si NO es letra pero el usuario pintó, es un error
      if (isPainted) {
        outsidePixels++;
      }
    }
  }

  if (targetPixels === 0) return;

  // --- NUEVO CÁLCULO CON PENALIZACIÓN ---

  // 1. Calculamos el porcentaje de cobertura base
  const coveragePercent = (coveredPixels / targetPixels) * 100;

  // 2. Calculamos la penalización.
  // Por ejemplo: por cada pixel fuera, restamos una proporción.
  // Aquí definimos que si pintas fuera un área equivalente al tamaño de la letra, restas el 100%.
  const penaltyPercent = (outsidePixels / targetPixels) * 100;

  // 3. Resultado final: Aciertos menos Errores
  let finalScore = coveragePercent - (penaltyPercent * 0.8);

  // Evitamos que el puntaje sea negativo
  if (finalScore < 0) finalScore = 0;

  this.showResult(finalScore);
}

private showResult(score: number) {
  let status = '';
  let color = '';

  if (score > 90) {
    status = `¡Perfecto! Puntaje: ${score.toFixed(1)}%`;
    color = '#27ae60'; // Verde
  } else if (score > 80) {
    status = `¡Muy bien! Puntaje: ${score.toFixed(1)}%`;
    color = '#2ecc71'; // Verde claro
  } else if (score > 40) {
    status = `Ten cuidado con los bordes. Puntaje: ${score.toFixed(1)}%`;
    color = '#f39c12'; // Naranja
  } else {
    status = `Inténtalo de nuevo, concéntrate en la letra. Puntaje: ${score.toFixed(1)}%`;
    color = '#e74c3c'; // Rojo
  }

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
