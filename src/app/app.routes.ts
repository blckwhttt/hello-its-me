import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.authRoutes)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    data: {
      title: 'Рабочая область',
      description: 'Комнаты, звонки и демонстрация экрана в Twine'
    },
    canActivate: [AuthGuard]
  },
  {
    path: 'call',
    loadChildren: () => import('./features/call/call.routes').then(m => m.callRoutes),
    data: {
      title: 'Комната',
      description: 'Голосовые и видеозвонки в комнате Twine'
    },
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
