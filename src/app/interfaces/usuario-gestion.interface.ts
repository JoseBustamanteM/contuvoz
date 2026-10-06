export interface UsuarioListado {
  idUsuario: number;
  rutUsuario: string;
  primerNombre: string;
  segundoNombre: string;
  aPaterno: string;
  aMaterno: string;
  correo: string;
  telefonoUsuario: string;
  urlAvatar: string | null;
  idRol: number;
  idColegio: number;
  activo: boolean;
  fechaRegistro: string;
  ultActividad: string | null;
  rol: { nomRol: string };
  /** Vínculos VIGENTES (solo viene con datos para estudiantes). */
  vinculosComoEstudiante: VinculoResumen[];
}

export type TipoVinculo = 'PROFESOR' | 'APODERADO';

export interface PersonaVinculo {
  idUsuario: number;
  primerNombre: string;
  aPaterno: string;
}

/** Lo que trae GET /usuarios por cada vínculo vigente. */
export interface VinculoResumen {
  idVinculo: number;
  tipoVinculo: TipoVinculo;
  creadoPor: number;
  adulto: PersonaVinculo;
}

/** Lo que trae GET /vinculos/estudiante/:id (con historial incluido). */
export interface VinculoDetalle {
  idVinculo: number;
  idEstudiante: number;
  idAdulto: number;
  tipoVinculo: TipoVinculo;
  fechaInicio: string;
  fechaFin: string | null;
  adulto: PersonaVinculo & { idRol: number };
  creador: PersonaVinculo & { idRol: number };
  deshabilitador: (PersonaVinculo & { idRol: number }) | null;
}

export interface CrearUsuarioPayload {
  idRol: number;
  idColegio?: number;
  rutUsuario: string;
  password: string;
  primerNombre: string;
  segundoNombre: string;
  aPaterno: string;
  aMaterno: string;
  telefonoUsuario: string;
  correo: string;
  urlAvatar?: string;
}

export type ActualizarUsuarioPayload = Partial<Omit<CrearUsuarioPayload, 'idColegio'>>;
