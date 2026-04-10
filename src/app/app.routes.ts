import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/homePage/homePage.component';
import { DrawPageComponent } from './pages/drawPage/drawPage.component';
import { TalkPageComponent } from './pages/talkPage/talkPage.component';
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
    path: 'talkPage',
    component: TalkPageComponent

  },
  {
    path: 'signPage',
    component: SignLanguageComponent

  },

  // {
  //   path: '**',
  //   redirectTo: ''
  // }
];
