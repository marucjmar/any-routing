import { AnyRoutingDataResponse, RouteSummary } from './data-providers';
import { Dispatcher } from './utils/dispatcher';
import { randomId } from './utils/random';

import {
  AnyRoutingOptions,
  AnyRoutingState,
  PluginFactory,
  Waypoint as InputWaypoint,
  AnyRoutingPlugin,
  AnyRoutingProjector,
  InternalWaypoint,
  InternalWaypointC,
  AnyRoutingGeocoder,
  RoutingEvents,
} from './core.model';

export type SetStateOptions<R extends AnyRoutingDataResponse> = {
  waypoints?: InputWaypoint[];
  data?: R;
  routesShapeGeojson?: R['routesShapeGeojson'];
  selectedRouteId?: number | null;
};

export class AnyRouting<R extends AnyRoutingDataResponse = AnyRoutingDataResponse, P extends AnyRoutingProjector = AnyRoutingProjector> {
  private readonly dispatcher = new Dispatcher<RoutingEvents<R>>();
  private readonly geocoder?: AnyRoutingGeocoder;

  private readonly _options: AnyRoutingOptions<P>;
  private readonly _plugins: AnyRoutingPlugin[] = [];
  private _projector?: P;

  private initialized = false;
  private removed = false;
  private calculationId = 0;
  private latestAppliedCalculationId = 0;
  private _state: AnyRoutingState<R>;

  public constructor(options: AnyRoutingOptions<P>) {
    this._options = {
      uniqueKey: randomId(),
      ...options,
    };

    this._state = this.createInitialState();

    this._plugins = (options.plugins ?? []).map((plugin) => this.resolvePlugin(plugin));
    this._projector = options.projector;

    if (this.options.waypointsSyncStrategy === 'geocodeFirst' && !this.options.geocoder) {
      throw new Error('Geocoder is required when waypointsSyncStrategy is `geocodeFirst`');
    }

    this.geocoder =
      this.options.geocoder && typeof this.options.geocoder === 'function'
        ? { geocode: this.options.geocoder }
        : (this.options.geocoder as AnyRoutingGeocoder | undefined);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  public get options(): AnyRoutingOptions {
    return this._options;
  }

  public get state(): AnyRoutingState<R> {
    return this._state;
  }

  public get data(): R | undefined {
    return this._state.data;
  }

  public get dataProvider() {
    return this.options.dataProvider;
  }

  public get projector(): P | undefined {
    return this._projector;
  }

  public get selectedRouteId(): number | null | undefined {
    return this._state.selectedRouteId;
  }

  public initialize(): void {
    if (this.initialized || this.removed) {
      return;
    }

    this.initialized = true;

    this._plugins.forEach((plugin) => {
      plugin.onAdd(this);
    });

    this._projector?.onAdd(this);
  }

  public setProjector(projector?: P): void {
    if (this._projector === projector) {
      return;
    }

    if (this.initialized && !this.removed) {
      this._projector?.onRemove(this);
    }

    this._projector = projector;
    this._options.projector = projector;

    if (this.initialized && !this.removed) {
      this._projector?.onAdd(this);
    }
  }

  public addPlugin<P extends PluginFactory>(
    plugin: P,
  ): P extends new (...args: any[]) => infer I ? I : P {
    const resolved = this.resolvePlugin(plugin);
    this._plugins.push(resolved);

    if (this.initialized && !this.removed) {
      resolved.onAdd(this);
    }

    return resolved as P extends new (...args: any[]) => infer I ? I : P;
  }

  public removePlugin(plugin: AnyRoutingPlugin): void {
    const index = this._plugins.indexOf(plugin);

    if (index === -1) {
      return;
    }

    this._plugins.splice(index, 1);

    if (this.initialized && !this.removed) {
      plugin.onRemove(this);
    }
  }

  public setWaypointsSyncStrategy(strategy: AnyRoutingOptions['waypointsSyncStrategy']): void {
    if (strategy === 'geocodeFirst' && !this.geocoder) {
      throw new Error('Geocoder is required when waypointsSyncStrategy is `geocodeFirst`');
    }

    this._options.waypointsSyncStrategy = strategy;
  }

  public onRemove(): void {
    if (this.removed) {
      return;
    }

    this.removed = true;

    if (this.initialized) {
      this._plugins.forEach((plugin) => {
        plugin.onRemove(this);
      });
      this._projector?.onRemove(this);
    }

    this.options.dataProvider?.destroy();
  }

  public on<E extends keyof RoutingEvents<R>>(
    event: E,
    callback: (event: RoutingEvents<R>[E]) => void,
  ): void {
    this.dispatcher.on(event, callback);
  }

  public off<E extends keyof RoutingEvents<R>>(
    event: E,
    callback: (event: RoutingEvents<R>[E]) => void,
  ): void {
    this.dispatcher.off(event, callback);
  }

  public setWaypoints(waypoints: InputWaypoint[]): void {
    this.updateState(
      {
        waypoints: this.transformToInternalWaypoints(waypoints),
      },
    );
  }

  public getWaypoint(index: number): InternalWaypoint | undefined {
    return this._state.waypoints[index];
  }

  public setState(patch: SetStateOptions<R>): void {
    const statePatch: Partial<AnyRoutingState<R>> = {};

    if (patch.waypoints !== undefined) {
      statePatch.waypoints = this.transformToInternalWaypoints(patch.waypoints);
    }

    if (patch.data !== undefined) {
      statePatch.data = patch.data;
      statePatch.routesShapeGeojson = patch.data.routesShapeGeojson;
    }

    if (patch.routesShapeGeojson !== undefined) {
      statePatch.routesShapeGeojson = patch.routesShapeGeojson;
    }

    if (patch.selectedRouteId !== undefined) {
      statePatch.selectedRouteId = patch.selectedRouteId;
    }

    this.updateState(statePatch);
  }

  public applyCalculationResult(data: R): void {
    const patchState: Partial<AnyRoutingState<R>> = {
      data,
      selectedRouteId: data.selectedRouteId,
      routesShapeGeojson: data.routesShapeGeojson,
    };

    if (this.options.waypointsSyncStrategy === 'toPath') {
      patchState.waypoints = this.syncWaypointsPositions(data.routes[0].waypoints);
    }

    this.updateState(patchState);

    this.fire('routesFound', {
      waypoints: this.state.waypoints,
      data,
    });
  }

  public reset(): void {
    const previousState = this._state;

    this._state = this.createInitialState();

    const updatedProperties = Object.keys(previousState) as Array<keyof AnyRoutingState<R>>;

    this.fire('stateUpdated', {
      updatedProperties,
    });

    this.fire('waypointsChanged', {
      waypoints: this._state.waypoints,
    });

    if (previousState.loading !== this._state.loading) {
      this.fire('loadingChanged', {
        loading: this._state.loading,
      });
    }
  }

  public getUniqueName(name: string): string {
    return `${name}-${this.options.uniqueKey}`;
  }

  public async recalculateRoute(): Promise<R | undefined> {
    if (this.waypoints.length < 2) {
      return undefined;
    }

    const dataProvider = this.options.dataProvider;

    if (!dataProvider) {
      throw new Error('No data provider');
    }

    const calculationId = ++this.calculationId;

    this.setLoading(true);
    this.fire('calculationStarted', { waypoints: this.waypoints });

    try {
      const waypointsSynced = await this.syncWaypointsBeforeCalculation(calculationId);
      if (!waypointsSynced || calculationId !== this.calculationId) {
        return undefined;
      }

      const data = (await dataProvider.request(this._state.waypoints, {
        mode: 'default',
      })) as R;

      if (calculationId <= this.latestAppliedCalculationId) {
        return data;
      }

      this.latestAppliedCalculationId = calculationId;

      const patchState: Partial<AnyRoutingState<R>> = {
        data,
        selectedRouteId: data.selectedRouteId,
        routesShapeGeojson: data.routesShapeGeojson,
      };

      if (this.options.waypointsSyncStrategy === 'toPath') {
        patchState.waypoints = this.syncWaypointsPositions(data.routes[0].waypoints);
      }

      this.updateState(patchState);

      // Tylko ostatni rozpoczęty request może zakończyć loading.
      if (calculationId === this.calculationId) {
        this.setLoading(false);
      }

      this.fire('routesFound', {
        waypoints: this.state.waypoints,
        data,
      });

      return data;
    } catch (error: unknown) {
      if (calculationId !== this.calculationId) {
        return undefined;
      }

      this.updateState({
        data: undefined,
        selectedRouteId: null,
        routesShapeGeojson: undefined,
      });

      if (calculationId === this.calculationId) {
        this.setLoading(false);
      }

      this.fire('calculationError', {
        error: this.toError(error),
      });

      throw error;
    }
  }

  public selectRoute(routeId: number): void {
    const data = this.data;

    if (!data) {
      return;
    }

    const route = data.routes[routeId];

    if (!route) {
      throw new Error(`No route with id: ${routeId}`);
    }

    this.updateState({
      selectedRouteId: routeId,
      data: {
        ...data,
        selectedRouteId: routeId,
      },
    });

    this.fire('routeSelected', {
      route,
      routeId,
    });
  }

  public syncWaypointsPositions(waypoints: RouteSummary['waypoints']): InternalWaypoint[] {
    return waypoints.map((position, index) => {
      const currentWaypoint = this._state.waypoints[index];

      if (!currentWaypoint) {
        return {
          position,
          originalPosition: position,
          properties: {
            index,
            isFirst: index === 0,
            isLast: index === waypoints.length - 1,
          },
          geocoded: false,
          index,
          isFirst: index === 0,
          isLast: index === waypoints.length - 1,
        } as InternalWaypoint;
      }

      return {
        ...currentWaypoint,
        position,
        originalPosition: currentWaypoint.originalPosition ?? currentWaypoint.position,
        properties: currentWaypoint.properties,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  private createInitialState(): AnyRoutingState<R> {
    return {
      waypoints: [],
      data: undefined,
      loading: false,
      selectedRouteId: null,
      routesShapeGeojson: undefined,
    };
  }

  private updateState(
    patch: Partial<AnyRoutingState<R>>,
  ): void {
    const updatedProperties = Object.keys(patch) as Array<keyof AnyRoutingState<R>>;

    if (updatedProperties.length === 0) {
      return;
    }

    const previousState = { ...this._state };

    this._state = {
      ...previousState,
      ...patch,
    };

    this.fire('stateUpdated', {
      updatedProperties,
    });

    if ('waypoints' in patch) {
      this.fire('waypointsChanged', {
        waypoints: this._state.waypoints,
      });
    }

    if ('loading' in patch) {
      this.fire('loadingChanged', {
        loading: this._state.loading,
      });
    }
  }

  private setLoading(loading: boolean): void {
    if (this._state.loading === loading) {
      return;
    }

    this.updateState({
      loading,
    });
  }

  // ---------------------------------------------------------------------------
  // Calculation
  // ---------------------------------------------------------------------------

  private async syncWaypointsBeforeCalculation(
    calculationId: number,
  ): Promise<boolean> {
    if (this.options.waypointsSyncStrategy !== 'geocodeFirst') {
      return true;
    }

    const waypointsToGeocode = this._state.waypoints.filter((waypoint) => !waypoint.geocoded);

    if (waypointsToGeocode.length === 0) {
      return true;
    }

    const previousWaypoints = this._state.waypoints;

    const waypoints = await this.geocodeWaypoints(previousWaypoints);

    if (calculationId !== this.calculationId) {
      return false;
    }

    this.updateState({
      waypoints,
    });

    waypoints.forEach((waypoint, index) => {
      if (previousWaypoints[index] && !previousWaypoints[index].geocoded && waypoint.geocoded) {
        this.fire('waypointGeocoded', {
          waypoint,
        });
      }
    });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Plugins
  // ---------------------------------------------------------------------------

  private resolvePlugin(plugin: PluginFactory): AnyRoutingPlugin {
    if (typeof plugin === 'function') {
      return new plugin();
    }

    return plugin;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private fire<E extends keyof RoutingEvents<R>>(
    event: E,
    data: Omit<RoutingEvents<R>[E], 'state'>,
  ): void {
    this.dispatcher.fire(event, {
      ...data,
      state: this._state,
    } as RoutingEvents<R>[E]);
  }

  // ---------------------------------------------------------------------------
  // Waypoints
  // ---------------------------------------------------------------------------

  private transformToInternalWaypoints(waypoints: InputWaypoint[]): InternalWaypoint[] {
    return waypoints.map((waypoint, index) =>
      InternalWaypointC.fromWaypoint(waypoint, {
        index,
        isFirst: index === 0,
        isLast: index === waypoints.length - 1,
      }),
    );
  }

  private geocodeWaypoints(waypoints: InternalWaypoint[]): Promise<InternalWaypoint[]> {
    const geocoder = this.geocoder;
    if (!geocoder) {
      return Promise.resolve(waypoints);
    }

    return Promise.all(
      waypoints.map(async (waypoint) => {
        if (waypoint.geocoded) {
          return waypoint;
        }

        const geocodedWaypoint = await geocoder.geocode(waypoint);

        return {
          ...geocodedWaypoint,
          geocoded: true,
        };
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Utils
  // ---------------------------------------------------------------------------

  private toError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }

  private get waypoints(): InternalWaypoint[] {
    return this._state.waypoints;
  }
}
