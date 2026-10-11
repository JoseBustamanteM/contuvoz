import {
  registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface,
} from 'class-validator';

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

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  return calcularDv(cuerpo) === dv;
}

@ValidatorConstraint({ name: 'esRut', async: false })
class EsRutConstraint implements ValidatorConstraintInterface {
  validate(rut: string): boolean {
    return typeof rut === 'string' && esRutValido(rut);
  }

  defaultMessage(): string {
    return 'El RUT ingresado no es válido';
  }
}

export function IsRut(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: EsRutConstraint,
    });
  };
}
