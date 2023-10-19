import { LngLatBounds, Map, Popup } from 'maplibre-gl';
import type { AnyRouting, AnyRoutingPlugin, AnyRoutingDataResponse } from '@any-routing/core';
import { BBox, featureCollection, point } from '@turf/helpers';
import { wrap } from 'comlink';
import bbox from '@turf/bbox';
import type { AnnotationWorkerApi } from './annotation.worker';
import { AnnotationPopupComponent, AnnotationPopupComponentI, OnAttach } from './popup-component';

export interface AnnotationPluginOptions {
  calculatePopupOnFly: boolean;
  map: Map;
  componentFactory(id, routeData: any, ctx: AnyRouting): AnnotationPopupComponentI;
}

const defaultConfig: Omit<AnnotationPluginOptions, 'map'> = {
  calculatePopupOnFly: true,
  componentFactory(routeId, data, ctx) {
    return new AnnotationPopupComponent(routeId, data, ctx);
  },
};

type Require<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export class AnnotationPlugin implements AnyRoutingPlugin {
  private map!: Map;
  private mapBounds!: LngLatBounds;
  private bounds?: BBox;
  private worker: Worker;
  private popups: Popup[] = [];
  private allInBbox = false;
  private ctx!: AnyRouting;
  private options: AnnotationPluginOptions;
  private workerApi: AnnotationWorkerApi;
  private data;
  private components: AnnotationPopupComponentI[] = [];
  private clearMapHandler = () => {
    this.data = undefined;
    this.destroyView();
  };
  private routeCalculatedHandler = this.routeCalculated.bind(this);
  private mapMoveEndHandler = this.recalculate.bind(this);

  constructor(options: Require<Partial<AnnotationPluginOptions>, 'map'>) {
    this.options = { ...defaultConfig, ...options };
    this.worker = new Worker(new URL('./annotation.worker', import.meta.url), {
      type: 'module',
    });

    this.map = this.options.map;

    // @ts-ignore
    this.workerApi = wrap(this.worker);
  }

  onAdd(ctx: AnyRouting) {
    this.ctx = ctx;

    this.ctx.on('routesFound', this.routeCalculatedHandler);
    this.ctx.on('calculationStarted', this.clearMapHandler);

    this.map.on(this.options.calculatePopupOnFly ? 'render' : 'idle', this.mapMoveEndHandler);
  }

  onRemove() {
    this.ctx.off('routesFound', this.routeCalculatedHandler);
    this.ctx.off('calculationStarted', this.clearMapHandler);
    this.worker.terminate();
    this.destroyView();
  }

  private async routeCalculated() {
    const data: AnyRoutingDataResponse | undefined = this.ctx.data;

    if (!data) {
      return;
    }

    if (this.data?.version === data.version || !data.latest) {
      return;
    }

    this.data = data;

    this.destroyView();

    if (this.ctx.state.data?.latest) {
      await this.workerApi.createChunks(this.data);
      await this.recalculate(true);
    }
  }

  public async recalculate(force = false) {
    this.mapBounds = this.map.getBounds();

    if (!this.data) {
      return;
    }

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

    this.destroyView();

    this.allInBbox = allInBbox;

    this.bounds = bbox(featureCollection(points.map((p) => point(p.lngLat))));

    this.components = [];

    points.forEach((point) => {
      const component = this.options.componentFactory(point.properties.routeId, this.data, this.ctx!);

      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'no-mouse-events',
      })
        .setLngLat(point.lngLat)
        .setDOMContent(component.container)
        .addTo(this.map);

      if ('onAttach' in component) {
        (component as AnnotationPopupComponentI & OnAttach).onAttach(popup);
      }

      const popupElem = popup.getElement();
      (popupElem.querySelector('.maplibregl-popup-content') as any).style.padding = '0';

      this.components.push(component);
      this.popups.push(popup);
    });
  }

  private destroyView() {
    this.allInBbox = false;
    this.components.forEach((c) => c.destroy());
    this.popups.forEach((p) => p.remove());

    this.popups = [];
    this.components = [];
  }
}
