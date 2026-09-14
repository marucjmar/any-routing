import { Remote, wrap } from 'comlink';
import type { AnyRoutingDataProvider, RequestOptions, Waypoint } from '@any-routing/core';
import { MapboxExecutor, type ExecutorRequestOptions } from './mapbox.executor';
import type { MapboxRoutingData, Options } from './mapbox-provider.types';

const defaultOptions: Partial<Options> = {
  baseUrl: 'https://api.mapbox.com/directions/v5/mapbox',
  profile: 'driving',
  worker: true,
  alternatives: false,
  steps: true,
  geometries: 'geojson',
  overview: 'full',
};

export class MapboxProvider implements AnyRoutingDataProvider {
  private worker?: Worker;
  private executorAPI: MapboxExecutor | Remote<MapboxExecutor>;
  private _options: Options;

  public get options(): Options {
    return this._options;
  }

  constructor(options: Options) {
    this._options = { ...defaultOptions, ...options };
    if (!this.options.accessToken) {
      throw new Error('A Mapbox access token is required');
    }

    if (this.options.worker) {
      this.worker = new Worker(new URL('./mapbox.worker', import.meta.url), { type: 'module' });
      this.executorAPI = wrap<MapboxExecutor>(this.worker);
    } else {
      this.executorAPI = new MapboxExecutor();
    }
  }

  public destroy(): void {
    this.worker?.terminate();
  }

  public request(waypoints: Waypoint[], opts: RequestOptions): Promise<MapboxRoutingData> {
    const url = this.buildUrl(waypoints, { ...this.options, ...opts });
    const requestOptions = { ...this.options, ...opts, url };
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

    const coordinates = waypoints
      .map(({ position }) => `${position.lng},${position.lat}`)
      .join(';');
    const queryParams: Record<string, string> = {
      access_token: opts.accessToken,
      alternatives: String(opts.alternatives ?? false),
      steps: String(opts.steps ?? true),
      geometries: opts.geometries ?? 'geojson',
      overview: opts.overview ?? 'full',
      ...(opts.continueStraight !== undefined
        ? { continue_straight: String(opts.continueStraight) }
        : {}),
      ...(opts.language ? { language: opts.language } : {}),
      ...(opts.bannerInstructions !== undefined
        ? { banner_instructions: String(opts.bannerInstructions) }
        : {}),
      ...(opts.voiceInstructions !== undefined
        ? { voice_instructions: String(opts.voiceInstructions) }
        : {}),
      ...(opts.voiceUnits ? { voice_units: opts.voiceUnits } : {}),
      ...(opts.exclude
        ? { exclude: Array.isArray(opts.exclude) ? opts.exclude.join(',') : opts.exclude }
        : {}),
      ...(opts.approaches
        ? {
            approaches: Array.isArray(opts.approaches)
              ? opts.approaches.join(';')
              : opts.approaches,
          }
        : {}),
      ...(opts.avoidManeuverRestrictions !== undefined
        ? { avoid_maneuver_restrictions: String(opts.avoidManeuverRestrictions) }
        : {}),
      ...Object.fromEntries(
        Object.entries(opts.queryParams ?? {}).map(([key, value]) => [key, String(value)]),
      ),
    };
    const query = new URLSearchParams(queryParams).toString();
    const url = `${opts.baseUrl}/${opts.profile ?? 'driving'}/${coordinates}?${query}`;
    return opts.buildUrl ? opts.buildUrl({ waypoints, options: opts }, url) : url;
  }
}
