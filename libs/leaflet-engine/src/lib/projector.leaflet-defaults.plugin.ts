import { divIcon, Marker } from 'leaflet';

import type {
  LeafletProjectorOptions,
  MarkerFactoryContext,
} from './projector.leaflet.plugin.types';

export const defaultLeafletMarkerFactory = ({
  waypoint,
  routeHover,
}: MarkerFactoryContext): Marker => {
  if ((waypoint && !waypoint.properties.isFirst && !waypoint.properties.isLast) || routeHover) {
    const width = waypoint ? 16 : 12;
    const height = waypoint ? 16 : 12;
    const fill = waypoint ? '#2546fe' : '#e207ff';
    const stroke = waypoint ? '#0b1e61' : '#ffffff';

    const icon = divIcon({
      className: 'marker-wrapper',
      html: `
        <div
          class="marker"
          style="
            width: ${width}px;
            height: ${height}px;
          "
        >
          <svg width="${width}" height="${height}" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" fill="${fill}" stroke="${stroke}" stroke-width="2.5" />
            <circle cx="9" cy="9" r="2.2" fill="#ffffff" opacity="0.75" />
          </svg>
        </div>
      `,
      iconSize: [width, height],
      iconAnchor: [width / 2, height / 2],
    });

    return new Marker([0, 0], {
      icon,
      draggable: !!waypoint,
    });
  }

  const isFirst = waypoint?.properties.isFirst === true;
  const isLast = waypoint?.properties.isLast === true;
  const color = isFirst ? '#11a775' : '#e53935';
  const label = isFirst ? 'A' : isLast ? 'B' : '';
  const size = 48;
  const icon = divIcon({
    className: 'marker-wrapper',
    html: `
      <div class="marker marker-waypoint marker-waypoint-${isFirst ? 'start' : 'end'}">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="${color}"
            stroke="#ffffff"
            stroke-width="1.5"
            d="M12 21.7l-.7-.7a48 48 0 0 1-3.5-4C6.2 14.7 4 12 4 10a8 8 0 1 1 16 0c0 2-2.2 4.7-3.8 7a48 48 0 0 1-3.5 4l-.7.7Z"
          />
          <circle cx="12" cy="10" r="3" fill="#ffffff" />
          ${label ? `<text x="12" y="11.5" text-anchor="middle" font-size="3.5" font-weight="700" fill="${color}">${label}</text>` : ''}
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });

  return new Marker([0, 0], {
    icon,
    draggable: !!waypoint,
  });
};

export const defaultLeafletProjectorOptions = {
  markerFactory: defaultLeafletMarkerFactory,

  routeStyle: {
    color: '#33C9EB',
    weight: 5,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
  },

  routeOutlineStyle: {
    color: '#ffffff',
    weight: 9,
    opacity: 0.95,
    lineCap: 'round',
    lineJoin: 'round',
  },

  selectedRouteStyle: {
    color: '#e207ff',
    weight: 5,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
  },

  maxWaypoints: Infinity,
  canAddWaypoints: true,
  canDragWaypoints: true,
  canSelectRoute: true,
  routesWhileDragging: true,
  waypointDragCommitDebounceTime: 150,
} satisfies Omit<LeafletProjectorOptions, 'map'>;
