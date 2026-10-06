import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Espejo de server-nest/src/common/validators/rut.validator.ts: validar acá
 *  evita un viaje al servidor para un RUT mal escrito y permite un mensaje
 *  específico en vez del 400 genérico. */
export function limpiarRut(rut: string): string {
  return rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
}

function calcularDv(cuerpo: string): string {
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return resto.toString();
}

export function esRutValido(rut: string): boolean {
  const limpio = limpiarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;
  return calcularDv(limpio.slice(0, -1)) === limpio.slice(-1);
}

/** 111111111 -> 11.111.111-1, para mostrar RUTs guardados normalizados. */
export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return rut;
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpo}-${limpio.slice(-1)}`;
}

/** Error `rut` si el valor no es un RUT válido. Vacío no es error: eso lo
 *  decide Validators.required. */
export const rutValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = control.value as string;
  if (!valor) return null;
  return esRutValido(valor) ? null : { rut: true };
};
