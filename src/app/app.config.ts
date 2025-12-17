import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  provideAppInitializer,
  inject,
} from '@angular/core';
import {
  provideRouter,
  withHashLocation,
  TitleStrategy,
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { PageTitleStrategy } from './core/services/page-meta.service';

const isElectron =
  typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, ...(isElectron ? [withHashLocation()] : [])),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideAppInitializer(() => {
      const authService = inject(AuthService);
      return firstValueFrom(authService.getCurrentUser());
    }),
  ],
};
