import { Routes } from '@angular/router';

export const HAND_TRACKER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./hand-tracker-claude.page').then((m) => m.HandTrackerClaudePage),
  },
];
