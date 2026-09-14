import { wrap, Remote } from 'comlink';

import { ExecutorRequestOptions, HereExecutor } from './here.executor';
import type {
  AnyRoutingDataProvider,
  RequestOptions,
  Waypoint,
  WaypointPosition,
} from '@any-routing/core';
import { HereRoutingData, PluginOptions } from './here-provider.types';

const defaultOptions: Partial<PluginOptions> = {
  baseUrl: 'https://router.hereapi.com/v8/routes',
  transportMode: 'car',
  worker: true,
  alternatives: 2,
  shapePolylinePrecision: 0.0000065,
  routeExcludeNotice: {
    critical: 'all',
  },
};

export class HereProvider implements AnyRoutingDataProvider {
  private worker?: Worker;
  // Comlink's `wrap` returns a `Remote<T>` proxy whose methods always
  // resolve to promises, even for originally-synchronous ones — typing
  // this union up front avoids the `@ts-ignore` the previous version
  // needed on assignment.
  private executorAPI: HereExecutor | Remote<HereExecutor>;
  private _options: PluginOptions;

  public get options(): PluginOptions {
    return this._options;
  }

  constructor(defaultModeOptions: PluginOptions) {
    this._options = { ...defaultOptions, ...defaultModeOptions };

    if (this.options.worker === true) {
      this.worker = new Worker(new URL('./here.worker', import.meta.url), {
        type: 'module',
      });

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

  public request(waypoints: Waypoint[], opts: Record<string, unknown>): Promise<HereRoutingData> {
    const configOptions = this.options;

    const url = this.buildUrl(waypoints, { ...configOptions, ...opts });

    // `buildUrl` is a function and must never be forwarded into
    // `requestParams` below — when running with `worker: true`,
    // `executorAPI` is a Comlink `Remote<HereExecutor>` and the call goes
    // through `postMessage`'s structured clone algorithm, which cannot
    // clone functions and throws `DataCloneError` at runtime. A previous
    // revision of this file destructured `buildUrl` out for exactly this
    // reason; that got lost in the last edit — restoring it here.
    const requestOptions = { ...configOptions, ...opts, url };
    delete requestOptions.buildUrl;
    const requestParams: ExecutorRequestOptions = requestOptions;

    return this.executorAPI.request(requestParams);
  }

  public async abortAllRequests(): Promise<void> {
    await this.executorAPI.abortAllRequests();
  }

  public setOption<T extends keyof PluginOptions>(optionKey: T, value: PluginOptions[T]): void {
    this.options[optionKey] = value;
  }

  public async hasPendingRequests(): Promise<boolean> {
    return await this.executorAPI.hasPendingRequests();
  }

  private buildUrl(waypoints: Waypoint[], opts: PluginOptions & RequestOptions): string {
    if (!waypoints[0] || !waypoints[waypoints.length - 1]) {
      throw new Error('At least two waypoints are required');
    }

    const start = waypoints[0].position;
    const end = waypoints[waypoints.length - 1].position;

    const spans = opts.spans?.join(',') ?? null;

    const returnFields = [...(opts.return || []), 'polyline', 'summary', 'routeLabels'].join(',');

    const queryParamsObj: Record<string, string | number | undefined | null> = {
      apiKey: opts.apiKey,
      origin: this.formatWp(start),
      destination: this.formatWp(end),
      transportMode: opts.transportMode || '',
      spans,
      return: returnFields,
      alternatives: opts?.alternatives ?? 0,
      currency: opts.currency || undefined,
      ...opts.queryParams,
    };

    if (this.options.selectRouteStrategy === 'cheapest' && !String(queryParamsObj['return']).includes('tolls')) {
      queryParamsObj['return'] = `${queryParamsObj['return']},tolls`;
    }

    // Preserves the original truthy filter (drops 0 / '' / null / undefined),
    // just stringifies everything up front so `URLSearchParams` type-checks.
    const queryParams: Record<string, string> = Object.entries(queryParamsObj).reduce(
      (acc, [key, value]) => {
        if (value) {
          acc[key] = String(value);
        }
        return acc;
      },
      {} as Record<string, string>
    );

    let qp = new URLSearchParams(queryParams).toString();

    if (waypoints.length > 2) {
      qp += `&${this.serializeWaypoints(waypoints)}`;
    }

    const url = `${opts.baseUrl}?${qp}`;

    return opts.buildUrl ? opts.buildUrl({ waypoints, options: opts }, url) : url;
  }

  private serializeWaypoints(waypoints: Waypoint[]): string {
    return waypoints
      .slice(1, waypoints.length - 1)
      .map((w) => `via=${this.formatWp(w.position)}`)
      .join('&');
  }

  private formatWp({ lat, lng }: WaypointPosition): string {
    return `${lat},${lng}`;
  }
}