import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Colegio } from '../interfaces/colegio.interface';

@Injectable({ providedIn: 'root' })
export class ColegiosService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/colegios`;

  listar(): Observable<Colegio[]> {
    return this.http.get<Colegio[]>(this.API);
  }
}
