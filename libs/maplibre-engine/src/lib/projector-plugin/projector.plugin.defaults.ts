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
    el.style.backgroundImage = `url(data:image/svg+xml;base64,PHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczpzb2RpcG9kaT0iaHR0cDovL3NvZGlwb2RpLnNvdXJjZWZvcmdlLm5ldC9EVEQvc29kaXBvZGktMC5kdGQiCiAgIHhtbG5zOmlua3NjYXBlPSJodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy9uYW1lc3BhY2VzL2lua3NjYXBlIgogICB3aWR0aD0iMjAwIgogICBoZWlnaHQ9IjIwMCIKICAgdmVyc2lvbj0iMS4xIgogICBpZD0ic3ZnMiIKICAgaW5rc2NhcGU6dmVyc2lvbj0iMC45MSByMTM3MjUiCiAgIHNvZGlwb2RpOmRvY25hbWU9IkRvdF9ncmVlbl8wZDIuc3ZnIj4KICA8bWV0YWRhdGEKICAgICBpZD0ibWV0YWRhdGExMCI+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPgogICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PgogICAgICAgIDxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz4KICAgICAgICA8ZGM6dGl0bGU+PC9kYzp0aXRsZT4KICAgICAgPC9jYzpXb3JrPgogICAgPC9yZGY6UkRGPgogIDwvbWV0YWRhdGE+CiAgPGRlZnMKICAgICBpZD0iZGVmczgiIC8+CiAgPHNvZGlwb2RpOm5hbWVkdmlldwogICAgIHBhZ2Vjb2xvcj0iI2ZmZmZmZiIKICAgICBib3JkZXJjb2xvcj0iIzY2NjY2NiIKICAgICBib3JkZXJvcGFjaXR5PSIxIgogICAgIG9iamVjdHRvbGVyYW5jZT0iMTAiCiAgICAgZ3JpZHRvbGVyYW5jZT0iMTAiCiAgICAgZ3VpZGV0b2xlcmFuY2U9IjEwIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwIgogICAgIGlua3NjYXBlOnBhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6d2luZG93LXdpZHRoPSIxOTIwIgogICAgIGlua3NjYXBlOndpbmRvdy1oZWlnaHQ9IjEwMjgiCiAgICAgaWQ9Im5hbWVkdmlldzYiCiAgICAgc2hvd2dyaWQ9ImZhbHNlIgogICAgIGlua3NjYXBlOnpvb209IjIuMzQ3ODE1NSIKICAgICBpbmtzY2FwZTpjeD0iMTMzLjc0MDE2IgogICAgIGlua3NjYXBlOmN5PSIxMjAuMzg0OTYiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9Ii04IgogICAgIGlua3NjYXBlOndpbmRvdy15PSItOCIKICAgICBpbmtzY2FwZTp3aW5kb3ctbWF4aW1pemVkPSIxIgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9InN2ZzIiIC8+CiAgPGNpcmNsZQogICAgIGN4PSIxMDAiCiAgICAgY3k9IjEwMCIKICAgICByPSI5NSIKICAgICBmaWxsPSIjMDFERjAxIgogICAgIHN0cm9rZT0iIzIxNjEwQiIKICAgICBzdHJva2Utd2lkdGg9IjMlIgogICAgIGlkPSJjaXJjbGU0IgogICAgIHN0eWxlPSJzdHJva2U6IzBiMWU2MTtzdHJva2Utb3BhY2l0eToxO2ZpbGw6IzI1NDZmZTtmaWxsLW9wYWNpdHk6MTtzdHJva2Utd2lkdGg6OS4wMztzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZSIgLz4KPC9zdmc+)`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.backgroundSize = '100%';
    el.style.zIndex = '100';

    return new Marker({ element: el });
  }

  const el = document.createElement('div');
    const width = 48
    const height = 48
    el.className = 'marker';
    el.style.backgroundImage = `url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiPjxwYXRoIGZpbGw9IiMxMWE3NzUiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTExLjI5MSAyMS43MDZMMTIgMjFsLS43MDkuNzA2ek0xMiAyMWwuNzA4LjcwNmExIDEgMCAwIDEtMS40MTcgMGwtLjAwNi0uMDA3bC0uMDE3LS4wMTdsLS4wNjItLjA2M2E0Ny43MDggNDcuNzA4IDAgMCAxLTEuMDQtMS4xMDZhNDkuNTYyIDQ5LjU2MiAwIDAgMS0yLjQ1Ni0yLjkwOGMtLjg5Mi0xLjE1LTEuODA0LTIuNDUtMi40OTctMy43MzRDNC41MzUgMTIuNjEyIDQgMTEuMjQ4IDQgMTBjMC00LjUzOSAzLjU5Mi04IDgtOGM0LjQwOCAwIDggMy40NjEgOCA4YzAgMS4yNDgtLjUzNSAyLjYxMi0xLjIxMyAzLjg3Yy0uNjkzIDEuMjg2LTEuNjA0IDIuNTg1LTIuNDk3IDMuNzM1YTQ5LjU4MyA0OS41ODMgMCAwIDEtMy40OTYgNC4wMTRsLS4wNjIuMDYzbC0uMDE3LjAxN2wtLjAwNi4wMDZMMTIgMjF6bTAtOGEzIDMgMCAxIDAgMC02YTMgMyAwIDAgMCAwIDZ6IiBjbGlwLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=)`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.backgroundSize = '100%';
    el.style.top = "-24px";
    el.style.zIndex = '200';

  return new Marker({ element: el });
};

export const mapLibreProjectorDefaultRoutetLayer = ({
  sourceId,
  routing,
}: LayerFactoryContext): LayerRef => {
  const specification: LayerSpecification = {
    id: routing.getUniqueName(`base-route`),
    type: 'line',
    source: sourceId,
    minzoom: 1,
    maxzoom: 20,
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': [
        'case',

        // selected
        // ['==', ['feature-state', 'selected'], true],
        // '#e207ff',

        // index === 0
        ['all', ['==', ['get', 'routeId'], 0], ['==',  ['coalesce', ['feature-state', 'selected'], false], true]],
        '#E53935',
        ['all', ['==', ['get', 'routeId'], 0], ['==',  ['coalesce', ['feature-state', 'hover'], false], true]],
        '#E53945',
        ['all', ['==', ['get', 'routeId'], 0], ['==',  ['coalesce', ['feature-state', 'selected'], false], false]],
        '#d48b8a',

        // index === 1
        ['all', ['==', ['get', 'routeId'], 1], ['==',  ['coalesce', ['feature-state', 'selected'], false], true]],
        '#43A047',
        ['all', ['==', ['get', 'routeId'], 1], ['==',  ['coalesce', ['feature-state', 'hover'], false], true]],
        '#43A067',
        ['all', ['==', ['get', 'routeId'], 1], ['==',  ['coalesce', ['feature-state', 'selected'], false], false]],
        '#7ea880',

        // index === 2
        ['all', ['==', ['get', 'routeId'], 2], ['==',  ['coalesce', ['feature-state', 'selected'], false], true]],
        '#1E88E5',
        ['all', ['==', ['get', 'routeId'], 2], ['==',  ['coalesce', ['feature-state', 'hover'], false], true]],
        '#1E88E9',
        ['all', ['==', ['get', 'routeId'], 2], ['==',  ['coalesce', ['feature-state', 'selected'], false], false]],
        '#8fa9bf',

        // default
        '#FB8C00',
      ],
      // 'line-offset': [
      //   'case',

      //   // selected
      //   // ['==', ['feature-state', 'selected'], true],
      //   // '#e207ff',

      //   // index === 0
      //   ['all', ['==', ['get', 'routeId'], 0], ['==',  ['coalesce', ['feature-state', 'selected'], false], true]],
      //   1,
      //   ['all', ['==', ['get', 'routeId'], 0], ['==',  ['coalesce', ['feature-state', 'selected'], false], false]],
      //   1,

      //   // index === 1
      //   ['all', ['==', ['get', 'routeId'], 1], ['==',  ['coalesce', ['feature-state', 'selected'], false], true]],
      //   4,
      //   ['all', ['==', ['get', 'routeId'], 1], ['==',  ['coalesce', ['feature-state', 'selected'], false], false]],
      //   4,

      //   // index === 2
      //   ['all', ['==', ['get', 'routeId'], 2], ['==',  ['coalesce', ['feature-state', 'selected'], false], true]],
      //   -3,
      //   ['all', ['==', ['get', 'routeId'], 2], ['==',  ['coalesce', ['feature-state', 'selected'], false], false]],
      //   -3,

      //   // default
      //   0,
      // ],
      'line-width': 5,
      // 'line-offset': ['step', ['line-progress'], 0, 0, 0.45, 20, 0.75, 30, 1],
    },
    metadata: {
      'anyRouting': routing.getUniqueName(`base-route`)
    }
  };

  return { specification };
};

export const mapLibreProjectorDefaultBackgroundRoutetLayer = ({
  sourceId,
  routing,
}: LayerFactoryContext): LayerRef => {
  const specification: LayerSpecification = {
    id: routing.getUniqueName(`background-route`),
    type: 'line',
    source: sourceId,
    minzoom: 1,
    maxzoom: 20,
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': [
        'case',

        ['==', ['feature-state', 'selected'], true],
        '#6e6f70',

        // default
        '#b6b8ba',
      ],
      'line-width': 8,
      // 'line-offset': [
      //   'case',

      //   // selected
      //   // ['==', ['feature-state', 'selected'], true],
      //   // '#e207ff',

      //   // index === 0
      //   ['all', ['==', ['get', 'routeId'], 0], ['==',  ['coalesce', ['feature-state', 'selected'], false], true]],
      //   1,
      //   ['all', ['==', ['get', 'routeId'], 0], ['==',  ['coalesce', ['feature-state', 'selected'], false], false]],
      //   1,

      //   // index === 1
      //   ['all', ['==', ['get', 'routeId'], 1], ['==',  ['coalesce', ['feature-state', 'selected'], false], true]],
      //   4,
      //   ['all', ['==', ['get', 'routeId'], 1], ['==',  ['coalesce', ['feature-state', 'selected'], false], false]],
      //   4,

      //   // index === 2
      //   ['all', ['==', ['get', 'routeId'], 2], ['==',  ['coalesce', ['feature-state', 'selected'], false], true]],
      //   -3,
      //   ['all', ['==', ['get', 'routeId'], 2], ['==',  ['coalesce', ['feature-state', 'selected'], false], false]],
      //   -3,

      //   // default
      //   0,
      // ],
      // 'line-offset': ['step', ['line-progress'], 0, 0, 0.45, 20, 0.75, 30, 1],
    },
    metadata: {
      'anyRouting': routing.getUniqueName(`base-route`)
    }
  };

  return { specification };
};

export const defaultMapLibreProjectorOptions: Omit<MapLibreProjectorOptions, 'map'> = {
  routeLayersFactory: [mapLibreProjectorDefaultBackgroundRoutetLayer, mapLibreProjectorDefaultRoutetLayer],
  markerFactory: defaultMarkerFactory,
  routesSourceId: 'routes',
};
