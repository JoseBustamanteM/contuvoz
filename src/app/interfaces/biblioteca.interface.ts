export interface ArchivoBiblioteca {
  idArchivo: number;
  tituloArchivo: string;
  descripcionArchivo: string | null;
  rutaArchivoUrl: string;
  tipoArchivo: string;
  fechaSubido: string;
  imagenUrl: string;
  imagenDescripcionUrl: string;
  idUsuario: number;
}
