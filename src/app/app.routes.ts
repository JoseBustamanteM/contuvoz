import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/homePage/homePage.component';
import { LoginComponent } from './pages/login/login.component';
import { authGuard, invitadoGuard } from './guards/auth.guard';
import { rolGuard } from './guards/rol.guard';

// Login e inicio van en el paquete principal (son lo primero que se ve). El
// resto se carga al entrar: así MediaPipe (Comunícate) y Chart.js (dashboard)
// no se descargan hasta que se usan.
export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [invitadoGuard] },
  {
    path: '',
    component: HomePageComponent,
    canActivate: [authGuard],
  },
  {
    path: 'drawPage',
    loadComponent: () =>
      import('./pages/drawPage/drawPage.component').then((m) => m.DrawPageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'signPage',
    loadComponent: () =>
      import('./pages/signLanguage/signLanguage.component').then((m) => m.SignLanguageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'talkPage',
    loadComponent: () =>
      import('./pages/talkPage/talkpage.component').then((m) => m.TalkPageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'unePage',
    loadComponent: () =>
      import('./pages/unePalabras/unePalabras.component').then((m) => m.UnePalabrasComponent),
    canActivate: [authGuard],
  },
  {
    path: 'mis-logros',
    loadComponent: () =>
      import('./pages/mis-logros/mis-logros.component').then((m) => m.MisLogrosComponent),
    canActivate: [authGuard],
  },
  {
    path: 'dashboard-page',
    loadComponent: () =>
      import('./pages/dashboard-page/dashboard-page.component').then(
        (m) => m.DashboardPageComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'gestion-usuarios',
    loadComponent: () =>
      import('./pages/gestion-usuarios/gestion-usuarios.component').then(
        (m) => m.GestionUsuariosComponent,
      ),
    canActivate: [authGuard, rolGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
