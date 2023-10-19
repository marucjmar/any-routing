import { Component, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { LayerSpecification, Map, MapLayerMouseEvent, Marker, SymbolLayerSpecification } from 'maplibre-gl';
import { AnyRouting, StateUpdatedEvent } from '@any-routing/core';
import { HereProvider, HereRoutingData } from '@any-routing/here-data-provider';
import { defaultMapLibreProjectorOptions, MapLibreProjector } from '@any-routing/maplibre-engine';
import { environment } from '../environments/environment';
import { PropagationEvent, setupLayerEventsPropagator } from '@any-routing/maplibre-layers-event-propagator';

@Component({
  selector: 'libre-routing-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit {
  @ViewChild('mapContainer') mapContainer?: ElementRef;

  constructor(private zone: NgZone) {}

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => {
      const map = new Map({
        container: this.mapContainer!.nativeElement,
        center: [13, 51],
        zoom: 4,
        style: `https://assets.vector.hereapi.com/styles/berlin/base/mapbox/tilezen?apikey=${environment.hereApiKey}`,
      });

      const dataProvider = new HereProvider({
        apiKey: environment.hereApiKey,
        transportMode: 'truck',
        return: ['routeLabels', 'turnByTurnActions'],
      });

      const projector = new MapLibreProjector({
        ...defaultMapLibreProjectorOptions,
        map,
      });

      const routing = new AnyRouting<HereRoutingData>({
        dataProvider,
        plugins: [projector],
        waypointsSyncStrategy: 'geocodeFirst',
        geocoder: async (waypoint) => {
         const geocode = await fetch(`https://revgeocode.search.hereapi.com/v1/revgeocode?apiKey=${environment.hereApiKey}&in=circle:${waypoint.position.lat},${waypoint.position.lng};r=50&limit=1&lang=pl&types=houseNumber,city,postalCode,area,district,street&includeUnnamedStreet=true`);
          const data = await geocode.json();

         console.log(waypoint.position, data.items[0])
          return { ...waypoint, mappedPosition: data.items[0].position, position: data.items[0].position };
        }
      });

      map.on('load', async () => {
        routing.initialize();
        // setupLayerEventsPropagator(map);

        // new Marker({ draggable: true }).setLngLat([0, 0]).addTo(map);

        // map.on('click', console.log)
        // map.on('mousemove', 'lake-label', (e: PropagationEvent<MapLayerMouseEvent>) => {
        // //@ts-ignore
        //   console.log(e.features[0].layer.id, e, '1');
        //   //@ts-ignore
        //   e.stopPropagation ? e.stopPropagation() : null;
        // })
        // map.on('mousemove', 'lake-labelx', (e: PropagationEvent<MapLayerMouseEvent>) => {
        //   //@ts-ignore
        //     console.log(e.features[0].layer.id, e, '1');
        //     //@ts-ignore
        //     e.stopPropagation ? e.stopPropagation() : null;
        //     e.stopImmediatePropagation ? e.stopImmediatePropagation() : null;
        //   })
        // //@ts-ignore
        // map.on('click', 'water', (e) => console.log(e.features[0].layer.id));
        // map.on('click', 'lake-label', (e: PropagationEvent<MapLayerMouseEvent>) => {
        //   if (e.isCancelled && e.isCancelled()) {
        //     return;
        //   }

        //   console.log(e, 'click on water label printed');
        //   e.stopPropagation ? e.stopPropagation() : null;
        //   e.stopImmediatePropagation ? e.stopImmediatePropagation() : null;
        // });

        // map.on('click', 'lake-label', (e: PropagationEvent<MapLayerMouseEvent>) => {
        //   if (e.isCancelled && e.isCancelled()) {
        //     return;
        //   }

        //   console.log(e, 'click on water label no printed');
        //   e.stopPropagation ? e.stopPropagation() : null;
        // });

        // map.on('click', 'water', (e: PropagationEvent<MapLayerMouseEvent>) => {
        //   if (e.isCancelled && e.isCancelled()) {
        //     return;
        //   }

        //   console.log(e, 'click on water');
        //   e.stopPropagation ? e.stopPropagation() : null;
        // });

        // map.on('click', (e: PropagationEvent<MapLayerMouseEvent>) => {
        //   //For non layer handlers
        //   if (e.originalEvent.isCancelled && e.originalEvent.isCancelled()) {
        //     return;
        //   }

        //   console.log(e, 'click anywhere else');
        // });

        // const l: SymbolLayerSpecification = {
        //   id: 'lake-labelx',
        //   type: 'symbol',
        //   source: 'omv',
        //   'source-layer': 'water',
        //   filter: ['all', ['==', '$type', 'Point']],
        //   layout: {
        //     'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        //     visibility: 'visible',
        //     'symbol-placement': 'point',
        //     'icon-allow-overlap': true,
        //     'text-ignore-placement': true,
        //     // "text-allow-overlap": true,
        //     'text-font': ['Fira GO Regular'],
        //     'text-max-width': 6,
        //     'text-line-height': 1,
        //   },
        //   paint: {
        //     'text-color': 'rgba(1, 35, 55, 1)',
        //     'text-opacity': 1,
        //     'text-halo-color': 'rgba(255, 255, 255, 0.3)',
        //     'text-halo-width': 1,
        //   },
        // };

        // setTimeout(() => {
        //   map.addLayer(l);
        // }, 7000);

        //@ts-ignore
        // map.on('click', 'lake-label', h)
        // map.off('click', 'lake-label', h)
        // routing.initialize();

        routing.setWaypoints([
          { position: { lat: 49.9539315, lng: 18.8531001 }, properties: { label: 'A' } },
          { position: { lng: 21.01178, lat: 52.22977 }, properties: { label: 'B' } },
        ]);

        routing.recalculateRoute({ fitViewToData: true });
      });
    });
  }
}
