import { Route } from '@angular/router';
import { HereComponent } from '../pages/here/here.component';
import { LeafletComponent } from '../pages/leaflet/leaflet.component';

export const appRoutes: Route[] = [
    { path: 'maplibre', component: HereComponent },
    { path: 'leaflet', component: LeafletComponent }
];
