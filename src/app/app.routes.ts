import { Component } from '@angular/core';
import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/homePage/homePage.component';
import { DrawPageComponent } from './pages/drawPage/drawPage.component';



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
    path: '**',
    redirectTo: ''
  }
];
