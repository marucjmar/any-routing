import { Remote, wrap } from 'comlink';

import type { AnyRoutingDataProvider, RequestOptions, Waypoint } from '@any-routing/core';
import { OrsExecutor, type ExecutorRequestOptions } from './ors.executor';
import type { Options, OrsRoutingData } from './ors-provider.types';

const defaultOptions: Partial<Options> = {
  baseUrl: 'https://api.heigit.org/openrouteservice/v2/directions',
  profile: 'driving-car',
  worker: true,
  alternatives: 0,
  preference: 'recommended',
  units: 'm',
  instructions: true,
  instructionsFormat: 'text',
  geometry: true,
  maneuvers: false,
};

export class OrsProvider implements AnyRoutingDataProvider {
  private worker?: Worker;
  private executorAPI: OrsExecutor | Remote<OrsExecutor>;
  private _options: Options;

  public get options(): Options {
    return this._options;
  }

  constructor(options: Options) {
    this._options = { ...defaultOptions, ...options };
    if (!this.options.apiKey) {
      throw new Error('An openrouteservice API key is required');
    }

    if (this.options.worker) {
      this.worker = new Worker(new URL('./ors.worker', import.meta.url), { type: 'module' });
      this.executorAPI = wrap<OrsExecutor>(this.worker);
    } else {
      this.executorAPI = new OrsExecutor();
    }
  }

  public destroy(): void {
    this.worker?.terminate();
  }

  public request(waypoints: Waypoint[], opts: RequestOptions): Promise<OrsRoutingData> {
    const url = this.buildUrl(waypoints, { ...this.options, ...opts });
    const requestOptions = {
      ...this.options,
      ...opts,
      url,
      requestCoordinates: waypoints.map(({ position }) => [position.lng, position.lat] as [number, number]),
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

    const profile = encodeURIComponent(opts.profile ?? 'driving-car');
    const query = new URLSearchParams(
      Object.entries(opts.queryParams ?? {}).map(([key, value]) => [key, String(value)]),
    ).toString();
    const url = `${opts.baseUrl}/${profile}${query ? `?${query}` : ''}/geojson`;
    return opts.buildUrl ? opts.buildUrl({ waypoints, options: opts }, url) : url;
  }
}
