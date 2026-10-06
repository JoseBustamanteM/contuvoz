/**
 * Banco de palabras para "Une Palabras".
 *
 * Por ahora vive en código. Cuando la profesora necesite crear sus propios sets,
 * esto pasa a una tabla `palabra_une` con su CRUD; la estructura de acá está
 * pensada para migrar sin cambios (id, texto, emoji, categoría).
 *
 * Criterios de selección:
 * - Palabras de vocabulario temprano, de 1 a 3 sílabas.
 * - Emoji inequívoco: si el dibujo admite más de una lectura, la palabra se
 *   descartó. Por ejemplo "árbol" 🌳 se mantuvo, pero "amigo" se descartó
 *   porque su emoji se confunde con "familia".
 * - Sin pares que compartan emoji parecido dentro de la misma categoría.
 */

export type CategoriaPalabra = 'familia' | 'colegio' | 'naturaleza' | 'comida' | 'cotidiano';

export interface PalabraBanco {
  id: number;
  texto: string;
  emoji: string;
  categoria: CategoriaPalabra;
}

export const BANCO_PALABRAS: PalabraBanco[] = [
  // ---------- Familia ----------
  { id: 1,  texto: 'mamá',    emoji: '👩', categoria: 'familia' },
  { id: 2,  texto: 'papá',    emoji: '👨', categoria: 'familia' },
  { id: 3,  texto: 'bebé',    emoji: '👶', categoria: 'familia' },
  { id: 4,  texto: 'abuela',  emoji: '👵', categoria: 'familia' },
  { id: 5,  texto: 'abuelo',  emoji: '👴', categoria: 'familia' },
  { id: 6,  texto: 'casa',    emoji: '🏠', categoria: 'familia' },

  // ---------- Colegio ----------
  { id: 7,  texto: 'libro',   emoji: '📕', categoria: 'colegio' },
  { id: 8,  texto: 'lápiz',   emoji: '✏️', categoria: 'colegio' },
  { id: 9,  texto: 'tijera',  emoji: '✂️', categoria: 'colegio' },
  { id: 10, texto: 'mochila', emoji: '🎒', categoria: 'colegio' },
  { id: 11, texto: 'regla',   emoji: '📏', categoria: 'colegio' },
  { id: 12, texto: 'pizarra', emoji: '📋', categoria: 'colegio' },

  // ---------- Naturaleza ----------
  { id: 13, texto: 'flor',    emoji: '🌸', categoria: 'naturaleza' },
  { id: 14, texto: 'árbol',   emoji: '🌳', categoria: 'naturaleza' },
  { id: 15, texto: 'sol',     emoji: '☀️', categoria: 'naturaleza' },
  { id: 16, texto: 'luna',    emoji: '🌙', categoria: 'naturaleza' },
  { id: 17, texto: 'lluvia',  emoji: '🌧️', categoria: 'naturaleza' },
  { id: 18, texto: 'mar',     emoji: '🌊', categoria: 'naturaleza' },

  // ---------- Comida ----------
  { id: 19, texto: 'pan',     emoji: '🍞', categoria: 'comida' },
  { id: 20, texto: 'leche',   emoji: '🥛', categoria: 'comida' },
  { id: 21, texto: 'manzana', emoji: '🍎', categoria: 'comida' },
  { id: 22, texto: 'plátano', emoji: '🍌', categoria: 'comida' },
  { id: 23, texto: 'huevo',   emoji: '🥚', categoria: 'comida' },
  { id: 24, texto: 'queso',   emoji: '🧀', categoria: 'comida' },

  // ---------- Cotidiano ----------
  { id: 25, texto: 'auto',    emoji: '🚗', categoria: 'cotidiano' },
  { id: 26, texto: 'pelota',  emoji: '⚽', categoria: 'cotidiano' },
  { id: 27, texto: 'reloj',   emoji: '⏰', categoria: 'cotidiano' },
  { id: 28, texto: 'silla',   emoji: '🪑', categoria: 'cotidiano' },
  { id: 29, texto: 'llave',   emoji: '🔑', categoria: 'cotidiano' },
  { id: 30, texto: 'zapato',  emoji: '👟', categoria: 'cotidiano' },
];

export const CATEGORIAS: CategoriaPalabra[] = [
  'familia', 'colegio', 'naturaleza', 'comida', 'cotidiano',
];

/** Fisher-Yates. No muta el array original. */
function mezclar<T>(arr: readonly T[]): T[] {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Sortea las palabras de una ronda.
 *
 * Por defecto toma una categoría al azar y saca las 5 de ahí: mezclar "sol" con
 * "mochila" en la misma ronda hace la tarea despareja, y agrupar por tema ayuda
 * a fijar vocabulario. Pasando una categoría se fuerza esa (útil si la profesora
 * está trabajando un tema puntual).
 */
export function sortearRonda(cantidad = 5, categoria?: CategoriaPalabra): PalabraBanco[] {
  const elegida = categoria ?? CATEGORIAS[Math.floor(Math.random() * CATEGORIAS.length)];
  const delGrupo = BANCO_PALABRAS.filter((p) => p.categoria === elegida);
  return mezclar(delGrupo).slice(0, cantidad);
}
