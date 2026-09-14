import { LngLatBounds, Map as MapLibreMap, Popup } from 'maplibre-gl';
import type {
  AnyRouting,
  AnyRoutingPlugin,
  AnyRoutingDataResponse,
} from '@any-routing/core';
import { featureCollection, point } from '@turf/helpers';
import { wrap } from 'comlink';
import bbox from '@turf/bbox';
import type { AnnotationWorkerApi } from './annotation.worker';
import { AnnotationPopupComponent, AnnotationPopupComponentI, OnAttach } from './popup-component';
import type { BBox } from 'geojson';

export interface AnnotationPluginOptions {
  calculatePopupOnFly: boolean;
  map: MapLibreMap;
  componentFactory(
    id: number,
    routeData: AnyRoutingDataResponse,
    ctx: AnyRouting,
  ): AnnotationPopupComponentI;
}

const defaultConfig: Omit<AnnotationPluginOptions, 'map' | 'projector'> = {
  calculatePopupOnFly: true,
  componentFactory(routeId, data, ctx) {
    return new AnnotationPopupComponent(routeId, data, ctx);
  },
};

type Require<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export class AnnotationPlugin implements AnyRoutingPlugin {
  private map!: MapLibreMap;
  private mapBounds!: LngLatBounds;
  private bounds?: BBox;
  private worker: Worker;
  private popups: Map<number, Popup> = new Map();
  private allInBbox = false;
  private ctx!: AnyRouting;
  private options: AnnotationPluginOptions;
  private workerApi: ReturnType<typeof wrap<AnnotationWorkerApi>>;
  private data: AnyRoutingDataResponse | undefined;
  private components: AnnotationPopupComponentI[] = [];
  private popupElementsByRouteId = new Map<number, HTMLElement>();
  private popupZIndexRouteId?: number;
  private popupHoverHandlers = new Map<
    number,
    { enter: () => void; leave: () => void }
  >();
  private animationFrame?: number;
  private recalculationInProgress = false;
  private recalculationRequested = false;
  private forceRecalculationRequested = false;
  private lifecycleGeneration = 0;
  private disposed = false;
  private clearMapHandler = () => {
    this.lifecycleGeneration += 1;
    this.data = undefined;
    this.bounds = undefined;
    this.destroyView();
  };
  private routeCalculatedHandler = this.routeCalculated.bind(this);
  private routeSelectedHandler = (event: { routeId: number }) => {
    this.raisePopupZIndex(event.routeId);
  };
  private routeHighlightHandler = (event: { routeId?: number }) => {
    this.raisePopupZIndex(event.routeId ?? this.ctx.selectedRouteId ?? undefined);
  };

  private mapMoveEndHandler = () => {
      this.animationFrame = undefined;
      void this.recalculate(true);
  };

  constructor(options: Require<Partial<AnnotationPluginOptions>, 'map'>) {
    this.options = { ...defaultConfig, ...options };
    this.worker = new Worker(new URL('./annotation.worker', import.meta.url), {
      type: 'module',
    });

    this.map = this.options.map;

    this.workerApi = wrap<AnnotationWorkerApi>(this.worker);
  }

  onAdd(ctx: AnyRouting): void {
    this.disposed = false;
    this.ctx = ctx;

    this.ctx.on('routesFound', this.routeCalculatedHandler);
    this.ctx.on('routeSelected', this.routeSelectedHandler);
    this.ctx.projector?.on('waypointDrag', this.clearMapHandler);
    this.ctx.projector?.on('previewStarted', this.clearMapHandler);
    this.ctx.projector?.on('routeHighlight', this.routeHighlightHandler);

    this.map.on(this.options.calculatePopupOnFly ? 'render' : 'idle', this.mapMoveEndHandler);

    void this.routeCalculated();
  }

  onRemove(): void {
    this.disposed = true;
    this.lifecycleGeneration += 1;
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
    this.ctx.off('routesFound', this.routeCalculatedHandler);
    this.ctx.off('routeSelected', this.routeSelectedHandler);
    this.ctx.projector?.off('waypointDrag', this.clearMapHandler);
    this.ctx.projector?.off('previewStarted', this.clearMapHandler);
    this.ctx.projector?.off('routeHighlight', this.routeHighlightHandler);
    this.worker.terminate();
    this.destroyView();
  }

  public setCalculatePopupOnFly(calculatePopupOnFly: boolean): void {
    if (this.options.calculatePopupOnFly === calculatePopupOnFly) {
      return;
    }

    const previousEvent = this.options.calculatePopupOnFly ? 'render' : 'idle';
    this.options.calculatePopupOnFly = calculatePopupOnFly;
    const nextEvent = calculatePopupOnFly ? 'render' : 'idle';

    if (this.ctx) {
      this.map.off(previousEvent, this.mapMoveEndHandler);
      this.map.on(nextEvent, this.mapMoveEndHandler);
    }
  }

  private async routeCalculated(): Promise<void> {
    const data: AnyRoutingDataResponse | undefined = this.ctx.data;

    if (!data) {
      return;
    }

    if (this.data?.version === data.version || !data.latest) {
      return;
    }

    const generation = ++this.lifecycleGeneration;
    this.data = data;

    this.destroyView();

    if (this.ctx.state.data?.latest) {
      await this.workerApi.createChunks(this.data);
      if (this.disposed || generation !== this.lifecycleGeneration) {
        return;
      }
      await this.recalculate(true);
    }
  }

  public async recalculate(force = false): Promise<void> {
    if (this.recalculationInProgress) {
      this.recalculationRequested = true;
      this.forceRecalculationRequested ||= force;
      return;
    }

    this.recalculationInProgress = true;
    let error: unknown;

    try {
      await this.recalculateNow(force);
    } catch (caughtError) {
      error = caughtError;
    } finally {
      this.recalculationInProgress = false;
    }

    if (this.recalculationRequested) {
      const nextForce = this.forceRecalculationRequested;
      this.recalculationRequested = false;
      this.forceRecalculationRequested = false;
      await this.recalculate(nextForce);
    }

    if (error) {
      throw error;
    }
  }

  private async recalculateNow(force: boolean): Promise<void> {
    this.mapBounds = this.map.getBounds();
    const requestBounds = this.mapBounds;
    const generation = this.lifecycleGeneration;

    if (this.disposed || !this.data) {
      return;
    }
    const data = this.data;

    if (
      this.bounds &&
      this.bounds.length === 4 &&
      this.mapBounds.contains([this.bounds[0], this.bounds[1]]) &&
      this.mapBounds.contains([this.bounds[2], this.bounds[3]]) &&
      this.allInBbox &&
      !force
    ) {
      return;
    }

    const sw = this.mapBounds.getSouthWest();
    const ne = this.mapBounds.getNorthEast();

    const { points, allInBbox } = await this.workerApi.recalculatePos({
      bbox: { sw, ne },
    });

    if (
      this.disposed ||
      generation !== this.lifecycleGeneration ||
      !this.areBoundsEqual(this.map.getBounds(), requestBounds)
    ) {
      return;
    }

    if (!points.length) return;

    if (
      this.bounds &&
      this.bounds.length === 4 &&
      this.mapBounds.contains([this.bounds[0], this.bounds[1]]) &&
      this.mapBounds.contains([this.bounds[2], this.bounds[3]]) &&
      !force
    ) {
      return;
    }

    this.allInBbox = allInBbox;

    this.bounds = bbox(featureCollection(points.map((p) => point(p.lngLat))));

    let addedNewPopups = false;

    points.forEach((point) => {
      if (this.popups.has(point.properties.routeId)) {
        this.popups.get(point.properties.routeId)!.setLngLat(point.lngLat as [number, number]);
        return;
      }

      addedNewPopups = true;

      const component = this.options.componentFactory(point.properties.routeId, data, this.ctx);

      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'no-mouse-events',
      })
        .setLngLat(point.lngLat as [number, number])
        .setDOMContent(component.container)
        .addTo(this.map);

      if ('onAttach' in component) {
        (component as AnnotationPopupComponentI & OnAttach).onAttach(popup);
      }

      const popupElem = popup.getElement();
      const popupContent = popupElem.querySelector<HTMLElement>('.maplibregl-popup-content');
      if (popupContent) popupContent.style.padding = '0';

      this.popupElementsByRouteId.set(point.properties.routeId, popupElem);
      this.bindPopupRouteHighlight(popupElem, point.properties.routeId);

      this.components.push(component);
      this.popups.set(point.properties.routeId, popup);
    });

    if (this.ctx.selectedRouteId != null && addedNewPopups) {
      this.raisePopupZIndex(this.ctx.selectedRouteId);
    }
  }

  private raisePopupZIndex(selectedRouteId?: number): void {
    const selectedPopup =
      selectedRouteId === undefined
        ? undefined
        : this.popupElementsByRouteId.get(selectedRouteId);
    const popupContainer = selectedPopup?.parentElement;

    if (
      this.popupZIndexRouteId === selectedRouteId &&
      (!selectedPopup || popupContainer?.lastElementChild === selectedPopup)
    ) {
      return;
    }

    this.popupElementsByRouteId.forEach((popupElem, routeId) => {
      popupElem.style.zIndex = routeId === selectedRouteId ? '10' : '';
    });

    if (selectedPopup && popupContainer && popupContainer.lastElementChild !== selectedPopup) {
      popupContainer.appendChild(selectedPopup);
    }

    this.popupZIndexRouteId = selectedRouteId;
  }

  private destroyView() {
    this.allInBbox = false;
    this.ctx.projector?.highlightRoute?.();
    this.components.forEach((c) => c.destroy());
    this.popups.forEach((p) => p.remove());
    this.popupHoverHandlers.forEach((handlers, routeId) => {
      const popupElem = this.popupElementsByRouteId.get(routeId);
      popupElem?.removeEventListener('mouseenter', handlers.enter);
      popupElem?.removeEventListener('mouseleave', handlers.leave);
    });

    this.popups = new Map();
    this.components = [];
    this.popupElementsByRouteId.clear();
    this.popupHoverHandlers.clear();
    this.popupZIndexRouteId = undefined;
  }

  private bindPopupRouteHighlight(popupElem: HTMLElement, routeId: number): void {
    const enter = () => this.ctx.projector?.highlightRoute?.(routeId);
    const leave = () => this.ctx.projector?.highlightRoute?.();

    popupElem.addEventListener('mouseenter', enter);
    popupElem.addEventListener('mouseleave', leave);
    this.popupHoverHandlers.set(routeId, { enter, leave });
  }

  private areBoundsEqual(first: LngLatBounds, second: LngLatBounds): boolean {
    const firstSouthWest = first.getSouthWest();
    const firstNorthEast = first.getNorthEast();
    const secondSouthWest = second.getSouthWest();
    const secondNorthEast = second.getNorthEast();

    return (
      firstSouthWest.lng === secondSouthWest.lng &&
      firstSouthWest.lat === secondSouthWest.lat &&
      firstNorthEast.lng === secondNorthEast.lng &&
      firstNorthEast.lat === secondNorthEast.lat
    );
  }
}
