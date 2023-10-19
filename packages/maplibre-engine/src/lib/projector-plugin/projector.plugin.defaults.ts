import { LayerSpecification, Marker } from 'maplibre-gl';
import type {
  LayerFactoryContext,
  LayerRef,
  MapLibreProjectorOptions,
  MarkerFactoryContext,
} from './projector.plugin.types';

export const defaultMarkerFactory = ({ waypoint, routeHover }: MarkerFactoryContext): Marker => {
  if ((waypoint && !waypoint.properties.isFirst && !waypoint.properties.isLast) || routeHover) {
    const el = document.createElement('div');
    const width = waypoint ? 16 : 12;
    const height = waypoint ? 16 : 12;
    el.className = 'marker';
    el.style.backgroundImage = `url(https://upload.wikimedia.org/wikipedia/commons/6/64/Blue_dot_with_stroke.svg)`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.backgroundSize = '100%';

    return new Marker(el);
  }

  return new Marker();
};

export const mapLibreProjectorDefaultRoutetLayer = ({ sourceId, routing }: LayerFactoryContext): LayerRef => {
  const specification: LayerSpecification = {
    id: routing.getUniqueName(`base-route`),
    type: 'line',
    source: sourceId,
    minzoom: 1,
    maxzoom: 20,
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
      'line-sort-key': ['case', ['==', ['get', 'selected'], true], 1, 0],
    },
    paint: {
      'line-color': ['case', ['==', ['get', 'selected'], true], '#e207ff', '#33C9EB'],
      'line-width': 4,
    },
  };

  return { specification };
};

export const defaultMapLibreProjectorOptions: Omit<MapLibreProjectorOptions, 'map'> = {
  routeLayersFactory: [mapLibreProjectorDefaultRoutetLayer],
  markerFactory: defaultMarkerFactory,
  routesSourceId: 'routes',
};
