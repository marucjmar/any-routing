import { lineString } from '@turf/helpers';
import type { FeatureCollection, LineString, Position } from 'geojson';
import type {
  AnyRouting,
  AnyRoutingDataResponse,
  AnyRoutingPlugin,
  AnyRoutingProjector,
  RoutingEvents,
} from '@any-routing/core';
import type { Map } from 'maplibre-gl';

import { LineAnimation, type LineAnimationOptions } from './line-animation';

export type { LineAnimationOptions } from './line-animation';

export interface LineLoaderPluginOptions {
  map: Map;
  projector: AnyRoutingProjector;
  animationId?: string;
  animation?: Partial<LineAnimationOptions>;
  enabled?: boolean;
}

type ResolvedLineLoaderOptions = {
  projector: AnyRoutingProjector;
  animationId: string;
  animation: Partial<LineAnimationOptions>;
  enabled: boolean;
};

const DEFAULT_OPTIONS = {
  animationId: 'any-routing-line-loader',
  enabled: true,
  animation: {
    dashLength: 1,
    duration: 500,
    loop: true,
    headColor: 'rgba(200,0,0,1)',
    tailColor: 'rgba(200,0,0,0)',
    backgroundColor: 'rgba(200,0,0,0)',
  },
} satisfies Omit<Required<LineLoaderPluginOptions>, 'map' | 'projector'>;

export class LineLoaderPlugin implements AnyRoutingPlugin {
  private readonly map: Map;
  private readonly options: ResolvedLineLoaderOptions;
  private routing?: AnyRouting;
  private animation?: LineAnimation;
  private active = false;

  private readonly calculationStartedHandler = (
    event: RoutingEvents<AnyRoutingDataResponse>['calculationStarted'],
  ): void => {
    if (!this.options.enabled) return;

    this.show(event.state);
  };

  private readonly routesProjectedHandler = (): void => {
    if (!this.options.enabled) return;
    this.hide();
  };
  private readonly waypointDragHandler = (event: {
    waypoint: AnyRouting['state']['waypoints'][number];
  }): void => {
    if (!this.options.enabled || !this.routing) return;

    this.show({
      ...this.routing.state,
      waypoints: this.routing.projector?.waypoints ?? []
    });
  };

  private readonly calculationErrorHandler = (
    event: RoutingEvents<AnyRoutingDataResponse>['calculationError'],
  ): void => {
    if (!this.options.enabled || this.routing?.state.loading) return;

    this.showError(event.state);
  };

  constructor(options: LineLoaderPluginOptions) {
    this.map = options.map;
    this.options = {
      ...DEFAULT_OPTIONS,
      projector: options.projector,
      animationId: options.animationId ?? DEFAULT_OPTIONS.animationId,
      enabled: options.enabled ?? DEFAULT_OPTIONS.enabled,
      animation: {
        ...DEFAULT_OPTIONS.animation,
        ...options.animation,
      },
    };
  }

  public onAdd(routing: AnyRouting): void {
    this.routing = routing;
    routing.on('calculationStarted', this.calculationStartedHandler);
    this.options.projector.on('routesProjected', this.routesProjectedHandler);
    this.options.projector.on('waypointDrag', this.waypointDragHandler);
    routing.on('calculationError', this.calculationErrorHandler);
  }

  public onRemove(): void {
    this.routing?.off('calculationStarted', this.calculationStartedHandler);
    this.options.projector.off('routesProjected', this.routesProjectedHandler);
    this.options.projector.off('waypointDrag', this.waypointDragHandler);
    this.routing?.off('calculationError', this.calculationErrorHandler);
    this.routing = undefined;
    this.hide();
  }

  private show(state: AnyRouting['state']): void {
    const coordinates = this.createRouteCoordinates(state.waypoints);
    if (coordinates.length < 2) return;

    const geojson: FeatureCollection<LineString> = {
      type: 'FeatureCollection',
      features: [lineString(coordinates)],
    };

    if (this.animation) {
      this.animation.updateWaypoints(geojson);

      return;
    }

    this.animation = new LineAnimation(this.options.animationId, {
      ...this.options.animation,
      geojson,
    });
    this.animation.addTo(this.map);
  }

  private showError(state: AnyRouting['state']): void {
    const coordinates = this.createRouteCoordinates(state.waypoints);
    if (coordinates.length < 2) {
      this.hide();
      return;
    }

    if (!this.animation) {
      const geojson: FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: [lineString(coordinates)],
      };

      this.animation = new LineAnimation(this.options.animationId, {
        ...this.options.animation,
        autoStart: false,
        geojson,
      });
      this.animation.addTo(this.map);
    }

    this.animation.showError();
  }

  private hide(): void {
    this.animation?.remove();
    this.animation = undefined;
  }

  private createRouteCoordinates(waypoints: AnyRouting['state']['waypoints']): Position[] {
    return waypoints.slice(0, -1).reduce<Position[]>((coordinates, waypoint, index) => {
      const next = waypoints[index + 1];
      const segment: Position[] = lineString(
        [[waypoint.position.lng, waypoint.position.lat],
        [next.position.lng, next.position.lat]],
      ).geometry.coordinates;
      const points = Array.isArray(segment[0]) && Array.isArray(segment[0][0])
        ? ((segment as Position[]).flat()) as unknown as Position[]
        : (segment as Position[]);
      coordinates.push(...(coordinates.length ? points.slice(1) : points));
      return coordinates;
    }, []);
  }
}
