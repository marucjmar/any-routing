import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { appRoutes } from './app.routes';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { provideMaplibreWorker } from '@maplibre/ngx-maplibre-gl/config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withHashLocation()),
    providePrimeNG({
      theme: {
        preset: Aura,
      },
    }),
    provideMaplibreWorker('maplibre-gl-worker.mjs'),
  ],
};
