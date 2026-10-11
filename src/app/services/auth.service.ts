// src/app/services/auth.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, shareReplay, finalize, switchMap} from 'rxjs';
import { environment } from '../../environments/environment';

interface LoginResponse {
  accessToken: string;
}

export interface UsuarioActual {
  idUsuario: number;
  rutUsuario: string;
  primerNombre: string;
  segundoNombre: string;
  aPaterno: string;
  aMaterno: string;
  correo: string;
  urlAvatar: string | null;
  idRol: number;
  idColegio: number;
  rol: { nomRol: string };
  colegio: { nomColegio: string };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/auth`;



  private accessToken = signal<string | null>(null);

  // true cuando ya intentamos restaurar la sesión al arrancar
  sesionVerificada = signal(false);

  getAccessToken(): string | null {
    return this.accessToken();
  }

  isLoggedIn(): boolean {
    return this.accessToken() !== null;
  }

  login(rutUsuario: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        `${this.API}/login`,
        { rutUsuario, password },
        { withCredentials: true },
      )
      .pipe(tap((res) => this.accessToken.set(res.accessToken)));
  }

  refresh(): Observable<LoginResponse | null> {
    return this.http
      .post<LoginResponse>(`${this.API}/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => this.accessToken.set(res.accessToken)),
        catchError(() => {
          this.accessToken.set(null);
          return of(null);
        }),
      );
  }

  /** Se llama una sola vez, al arrancar la app */
restaurarSesion(): Observable<UsuarioActual | null> {
  return this.refresh().pipe(
    switchMap((res) => (res ? this.cargarUsuario() : of(null))),
    tap(() => this.sesionVerificada.set(true)),
  );
}

  logout(): Observable<any> {
    return this.http
      .post(`${this.API}/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => this.accessToken.set(null)),
        catchError(() => {
          this.accessToken.set(null);
          return of(null);
        }),
      );
  }



  usuario = signal<UsuarioActual | null>(null);

cargarUsuario(): Observable<UsuarioActual | null> {
  return this.http
    .get<UsuarioActual>(`${this.API}/me`, { withCredentials: true })
    .pipe(
      tap((u) => this.usuario.set(u)),
      catchError(() => {
        this.usuario.set(null);
        return of(null);
      }),
    );
}

// Guarda el refresh en curso para que varias peticiones compartan uno solo
private refreshEnCurso: Observable<LoginResponse | null> | null = null;

refreshCompartido(): Observable<LoginResponse | null> {
  // Si ya hay uno en vuelo, nos colgamos de ese en vez de disparar otro
  if (this.refreshEnCurso) return this.refreshEnCurso;

  this.refreshEnCurso = this.refresh().pipe(
    shareReplay(1),
    finalize(() => {
      this.refreshEnCurso = null; // liberamos para el próximo 401
    }),
  );

  return this.refreshEnCurso;
}


}
