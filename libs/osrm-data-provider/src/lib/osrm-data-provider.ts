import { wrap, Remote } from 'comlink';

import { ExecutorRequestOptions, OsrmExecutor } from './osrm.executor';
import type {
  AnyRoutingDataProvider,
  RequestOptions,
  Waypoint,
  WaypointPosition,
} from '@any-routing/core';
import { OsrmRoutingData, Options } from './osrm-provider.types';

const defaultOptions: Partial<Options> = {
  baseUrl: 'https://router.project-osrm.org/route/v1/driving',
  worker: true,
  alternatives: 0,
  steps: true,
  geometries: 'geojson',
  overview: 'full',
};

export class OsrmProvider implements AnyRoutingDataProvider {
  private worker?: Worker;
  // Comlink's `wrap` returns a `Remote<T>` proxy whose methods always
  // resolve to promises, even for originally-synchronous ones — typing
  // this union up front avoids the `@ts-ignore` a plain assignment would
  // otherwise need.
  private executorAPI: OsrmExecutor | Remote<OsrmExecutor>;
  private _options: Options;

  public get options(): Options {
    return this._options;
  }

  constructor(options: Options = {}) {
    this._options = { ...defaultOptions, ...options };

    if (this.options.worker === true) {
      this.worker = new Worker(new URL('./osrm.worker', import.meta.url), {
        type: 'module',
      });

      this.executorAPI = wrap<OsrmExecutor>(this.worker);
    } else {
      this.executorAPI = new OsrmExecutor();
    }
  }

  public destroy(): void {
    if (this.worker) {
      this.worker.terminate();
    }
  }

  public request(waypoints: Waypoint[], opts: RequestOptions): Promise<OsrmRoutingData> {
    const url = this.buildUrl(waypoints, { ...this.options, ...opts });

    // `buildUrl` is a function and must never be forwarded into
    // `requestParams` below — when running with `worker: true`,
    // `executorAPI` is a Comlink `Remote<OsrmExecutor>` and the call goes
    // through `postMessage`'s structured clone algorithm, which cannot
    // clone functions and throws `DataCloneError` at runtime.
    const requestOptions = { ...this.options, ...opts, url };
    delete requestOptions.buildUrl;
    const requestParams: ExecutorRequestOptions = requestOptions;

    return this.executorAPI.request(requestParams);
  }

  public async abortAllRequests(): Promise<void> {
    await this.executorAPI.abortAllRequests();
  }

  public setOption<T extends keyof Options>(optionKey: T, value: Options[T]): void {
    this.options[optionKey] = value;
  }

  public async hasPendingRequests(): Promise<boolean> {
    return await this.executorAPI.hasPendingRequests();
  }

  private buildUrl(waypoints: Waypoint[], opts: Options & RequestOptions): string {
    if (!waypoints[0] || !waypoints[waypoints.length - 1]) {
      throw new Error('At least two waypoints are required');
    }

    const coordinates = waypoints.map((w) => this.formatWp(w.position)).join(';');

    const queryParamsObj: Record<string, string | number | boolean | undefined | null> = {
      alternatives: opts.mode === 'default' ? opts.alternatives ?? 0 : 0,
      steps: opts.steps,
      geometries: opts.geometries || 'geojson',
      overview: opts.overview || 'full',
      continue_straight: opts.continueStraight,
      annotations: opts.annotations,
      ...opts.queryParams,
    };

    // Only truthy/explicitly-set values are sent, matching OSRM's own
    // defaults for anything omitted (mirrors here-data-provider's filter).
    const queryParams: Record<string, string> = Object.entries(queryParamsObj).reduce(
      (acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = String(value);
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    const qp = new URLSearchParams(queryParams).toString();

    const url = `${this.options.baseUrl}/${coordinates}${qp ? `?${qp}` : ''}`;

    return this.options.buildUrl ? this.options.buildUrl({ waypoints, options: opts }, url) : url;
  }

  private formatWp({ lat, lng }: WaypointPosition): string {
    return `${lng},${lat}`;
  }
}
