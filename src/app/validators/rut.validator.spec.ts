import { FormControl } from '@angular/forms';
import { esRutValido, formatearRut, limpiarRut, rutValidator } from './rut.validator';

describe('rut.validator', () => {
  it('acepta RUTs válidos con y sin formato', () => {
    expect(esRutValido('11.111.111-1')).toBe(true);
    expect(esRutValido('111111111')).toBe(true);
    expect(esRutValido('9.966.989-6')).toBe(true);
  });

  it('acepta dígito verificador K en mayúscula o minúscula', () => {
    expect(esRutValido('20.000.000-k')).toBe(esRutValido('20.000.000-K'));
  });

  it('rechaza dígito verificador incorrecto y formatos raros', () => {
    expect(esRutValido('11.111.111-2')).toBe(false);
    expect(esRutValido('123')).toBe(false);
    expect(esRutValido('abc')).toBe(false);
  });

  it('limpia y formatea', () => {
    expect(limpiarRut(' 11.111.111-k ')).toBe('11111111K');
    expect(formatearRut('111111111')).toBe('11.111.111-1');
    expect(formatearRut('99669896')).toBe('9.966.989-6');
  });

  it('el validador deja pasar vacío (eso lo decide required)', () => {
    expect(rutValidator(new FormControl(''))).toBeNull();
    expect(rutValidator(new FormControl('11.111.111-2'))).toEqual({ rut: true });
  });
});
