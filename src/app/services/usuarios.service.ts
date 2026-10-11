import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  UsuarioListado, CrearUsuarioPayload, ActualizarUsuarioPayload,
} from '../interfaces/usuario-gestion.interface';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/usuarios`;

 listar(rol?: number): Observable<UsuarioListado[]> {
  const params: Record<string, string> = {};
  if (rol) params['rol'] = String(rol);

  return this.http.get<UsuarioListado[]>(this.API, { params });
}

  obtenerUno(id: number): Observable<UsuarioListado> {
    return this.http.get<UsuarioListado>(`${this.API}/${id}`);
  }

  crear(datos: CrearUsuarioPayload): Observable<UsuarioListado> {
    return this.http.post<UsuarioListado>(this.API, datos);
  }

  actualizar(id: number, datos: ActualizarUsuarioPayload): Observable<UsuarioListado> {
    return this.http.patch<UsuarioListado>(`${this.API}/${id}`, datos);
  }

  desactivar(id: number): Observable<UsuarioListado> {
    return this.http.patch<UsuarioListado>(`${this.API}/${id}/desactivar`, {});
  }

  reactivar(id: number): Observable<UsuarioListado> {
    return this.http.patch<UsuarioListado>(`${this.API}/${id}/reactivar`, {});
  }
}
