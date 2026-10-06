import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/homePage/homePage.component';
import { DrawPageComponent } from './pages/drawPage/drawPage.component';
import { SignLanguageComponent } from './pages/signLanguage/signLanguage.component';
import { TalkPageComponent } from './pages/talkPage/talkpage.component';
import { DashboardPageComponent } from './pages/dashboard-page/dashboard-page.component';
import { LoginComponent } from './pages/login/login.component';
import { authGuard } from './guards/auth.guard';
import { rolGuard } from './guards/rol.guard';
import { GestionUsuariosComponent } from './pages/gestion-usuarios/gestion-usuarios.component';
export const routes: Routes = [

  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: HomePageComponent,
    canActivate: [authGuard]
  },
  {
    path: 'drawPage',
    component: DrawPageComponent,
    canActivate: [authGuard]
  },
  {
    path: 'signPage',
    component: SignLanguageComponent,
    canActivate: [authGuard]
  },
   {
    path: 'talkPage',
    component: TalkPageComponent,
    canActivate: [authGuard]
  },
  {
    path: 'dashboard-page',
    component: DashboardPageComponent,
    canActivate: [authGuard]
  },
   {
  path: 'gestion-usuarios',
  component: GestionUsuariosComponent,
  canActivate: [authGuard, rolGuard],
},
  {
    path: 'unePage',
    loadComponent: () =>
      import('./pages/unePalabras/unePalabras.component').then((m) => m.UnePalabrasComponent),
  },
  {
    path: '**',
    redirectTo: ''
  },

];
