import { AnyRoutingDataResponse, RouteSummary } from './data-providers';
import { Dispatcher } from './utils/dispatcher';
import { randomId } from './utils/random';
import {
  AnyRoutingEventsMap,
  AnyRoutingOptions,
  AnyRoutingState,
  PluginFactory,
  StateUpdateSource,
  Waypoint as InputWaypoint,
  AnyRoutingPlugin,
  InternalWaypoint,
  InternalWaypointC,
  RecalculateOptions,
  Mode,
  AnyRoutingGeocoder,
} from './libre-routing.model';
import { featureCollection } from '@turf/helpers';

export class AnyRouting<R extends AnyRoutingDataResponse = AnyRoutingDataResponse> {
  private readonly dispatcher = new Dispatcher<AnyRoutingEventsMap>();
  private readonly geocoder?: AnyRoutingGeocoder;

  private _options: AnyRoutingOptions;
  private _plugins: PluginFactory[] = [];

  private _initialState: AnyRoutingState<R> = {
    waypoints: [],
    data: undefined,
    loading: false,
    selectedRouteId: undefined,
    mode: 'default',
    routesShapeGeojson: undefined,
  };

  private _state: AnyRoutingState<R> = { ...this._initialState };

  public get options(): AnyRoutingOptions {
    return this._options;
  }

  public get data() {
    return this._state.data;
  }

  public get state(): AnyRoutingState<R> {
    return this._state;
  }

  public get dataProvider() {
    return this.options.dataProvider;
  }

  public get selectedRouteId(): number | undefined | null {
    return this._state.selectedRouteId;
  }

  private get waypoints(): InternalWaypoint[] {
    return this._state.waypoints;
  }

  constructor(options: AnyRoutingOptions) {
    this._options = {
      ...{ uniqueKey: randomId() },
      ...options,
    };

    this._plugins = options.plugins ?? [];

    if (this.options.waypointsSyncStrategy === 'geocodeFirst' && !this.options.geocoder) {
      throw new Error('Geocoder is required when waypointsSyncStrategy is `geocodeFirst`');
    }

    this.geocoder =
      this.options.geocoder && typeof this.options.geocoder === 'function'
        ? { geocode: this.options.geocoder }
        : (this.options.geocoder as AnyRoutingGeocoder);
  }

  public initialize() {
    this.initPlugins();
  }

  public onRemove() {
    this.detachPlugins();
    this.options.dataProvider?.destroy();
  }

  public setMode(mode: Mode) {
    this._patchState({ mode });
  }

  public setWaypoints(waypoints: InputWaypoint[]) {
    const internalWaypoints: InternalWaypoint[] = this.transformToInternalWaypoints(waypoints);
    this._patchState({ waypoints: internalWaypoints });
  }

  public getWaypoint(waypointId: number) {
    return this._state.waypoints[waypointId];
  }

  public async recalculateRoute(opts: RecalculateOptions & Record<string, any> = {}): Promise<R | undefined> {
    if (this.waypoints.length < 2) return;

    if (!this.options.dataProvider) {
      throw new Error('No data provider');
    }

    if (opts.dropPendingRequests) {
      await this.options.dataProvider.abortAllRequests();
    }

    let patchState: Partial<AnyRoutingState<R>> = {};

    if (!this._state.loading) {
      patchState = { ...patchState, loading: true };
    }

    this.fire('calculationStarted', {
      mode: this.state.mode,
      waypoints: this.waypoints,
      recalculateOptions: opts,
    });

    this._patchState(patchState);

    if ('loading' in patchState) {
      this.fire('loadingChanged', { loading: true });
    }

    try {
      let patchState: Partial<AnyRoutingState<R>> = {};

      if (opts.syncWaypoints !== false && this.options.waypointsSyncStrategy === 'geocodeFirst') {
        const waypointsToSyncIds: number[] = this._state.waypoints.reduce((acc: number[], w, index) => {
          if (!w.geocoded) {
            acc.push(index)
          }

          return acc;
        }, []);

        if (waypointsToSyncIds.length > 0) {
          const waypoints = await this.geocodeWaypoints(this._state.waypoints);
          this._patchState({ waypoints });
          
          waypointsToSyncIds.forEach((waypointId) => {
            this.fire('waypointGeocoded', { waypoint: waypoints[waypointId] });
          });
        }
      }

      const data: R = (await this.options.dataProvider.request(this._state.waypoints, {
        mode: this.state.mode,
      })) as R;

      patchState = {
        ...patchState,
        data,
        selectedRouteId: data.selectedRouteId,
        routesShapeGeojson: data.routesShapeGeojson,
      };

      if (opts.syncWaypoints !== false && this.options.waypointsSyncStrategy === 'toPath') {
        const syncedWaypoints: InternalWaypoint[] = this.syncWaypointsPositions(data.routes[0].waypoints);
        patchState = { ...patchState, waypoints: syncedWaypoints };
      }

      this._patchState(patchState);

      this.fire('routesFound', {
        mode: this.state.mode,
        waypoints: this._state.waypoints,
        data,
        recalculateOptions: opts,
      });

      return this._state.data;
    } catch (e: unknown) {
      this.fire('calculationError', { error: e as Error, recalculateOptions: opts });

      throw e;
    } finally {
      if (this._state.loading && (this.data?.latest || !(await this.dataProvider.hasPendingRequests()))) {
        this._patchState({ loading: false });
        this.fire('loadingChanged', { loading: false });
      }
    }
  }

  public on<E extends keyof AnyRoutingEventsMap>(event: E, callback: (event: AnyRoutingEventsMap[E]) => void) {
    this.dispatcher.on(event, callback);
  }

  public off<E extends keyof AnyRoutingEventsMap>(event: E, callback: (event: AnyRoutingEventsMap[E]) => void) {
    this.dispatcher.off(event, callback);
  }

  public selectRoute(routeId: number) {
    if (!this.data) {
      return;
    }

    const features = this.data.routesShapeGeojson.features.map((feature) => {
      return {
        ...feature,
        properties: {
          ...feature.properties,
          selected: feature.properties.routeId === routeId,
        },
      };
    });

    this._patchState({
      selectedRouteId: routeId,
      data: {
        ...this._state.data!,
        routesShapeGeojson: featureCollection(features),
        selectedRouteId: routeId,
      },
      routesShapeGeojson: featureCollection(features),
    });

    this.fire('routeSelected', {
      route: this.data!.routes[routeId],
      routeId: routeId,
    });
  }

  public reset(): void {
    this._setState({ ...this._initialState }, 'external');
  }

  public getUniqueName(name: string) {
    return `${name}-${this.options.uniqueKey}`;
  }

  public syncWaypointsPositions(waypoints: RouteSummary['waypoints']): InternalWaypoint[] {
    const newWaypoints: InternalWaypoint[] = waypoints.map(
      (waypoint, index): InternalWaypoint => ({
        ...this._state.waypoints[index],
        position: waypoint,
        originalPosition: this._state.waypoints[index].originalPosition || this._state.waypoints[index].position,
        properties: this._state.waypoints[index].properties,
      })
    );

    return newWaypoints;
  }

  public setState({
    waypoints,
    data,
    routesShapeGeojson,
    selectedRouteId,
  }: {
    waypoints?: InputWaypoint[];
    data?: R;
    routesShapeGeojson?: R['routesShapeGeojson'];
    selectedRouteId?: number | null;
  }): void {
    let newState: AnyRoutingState<R> = { ...this._state };
    if (waypoints) {
      const internalWaypoints = this.transformToInternalWaypoints(waypoints);
      newState = { ...newState, waypoints: internalWaypoints };
    }

    if (routesShapeGeojson) {
      newState = { ...newState, routesShapeGeojson };
    }

    if (data) {
      newState = { ...newState, data, routesShapeGeojson: data.routesShapeGeojson };
    }

    if (selectedRouteId != null) {
      newState = { ...newState, selectedRouteId };
    }

    if (data || waypoints || routesShapeGeojson || selectedRouteId != null) {
      this._setState(newState, 'external');
    }
  }

  private initPlugins(): void {
    this._plugins.forEach((plugin) => this.resolvePlugin(plugin).onAdd(this));
  }

  private detachPlugins(): void {
    this._plugins.forEach((plugin) => this.resolvePlugin(plugin).onRemove(this));
  }

  private resolvePlugin(plugin: AnyRoutingPlugin | (new (...args: any[]) => AnyRoutingPlugin)): AnyRoutingPlugin {
    if (typeof plugin === 'function') {
      return new plugin({});
    }

    return plugin;
  }

  private _setState(
    newState: AnyRoutingState<R>,
    source: StateUpdateSource = 'internal',
    updatedKeys?: Array<keyof AnyRoutingState<R>>
  ): void {
    this._state = newState;
    this.fire('stateUpdated', {
      source,
      updatedProperties: updatedKeys ?? (Object.keys(this.state) as Array<keyof AnyRoutingState<R>>),
    });
  }

  private _patchState(patchState: Partial<AnyRoutingState<R>>, source: StateUpdateSource = 'internal'): void {
    if (Object.keys(patchState).length === 0) {
      return;
    }

    this._setState(
      { ...this._state, ...patchState },
      source,
      Object.keys(patchState) as Array<keyof AnyRoutingState<R>>
    );

    if ('waypoints' in patchState) {
      this.fire('waypointsChanged', { waypoints: this.state.waypoints });
    }
  }

  private transformToInternalWaypoints(waypoints: InputWaypoint[]): InternalWaypoint[] {
    return waypoints.map((waypoint, index) =>
      InternalWaypointC.fromWaypoint(waypoint, { index, isFirst: index === 0, isLast: index === waypoints.length - 1 })
    );
  }

  private fire<E extends keyof AnyRoutingEventsMap>(
    event: E,
    data: Omit<AnyRoutingEventsMap[E], 'state' | 'eventName'>
  ) {
    //@ts-ignore
    this.dispatcher.fire(event, <AnyRoutingEventsMap[E]>{ ...data, state: this.state, eventName: event });
  }

  private geocodeWaypoints(waypoints: InternalWaypoint[]): Promise<InternalWaypoint[]> {
    const waypointGeocodes = waypoints.map(async (waypoint) => {
      if (waypoint.geocoded) {
        return waypoint;
      }

      const geocodedWaypoint = await this.geocoder!.geocode(waypoint);
      geocodedWaypoint.geocoded = true;

      return geocodedWaypoint;
    });

    return Promise.all(waypointGeocodes);
  }
}
