import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TipoVinculo, VinculoDetalle } from '../interfaces/usuario-gestion.interface';

@Injectable({ providedIn: 'root' })
export class VinculosService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/vinculos`;

  crear(idEstudiante: number, idAdulto: number, tipoVinculo: TipoVinculo): Observable<VinculoDetalle> {
    return this.http.post<VinculoDetalle>(this.API, { idEstudiante, idAdulto, tipoVinculo });
  }

  deshabilitar(idVinculo: number): Observable<VinculoDetalle> {
    return this.http.patch<VinculoDetalle>(`${this.API}/${idVinculo}/deshabilitar`, {});
  }

  /** Con historial=true incluye los vínculos cerrados (solo administradores). */
  listarDeEstudiante(idEstudiante: number, historial = false): Observable<VinculoDetalle[]> {
    return this.http.get<VinculoDetalle[]>(`${this.API}/estudiante/${idEstudiante}`, {
      params: historial ? { historial: 'true' } : {},
    });
  }
}
