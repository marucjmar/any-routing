import { AnyRoutingDataProvider, AnyRoutingDataResponse, RouteSummary } from './data-providers';
import type { AnyRouting } from './core';

export type LngLatPosition = number[];

export type WaypointPosition = { lat: number; lng: number };

export type RoutingEventPayloads<R extends AnyRoutingDataResponse> = {
  calculationStarted: {
    waypoints: InternalWaypoint[];
  };

  calculationError: {
    error: Error;
  };

  routesFound: {
    waypoints: InternalWaypoint[];
    data: R;
  };

  routeSelected: {
    routeId: number;
    route: RouteSummary;
  };

  waypointsChanged: {
    waypoints: InternalWaypoint[];
  };

  waypointGeocoded: {
    waypoint: InternalWaypoint;
  };

  loadingChanged: {
    loading: boolean;
  };

  stateUpdated: {
    updatedProperties: Array<keyof AnyRoutingState<R>>;
  };
};

export type RoutingEvent<
  R extends AnyRoutingDataResponse,
  E extends keyof RoutingEventPayloads<R>
> = RoutingEventPayloads<R>[E] & {
  state: AnyRoutingState<R>;
  eventName: E;
};

export type RoutingEvents<R extends AnyRoutingDataResponse> = {
  calculationStarted: {
    state: AnyRoutingState<R>;
    waypoints: InternalWaypoint[];
  };

  calculationError: {
    state: AnyRoutingState<R>;
    error: Error;
  };

  routesFound: {
    state: AnyRoutingState<R>;
    waypoints: InternalWaypoint[];
    data: R;
  };

  routeSelected: {
    state: AnyRoutingState<R>;
    routeId: number;
    route: RouteSummary;
  };

  waypointsChanged: {
    state: AnyRoutingState<R>;
    waypoints: InternalWaypoint[];
  };

  waypointGeocoded: {
    state: AnyRoutingState<R>;
    waypoint: InternalWaypoint;
  };

  loadingChanged: {
    state: AnyRoutingState<R>;
    loading: boolean;
  };

  stateUpdated: {
    state: AnyRoutingState<R>;
    updatedProperties: Array<keyof AnyRoutingState<R>>;
  };
};


export type InternalWaypointProperties = {
  index: number;
  isFirst: boolean;
  isLast: boolean;
};

export type AnyRoutingState<DataType = AnyRoutingDataResponse> = {
  data: DataType | undefined;
  waypoints: InternalWaypoint[];
  loading: boolean;
  selectedRouteId: number | undefined | null;
  routesShapeGeojson?: AnyRoutingDataResponse['routesShapeGeojson'];
};

export interface InternalWaypoint {
  index: number;
  position: WaypointPosition;
  originalPosition: WaypointPosition;
  properties: InternalWaypointProperties & Record<string, string | boolean | number>;
  geocoded?: boolean;
}

export function isWaypointPositionEqual(posA: WaypointPosition, posB: WaypointPosition): boolean {
  return posA.lat === posB.lat && posA.lng === posB.lng;
}

export class InternalWaypointC {
  public static fromWaypoint(waypoint: Waypoint, props: InternalWaypointProperties): InternalWaypoint {
    return {
      index: props.index,
      originalPosition: waypoint.position,
      position: waypoint.position,
      geocoded: waypoint.geocoded,
      properties: { ...props, ...(waypoint.properties || {}) },
    };
  }
}

export interface Waypoint {
  position: WaypointPosition;
  originalPosition?: WaypointPosition;
  properties?: Record<string, string | boolean | number>;
  geocoded?: boolean;
}

export type PluginFactory = AnyRoutingPlugin | (new (...args: any[]) => AnyRoutingPlugin);

export interface AnyRoutingGeocoder {
  geocode(waypoint: InternalWaypoint): Promise<InternalWaypoint>;
}

export type AnyRoutingProjectorEventMap = {
  previewStarted: Record<string, never>;
  previewFinished: { data: AnyRoutingDataResponse };
  previewError: { error: Error };
  waypointDrag: {
    waypoint: InternalWaypoint;
  };
  waypointDragCommit: {
    waypoint: InternalWaypoint;
  };
  waypointDragEnd: {
    waypoint: InternalWaypoint;
  };
  waypointAdded: {
    waypoint: InternalWaypoint;
  };
  routesProjected: {
    routesShapeGeojson: AnyRoutingDataResponse['routesShapeGeojson'];
  };
  waypointsProjected: {
    waypoints: InternalWaypoint[];
  };
  routeClick: {
    routeId: number;
  };
  routeHighlight: {
    routeId?: number;
  };
  viewStateChanged: {
    state: AnyRoutingState;
    reason: 'route' | 'waypoints' | 'interaction';
  };
};

export interface AnyRoutingProjector {
  waypoints: InternalWaypoint[];
  onAdd(routing: AnyRouting<any>): void;
  onRemove(routing: AnyRouting<any>): void;
  highlightRoute?(routeId?: number): void;
  on<E extends keyof AnyRoutingProjectorEventMap>(
    event: E,
    callback: (event: AnyRoutingProjectorEventMap[E]) => void,
  ): void;
  off<E extends keyof AnyRoutingProjectorEventMap>(
    event: E,
    callback: (event: AnyRoutingProjectorEventMap[E]) => void,
  ): void;
}

export type AnyRoutingOptions<P extends AnyRoutingProjector = AnyRoutingProjector> = {
  dataProvider: AnyRoutingDataProvider;
  projector?: P;
  geocoder?: AnyRoutingGeocoder | ((waypoint: InternalWaypoint) => Promise<InternalWaypoint>);
  plugins?: PluginFactory[];
  uniqueKey?: string;
  waypointsSyncStrategy: 'none' | 'toPath' | 'geocodeFirst';
};

export interface AnyRoutingPlugin {
  onAdd(AnyRouting: AnyRouting<any>): void;
  onRemove(AnyRouting: AnyRouting<any>): void;
}
