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
