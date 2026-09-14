import { Remote, wrap } from 'comlink';
import type { AnyRoutingDataProvider, RequestOptions, Waypoint } from '@any-routing/core';
import { ValhallaExecutor, type ExecutorRequestOptions } from './valhalla.executor';
import type { Options, ValhallaRoutingData } from './valhalla-provider.types';

const defaultOptions: Partial<Options> = {
  baseUrl: 'https://valhalla1.openstreetmap.de/route',
  costing: 'auto',
  units: 'kilometers',
  language: 'en-US',
  worker: true,
  alternatives: 0,
  shapeFormat: 'polyline6',
};

export class ValhallaProvider implements AnyRoutingDataProvider {
  private worker?: Worker;
  private executorAPI: ValhallaExecutor | Remote<ValhallaExecutor>;
  private _options: Options;

  public get options(): Options {
    return this._options;
  }

  constructor(options: Options = {}) {
    this._options = { ...defaultOptions, ...options };
    if (this.options.worker) {
      this.worker = new Worker(new URL('./valhalla.worker', import.meta.url), { type: 'module' });
      this.executorAPI = wrap<ValhallaExecutor>(this.worker);
    } else {
      this.executorAPI = new ValhallaExecutor();
    }
  }

  public destroy(): void {
    this.worker?.terminate();
  }

  public request(waypoints: Waypoint[], opts: RequestOptions): Promise<ValhallaRoutingData> {
    const url = this.buildUrl(waypoints, { ...this.options, ...opts });
    const requestOptions = {
      ...this.options,
      ...opts,
      url,
      requestLocations: waypoints.map(({ position }, index) => ({
        lat: position.lat,
        lon: position.lng,
        type: index === 0 || index === waypoints.length - 1 ? 'break' : 'via',
      })),
    };
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
