import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    { path: 'maplibre', loadComponent: () => import('../pages/here/here.component').then(({ HereComponent }) => HereComponent) },
    { path: 'leaflet', loadComponent: () => import('../pages/leaflet/leaflet.component').then(({ LeafletComponent }) => LeafletComponent) },
    { path: '**', redirectTo: '/maplibre' }
];
