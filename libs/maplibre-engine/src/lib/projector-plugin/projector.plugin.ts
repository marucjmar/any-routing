import { featureCollection } from '@turf/helpers';
import {
  FitBoundsOptions,
  GeoJSONSource,
  LngLatBounds,
  Map,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  MapMouseEvent,
  Marker,
} from 'maplibre-gl';
import {
  type AnyRouting,
  type AnyRoutingDataResponse,
  type AnyRoutingProjector,
  type InternalWaypoint,
  InternalWaypointC,
  Dispatcher,
  type RoutingEvents,
} from '@any-routing/core';
import { debounce } from '../utils/debounce.util';

import type {
  LayerFactory,
  LayerRef,
  MapLibreProjectorEventMap,
  MapLibreProjectorOptions,
  RouteFeatureProperties,
} from './projector.plugin.types';
import { Feature, Geometry } from 'geojson';
import bbox from '@turf/bbox';

interface LatLng {
  lat: number;
  lng: number;
}

type RouteMouseEvent = MapMouseEvent & {
  features?: MapGeoJSONFeature[];
};

const DEFAULT_OPTIONS = {
  maxWaypoints: Infinity,
  canAddWaypoints: true,
  canDragWaypoints: true,
  canSelectRoute: true,
  hoverEnabled: true,
  routesWhileDragging: true,
  waypointDragCommitDebounceTime: 650,
  sourceTolerance: 0.01,
} as const;

export const isEqual = <T>(a: T, b: T): boolean => {
  if (a === b) {
    return true;
  }

  const bothAreObjects =
    a &&
    b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    Array.isArray(a) === Array.isArray(b);

  return Boolean(
    bothAreObjects &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([k, v]) => isEqual(v, b[k as keyof T])),
  );
};

/** Inner debounce window for the drag-commit handler (ms). */
const DRAG_COMMIT_DEBOUNCE_WAIT_MS = 50;

export class MapLibreProjector implements AnyRoutingProjector {
  private routing!: AnyRouting;
  private readonly map: Map;
  private readonly options: MapLibreProjectorOptions;
  private readonly dispatcher: Dispatcher<MapLibreProjectorEventMap> = new Dispatcher();

  private addWaypointMarker: Marker = new Marker();
  private _waypointsMarkers: Marker[] = [];
  private _canAddWaypoints = true;
  private _canDragWaypoints = true;
  private _canSelectRoute = true;
  private _hoverEnabled = true;
  private _maxWaypoints = Infinity;
  private _sourceId: string;
  private _routesLayerIds: string[] = [];
  private layers: LayerRef[] = [];
  private lastHoverFeatureId?: number;
  private waypointMarkerAdded = false;
  private activeDragCleanup?: () => void;
  private highlightedRouteId?: number;
  private routeMoveFrame?: number;
  private pendingRouteMove?: LatLng;
  private recalculationId = 0;
  private previewRequestId = 0;
  private previewLoading = false;
  private lastPreviewData?: { waypoints: InternalWaypoint[]; data: AnyRoutingDataResponse };
  private _waypoints: InternalWaypoint[] = [];

  private readonly stateUpdatedHandler = (
    event: RoutingEvents<AnyRoutingDataResponse>['stateUpdated'],
  ) => {
    const touchedWaypoints = event.updatedProperties.includes('waypoints');

    if (touchedWaypoints) {
      this.projectWaypoints(event.state.waypoints);
    }

    const touchedRoutes = event.updatedProperties.includes('routesShapeGeojson');
    if (touchedRoutes) {
      if (event.state.routesShapeGeojson) {
        this.projectRoute(event.state.routesShapeGeojson);
      } else {
        this.clearRoutes();
      }
    }

    const touchedSelectedRoute = event.updatedProperties.includes('selectedRouteId');
    if (touchedSelectedRoute) {
      this.bringLineToTop(event.state.selectedRouteId ?? 0);
    }
  };

  private readonly routeClickHandler = this.onRouteClick.bind(this);
  private readonly routeMouseDownHandler = this.onRouteMouseDown.bind(this);
  private readonly mapMouseMoveHandler = this.onMapMouseMove.bind(this);
  private readonly dragCommitHandler: ((
    newWaypoints: InternalWaypoint[],
    index: number,
  ) => void) & { cancel: () => void };

  public get waypointsMarkers(): Marker[] {
    return this._waypointsMarkers;
  }

  public get routesLayerIds(): string[] {
    return this._routesLayerIds;
  }

  public get isEditable(): boolean {
    return this._canAddWaypoints || this._canDragWaypoints;
  }

  public get waypoints(): InternalWaypoint[] {
    return this._waypoints;
  }

  constructor(options: MapLibreProjectorOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.map = options.map;
    this._maxWaypoints = this.options.maxWaypoints ?? Infinity;
    this._sourceId = options.routesSourceId || '';

    this.dragCommitHandler = debounce(
      (newWaypoints: InternalWaypoint[], index: number) => {
        this.dispatcher.fire('waypointDragCommit', {
          waypoint: newWaypoints[index],
        });
        void this.preview(newWaypoints);
      },
      DRAG_COMMIT_DEBOUNCE_WAIT_MS,
      { maxWait: this.options.waypointDragCommitDebounceTime },
    );
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  public onAdd(anyRouting: AnyRouting): void {
    this.routing = anyRouting;

    this._sourceId =
      this.options.routesSourceId ?? this.routing.getUniqueName('any-routing-maplibre-projector');

    this.map.addSource(this._sourceId, {
      data: featureCollection([]),
      type: 'geojson',
      tolerance: this.options.sourceTolerance,
      lineMetrics: !!this.options.sourceLineMetrics,
    });

    this.setLayers(this.options.routeLayersFactory || []);

    this.setCanAddWaypoints(this.options.editable ?? !!this.options.canAddWaypoints);
    this.setCanSelectRoute(this.options.editable ?? !!this.options.canSelectRoute);
    this.setCanDragWaypoint(this.options.editable ?? !!this.options.canDragWaypoints);
    this.setHoverEnabled(this.options.hoverEnabled ?? true);
    this.bindLayerEvents();

    this.routing.on('stateUpdated', this.stateUpdatedHandler);
  }

  public onRemove(): void {
    this.destroy();
  }

  public destroy(): void {
    this.recalculationId += 1;
    if (this.routeMoveFrame !== undefined) {
      cancelAnimationFrame(this.routeMoveFrame);
      this.routeMoveFrame = undefined;
    }
    this.pendingRouteMove = undefined;
    this.routing?.off('stateUpdated', this.stateUpdatedHandler);
    this.dragCommitHandler.cancel();
    this.activeDragCleanup?.();
    this.activeDragCleanup = undefined;
    this.unbindLayerEvents();
    this.destroyLayers();

    if (this.map?.getSource(this._sourceId)) {
      this.map.removeSource(this._sourceId);
    }

    this._waypointsMarkers.forEach((marker) => marker.remove());
    this._waypointsMarkers = [];
    this.addWaypointMarker.remove();
    this.waypointMarkerAdded = false;
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------

  public projectRoute(routesShapeGeojson: AnyRoutingDataResponse['routesShapeGeojson']): void {
    this.getSource()?.setData(routesShapeGeojson);
    this.dispatcher.fire('routesProjected', { routesShapeGeojson });
    this.dispatcher.fire('viewStateChanged', {
      state: this.routing.state,
      reason: 'route',
    });
  }

  public clearRoutes(): void {
    this.getSource()?.setData(featureCollection([]));
  }

  public projectWaypoints(waypoints: InternalWaypoint[]): void {
    this._waypoints = waypoints;
    this._waypointsMarkers.forEach((marker) => marker.remove());

    this._waypointsMarkers = waypoints.map((waypoint, index): Marker => {
      const marker = this.options
        .markerFactory({ waypoint })
        .setDraggable(this._canDragWaypoints)
        .setLngLat([waypoint.position.lng, waypoint.position.lat])
        .addTo(this.map);

      const dragHandler = (): void => {
        const newWaypoints = this.withUpdatedPosition(this.waypoints, index, marker.getLngLat());

        this.dispatcher.fire('waypointDrag', {
          waypoint: newWaypoints[index],
        });
        this.dispatcher.fire('viewStateChanged', {
          state: { ...this.routing.state, waypoints: newWaypoints },
          reason: 'interaction',
        });
        this._waypoints = newWaypoints;
        if (this.options.routesWhileDragging) {
          this.dragCommitHandler(newWaypoints, index);
        }
      };

      marker.on('drag', dragHandler);

      marker.on('dragend', () => {
        this.dragCommitHandler.cancel();
        marker.off('drag', dragHandler);

        const newWaypoints = this.withUpdatedPosition(
          this.routing.state.waypoints,
          index,
          marker.getLngLat(),
        );

        this.dispatcher.fire('waypointDragEnd', {
          waypoint: newWaypoints[index],
        });
        this.dispatcher.fire('viewStateChanged', {
          state: { ...this.routing.state, waypoints: newWaypoints },
          reason: 'interaction',
        });

        if (
          this.lastPreviewData &&
          isEqual(this.lastPreviewData.waypoints, newWaypoints) &&
          this.options.previewDataProvider === this.routing.options.dataProvider
        ) {
          this.routing.setWaypoints(newWaypoints);
          this.routing.applyCalculationResult(this.lastPreviewData.data);
        } else {
          this.setAndRecalculate(newWaypoints);
        }
      });

      return marker;
    });

    this.dispatcher.fire('waypointsProjected', { waypoints });
    this.dispatcher.fire('viewStateChanged', {
      state: { ...this.routing.state, waypoints },
      reason: 'waypoints',
    });
  }

  public setLayers(layersFactories: LayerFactory[]): void {
    this.destroyLayers();
    this.layers = layersFactories.map((layerFactory) =>
      layerFactory({ routing: this.routing, sourceId: this._sourceId }),
    );
    this._routesLayerIds = this.layers.map(({ specification: { id } }) => id);
    this.layers.forEach((layer) => this.map.addLayer(layer.specification, layer.addBefore));
  }

  public fitViewToData(options: FitBoundsOptions = {}): void {
    const state = this.routing.state;
    const bounds = this.computeBounds(state);
    if (!bounds) return;

    this.map.fitBounds(bounds, { padding: 40, ...options });
  }

  private computeBounds(state: AnyRouting['state']): LngLatBounds | undefined {
    if (state.data?.routesShapeBounds) {
      return new LngLatBounds(state.data.routesShapeBounds as [number, number, number, number]);
    }

    if (state.routesShapeGeojson) {
      return new LngLatBounds(bbox(state.routesShapeGeojson) as [number, number, number, number]);
    }

    if (state.waypoints.length > 0) {
      const bounds = new LngLatBounds();
      state.waypoints.forEach((w) => bounds.extend([w.position.lng, w.position.lat]));
      return bounds;
    }

    return undefined;
  }

  private async bringLineToTop(routeId: number): Promise<void> {
    this.layers.forEach((layer) => {
      this.map.setLayoutProperty(layer.specification.id, 'line-sort-key', [
        'case',
        ['==', ['get', 'routeId'], routeId ?? 0],
        1000,
        ['-', 999, ['get', 'routeId']],
      ]);
    });

    this.map.querySourceFeatures(this._sourceId).forEach((f) => {
      this.map.setFeatureState(
        {
          source: this._sourceId,
          id: f.id,
        },
        {
          selected:
            this.routing.state.selectedRouteId === (f.properties as RouteFeatureProperties).routeId,
        },
      );
    });

    this.routing.state.routesShapeGeojson?.features.forEach((feature) => {
      this.map.setFeatureState(
        {
          source: this._sourceId,
          id: feature.id,
        },
        {
          selected: this.routing.state.selectedRouteId === feature.properties.routeId,
        },
      );
    });
  }

  // ---------------------------------------------------------------------
  // Event bus
  // ---------------------------------------------------------------------

  public on<E extends keyof MapLibreProjectorEventMap>(
    event: E,
    call: (event: MapLibreProjectorEventMap[E]) => void,
  ): void {
    this.dispatcher.on(event, call);
  }

  public off<E extends keyof MapLibreProjectorEventMap>(
    event: E,
    call: (event: MapLibreProjectorEventMap[E]) => void,
  ): void {
    this.dispatcher.off(event, call);
  }

  // ---------------------------------------------------------------------
  // Map interaction handlers
  // ---------------------------------------------------------------------

  private onRouteClick(event: MapLayerMouseEvent): void {
    const props = this.getFeatureProperties(event);

    if (
      props?.routeId != null &&
      props.routeId !== this.routing.state.selectedRouteId &&
      this._canSelectRoute &&
      !this.eventIsCancelled(event)
    ) {
      this.stopEventPropagation(event);
      this.routing.selectRoute(props.routeId);
      this.dispatcher.fire('routeClick', { routeId: props.routeId });
      this.dispatcher.fire('viewStateChanged', {
        state: this.routing.state,
        reason: 'interaction',
      });
    }
  }

  private onRouteHover(event: RouteMouseEvent): void {
    if (!this._hoverEnabled) return;

    this.map.getCanvas().style.cursor = 'pointer';
    const props = this.getFeatureProperties(event);

    if (
      event.originalEvent.target === this.map.getCanvas() &&
      event.features?.[0] &&
      props?.routeId === this.routing.state.selectedRouteId &&
      props?.routeId != null &&
      this._canAddWaypoints &&
      this.waypoints.length < this._maxWaypoints &&
      !this.eventIsCancelled(event)
    ) {
      this.stopEventPropagation(event);

      this.addWaypointMarker?.remove();
      this.waypointMarkerAdded = false;
      this.addWaypointMarker = this.options.markerFactory({
        routeHover: this.getRouteHoverFeature(event),
      });
      this.showAddWaypointMarker(event.lngLat);
    }

    if (props?.routeId == null || this.lastHoverFeatureId === props.routeId) return;

    this.lastHoverFeatureId = props.routeId;
    this.highlightRoute(props.routeId);
  }

  private onRouteHoverOut(): void {
    if (!this._hoverEnabled) return;

    this.map.getCanvas().style.cursor = '';
    this.addWaypointMarker.remove();
    this.waypointMarkerAdded = false;
    this.pendingRouteMove = undefined;
    if (this.routeMoveFrame !== undefined) {
      cancelAnimationFrame(this.routeMoveFrame);
      this.routeMoveFrame = undefined;
    }

    this.lastHoverFeatureId = undefined;
    this.highlightRoute();
  }

  private onMapMouseMove(event: MapMouseEvent): void {
    const features = this.map.queryRenderedFeatures(event.point, {
      layers: this.routesLayerIds,
    });

    if (features.length === 0) {
      this.onRouteHoverOut();
      return;
    }

    const routeEvent = event as RouteMouseEvent;
    routeEvent.features = features;
    this.onRouteHover(routeEvent);
    this.onRouteMove(routeEvent);
  }

  private onRouteMove(event: RouteMouseEvent): void {
    if (
      !this._canAddWaypoints ||
      this.waypoints.length >= this._maxWaypoints ||
      this.eventIsCancelled(event)
    ) {
      return;
    }

    const props = this.getFeatureProperties(event);

    if (
      event.originalEvent.target === this.map.getCanvas() &&
      props?.routeId === this.routing.state.selectedRouteId
    ) {
      this.stopEventPropagation(event);
      this.pendingRouteMove = {
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
      };

      if (this.routeMoveFrame === undefined) {
        this.routeMoveFrame = requestAnimationFrame(() => {
          this.routeMoveFrame = undefined;
          const position = this.pendingRouteMove;
          this.pendingRouteMove = undefined;
          if (position) {
            this.showAddWaypointMarker(position);
          }
        });
      }
    }
  }

  private onRouteMouseDown(event: MapLayerMouseEvent): void {
    const props = this.getFeatureProperties(event);
    const target = event.originalEvent.target as HTMLElement;

    if (
      target !== this.map.getCanvas() ||
      !event.features?.[0] ||
      props?.waypoint == null ||
      props?.routeId !== this.routing.state.selectedRouteId ||
      !this._canAddWaypoints ||
      this.waypoints.length >= this._maxWaypoints ||
      this.eventIsCancelled(event) ||
      target.closest('.marker')
    ) {
      return;
    }

    event.preventDefault();
    this.stopEventPropagation(event);

    const newWaypointIndex = props.waypoint + 1;
    const waypoint = this.createWaypointAt(event.lngLat, newWaypointIndex);

    const newWaypointMarker = this.options
      .markerFactory({ waypoint })
      .setLngLat(event.lngLat)
      .addTo(this.map);

    this.dispatcher.fire('waypointAdded', { waypoint });
    this.dispatcher.fire('viewStateChanged', {
      state: {
        ...this.routing.state,
        waypoints: this.withWaypointAt(this.waypoints, newWaypointIndex, waypoint),
      },
      reason: 'interaction',
    });

    const newWaypoints = this.withWaypointAt(this.waypoints, newWaypointIndex, waypoint);
    this._waypoints = newWaypoints;
    this.preview(newWaypoints);

    const mouseMoveHandler = (moveEvent: MapLayerMouseEvent): void => {
      newWaypointMarker.setLngLat(moveEvent.lngLat);

      const draggedWaypoint = this.createWaypointAt(moveEvent.lngLat, newWaypointIndex);

      const newWaypoints = this.withUpdatedWaypointAt(
        this.waypoints,
        newWaypointIndex,
        draggedWaypoint,
      );
      this._waypoints = newWaypoints;

      this.dispatcher.fire('waypointDrag', {
        waypoint: newWaypoints[newWaypointIndex],
      });
      this.dispatcher.fire('viewStateChanged', {
        state: { ...this.routing.state, waypoints: newWaypoints },
        reason: 'interaction',
      });

      if (this.options.routesWhileDragging) {
        this.dragCommitHandler(newWaypoints, newWaypointIndex);
      }
    };

    const mouseUpHandler = (mouseUpEvent: MapLayerMouseEvent): void => {
      this.activeDragCleanup = undefined;
      this.map.off('mousemove', mouseMoveHandler);
      this.dragCommitHandler.cancel();

      const finalWaypoint = this.createWaypointAt(mouseUpEvent.lngLat, newWaypointIndex);

      const newWaypoints = this.withUpdatedWaypointAt(
        this.waypoints,
        newWaypointIndex,
        finalWaypoint,
      );
      this._waypoints = newWaypoints;

      this.projectWaypoints(newWaypoints);
      newWaypointMarker.remove();

      this.dispatcher.fire('waypointDragEnd', {
        waypoint: newWaypoints[newWaypointIndex],
      });
      this.dispatcher.fire('viewStateChanged', {
        state: { ...this.routing.state, waypoints: newWaypoints },
        reason: 'interaction',
      });

      if (
        this.lastPreviewData &&
        isEqual(this.lastPreviewData.waypoints, newWaypoints) &&
        this.options.previewDataProvider === this.routing.options.dataProvider
      ) {
        this.routing.setWaypoints(newWaypoints);
        this.routing.applyCalculationResult(this.lastPreviewData.data);
      } else {
        this.setAndRecalculate(newWaypoints);
      }
    };

    this.map.on('mousemove', mouseMoveHandler);
    this.map.once('mouseup', mouseUpHandler);
    this.activeDragCleanup = () => {
      this.map.off('mousemove', mouseMoveHandler);
      this.map.off('mouseup', mouseUpHandler);
      this.dragCommitHandler.cancel();
      newWaypointMarker.remove();
    };
  }

  // ---------------------------------------------------------------------
  // Editability toggles
  // ---------------------------------------------------------------------

  public setEditable(isEditable: boolean): void {
    this.setCanAddWaypoints(isEditable);
    this.setCanSelectRoute(isEditable);
    this.setCanDragWaypoint(isEditable);
  }

  public setCanDragWaypoint(canDragWaypoints: boolean): void {
    this._canDragWaypoints = canDragWaypoints;
    this.addWaypointMarker?.remove();
    this.waypointMarkerAdded = false;
    this.waypointsMarkers.forEach((marker) => marker.setDraggable(canDragWaypoints));
  }

  public setCanSelectRoute(canSelectRoute: boolean): void {
    this._canSelectRoute = canSelectRoute;
  }

  public setCanAddWaypoints(canAddWaypoints: boolean): void {
    this._canAddWaypoints = canAddWaypoints;
    if (!canAddWaypoints) {
      this.addWaypointMarker?.remove();
      this.waypointMarkerAdded = false;
    }
  }

  public setMaxWaypoints(maxWaypoints: number): void {
    this._maxWaypoints = maxWaypoints;
  }

  public setHoverEnabled(hoverEnabled: boolean): void {
    this._hoverEnabled = hoverEnabled;
    if (!hoverEnabled) {
      this.map.getCanvas().style.cursor = '';
      this.addWaypointMarker?.remove();
      this.waypointMarkerAdded = false;
      this.lastHoverFeatureId = undefined;
      this.highlightRoute();
    }
  }

  public highlightRoute(routeId?: number): void {
    if (this.highlightedRouteId === routeId) {
      return;
    }

    this.highlightedRouteId = routeId;
    this.dispatcher.fire('routeHighlight', { routeId });
    this.updateRouteHoverState();
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  /** Type-safe accessor for route-feature properties (single cast point). */
  private getFeatureProperties(event: RouteMouseEvent): RouteFeatureProperties | undefined {
    return event.features?.[0]?.properties as RouteFeatureProperties | undefined;
  }

  private getRouteHoverFeature(
    event: RouteMouseEvent,
  ): Feature<Geometry, RouteFeatureProperties> | undefined {
    return event.features?.[0] as Feature<Geometry, RouteFeatureProperties> | undefined;
  }

  private getSource(): GeoJSONSource | undefined {
    return this.map?.getSource(this._sourceId) as GeoJSONSource | undefined;
  }

  private updateRouteHoverState(): void {
    const activeRouteId = this.highlightedRouteId ?? this.lastHoverFeatureId;

    this.map.querySourceFeatures(this._sourceId).forEach((feature) => {
      const routeId = (feature.properties as RouteFeatureProperties).routeId;
      this.map.setFeatureState(
        { source: this._sourceId, id: feature.id },
        { hover: routeId === activeRouteId },
      );
    });

    this.routing.state.routesShapeGeojson?.features.forEach((feature) => {
      this.map.setFeatureState(
        { source: this._sourceId, id: feature.id },
        { hover: feature.properties.routeId === activeRouteId },
      );
    });

    this.bringLineToTop(activeRouteId ?? this.routing.state.selectedRouteId ?? 0);
  }

  private createWaypointAt(lngLat: LatLng, index: number): InternalWaypoint {
    return InternalWaypointC.fromWaypoint(
      { position: { lat: lngLat.lat, lng: lngLat.lng } },
      { isFirst: false, isLast: false, index },
    );
  }

  private withWaypointAt(
    waypoints: InternalWaypoint[],
    index: number,
    waypoint: InternalWaypoint,
  ): InternalWaypoint[] {
    const next = [...waypoints];
    next.splice(index, 0, waypoint);
    return next;
  }

  private withUpdatedWaypointAt(
    waypoints: InternalWaypoint[],
    index: number,
    waypoint: InternalWaypoint,
  ): InternalWaypoint[] {
    const next = [...waypoints];
    next[index] = waypoint;
    return next;
  }

  private withUpdatedPosition(
    waypoints: InternalWaypoint[],
    index: number,
    position: LatLng,
  ): InternalWaypoint[] {
    const next = [...waypoints];
    next[index] = {
      ...next[index],
      position: { lat: position.lat, lng: position.lng },
      geocoded: false,
    };
    return next;
  }

  private setAndRecalculate(waypoints: InternalWaypoint[]): void {
    this.routing.setWaypoints(waypoints);
    this.routing.recalculateRoute();
  }

  private async preview(waypoints: InternalWaypoint[]): Promise<void> {
    if (!this.options.previewDataProvider)
      throw new Error('No previewDataProvider configured for this projector');

    const requestId = ++this.previewRequestId;
    if (!this.previewLoading) {
      this.previewLoading = true;
      this.dispatcher.fire('previewStarted', {});
    }

    let data: AnyRoutingDataResponse | undefined;

    try {
      data = await this.options.previewDataProvider?.request(
        waypoints.map((waypoint) => ({ ...waypoint })),
        { mode: 'preview' },
      );
      if (requestId !== this.previewRequestId || !data) return;
      this.dispatcher.fire('previewFinished', { data });
      this.projectRoute(data.routesShapeGeojson);
    } catch (error) {
      if (requestId === this.previewRequestId) {
        this.dispatcher.fire('previewError', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    } finally {
      if (requestId === this.previewRequestId) {
        this.previewLoading = false;
        this.lastPreviewData = { waypoints: [...waypoints], data: data! };
      }
    }
  }

  private showAddWaypointMarker(position: LatLng): void {
    this.addWaypointMarker.setLngLat(position);
    if (!this.waypointMarkerAdded) {
      this.addWaypointMarker.addTo(this.map);
      this.waypointMarkerAdded = true;
    }
    this.addWaypointMarker.getElement().style.pointerEvents = 'none';
  }

  private destroyLayers(): void {
    this.layers.forEach((layer) => {
      if (this.map?.getLayer(layer.specification.id)) {
        this.map.removeLayer(layer.specification.id);
      }
    });
    this.layers = [];
    this._routesLayerIds = [];
  }

  private bindLayerEvents(): void {
    this.routesLayerIds.forEach((layerId) => {
      this.map.on('click', layerId, this.routeClickHandler);
      this.map.on('mousedown', layerId, this.routeMouseDownHandler);
    });
    this.map.on('mousemove', this.mapMouseMoveHandler);
  }

  private unbindLayerEvents(): void {
    this.routesLayerIds.forEach((layerId) => {
      this.map.off('click', layerId, this.routeClickHandler);
      this.map.off('mousedown', layerId, this.routeMouseDownHandler);
    });
    this.map.off('mousemove', this.mapMouseMoveHandler);
  }

  private eventIsCancelled(event: MapLayerMouseEvent): boolean {
    const handledFor = (
      event.originalEvent as unknown as {
        handledFor?: string[];
      }
    ).handledFor;
    return handledFor ? handledFor.includes(event.type) : false;
  }

  private stopEventPropagation(event: MapLayerMouseEvent): void {
    const original = event.originalEvent as unknown as {
      handledFor?: string[];
    };
    original.handledFor = [...(original.handledFor || []), event.type];
  }
}
