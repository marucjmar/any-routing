import { Remote, wrap } from 'comlink';
import type { AnyRoutingDataProvider, RequestOptions, Waypoint } from '@any-routing/core';
import { GoogleExecutor, type ExecutorRequestOptions } from './google.executor';
import type { GoogleRoutingData, Options } from './google-provider.types';

const defaultOptions: Partial<Options> = {
  baseUrl: 'https://routes.googleapis.com/directions/v2:computeRoutes',
  worker: true,
  travelMode: 'DRIVE',
  routingPreference: 'TRAFFIC_AWARE',
  units: 'METRIC',
  languageCode: 'en-US',
  alternatives: 0,
  fieldMask:
    'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs',
};

export class GoogleProvider implements AnyRoutingDataProvider {
  private worker?: Worker;
  private executorAPI: GoogleExecutor | Remote<GoogleExecutor>;
  private _options: Options;

  public get options(): Options {
    return this._options;
  }

  constructor(options: Options = {}) {
    this._options = { ...defaultOptions, ...options };
    if (this.options.worker === true) {
      this.worker = new Worker(new URL('./google.worker', import.meta.url), { type: 'module' });
      this.executorAPI = wrap<GoogleExecutor>(this.worker);
    } else {
      this.executorAPI = new GoogleExecutor();
    }
  }

  public destroy(): void {
    this.worker?.terminate();
  }

  public request(waypoints: Waypoint[], opts: RequestOptions): Promise<GoogleRoutingData> {
    const merged = { ...this.options, ...opts } as Options & RequestOptions;
    const url = this.buildUrl(waypoints, merged);
    const requestOptions = { ...merged, url, requestWaypoints: waypoints };
    delete requestOptions.buildUrl;
    return this.executorAPI.request(requestOptions as ExecutorRequestOptions);
  }

  public async abortAllRequests(): Promise<void> {
    await this.executorAPI.abortAllRequests();
  }

  public setOption<T extends keyof Options>(key: T, value: Options[T]): void {
    this.options[key] = value;
  }

  public async hasPendingRequests(): Promise<boolean> {
    return await this.executorAPI.hasPendingRequests();
  }

  private buildUrl(waypoints: Waypoint[], opts: Options & RequestOptions): string {
    if (waypoints.length < 2) {
      throw new Error('At least two waypoints are required');
    }
    const query = new URLSearchParams(
      Object.entries(opts.queryParams ?? {}).map(([key, value]) => [key, String(value)]),
    ).toString();
    const url = `${opts.baseUrl ?? defaultOptions.baseUrl}${query ? `?${query}` : ''}`;
    return opts.buildUrl ? opts.buildUrl({ waypoints, options: opts }, url) : url;
  }
}
