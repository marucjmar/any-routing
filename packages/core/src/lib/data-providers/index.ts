import type { BBox, FeatureCollection, Geometry, LineString } from '@turf/helpers';
import { Waypoint, LngLatPosition, Mode } from '../libre-routing.model';

export interface AnyRoutingDataProvider {
  request: (waypoints: Waypoint[], opts: RequestOptions) => Promise<AnyRoutingDataResponse>;

  destroy(): void;
  hasPendingRequests(): Promise<boolean>;
  abortAllRequests(): void;
}

export interface RequestOptions {
  mode: Mode;
}

export interface AnyRoutingDataResponse {
  rawResponse: any;
  routesShapeGeojson: FeatureCollection<Geometry, { routeId: number; waypoint: number }>;
  routes: RouteSummary[];
  selectedRouteId?: number | null;
  routesShapeBounds?: BBox;
  version: number;
  latest: boolean;
  mode: Mode;
}

export type RoutePath = LngLatPosition[];

export interface RouteSummary {
  id: number;
  label?: string;
  path: RoutePath;
  durationTime: number;
  arriveTime: Date;
  departureTime: Date;
  distance: number;
  cost?: number;
  waypoints: { lat: number; lng: number }[];
  shape: FeatureCollection<LineString, { routeId: number; waypoint: number }>;
}

export * from './errors';
