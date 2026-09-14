import { Component, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { AnyRouting } from '@any-routing/core';
import { HereProvider, HereRoutingData } from '@any-routing/here-data-provider';
import { environment } from '../../environments/environment';

import * as L from 'leaflet';
import { LeafletLineLoaderPlugin } from '@any-routing/line-loader/leaflet';
import { LeafletAnnotationPlugin } from '@any-routing/annotation-plugin/leaflet';
import { LeafletProjector } from '../../../../../libs/leaflet-engine/src/lib/projector.leaflet.plugin';
import { defaultLeafletProjectorOptions } from '../../../../../libs/leaflet-engine/src/lib/projector.leaflet-defaults.plugin';

@Component({
  selector: 'app-leaflet-page',
  template: `<div id="map" #mapContainer></div>`,
  styles: `
    #map {
      display: block;
      width: 80vw;
      height: 100vh;
    }
  `,
})
export class LeafletComponent implements AfterViewInit {
  @ViewChild('mapContainer') mapContainer?: ElementRef;

  ngAfterViewInit() {
    const map = new L.Map(this.mapContainer!.nativeElement, { preferCanvas: true }).setView([51.505, -0.09], 5);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const dataProvider = new HereProvider({
      apiKey: environment.hereApiKey,
      transportMode: 'truck',
    });

    const projector = new LeafletProjector({
      map,
      ...defaultLeafletProjectorOptions,
      editable: true,
    });

    const annotationPlugin = new LeafletAnnotationPlugin({ map });
    const loader = new LeafletLineLoaderPlugin({ map, projector,
      animation: {
    duration: 900,
    dashLength: 1.5,
    loop: true,
    headColor: '#e207ff',
    backgroundColor: 'rgba(226, 7, 255, 0.15)',
  },
    });

    const routing = new AnyRouting<HereRoutingData>({
      dataProvider,
      projector,
      plugins: [annotationPlugin, loader],
      waypointsSyncStrategy: 'none',
      // geocoder: async (waypoint) => {
      //  const geocode = await fetch(`https://revgeocode.search.hereapi.com/v1/revgeocode?apiKey=${environment.hereApiKey}&in=circle:${waypoint.position.lat},${waypoint.position.lng};r=50&limit=1&lang=pl&types=address,houseNumber,city,postalCode,area,street&includeUnnamedStreet=true`);
      //   const data = await geocode.json();

      //  console.log(data)
      //   return { ...waypoint, mappedPosition: data.items[0].position, position: data.items[0].position };
      // }
    });

    // map.on('load', async () => {
      routing.initialize();

      routing.setWaypoints([
        { position: { lat: 49.9539315, lng: 18.8531001 }, properties: { label: 'A' } },
        { position: { lng: 21.01178, lat: 52.22977 }, properties: { label: 'B' } },
      ]);

      routing.recalculateRoute();
    // });
  }
}
