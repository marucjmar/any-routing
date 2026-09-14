import type {
  AnyRoutingDataResponse,
  RequestOptions,
  RouteSummary,
  Waypoint,
} from '@any-routing/core';
import type { ExecutorRequestOptions } from './valhalla.executor';

export type ValhallaLocationType = 'break' | 'through' | 'via' | 'break_through';
export type ValhallaUnits = 'kilometers' | 'miles';

export interface ValhallaRouteSummary extends RouteSummary {
  rawRoute: ValhallaRawTrip;
}

export interface ValhallaRoutingData extends AnyRoutingDataResponse {
  routes: ValhallaRouteSummary[];
  requestOptions: ExecutorRequestOptions;
}

export interface ValhallaRawManeuver {
  type?: number;
  instruction?: string;
  length?: number;
  time?: number;
  begin_shape_index?: number;
  end_shape_index?: number;
  [key: string]: unknown;
}

export interface ValhallaRawLeg {
  shape: string;
  summary?: { length?: number; time?: number; cost?: number };
  maneuvers?: ValhallaRawManeuver[];
}

export interface ValhallaRawLocation {
  lat: number;
  lon: number;
  type?: ValhallaLocationType;
  original_index?: number;
}

export interface ValhallaRawTrip {
  locations: ValhallaRawLocation[];
  legs: ValhallaRawLeg[];
  summary?: { length?: number; time?: number; cost?: number };
  status?: number;
  status_message?: string;
  units?: string;
  [key: string]: unknown;
}

export interface ValhallaApiResponse {
  trip?: ValhallaRawTrip;
  alternates?: Array<{ trip: ValhallaRawTrip }>;
  error_code?: number;
  error?: string;
  status?: number;
  status_message?: string;
}

export type Options = {
  baseUrl?: string;
  worker?: boolean;
  costing?: string;
  costingOptions?: Record<string, unknown>;
  units?: ValhallaUnits;
  language?: string;
  alternatives?: number;
  shapeFormat?: 'polyline6' | 'polyline5';
  directionsOptions?: Record<string, unknown>;
  queryParams?: Record<string, string | number | boolean>;
  requestParams?: RequestInit;
  buildUrl?: (
    ctx: { waypoints: Waypoint[]; options: Options & RequestOptions },
    url: string,
  ) => string;
};

export class ValhallaAPIError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: {
      error?: string;
      error_code?: number;
      status_code?: number;
      status: string;
    },
  ) {
    super(message);
    this.name = 'ValhallaAPIError';
  }
}
