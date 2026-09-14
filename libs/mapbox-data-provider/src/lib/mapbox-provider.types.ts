import type {
  AnyRoutingDataResponse,
  RequestOptions,
  RouteSummary,
  Waypoint,
} from '@any-routing/core';
import type { ExecutorRequestOptions } from './mapbox.executor';

export type MapboxProfile = 'driving' | 'driving-traffic' | 'walking' | 'cycling' | (string & {});

export type MapboxGeometry = 'geojson' | 'polyline' | 'polyline6';
export type MapboxOverview = 'full' | 'simplified' | 'false';

export interface MapboxRouteSummary extends RouteSummary {
  rawRoute: MapboxRawRoute;
}

export interface MapboxRoutingData extends AnyRoutingDataResponse {
  routes: MapboxRouteSummary[];
  requestOptions: ExecutorRequestOptions;
}

export interface MapboxRawStep {
  distance: number;
  duration: number;
  name?: string;
  geometry?: MapboxRawLineString;
  maneuver?: {
    location: [number, number];
    type?: string;
    modifier?: string;
    instruction?: string;
  };
  [key: string]: unknown;
}

export interface MapboxRawLeg {
  distance: number;
  duration: number;
  steps?: MapboxRawStep[];
  summary?: string;
}

export interface MapboxRawLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface MapboxRawRoute {
  distance: number;
  duration: number;
  geometry: MapboxRawLineString;
  legs: MapboxRawLeg[];
  weight?: number;
  weight_name?: string;
  [key: string]: unknown;
}

export interface MapboxRawWaypoint {
  name?: string;
  location: [number, number];
  distance?: number;
  waypoint_index?: number;
  trips_index?: number;
}

export interface MapboxApiResponse {
  code: string;
  message?: string;
  routes?: MapboxRawRoute[];
  waypoints?: MapboxRawWaypoint[];
}

export type Options = {
  accessToken: string;
  baseUrl?: string;
  profile?: MapboxProfile;
  worker?: boolean;
  alternatives?: boolean;
  steps?: boolean;
  overview?: MapboxOverview;
  geometries?: MapboxGeometry;
  annotations?: boolean | string[];
  continueStraight?: boolean | 'default';
  language?: string;
  bannerInstructions?: boolean;
  voiceInstructions?: boolean;
  voiceUnits?: 'imperial' | 'metric';
  exclude?: string | string[];
  approaches?: string | string[];
  avoidManeuverRestrictions?: boolean;
  queryParams?: Record<string, string | number | boolean>;
  requestParams?: RequestInit;
  buildUrl?: (
    ctx: { waypoints: Waypoint[]; options: Options & RequestOptions },
    url: string,
  ) => string;
};
