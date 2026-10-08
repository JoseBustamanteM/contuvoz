import { Component, ElementRef, Injector, OnInit, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MisLogrosService } from '../../services/mis-logros.service';
import { ClaveActividad, LetraProgreso, ResumenEstudiante } from '../../interfaces/mis-logros.interface';

type ClaveCajon = ClaveActividad | 'medallas';

interface Actividad {
  clave: ClaveActividad;
  nombre: string;
  icono: string;
  ruta: string;
}

const ACTIVIDADES: Actividad[] = [
  { clave: 'pinta', nombre: 'Pinta letras', icono: '🎨', ruta: '/drawPage' },
  { clave: 'comunicate', nombre: 'Comunícate', icono: '✋', ruta: '/signPage' },
  { clave: 'hablemos', nombre: 'Hablemos', icono: '🎤', ruta: '/talkPage' },
  { clave: 'une', nombre: 'Une palabras', icono: '🧩', ruta: '/unePage' },
];

/** Orden de los cajones (abajo): las vocales primero, que es lo que más se practica. */
const ORDEN_CAJONES: ClaveActividad[] = ['hablemos', 'comunicate', 'pinta', 'une'];

/** Una estrella en la línea de Une palabras cada esta cantidad de palabras. */
const PALABRAS_POR_HITO = 10;

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Dashboard del estudiante.
 * - Arriba (lo primero que ve): saludo, estrellas, racha, semana, tarjetas por
 *   actividad. Poco texto y nada que leer obligatoriamente.
 * - Abajo: un cajón por actividad con el detalle. Tocar una tarjeta de arriba
 *   abre su cajón y baja hasta él.
 */
@Component({
  selector: 'app-mis-logros',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mis-logros.component.html',
  styleUrl: './mis-logros.component.scss',
})
export class MisLogrosComponent implements OnInit {
  private misLogrosService = inject(MisLogrosService);
  private authService = inject(AuthService);
  private host = inject(ElementRef<HTMLElement>);
  private injector = inject(Injector);

  readonly actividades = ACTIVIDADES;
  readonly dias = DIAS;
  readonly medallas = this.misLogrosService.obtenerMedallas();

  nombre = computed(() => this.authService.usuario()?.primerNombre ?? '');

  resumen = signal<ResumenEstudiante | null>(null);
  cargando = signal(true);
  error = signal(false);

  abiertos = signal<Set<ClaveCajon>>(new Set());

  cajones = computed(() => ORDEN_CAJONES.map((c) => ACTIVIDADES.find((a) => a.clave === c)!));

  medallasObtenidas = computed(() => this.medallas.filter((m) => m.obtenida).length);

  /** No jugó esta semana: el resumen de arriba (todo en cero) se cambia por
   *  una invitación. Los cajones se muestran igual, con lo que ya aprendió. */
  sinActividad = computed(() => {
    const r = this.resumen();
    return !!r && r.diasSemana.every((d) => !d);
  });

  /** Línea de Une palabras: posición, hitos (estrellas) y cuánto falta. */
  lineaUne = computed(() => {
    const une = this.resumen()?.une;
    if (!une || une.total === 0) return null;

    const pct = (n: number) => Math.min(100, (n / une.total) * 100);
    const hitos: { valor: number; pct: number; logrado: boolean }[] = [];
    // Sin estrella pegada al trofeo: con 31 palabras, una estrella en 30
    // quedaba encima del trofeo y sus números se superponían.
    for (let v = PALABRAS_POR_HITO; v <= une.total - PALABRAS_POR_HITO / 2; v += PALABRAS_POR_HITO) {
      hitos.push({ valor: v, pct: pct(v), logrado: une.conocidas >= v });
    }
    const siguiente = hitos.find((h) => !h.logrado)?.valor ?? une.total;

    return {
      pct: pct(une.conocidas),
      hitos,
      faltan: siguiente - une.conocidas,
      siguienteEsTrofeo: siguiente === une.total,
      completa: une.conocidas >= une.total,
    };
  });

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.error.set(false);
    this.misLogrosService.obtenerResumen().subscribe({
      next: (r) => {
        this.resumen.set(r);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  letrasDe(clave: ClaveActividad): LetraProgreso[] {
    const r = this.resumen();
    if (!r || clave === 'une') return [];
    return r[clave].letras;
  }

  pistaDe(clave: ClaveActividad): string | null {
    const r = this.resumen();
    if (!r || clave === 'une') return null;
    return r[clave].pista;
  }

  contador(clave: ClaveActividad): string {
    const r = this.resumen();
    if (!r) return '';
    if (clave === 'une') return `${r.une.conocidas} de ${r.une.total}`;
    const letras = r[clave].letras;
    return `${letras.filter((l) => l.estado === 'dominada').length} de ${letras.length}`;
  }

  /** Arreglo de largo n, para dibujar n estrellas con @for. */
  estrellas(n: number): number[] {
    return Array.from({ length: Math.min(n, 5) }, (_, i) => i);
  }

  estaAbierto(clave: ClaveCajon) {
    return this.abiertos().has(clave);
  }

  alternar(clave: ClaveCajon) {
    this.abiertos.update((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });
  }

  /** Tarjeta de arriba → abre su cajón y baja hasta él. */
  irACajon(clave: ClaveActividad) {
    this.abiertos.update((s) => new Set(s).add(clave));
    afterNextRender(
      () => {
        const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.host.nativeElement
          .querySelector(`#cajon-${clave}`)
          ?.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
      },
      { injector: this.injector },
    );
  }
}
