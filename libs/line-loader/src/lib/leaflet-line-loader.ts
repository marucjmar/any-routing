import type { Position } from 'geojson';
import type {
  AnyRouting,
  AnyRoutingDataResponse,
  AnyRoutingPlugin,
  AnyRoutingProjector,
  RoutingEvents,
} from '@any-routing/core';
import { Map, polyline, Polyline, svg } from 'leaflet';
import type { LineAnimationOptions } from './line-animation';
import { lineString } from '@turf/helpers';

export interface LeafletLineLoaderPluginOptions {
  map: Map;
  projector: AnyRoutingProjector;
  animation?: Partial<LineAnimationOptions>;
  enabled?: boolean;
}

class LeafletLineAnimation {
  private readonly line: Polyline;
  private readonly backgroundLine: Polyline;
  private readonly duration: number;
  private readonly loop: boolean;
  private readonly headColor: string;
  private readonly backgroundColor: string;
  private readonly dashLength: number;
  private readonly dashSize: number;
  private rafId?: number;
  private startTime = 0;

  constructor(
    private readonly map: Map,
    private readonly coordinates: Position[],
    options: Partial<LineAnimationOptions>,
  ) {
    this.duration = options.duration ?? 1000;
    this.loop = options.loop ?? true;
    this.headColor = options.headColor ?? 'rgba(200,0,0,1)';
    this.backgroundColor = options.backgroundColor ?? 'rgba(200,0,0,0)';
    this.dashLength = options.dashLength ?? 1;
    this.dashSize = Math.max(this.dashLength * 20, 2);

    const latLngs = coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
    const width = Math.max(options.headWidth ?? 5, options.tailWidth ?? 5, 5);
    const renderer = svg();
    this.backgroundLine = polyline(latLngs, {
      color: this.backgroundColor,
      weight: width,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
      renderer,
    }).addTo(map);
    this.line = polyline(latLngs, {
      color: this.headColor,
      weight: width,
      opacity: 1,
      dashArray: `${this.dashSize} ${this.dashSize}`,
      dashOffset: '0',
      lineCap: 'round',
      lineJoin: 'round',
      renderer,
    }).addTo(map);
  }

  play(): void {
    this.startTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  remove(): void {
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    this.line.removeFrom(this.map);
    this.backgroundLine.removeFrom(this.map);
  }

  private readonly tick = (now: number): void => {
    const progress = Math.max(0, (now - this.startTime) / Math.max(this.duration, 1));
    if (progress >= 1 && !this.loop) {
      this.rafId = undefined;
      return;
    }

    const offset = (progress % 1) * this.dashSize;
    this.line.setStyle({
      dashOffset: `${-offset}px`,
    });
    this.rafId = requestAnimationFrame(this.tick);
  };
}

export class LeafletLineLoaderPlugin implements AnyRoutingPlugin {
  private readonly map: Map;
  private readonly options: LeafletLineLoaderPluginOptions;
  private routing?: AnyRouting;
  private animation?: LeafletLineAnimation;
  private loading = false;
  private readonly projector: AnyRoutingProjector;
  private readonly routesProjectedHandler = (): void => {
    if (!this.options.enabled) return;

    this.loading = false;
    this.hide();
  };
  private readonly waypointDragHandler = (event: {
    waypoint: AnyRouting['state']['waypoints'][number];
  }): void => {
    if (!this.options.enabled || !this.routing) return;

    this.show(
      this.routing.projector!.waypoints.map((waypoint) =>
        waypoint.index === event.waypoint.index ? event.waypoint : waypoint,
      ),
    );
  };

  private readonly stateUpdatedHandler = (
    event: RoutingEvents<AnyRoutingDataResponse>['stateUpdated'],
  ): void => {
    if (!this.options.enabled) return;
    if (event.state.loading) {
      this.loading = true;
      this.show(event.state.waypoints);
    } else if (!event.state.loading && this.loading) {
      this.loading = false;
      this.hide();
    }
  };

  constructor(options: LeafletLineLoaderPluginOptions) {
    this.map = options.map;
    this.projector = options.projector;
    this.options = { ...options, enabled: options.enabled ?? true };
  }

  onAdd(routing: AnyRouting): void {
    this.routing = routing;
    routing.on('stateUpdated', this.stateUpdatedHandler);
    this.projector.on('routesProjected', this.routesProjectedHandler);
    this.projector.on('waypointDrag', this.waypointDragHandler);
  }

  onRemove(): void {
    this.routing?.off('stateUpdated', this.stateUpdatedHandler);
    this.projector.off('routesProjected', this.routesProjectedHandler);
    this.projector.off('waypointDrag', this.waypointDragHandler);
    this.routing = undefined;
    this.loading = false;
    this.hide();
  }

  private show(waypoints: AnyRouting['state']['waypoints']): void {
    this.hide();
    const coordinates = this.createRouteCoordinates(waypoints);
    if (coordinates.length < 2) return;
    this.animation = new LeafletLineAnimation(this.map, coordinates, this.options.animation ?? {});
    this.animation.play();
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

export type { LineAnimationOptions };
