import type { BBox, FeatureCollection, Geometry, LineString } from 'geojson';
import { Waypoint, LngLatPosition } from '../core.model';

export interface AnyRoutingDataProvider {
  request: (waypoints: Waypoint[], opts: RequestOptions) => Promise<AnyRoutingDataResponse>;

  destroy(): void;
  hasPendingRequests(): Promise<boolean>;
  abortAllRequests(): void;
}

export type RequestOptions  = Record<string, unknown>;

export interface AnyRoutingDataResponse {
  rawResponse: unknown;
  routesShapeGeojson: FeatureCollection<Geometry, { routeId: number; waypoint: number }>;
  routes: RouteSummary[];
  selectedRouteId?: number | null;
  routesShapeBounds?: BBox;
  version: number;
  latest: boolean;
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
