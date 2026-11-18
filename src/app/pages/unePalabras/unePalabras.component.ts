import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { AvisoModoPracticaComponent } from '../../components/shared/aviso-modo-practica/aviso-modo-practica.component';
import { ActividadesService } from '../../services/actividades.service';
import { sortearRonda, PalabraBanco } from '../../interfaces/banco-palabras';
import { Confusion, ResultadoUnePalabras } from '../../interfaces/une-palabras.interface';

const PARES_POR_RONDA = 5;
const UMBRAL_APROBADO = 80;

/** Colores de las cuerdas, uno por par (en el orden de las palabras). */
const COLORES_CUERDA = ['#8b5cf6', '#ff922b', '#2b7de9', '#e8457a', '#2f9e44'];

/** Cuerda dibujada entre una palabra y su dibujo, en px del tablero. */
interface Cuerda {
  id: number;
  d: string;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Una tarjeta de la columna derecha (el dibujo). */
interface Dibujo {
  id: number;
  emoji: string;
  texto: string;
}

@Component({
  selector: 'une-page',
  standalone: true,
  imports: [AvisoModoPracticaComponent],
  templateUrl: './unePalabras.component.html',
  styleUrls: ['./unePalabras.component.scss'],
})
export class UnePalabrasComponent {
  private actividadesService = inject(ActividadesService);

  palabras = signal<PalabraBanco[]>([]);
  dibujos = signal<Dibujo[]>([]);

  /** Palabra tocada, esperando que se toque un dibujo. null = nada seleccionado. */
  seleccionada = signal<PalabraBanco | null>(null);

  /** ids de las palabras ya resueltas. */
  resueltas = signal<Set<number>>(new Set());

  /** id del dibujo que acaba de fallar, para pintarlo en rojo un instante. */
  errorEn = signal<number | null>(null);

  errores = signal(0);
  terminado = signal(false);
  guardando = signal(false);
  errorGuardado = signal(false);

  /** Palabras que ya tuvieron al menos un error. Sirve para no contarlas como
   *  acierto limpio aunque después se resuelvan bien. */
  private falladas = new Set<number>();

  /** Confusiones acumuladas, indexadas por "palabra→eligio". */
  private confusiones = new Map<string, Confusion>();

  /** Se fija al primer toque, no al abrir la página: mide el trabajo real. */
  private inicio: number | null = null;

  progreso = computed(() => this.resueltas().size);
  aciertosLimpios = computed(
    () => this.palabras().filter((p) => this.resueltas().has(p.id) && !this.falladas.has(p.id)).length,
  );

  // ── Cuerdas entre los pares unidos ───────────────────────
  private tablero = viewChild<ElementRef<HTMLElement>>('tablero');
  private palabrasEl = viewChildren<ElementRef<HTMLElement>>('palabraEl');
  private dibujosEl = viewChildren<ElementRef<HTMLElement>>('dibujoEl');
  /** Sube cada vez que el tablero cambia de tamaño, para volver a medir. */
  private medida = signal(0);

  cuerdas = signal<Cuerda[]>([]);
  cajaCuerdas = signal('0 0 100 100');

  constructor() {
    this.nuevaRonda();

    // Las cuerdas se dibujan midiendo dónde quedaron las tarjetas: así calzan
    // en cualquier pantalla. Se recalculan al unir un par o al cambiar el
    // tamaño del tablero.
    let observador: ResizeObserver | null = null;
    let observado: HTMLElement | null = null;
    inject(DestroyRef).onDestroy(() => observador?.disconnect());

    afterRenderEffect({
      read: () => {
        const tablero = this.tablero()?.nativeElement;
        const resueltas = this.resueltas();
        this.medida();
        const palabras = this.palabrasEl();
        const dibujos = this.dibujosEl();
        if (!tablero) return;

        // Cada ronda crea un tablero nuevo: se observa el que esté en pantalla.
        if (observado !== tablero) {
          observador ??= new ResizeObserver(() => this.medida.update((n) => n + 1));
          if (observado) observador.unobserve(observado);
          observador.observe(tablero);
          observado = tablero;
        }

        const t = tablero.getBoundingClientRect();
        const buscar = (lista: readonly ElementRef<HTMLElement>[], id: number) =>
          lista.find((e) => e.nativeElement.dataset['id'] === String(id))?.nativeElement.getBoundingClientRect();

        const cuerdas: Cuerda[] = [];
        this.palabras().forEach((palabra, i) => {
          if (!resueltas.has(palabra.id)) return;
          const a = buscar(palabras, palabra.id);
          const b = buscar(dibujos, palabra.id);
          if (!a || !b) return;
          const x1 = a.right - t.left;
          const y1 = a.top + a.height / 2 - t.top;
          const x2 = b.left - t.left;
          const y2 = b.top + b.height / 2 - t.top;
          const m = (x1 + x2) / 2;
          cuerdas.push({
            id: palabra.id,
            d: `M${x1} ${y1} C ${m} ${y1}, ${m} ${y2}, ${x2} ${y2}`,
            color: COLORES_CUERDA[i % COLORES_CUERDA.length],
            x1,
            y1,
            x2,
            y2,
          });
        });

        this.cajaCuerdas.set(`0 0 ${t.width} ${t.height}`);
        this.cuerdas.set(cuerdas);
      },
    });
  }

  nuevaRonda() {
    const elegidas = sortearRonda(PARES_POR_RONDA);

    this.palabras.set(elegidas);
    // Los dibujos van en otro orden: si coincidieran fila a fila, el niño podría
    // resolver por posición sin leer.
    this.dibujos.set(
      [...elegidas]
        .sort(() => Math.random() - 0.5)
        .map((p) => ({ id: p.id, emoji: p.emoji, texto: p.texto })),
    );

    this.seleccionada.set(null);
    this.resueltas.set(new Set());
    this.cuerdas.set([]);
    this.errorEn.set(null);
    this.errores.set(0);
    this.terminado.set(false);
    this.errorGuardado.set(false);
    this.falladas.clear();
    this.confusiones.clear();
    this.inicio = null;
  }

  /** Toque en una palabra (columna izquierda). */
  tocarPalabra(palabra: PalabraBanco) {
    if (this.terminado() || this.resueltas().has(palabra.id)) return;

    this.inicio ??= performance.now();

    // Volver a tocar la misma la deselecciona: es la forma de arrepentirse
    // sin tener que unirla mal.
    this.seleccionada.set(this.seleccionada()?.id === palabra.id ? null : palabra);
    this.errorEn.set(null);
  }

  /** Toque en un dibujo (columna derecha). */
  tocarDibujo(dibujo: Dibujo) {
    if (this.terminado() || this.resueltas().has(dibujo.id)) return;

    const palabra = this.seleccionada();
    // Sin palabra elegida el toque no hace nada: el orden es palabra → dibujo.
    if (!palabra) return;

    this.inicio ??= performance.now();

    if (palabra.id === dibujo.id) {
      this.resueltas.update((s) => new Set(s).add(palabra.id));
      this.seleccionada.set(null);
      this.errorEn.set(null);

      if (this.resueltas().size === this.palabras().length) {
        this.finalizar();
      }
      return;
    }

    // Error: se registra la confusión y se deja la palabra seleccionada para
    // que pueda reintentar sin volver a tocarla.
    this.errores.update((n) => n + 1);
    this.falladas.add(palabra.id);
    this.registrarConfusion(palabra.texto, dibujo.texto);

    this.errorEn.set(dibujo.id);
    setTimeout(() => this.errorEn.set(null), 600);
  }

  private registrarConfusion(palabra: string, eligio: string) {
    const clave = `${palabra}→${eligio}`;
    const previa = this.confusiones.get(clave);

    if (previa) {
      previa.veces++;
    } else {
      this.confusiones.set(clave, { palabra, eligio, veces: 1 });
    }
  }

  private finalizar() {
    this.terminado.set(true);

    const total = this.palabras().length;
    const aciertos = this.aciertosLimpios();
    const duracion = this.inicio
      ? Math.round((performance.now() - this.inicio) / 1000)
      : 0;

    const datos: ResultadoUnePalabras = {
      totalPares: total,
      aciertos,
      errores: this.errores(),
      // El servidor lo recalcula igual; se envía por compatibilidad con el DTO.
      puntajeFinal: total > 0 ? (aciertos / total) * 100 : 0,
      duracion,
      pares: this.palabras().map((p) => p.texto),
      confusiones: [...this.confusiones.values()],
    };

    // Modo práctica: el backend respondería 403 para este rol.
    if (!this.actividadesService.puedeGuardarProgreso()) return;

    this.guardando.set(true);
    this.actividadesService.guardarUnePalabras(datos).subscribe({
      next: () => this.guardando.set(false),
      error: () => {
        this.guardando.set(false);
        this.errorGuardado.set(true);
      },
    });
  }

  /** Reintenta el guardado sin rehacer la ronda. */
  reintentarGuardado() {
    if (!this.terminado()) return;
    this.errorGuardado.set(false);
    this.finalizar();
  }

  puntaje = computed(() => {
    const total = this.palabras().length;
    return total > 0 ? Math.round((this.aciertosLimpios() / total) * 100) : 0;
  });

  aprobado = computed(() => this.puntaje() >= UMBRAL_APROBADO);
}
