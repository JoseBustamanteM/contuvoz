export enum Rol {
  ADMINISTRADOR = 1,
  ADMIN_COLEGIO = 2,
  PROFESOR = 3,
  APODERADO = 4,
  ESTUDIANTE = 5,
}

export const NOMBRE_ROL: Record<number, string> = {
  [Rol.ADMINISTRADOR]: 'Administrador',
  [Rol.ADMIN_COLEGIO]: 'Admin. Colegio',
  [Rol.PROFESOR]: 'Profesor',
  [Rol.APODERADO]: 'Apoderado',
  [Rol.ESTUDIANTE]: 'Estudiante',
};

// Roles que puede gestionar cada rol, espejo de PUEDE_GESTIONAR en el backend
export const ROLES_GESTIONABLES: Record<number, Rol[]> = {
  [Rol.ADMINISTRADOR]: [
    Rol.ADMINISTRADOR, Rol.ADMIN_COLEGIO, Rol.PROFESOR, Rol.APODERADO, Rol.ESTUDIANTE,
  ],
  [Rol.ADMIN_COLEGIO]: [Rol.PROFESOR, Rol.APODERADO, Rol.ESTUDIANTE],
  [Rol.PROFESOR]: [Rol.APODERADO, Rol.ESTUDIANTE],
};
