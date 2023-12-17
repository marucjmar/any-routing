import { wrap } from 'comlink';

import { ExecutorRequestOptions, HereExecutor } from './here.executor';
import type {
  AnyRoutingDataProvider,
  AnyRoutingDataResponse,
  RequestOptions,
  RouteSummary,
  LngLatPosition,
  Waypoint,
  InternalWaypoint,
  WaypointPosition,
} from '@any-routing/core';

export type SelectRouteStrategy = 'fastest' | 'shortest' | 'cheapest' | 'none';

export type RouteExcludeNoticeDefinitions = {
  [key in 'critical' | 'info']?: string[] | 'all';
};

export type TurnByTurnAction = {
  action: 'arrive' | 'turn' | 'depart';
  duration: number;
  length: number;
  position: { lat: number; lng: number };
  offset: number;
};

export type RoutePath = LngLatPosition[];

export interface HereRouteSummary extends RouteSummary {
  turnByTurnActions: TurnByTurnAction[];
  shapePath: RoutePath;
  rawRoute: any;
}

export { ExecutorRequestOptions } from './here.executor';

export interface HereRoutingData extends AnyRoutingDataResponse {
  routes: HereRouteSummary[];
  requestOptions: ExecutorRequestOptions;
}

export type GeoJsonSplitStrategy = 'jamFactor';

export type Options = {
  alternatives?: number;
  worker?: boolean;
  apiKey: string;
  baseUrl?: string;
  selectRouteStrategy?: SelectRouteStrategy;
  spans?: string[];
  return?: string[];
  currency?: string;
  transportMode?: string;
  queryParams?: Record<string, any>;
  requestParams?: RequestInit;
  routeExcludeNotice?: RouteExcludeNoticeDefinitions;
  shapePolylinePrecision?: number;
  geoJSONShapeSplitStrategies?: { drag?: Array<GeoJsonSplitStrategy>; default?: Array<GeoJsonSplitStrategy> },
  buildUrl?: (ctx: { waypoints: Waypoint[]; options: Options & RequestOptions }, url: string) => string;
};

const defaultOptions: Partial<Options> = {
  baseUrl: 'https://router.hereapi.com/v8/routes',
  transportMode: 'car',
  worker: true,
  alternatives: 2,
  shapePolylinePrecision: 0.0000065,
  geoJSONShapeSplitStrategies: {},
  routeExcludeNotice: {
    critical: 'all',
  },
};

export class HereProvider implements AnyRoutingDataProvider {
  private worker?: Worker;
  private executorAPI: HereExecutor;
  private _options: Options;

  public get options(): Options {
    return this._options;
  }

  constructor(options: Options) {
    this._options = { ...defaultOptions, ...options };

    if (this.options.worker === true) {
      this.worker = new Worker(new URL('./here.worker', import.meta.url), {
        type: 'module',
      });

      // @ts-ignore
      this.executorAPI = wrap<HereExecutor>(this.worker);
    } else {
      this.executorAPI = new HereExecutor();
    }
  }

  public destroy(): void {
    if (this.worker) {
      this.worker.terminate();
    }
  }

  public request(waypoints, opts: RequestOptions): Promise<HereRoutingData> {
    const url = this.buildUrl(waypoints, { ...this.options, ...opts });

    const requestParams = { url, ...this.options, ...opts };
    delete requestParams['buildUrl'];

    return this.executorAPI.request(requestParams);
  }

  public abortAllRequests(): void {
    return this.executorAPI.abortAllRequests();
  }

  public setOption<T extends keyof Options>(optionKey: T, value: Options[T]): void {
    this.options[optionKey] = value;
  }

  public async hasPendingRequests() {
    return this.executorAPI.hasPendingRequests();
  }

  private buildUrl(waypoints: InternalWaypoint[], opts: Options & RequestOptions): string {
    const start = waypoints[0].position;
    const end = waypoints[waypoints.length - 1].position;
    const spans = this.options.spans ? this.options.spans.join(',') : null;
    const Return =
      opts.mode === 'drag'
        ? 'polyline,summary'
        : [...(this.options.return || []), 'polyline', 'summary', 'routeLabels'].join(',');

    const qpObj = {
      apiKey: this.options.apiKey,
      origin: this.formatWp(start),
      destination: this.formatWp(end),
      transportMode: this.options.transportMode || '',
      spans,
      return: Return,
      alternatives: opts.mode === 'default' ? opts?.alternatives ?? 0 : 0,
      currency: this.options.currency || undefined,
      ...this.options.queryParams,
    };

    if (this.options.selectRouteStrategy === 'cheapest' && !qpObj.return.includes('tolls')) {
      qpObj.return += ',tolls';
    }

    const queryParams = Object.keys(qpObj).reduce((acc, key) => {
      if (qpObj[key]) {
        acc[key] = qpObj[key];
      }

      return acc;
    }, {});

    let qp = new URLSearchParams(queryParams).toString();

    if (waypoints.length > 2) {
      qp += `&${this.serializeWaypoints(waypoints)}`;
    }

    const url = `${this.options.baseUrl}?${qp}`;

    return this.options.buildUrl ? this.options.buildUrl({ waypoints, options: opts }, url) : url;
  }

  private serializeWaypoints(waypoints: InternalWaypoint[]) {
    return waypoints
      .slice(1, waypoints.length - 1)
      .map((w) => `via=${this.formatWp(w.position)}`)
      .join('&');
  }

  private formatWp({ lat, lng }: WaypointPosition): string {
    return `${lat},${lng}`;
  }
}
