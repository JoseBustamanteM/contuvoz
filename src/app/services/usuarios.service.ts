import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  UsuarioListado, CrearUsuarioPayload, ActualizarUsuarioPayload, CandidatoVinculo,
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

  /** Solo profesores: apoderados de su colegio que puede elegir al vincular
   *  (los que no son suyos vienen solo con nombre). */
  apoderadosVinculables(): Observable<CandidatoVinculo[]> {
    return this.http.get<CandidatoVinculo[]>(`${this.API}/apoderados-vinculables`);
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
