// import { Component, NgZone, OnInit } from '@angular/core';
// import { Map, TileLayer, Marker } from 'leaflet';
// import { AnnotationPlugin, HereProvider, HereRoutingData, LeafletProjector, AnyRouting, MapLibreProjector, MousePlugin } from 'libre-routing';
// import { environment } from '../../environments/environment';

// @Component({
//   selector: 'libre-routing-leaflet',
//   templateUrl: 'leaflet.component.html',
//   styleUrls: ['leaflet.component.scss']
// })

// export class LeafletComponent implements OnInit {
//   constructor(private zone: NgZone) {}

//   ngOnInit() { }

//   ngAfterViewInit() {
//     this.zone.runOutsideAngular(() => {
//       const map = new Map('map', { preferCanvas: true }).setView([51.505, -0.09], 13);

//       new TileLayer ('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
//           attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//       }).addTo(map);

//       const dataProvider = new HereProvider({
//         apiKey: environment.hereApiKey,
//         transportMode: 'truck',
//         return: ['routeLabels', 'turnByTurnActions'],
//       });

//       const projector = new LeafletProjector({});

//       const routing = new AnyRouting<HereRoutingData>({
//         alternatives: 2,
//         dataProvider,
//         projector,
//         plugins: [new MousePlugin()],
//         waypointsSyncStrategy: 'toPath',
//       });

//       //@ts-ignore
//       routing.onAdd(map);

//       routing.setWaypoints([
//         { position: [18.8531001, 49.9539315], properties: { label: 'A' } },
//         { position: [21.01178, 52.22977], properties: { label: 'B' } }
//       ]);

//       routing.recalculateRoute();

//     });

//   }
// }
