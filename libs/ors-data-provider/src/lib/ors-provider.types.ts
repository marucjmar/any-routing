import type { AnyRoutingDataResponse, RequestOptions, RouteSummary, Waypoint } from '@any-routing/core';
import type { ExecutorRequestOptions } from './ors.executor';

export type OrsProfile =
  | 'driving-car'
  | 'driving-hgv'
  | 'cycling-regular'
  | 'cycling-road'
  | 'cycling-mountain'
  | 'cycling-electric'
  | 'foot-walking'
  | 'foot-hiking'
  | 'wheelchair'
  | 'public-transport'
  | (string & {});

export type OrsPreference = 'fastest' | 'shortest' | 'recommended' | 'custom';
export type OrsUnits = 'm' | 'km' | 'mi';

export interface OrsRouteSummary extends RouteSummary {
  rawRoute: OrsRawFeature;
}

export interface OrsRoutingData extends AnyRoutingDataResponse {
  routes: OrsRouteSummary[];
  requestOptions: ExecutorRequestOptions;
}

export interface OrsRawStep {
  distance: number;
  duration: number;
  instruction?: string;
  name?: string;
  type?: number;
  way_points?: [number, number];
}

export interface OrsRawSegment {
  distance: number;
  duration: number;
  steps?: OrsRawStep[];
  way_points?: [number, number];
}

export interface OrsRawFeatureProperties {
  summary?: { distance?: number; duration?: number; ascent?: number; descent?: number };
  segments?: OrsRawSegment[];
  way_points?: [number, number];
  [key: string]: unknown;
}

export interface OrsRawFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  properties: OrsRawFeatureProperties;
}

export interface OrsApiResponse {
  type: 'FeatureCollection';
  features?: OrsRawFeature[];
  bbox?: number[];
  metadata?: Record<string, unknown>;
}

export interface OrsApiErrorResponse {
  error?: {
    code?: number | string;
    message?: string;
  };
  message?: string;
  code?: number | string;
}

export type Options = {
  apiKey: string;
  profile?: OrsProfile;
  baseUrl?: string;
  worker?: boolean;
  alternatives?: number;
  preference?: OrsPreference;
  units?: OrsUnits;
  language?: string;
  instructions?: boolean;
  instructionsFormat?: 'text' | 'html';
  maneuvers?: boolean;
  geometry?: boolean;
  extraInfo?: string[];
  attributes?: string[];
  continueStraight?: boolean;
  elevation?: boolean;
  options?: Record<string, unknown>;
  queryParams?: Record<string, string | number | boolean>;
  requestParams?: RequestInit;
  buildUrl?: (ctx: { waypoints: Waypoint[]; options: Options & RequestOptions }, url: string) => string;
};
