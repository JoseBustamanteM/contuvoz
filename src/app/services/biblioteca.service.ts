import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ArchivoBiblioteca } from '../interfaces/biblioteca.interface';

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
}
