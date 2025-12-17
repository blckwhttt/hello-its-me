import { Routes } from '@angular/router';
import { GuestGuard } from '../../core/guards/guest.guard';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
    canActivate: [GuestGuard],
    data: {
      title: 'Вход',
      description: 'Войдите в Twine чтобы продолжить звонки и чаты'
    }
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.component').then(m => m.RegisterComponent),
    canActivate: [GuestGuard],
    data: {
      title: 'Регистрация',
      description: 'Создайте аккаунт Twine для звонков и комнат'
    }
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];

