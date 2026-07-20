import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/homePage/homePage.component';
import { DrawPageComponent } from './pages/drawPage/drawPage.component';
import { SignLanguageComponent } from './pages/signLanguage/signLanguage.component';
import { TalkPageComponent } from './pages/talkPage/talkpage.component';
import { DashboardPageComponent } from './pages/dashboard-page/dashboard-page.component';
import { DbTestComponent } from './pages/db-test/db-test.component';
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
    path: 'talkPage',
    component: TalkPageComponent
  },
  {
    path: 'dashboard-page',
    component: DashboardPageComponent
  },
    {
    path: 'test-db',
    component: DbTestComponent,
  },
  {
    path: '**',
    redirectTo: ''
  }
];
