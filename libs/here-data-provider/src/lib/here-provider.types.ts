import type { AnyRoutingDataResponse, LngLatPosition, RequestOptions, RouteSummary, Waypoint } from '@any-routing/core';
import type { ExecutorRequestOptions } from './here.executor';

export type SelectRouteStrategy = 'fastest' | 'shortest' | 'cheapest' | 'none';

export type RouteExcludeNoticeDefinitions = {
  [key in 'critical' | 'info']?: string[] | 'all';
};

/**
 * HERE's `action` values on `turnByTurnActions` are documented as an
 * "extensible enum" — HERE can add new maneuver types over time, and
 * clients are expected to handle unknown values gracefully rather than
 * fail. We type the values we know about explicitly (for autocomplete /
 * exhaustiveness where it matters) but keep the type open to any other
 * string so a future HERE rollout doesn't produce values TypeScript
 * silently rejects at compile time / mangles at runtime.
 *
 * Source: HERE Routing API v8 docs — "What is an action".
 */
export type HereActionType =
  | 'depart'
  | 'arrive'
  | 'continue'
  | 'turn'
  | 'uTurn'
  | 'ramp'
  | 'keep'
  | 'roundaboutEnter'
  | 'roundaboutPass'
  | 'roundaboutExit'
  | 'exit'
  | 'ferry'
  | (string & {});

export type TurnByTurnAction = {
  action: HereActionType;
  duration: number;
  length: number;
  position: { lat: number; lng: number };
  offset: number;
};

export type RoutePath = LngLatPosition[];

export interface HereRouteSummary extends RouteSummary {
  turnByTurnActions: TurnByTurnAction[];
  shapePath: RoutePath;
  rawRoute: HereRawRoute;
}

export interface HereRoutingData extends AnyRoutingDataResponse {
  routes: HereRouteSummary[];
  requestOptions: ExecutorRequestOptions;
}

export type GeoJsonSplitStrategy = 'jamFactor';

export type BaseOptions = {
  alternatives?: number;
  worker?: boolean;
  apiKey: string;
  baseUrl?: string;
  selectRouteStrategy?: SelectRouteStrategy;
  spans?: string[];
  return?: string[];
  currency?: string;
  transportMode?: string;
  queryParams?: Record<string, unknown>;
  requestParams?: RequestInit;
  routeExcludeNotice?: RouteExcludeNoticeDefinitions;
  shapePolylinePrecision?: number;
  geoJSONShapeSplitStrategies?: Array<GeoJsonSplitStrategy>;
  buildUrl?: (ctx: { waypoints: Waypoint[]; options: BaseOptions & RequestOptions }, url: string) => string;
};

export type PluginOptions = BaseOptions;

// ---------------------------------------------------------------------------
// HERE Routing API v8 raw response types (the subset the executor reads).
// These model the JSON documented at
// https://docs.here.com/routing/docs/routing-v8-get-started#response and the
// "What is a span" / "What is a notice" guides. Fields not consumed by this
// package are intentionally left out rather than fully modeled, and open
// dictionaries (`spans`) are typed loosely since their shape depends on the
// `spans=` request parameter the caller chose.
// ---------------------------------------------------------------------------

export interface HereRawPlace {
  type: string;
  location: { lat: number; lng: number };
  /** Present only when this endpoint was geocoded from a raw waypoint. */
  originalLocation?: { lat: number; lng: number };
}

export interface HereRawSectionEndpoint {
  place: HereRawPlace;
  time?: string;
}

export interface HereRawSummary {
  duration?: number;
  length?: number;
  baseDuration?: number;
}

export interface HereRawFarePrice {
  value: number;
  currency: string;
}

export interface HereRawFare {
  price?: HereRawFarePrice;
  convertedPrice?: HereRawFarePrice;
}

export interface HereRawToll {
  fares?: HereRawFare[];
}

export interface HereRawDynamicSpeedInfo {
  baseSpeed: number;
  trafficSpeed: number;
  turnTime?: number;
}

/**
 * A single `spans[]` entry. Which attributes are present depends entirely
 * on the `spans=` query param sent in the request (see "What is a span" in
 * the HERE docs), so beyond the `offset` every requested attribute name
 * (`dynamicSpeedInfo`, `names`, `countryCode`, ...) shows up as an optional
 * key — hence the index signature rather than an exhaustive interface.
 */
export interface HereRawSpan {
  offset: number;
  dynamicSpeedInfo?: HereRawDynamicSpeedInfo;
  [attribute: string]: unknown;
}

export interface HereRawAction {
  action: HereActionType;
  duration: number;
  length: number;
  offset: number;
  instruction?: string;
}

export interface HereRawNotice {
  code: string;
  severity: 'critical' | 'info';
}

export interface HereRawSection {
  id: string;
  type: string;
  departure: HereRawSectionEndpoint;
  arrival: HereRawSectionEndpoint;
  summary?: HereRawSummary;
  polyline: string;
  spans?: HereRawSpan[];
  tolls?: HereRawToll[];
  turnByTurnActions?: HereRawAction[];
  notices?: HereRawNotice[];
}

export interface HereRawRouteLabel {
  name: { value: string; language?: string };
}

export interface HereRawRoute {
  id: string;
  sections: HereRawSection[];
  routeLabels?: HereRawRouteLabel[];
}

export interface HereApiResponse {
  routes: HereRawRoute[];
  notices?: HereRawNotice[];
}