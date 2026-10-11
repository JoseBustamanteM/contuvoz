import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { ArchivoBiblioteca } from '../interfaces/biblioteca.interface';

export interface CrearArchivoBiblioteca {
  tituloArchivo: string;
  descripcionArchivo?: string;
  file: File;
}

export interface EliminarArchivoBibliotecaResponse {
  message: string;
  idArchivo: number;
}

export interface EditarArchivoBiblioteca {
  tituloArchivo?: string;
  descripcionArchivo?: string;
}

@Injectable({
  providedIn: 'root',
})
export class BibliotecaService {
  private http = inject(HttpClient);

  private readonly API = `${environment.apiUrl}/biblioteca`;

  listar(): Observable<ArchivoBiblioteca[]> {
    return this.http.get<ArchivoBiblioteca[]>(this.API);
  }

  obtener(id: number): Observable<ArchivoBiblioteca> {
    return this.http.get<ArchivoBiblioteca>(`${this.API}/${id}`);
  }

  subir(
    archivo: CrearArchivoBiblioteca,
  ): Observable<ArchivoBiblioteca> {
    const formData = new FormData();

    formData.append('tituloArchivo', archivo.tituloArchivo);

    if (archivo.descripcionArchivo) {
      formData.append(
        'descripcionArchivo',
        archivo.descripcionArchivo,
      );
    }

    formData.append('file', archivo.file);

    return this.http.post<ArchivoBiblioteca>(
      `${this.API}/upload`,
      formData,
    );
  }

  eliminar(
    id: number,
  ): Observable<EliminarArchivoBibliotecaResponse> {
    return this.http.delete<EliminarArchivoBibliotecaResponse>(
      `${this.API}/${id}`,
    );
  }

  editar(
    id: number,
    datos: EditarArchivoBiblioteca,
  ): Observable<ArchivoBiblioteca> {
    return this.http.patch<ArchivoBiblioteca>(
      `${this.API}/${id}`,
      datos,
    );
  }
}
