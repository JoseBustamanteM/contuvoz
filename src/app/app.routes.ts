import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/homePage/homePage.component';
import { DrawPageComponent } from './pages/drawPage/drawPage.component';
import { SignLanguageComponent } from './pages/signLanguage/signLanguage.component';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent
  },
  {
    path: 'drawPage',
    component: DrawPageComponent
  },
  {
    path: 'signPage',
    component: SignLanguageComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];
