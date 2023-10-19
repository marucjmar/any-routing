import { AnyRoutingDataProvider, AnyRoutingDataResponse, RouteSummary } from './data-providers';
import type { AnyRouting } from './libre-routing';

export type LngLatPosition = [number, number];

export type WaypointPosition = { lat: number; lng: number };

export type Mode = 'default' | 'drag';

export type BaseEvent<R extends AnyRoutingDataResponse = AnyRoutingDataResponse> = {
  state: AnyRoutingState<R>;
  eventName: keyof MessagePortEventMap;
};

export type CalculationStartedEvent<R extends AnyRoutingDataResponse = AnyRoutingDataResponse> = BaseEvent<R> & {
  waypoints: InternalWaypoint[];
  recalculateOptions: RecalculateOptions;
  mode: Mode;
};

export type CalculationErrorEvent<R extends AnyRoutingDataResponse = AnyRoutingDataResponse> = BaseEvent<R> & {
  error: Error;
  recalculateOptions: RecalculateOptions;
};

export type RoutesFoundEvent<R extends AnyRoutingDataResponse = AnyRoutingDataResponse> = BaseEvent<R> & {
  waypoints: InternalWaypoint[];
  data: R;
  mode: Mode;
  recalculateOptions: RecalculateOptions;
};

export type RouteSelectedEvent<R extends AnyRoutingDataResponse = AnyRoutingDataResponse> = BaseEvent<R> & {
  routeId: number;
  route: RouteSummary;
};

export type WaypointsChangedEvent<R extends AnyRoutingDataResponse = AnyRoutingDataResponse> = BaseEvent<R> & {
  waypoints: InternalWaypoint[];
};

export type WaypointGeocoded<R extends AnyRoutingDataResponse = AnyRoutingDataResponse> = BaseEvent<R> & {
  waypoint: InternalWaypoint;
};

export type LoadingChangedEvent<R extends AnyRoutingDataResponse = AnyRoutingDataResponse> = BaseEvent<R> & {
  loading: boolean;
};

export type StateUpdateSource = 'internal' | 'external';

export type StateUpdatedEvent<R extends AnyRoutingDataResponse = AnyRoutingDataResponse> = BaseEvent<R> & {
  state: AnyRoutingState<R>;
  source: StateUpdateSource;
  updatedProperties: Array<keyof AnyRoutingState<R>>;
};

export interface AnyRoutingEventsMap {
  calculationStarted: CalculationStartedEvent;
  calculationError: CalculationErrorEvent;
  routesFound: RoutesFoundEvent;
  routeSelected: RouteSelectedEvent;
  waypointsChanged: WaypointsChangedEvent;
  waypointGeocoded: WaypointGeocoded;
  loadingChanged: LoadingChangedEvent;
  stateUpdated: StateUpdatedEvent;
}

export type AnyRoutingEvents = keyof AnyRoutingEventsMap;

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
  mode: Mode;
  routesShapeGeojson?: AnyRoutingDataResponse['routesShapeGeojson'];
};

export interface InternalWaypoint {
  index: number;
  position: WaypointPosition;
  originalPosition: WaypointPosition;
  properties: InternalWaypointProperties & Record<string, any>;
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

export type AnyRoutingOptions = {
  dataProvider: AnyRoutingDataProvider;
  geocoder?: AnyRoutingGeocoder | ((waypoint: InternalWaypoint) => Promise<InternalWaypoint>);
  plugins?: PluginFactory[];
  uniqueKey?: string;
  waypointsSyncStrategy: 'none' | 'toPath' | 'geocodeFirst';
};

export interface AnyRoutingPlugin {
  onAdd(AnyRouting: AnyRouting<any>): void;
  onRemove(AnyRouting: AnyRouting<any>): void;
}

export interface RecalculateOptions {
  fitViewToData?: boolean;
  clearMap?: boolean;
  dropPendingRequests?: boolean;
  syncWaypoints?: boolean;
}
