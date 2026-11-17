export interface UsuarioListado {
  idUsuario: number;
  rutUsuario: string;
  primerNombre: string;
  segundoNombre: string;
  aPaterno: string;
  aMaterno: string;
  /** null: estudiante sin correo (es opcional para ellos). */
  correo: string | null;
  telefonoUsuario: string | null;
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

/** Lo mínimo para ofrecer a alguien al vincular: nombre, rol y colegio. Es lo
 *  que trae GET /usuarios/apoderados-vinculables (sin RUT, correo ni
 *  teléfono), y un UsuarioListado también lo cumple. */
export type CandidatoVinculo = Pick<
  UsuarioListado,
  'idUsuario' | 'primerNombre' | 'aPaterno' | 'aMaterno' | 'idRol' | 'idColegio' | 'activo'
>;

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
  /** Opcionales solo para estudiantes; "" = sin dato. */
  telefonoUsuario: string;
  correo: string;
  urlAvatar?: string;
}

export type ActualizarUsuarioPayload = Partial<Omit<CrearUsuarioPayload, 'idColegio'>>;
