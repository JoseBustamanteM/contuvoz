import { ApplicationConfig, provideBrowserGlobalErrorListeners,provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';
import { PrecargaTrasLogin } from './services/precarga.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Con sesión iniciada, el código de todas las páginas se baja en segundo
    // plano: abrir cada actividad no espera la descarga.
    provideRouter(routes, withPreloading(PrecargaTrasLogin)),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(() => {
      const authService = inject(AuthService);
      return firstValueFrom(authService.restaurarSesion());
    }),
  ],
};
