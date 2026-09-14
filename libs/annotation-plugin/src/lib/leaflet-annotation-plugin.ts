import bbox from '@turf/bbox';
import { featureCollection, point } from '@turf/helpers';
import type { BBox } from 'geojson';
import { wrap } from 'comlink';
import { Map as LMap, Popup, LatLngBounds } from 'leaflet';
import type {
  AnyRouting,
  AnyRoutingDataResponse,
  AnyRoutingPlugin,
} from '@any-routing/core';
import type { AnnotationWorkerApi } from './annotation.worker';
import { AnnotationPopupComponent, type AnnotationPopupComponentI } from './popup-component';

export interface LeafletAnnotationPluginOptions {
  map: LMap;
  componentFactory?: (
    routeId: number,
    data: AnyRoutingDataResponse,
    ctx: AnyRouting,
  ) => AnnotationPopupComponentI;
}

export class LeafletAnnotationPlugin implements AnyRoutingPlugin {
  private readonly map: LMap;
  private readonly componentFactory: NonNullable<
    LeafletAnnotationPluginOptions['componentFactory']
  >;
  private readonly worker: Worker;
  private readonly workerApi: ReturnType<typeof wrap<AnnotationWorkerApi>>;
  private routing!: AnyRouting;
  private data?: AnyRoutingDataResponse;
  private bounds?: BBox;
  private allInBbox = false;
  private popups: Map<number, Popup> = new Map();
  private components: AnnotationPopupComponentI[] = [];
  private frame?: number;
  private generation = 0;
  private recalculating = false;
  private recalculateAgain = false;

  private readonly mapChangedHandler = (): void => {
    if (this.frame !== undefined) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      void this.recalculate(true);
    });
  };
  private readonly routesFoundHandler = (): void => {
    const data = this.routing.data;
    if (!data || data.version === this.data?.version || !data.latest) return;
    const generation = ++this.generation;
    this.data = data;
    this.destroyView();
    void this.workerApi.createChunks(data).then(async () => {
      if (generation !== this.generation) return;
      await this.recalculate(true);
    });
  };
  private readonly waypointDragHandler = (): void => {
    this.generation++;
    this.data = undefined;
    this.bounds = undefined;
    this.destroyView();
  };

  constructor(options: LeafletAnnotationPluginOptions) {
    this.map = options.map;
    this.componentFactory =
      options.componentFactory ??
      ((routeId, data, ctx) => new AnnotationPopupComponent(routeId, data, ctx));
    this.worker = new Worker(new URL('./annotation.worker', import.meta.url), { type: 'module' });
    this.workerApi = wrap<AnnotationWorkerApi>(this.worker);
  }

  onAdd(routing: AnyRouting): void {
    this.routing = routing;
    this.routing.on('routesFound', this.routesFoundHandler);
    this.routing.projector?.on('waypointDrag', this.waypointDragHandler);
    this.routing.projector?.on('previewStarted', this.waypointDragHandler);
    this.map.on('moveend', this.mapChangedHandler);
    this.map.on('zoomend', this.mapChangedHandler);
  }

  onRemove(): void {
    this.generation++;
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.routing.off('routesFound', this.routesFoundHandler);
    this.routing.projector?.off('waypointDrag', this.waypointDragHandler);
    this.routing.projector?.off('previewStarted', this.waypointDragHandler);
    this.map.off('moveend', this.mapChangedHandler);
    this.map.off('zoomend', this.mapChangedHandler);
    this.worker.terminate();
    this.destroyView();
  }

  async recalculate(force = false): Promise<void> {
    if (this.recalculating) {
      this.recalculateAgain = true;
      return;
    }
    this.recalculating = true;
    try {
      await this.recalculateNow(force);
    } finally {
      this.recalculating = false;
      if (this.recalculateAgain) {
        this.recalculateAgain = false;
        await this.recalculate(true);
      }
    }
  }

  private async recalculateNow(force: boolean): Promise<void> {
    if (!this.data) return;
    const requestGeneration = this.generation;
    const mapBounds = this.map.getBounds();
    if (
      !force &&
      this.bounds &&
      this.allInBbox &&
      mapBounds.contains([this.bounds[1], this.bounds[0]]) &&
      mapBounds.contains([this.bounds[3], this.bounds[2]])
    )
      return;
    const sw = mapBounds.getSouthWest();
    const ne = mapBounds.getNorthEast();
    const result = await this.workerApi.recalculatePos({ bbox: { sw, ne } });
    if (requestGeneration !== this.generation) return;
    if (!result.points.length) return;
    this.destroyView();
    this.allInBbox = result.allInBbox;
    this.bounds = bbox(featureCollection(result.points.map((item) => point(item.lngLat))));
    result.points.forEach((item) => {
      if (this.popups.has(item.properties.routeId)) {
        this.popups.get(item.properties.routeId)!.setLatLng(item.lngLat.reverse() as [number, number]);
        return;
      }
      
      const component = this.componentFactory(item.properties.routeId, this.data!, this.routing);
      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        autoClose: false,
        autoPan: false,
        className: 'no-mouse-events',
      })
        .setLatLng([item.lngLat[1], item.lngLat[0]])
        .setContent(component.container)
        .on('add', (evt) => {
          evt.target.getElement().addEventListener('click', () => {
            this.routing.selectRoute(item.properties.routeId);
          });
        })
        .addTo(this.map);
      this.components.push(component);
      this.popups.set(item.properties.routeId, popup);
    });
  }

  private destroyView(): void {
    this.components.forEach((component) => component.destroy());
    this.popups.forEach((popup) => popup.remove());
    this.components = [];
    this.popups = new Map();
    this.allInBbox = false;
  }
}
