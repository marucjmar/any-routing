import type { AnyRoutingDataResponse, RequestOptions, RouteSummary, Waypoint } from '@any-routing/core';
import type { ExecutorRequestOptions } from './google.executor';

export type GoogleTravelMode = 'DRIVE' | 'BICYCLE' | 'WALK' | 'TWO_WHEELER' | 'TRANSIT';
export type GoogleRoutingPreference =
  | 'ROUTING_PREFERENCE_UNSPECIFIED'
  | 'TRAFFIC_UNAWARE'
  | 'TRAFFIC_AWARE'
  | 'TRAFFIC_AWARE_OPTIMAL';
export type GoogleUnits = 'METRIC' | 'IMPERIAL';

export interface GoogleRouteSummary extends RouteSummary {
  rawRoute: GoogleRawRoute;
}

export interface GoogleRoutingData extends AnyRoutingDataResponse {
  routes: GoogleRouteSummary[];
  requestOptions: ExecutorRequestOptions;
}

export interface GoogleRawLeg {
  startLocation?: GoogleWaypoint;
  endLocation?: GoogleWaypoint;
  polyline?: { encodedPolyline?: string };
  duration?: string;
  distanceMeters?: number;
  [key: string]: unknown;
}

export interface GoogleRawRoute {
  distanceMeters?: number;
  duration?: string;
  polyline?: { encodedPolyline?: string };
  legs?: GoogleRawLeg[];
  description?: string;
  [key: string]: unknown;
}

export interface GoogleApiResponse {
  routes?: GoogleRawRoute[];
  [key: string]: unknown;
}

export interface GoogleWaypoint {
  location: { latLng: { latitude?: number; longitude?: number } };
}

export type Options = {
  apiKey?: string;
  baseUrl?: string;
  worker?: boolean;
  travelMode?: GoogleTravelMode;
  routingPreference?: GoogleRoutingPreference;
  units?: GoogleUnits;
  languageCode?: string;
  regionCode?: string;
  alternatives?: number;
  routeModifiers?: Record<string, unknown>;
  extraComputations?: string[];
  fieldMask?: string;
  queryParams?: Record<string, string | number | boolean>;
  requestParams?: RequestInit;
  buildUrl?: (
    ctx: { waypoints: Waypoint[]; options: Options & RequestOptions },
    url: string,
  ) => string;
};
