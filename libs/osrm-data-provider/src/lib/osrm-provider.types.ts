import type { AnyRoutingDataResponse, RequestOptions, RouteSummary, Waypoint } from '@any-routing/core';
import type { ExecutorRequestOptions } from './osrm.executor';

export type OsrmGeometry = 'polyline' | 'polyline6' | 'geojson';
export type OsrmOverview = 'simplified' | 'full' | 'false';

export interface OsrmRouteSummary extends RouteSummary {
  rawRoute: OsrmRawRoute;
}

export interface OsrmRoutingData extends AnyRoutingDataResponse {
  routes: OsrmRouteSummary[];
  requestOptions: ExecutorRequestOptions;
}

export type Options = {
  /**
   * Base URL of the OSRM HTTP server up to and including the profile, e.g.
   * `https://router.project-osrm.org/route/v1/driving`. `{coordinates}` and
   * query options are appended by this provider.
   */
  baseUrl?: string;
  worker?: boolean;
  alternatives?: number;
  steps?: boolean;
  annotations?: boolean | 'nodes' | 'distance' | 'duration' | 'datasources' | 'weight' | 'speed';
  geometries?: OsrmGeometry;
  overview?: OsrmOverview;
  continueStraight?: 'default' | boolean;
  queryParams?: Record<string, unknown>;
  requestParams?: RequestInit;
  buildUrl?: (ctx: { waypoints: Waypoint[]; options: Options & RequestOptions }, url: string) => string;
};

// ---------------------------------------------------------------------------
// OSRM `route` service raw response types (the subset the executor reads).
// Modeled after https://project-osrm.org/docs/v5.24.0/api/#route-service and
// the OSRM HTTP API docs. `geometries=geojson` is always requested by this
// provider so `geometry` is always a GeoJSON `LineString`.
// ---------------------------------------------------------------------------

export interface OsrmRawLineStringGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface OsrmRawStepManeuver {
  location: [number, number];
  bearing_before: number;
  bearing_after: number;
  type: string;
  modifier?: string;
  exit?: number;
}

export interface OsrmRawStep {
  distance: number;
  duration: number;
  weight?: number;
  name: string;
  ref?: string;
  geometry: OsrmRawLineStringGeometry;
  maneuver: OsrmRawStepManeuver;
}

export interface OsrmRawLeg {
  distance: number;
  duration: number;
  weight?: number;
  summary?: string;
  steps: OsrmRawStep[];
}

export interface OsrmRawRoute {
  distance: number;
  duration: number;
  weight?: number;
  weight_name?: string;
  geometry: OsrmRawLineStringGeometry;
  legs: OsrmRawLeg[];
}

export interface OsrmRawWaypoint {
  hint?: string;
  distance: number;
  name: string;
  location: [number, number];
}

export interface OsrmApiResponse {
  code: string;
  message?: string;
  waypoints?: OsrmRawWaypoint[];
  routes?: OsrmRawRoute[];
}
