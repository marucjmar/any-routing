import { featureCollection } from '@turf/helpers';
import { FitBoundsOptions, LngLatBounds, Map, MapLayerMouseEvent, Marker } from 'maplibre-gl';
import {
  AnyRouting,
  AnyRoutingDataResponse,
  AnyRoutingPlugin,
  Dispatcher,
  InternalWaypoint,
  InternalWaypointC,
  Mode,
} from '@any-routing/core';
import bbox from '@turf/bbox';
import { debounce } from '../utils/debounce.util';
import { LayerFactory, LayerRef, MapLibreProjectorEventMap, MapLibreProjectorOptions } from './projector.plugin.types';

export class MapLibreProjector implements AnyRoutingPlugin {
  private routing!: AnyRouting;
  private readonly map: Map;
  private readonly options: MapLibreProjectorOptions;
  private readonly dispatcher: Dispatcher<MapLibreProjectorEventMap> = new Dispatcher();

  private addWaypointMarker: Marker = new Marker();
  private _waypointsMarkers: Marker[] = [];
  private _canAddWaypoints = true;
  private _canDragWaypoints = true;
  private _canSelectRoute = true;
  private _maxWaypoints = Infinity;
  private _sourceId: string;

  private readonly routeClickHandler = this.onRouteClick.bind(this);
  private readonly routeHoverHandler = this.onRouteHover.bind(this);
  private readonly routeHoverOutHandler = this.onRouteHoverOut.bind(this);
  private readonly routeMouseDownHandler = this.onRouteMouseDown.bind(this);
  private readonly routeMoveHandler = this.onRouteMove.bind(this);
  private readonly dragCommitHandler;

  public get waypointsMarkers(): Marker[] {
    return this._waypointsMarkers;
  }

  public get routesLayerIds(): string[] {
    return this._routesLayerIds;
  }

  public get isEditable(): boolean {
    return this._canAddWaypoints || this._canDragWaypoints;
  }

  private get waypoints(): InternalWaypoint[] {
    return this.routing.state.waypoints;
  }

  private _routesLayerIds: string[] = [];

  private layers: LayerRef[] = [];

  constructor(options: MapLibreProjectorOptions) {
    this.options = {
      maxWaypoints: Infinity,
      canAddWaypoints: true,
      canDragWaypoints: true,
      canSelectRoute: true,
      routesWhileDragging: true,
      waypointDragCommitDebounceTime: 150,
      sourceTolerance: 0.01,
      ...options,
    };

    this.map = options.map;
    this._maxWaypoints = this.options.maxWaypoints ?? Infinity;
    this._sourceId = options.routesSourceId || '';

    this.dragCommitHandler = debounce(
      (newWaypoints: InternalWaypoint[], index: number) => {
        this.dispatcher.fire('waypointDragCommit', {
          waypoint: newWaypoints[index],
        });

        this.setAndRecalculate(newWaypoints, 'drag');
      },
      50,
      { maxWait: this.options.waypointDragCommitDebounceTime }
    );
  }

  public projectRoute(routesShapeGeojson: AnyRoutingDataResponse['routesShapeGeojson']): void {
    this.map
      ?.getSource(this._sourceId)
      //@ts-ignore
      ?.setData(routesShapeGeojson);

    this.dispatcher.fire('routesProjected', { routesShapeGeojson });
  }

  public onAdd(anyRouting: AnyRouting): void {
    this.routing = anyRouting;

    this._sourceId = this.options.routesSourceId ?? this.routing.getUniqueName('any-routing-maplibre-projector');

    this.map.addSource(this._sourceId, {
      data: null,
      type: 'geojson',
      lineMetrics: this.options.sourceLineMetrics === true,
      tolerance: this.options.sourceTolerance,
    });

    this.setLayers(this.options.routeLayersFactory || []);

    this.setCanAddWaypoints(this.options.editable ?? !!this.options.canAddWaypoints);
    this.setCanSelectRoute(this.options.editable ?? !!this.options.canSelectRoute);
    this.setCanDragWaypoint(this.options.editable ?? !!this.options.canDragWaypoints);
    this.bindLayerEvents();

    this.routing.on('waypointsChanged', (event) => {
      if (event.state.mode === 'drag') {
        return;
      }

      this.projectWaypoints(event.waypoints);
    });

    this.routing.on('routesFound', (event) => {
      if (event.state.routesShapeGeojson) {
        this.projectRoute(event.state.routesShapeGeojson);

        if (event.state.mode === 'default') {
          this.projectWaypoints(event.state.waypoints);
        }

        if (event.recalculateOptions.fitViewToData) {
          this.fitViewToData();
        }
      }
    });

    this.routing.on('routeSelected', (event) => {
      if (event.state.routesShapeGeojson) {
        this.projectRoute(event.state.routesShapeGeojson);
      }
    });

    this.routing.on('calculationStarted', (event) => {
      if (event.recalculateOptions.clearMap) {
        this.clearRoutes();
      }
    });

    this.routing.on('stateUpdated', (event) => {
      if (
        event.source === 'external' &&
        (event.updatedProperties.includes('routesShapeGeojson') || event.updatedProperties.includes('waypoints'))
      ) {
        if (event.state.routesShapeGeojson) {
          this.projectRoute(event.state.routesShapeGeojson);
        }

        this.projectWaypoints(event.state.waypoints);
      }
    });
  }

  public onRemove(): void {
    this.destroy();
  }

  public projectWaypoints(waypoints: InternalWaypoint[]): void {
    this._waypointsMarkers.forEach((waypointMarker) => waypointMarker.remove());

    this._waypointsMarkers = waypoints.map((waypoint, index): Marker => {
      const marker: Marker = this.options.markerFactory({ waypoint });
      marker
        .setDraggable(this._canDragWaypoints)
        .setLngLat([waypoint.position.lng, waypoint.position.lat])
        .addTo(this.map!);

      const dragHandler = (event) => {
        const newWaypoints = [...this.waypoints];
        newWaypoints[index] = {
          ...newWaypoints[index],
          position: {
            lat: event.target._lngLat.lat,
            lng: event.target._lngLat.lng,
          },
          geocoded: false
        };

        this.dispatcher.fire('waypointDrag', {
          waypoint: newWaypoints[index],
        });

        this.dragCommitHandler(newWaypoints, index);
      };

      if (this.options.routesWhileDragging) {
        marker.on('drag', dragHandler);
      }

      marker.on('dragend', (e) => {
        this.dragCommitHandler.cancel();
        marker.off('drag', dragHandler);

        const newWaypoints = [...this.routing.state.waypoints];
        newWaypoints[index] = {
          ...newWaypoints[index],
          position: {
            lat: e.target._lngLat.lat,
            lng: e.target._lngLat.lng,
          },
          geocoded: false
        };

        this.dispatcher.fire('waypointDragEnd', {
          waypoint: newWaypoints[index],
        });

        this.setAndRecalculate(newWaypoints, 'default');
      });

      return marker;
    });
  }

  public destroy(): void {
    this.layers.forEach((layer) => {
      if (this.map?.getLayer(layer.specification.id)) {
        this.map?.removeLayer(layer.specification.id)
      }
    });

    if (this.map?.getSource(this._sourceId)) {
      this.map?.removeSource(this._sourceId);
    }
 
    this._waypointsMarkers?.forEach((waypointMarker) => waypointMarker.remove());
    this.unbindLayerEvents();
  }

  public setLayers(layersFactories: LayerFactory[]): void {
    this.destroyLayers();
    this.layers = layersFactories.map((layerFactory) =>
      layerFactory({ routing: this.routing, sourceId: this._sourceId })
    );
    this._routesLayerIds = this.layers.map(({ specification: { id } }) => id);
    this.layers.forEach((layer) => this.map!.addLayer(layer.specification, layer.addBefore));
  }

  private destroyLayers(): void {
    this.layers.forEach((layer) => this.map!.removeLayer(layer.specification.id));
    this.layers = [];
    this._routesLayerIds = [];
  }

  public clearRoutes(): void {
    this.map
      ?.getSource(this._sourceId)
      //@ts-ignore
      ?.setData(featureCollection([]));
  }

  public fitViewToData(options: FitBoundsOptions = {}): void {
    const state = this.routing.state;
    let bounds: LngLatBounds;

    if (state.routesShapeGeojson || state.data?.routesShapeBounds) {
      bounds = state.data?.routesShapeBounds
        ? new LngLatBounds(state.data.routesShapeBounds)
        : new LngLatBounds(bbox(state.routesShapeGeojson));
    } else if (state.waypoints.length > 0) {
      bounds = new LngLatBounds();

      state.waypoints.forEach((w) => bounds.extend([w.position.lng, w.position.lat]));
    } else {
      return;
    }

    this.map!.fitBounds(bounds, {
      padding: 40,
      ...options,
    });
  }

  public on<E extends keyof MapLibreProjectorEventMap>(
    event: E,
    call: (event: MapLibreProjectorEventMap[E]) => void
  ): void {
    this.dispatcher.on(event, call);
  }

  public off<E extends keyof MapLibreProjectorEventMap>(
    event: E,
    call: (event: MapLibreProjectorEventMap[E]) => void
  ): void {
    this.dispatcher.off(event, call);
  }

  private onRouteClick(event: MapLayerMouseEvent): void {
    if (
      //@ts-ignore
      !event.features[0].properties?.selected &&
      //@ts-ignore
      event.features[0].properties?.routeId != null &&
      this._canSelectRoute &&
      !this.eventIsCancelled(event)
    ) {
      this.stopEventPropagation(event);
      //@ts-ignore
      const routeId: number = event.features[0].properties.routeId;

      this.routing.selectRoute(routeId);
      this.dispatcher.fire('routeClick', { routeId });
    }
  }

  private onRouteHover(event: MapLayerMouseEvent): void {
    this.map!.getCanvas().style.cursor = 'pointer';

    if (
      event.originalEvent.target === this.map.getCanvas() &&
      //@ts-ignore
      event.features[0].properties?.selected &&
      //@ts-ignore
      event.features[0].properties?.routeId != null &&
      this._canAddWaypoints &&
      this.waypoints.length < this._maxWaypoints &&
      !this.eventIsCancelled(event)
    ) {
      this.stopEventPropagation(event);

      this.addWaypointMarker?.remove();
      this.addWaypointMarker = this.options.markerFactory({
        //@ts-ignore
        routeHover: event.features[0],
      });
      this.addWaypointMarker.setLngLat(event.lngLat).addTo(this.map);
      this.addWaypointMarker.getElement().style.pointerEvents = 'none';
    }
  }

  private onRouteHoverOut(): void {
    this.map!.getCanvas().style.cursor = '';

    this.addWaypointMarker.remove();
  }

  private onRouteMouseDown(event: MapLayerMouseEvent): void {
    //@ts-ignore
    if (
      (event.originalEvent.target as HTMLElement) !== this.map.getCanvas() ||
      !event.features ||
      event.features[0] == null ||
      //@ts-ignore
      event.features[0].properties?.waypoint == null ||
      //@ts-ignore
      !event.features[0].properties?.selected ||
      !this._canAddWaypoints ||
      this.waypoints.length >= this._maxWaypoints ||
      this.eventIsCancelled(event)
    ) {
      return;
    }

    if ((event.originalEvent.target as HTMLElement).closest('.marker')) {
      return;
    }

    event.preventDefault();
    this.stopEventPropagation(event);

    //@ts-ignore
    const newWaypointIndex: number = event.features[0].properties.waypoint + 1;

    const waypoint: InternalWaypoint = InternalWaypointC.fromWaypoint(
      {
        position: { lat: event.lngLat.lat, lng: event.lngLat.lng },
      },
      { isFirst: false, isLast: false, index: newWaypointIndex }
    );

    const newWaypointMarker = this.options
      .markerFactory({
        waypoint,
      })
      .setLngLat(event.lngLat)
      .addTo(this.map!);

    const newWaypoints = [...this.waypoints];
    newWaypoints.splice(newWaypointIndex, 0, waypoint);

    this.dispatcher.fire('waypointAdded', { waypoint });
    this.setAndRecalculate(newWaypoints, 'drag');

    const mouseMoveHandler = (event) => {
      newWaypointMarker.setLngLat(event.lngLat);
      const newWaypoints = [...this.waypoints];
      const waypoint = InternalWaypointC.fromWaypoint(
        {
          position: { lat: event.lngLat.lat, lng: event.lngLat.lng },
        },
        { isFirst: false, isLast: false, index: newWaypointIndex }
      );

      newWaypoints[newWaypointIndex] = waypoint;
      this.dispatcher.fire('waypointDrag', {
        waypoint: newWaypoints[newWaypointIndex],
      });

      if (this.options.routesWhileDragging) {
        this.dragCommitHandler(newWaypoints, newWaypointIndex);
      }
    };

    this.map!.on('mousemove', mouseMoveHandler);

    this.map!.once('mouseup', (event) => {
      this.map!.off('mousemove', mouseMoveHandler);
      this.dragCommitHandler.cancel();
      const newWaypoints = [...this.waypoints];
      const waypoint = InternalWaypointC.fromWaypoint(
        {
          position: { lat: event.lngLat.lat, lng: event.lngLat.lng },
        },
        { isFirst: false, isLast: false, index: newWaypointIndex }
      );

      newWaypoints[newWaypointIndex] = waypoint;
      this.projectWaypoints(newWaypoints);
      newWaypointMarker.remove();
      this.dispatcher.fire('waypointDragEnd', {
        waypoint: newWaypoints[newWaypointIndex],
      });
      this.setAndRecalculate(newWaypoints, 'default');
    });
  }

  private setAndRecalculate(waypoints: InternalWaypoint[], mode: Mode): void {
    this.routing.setMode(mode);
    this.routing.setWaypoints(waypoints.map((w) => ({ ...w })));
    this.routing
      .recalculateRoute({
        clearMap: false,
        dropPendingRequests: mode === 'default',
        fitViewToData: false,
        syncWaypoints: mode === 'default',
      })
      .catch(() => this.clearRoutes());
  }

  private onRouteMove(event: MapLayerMouseEvent): void {
    if (!this._canAddWaypoints || this.waypoints.length >= this._maxWaypoints || this.eventIsCancelled(event)) {
      return;
    }

    if (
      event.originalEvent.target === this.map.getCanvas() &&
      //@ts-ignore
      event.features[0].properties?.selected &&
      //@ts-ignore
      event.features[0].properties?.routeId != null
    ) {
      this.stopEventPropagation(event);

      this.addWaypointMarker.setLngLat(event.lngLat).addTo(this.map);
      this.addWaypointMarker.getElement().style.pointerEvents = 'none';
    }
  }

  public setEditable(isEditable: boolean): void {
    this.setCanAddWaypoints(isEditable);
    this.setCanSelectRoute(isEditable);
    this.setCanDragWaypoint(isEditable);
  }

  public setCanDragWaypoint(canDragWaypoints: boolean): void {
    this._canDragWaypoints = canDragWaypoints;
    this.addWaypointMarker?.remove();
    this.waypointsMarkers.forEach((marker) => marker.setDraggable(canDragWaypoints));
  }

  public setCanSelectRoute(canSelectRoute: boolean): void {
    this._canSelectRoute = canSelectRoute;
  }

  public setCanAddWaypoints(canAddWaypoints: boolean): void {
    this._canAddWaypoints = canAddWaypoints;

    if (!canAddWaypoints) {
      this.addWaypointMarker?.remove();
    }
  }

  public setMaxWaypoints(maxWaypoints: number): void {
    this._maxWaypoints = maxWaypoints;
  }

  private bindLayerEvents(): void {
    this.routesLayerIds.forEach((layerId) => {
      this.map.on('click', layerId, this.routeClickHandler);
      this.map.on('mouseenter', layerId, this.routeHoverHandler);
      this.map.on('mouseleave', layerId, this.routeHoverOutHandler);
      this.map.on('mousedown', layerId, this.routeMouseDownHandler);
      this.map.on('mousemove', layerId, this.routeMoveHandler);
    });
  }

  private unbindLayerEvents(): void {
    this.routesLayerIds.forEach((layerId) => {
      this.map.off('click', layerId, this.routeClickHandler);
      this.map.off('mouseenter', layerId, this.routeHoverHandler);
      this.map.off('mouseleave', layerId, this.routeHoverOutHandler);
      this.map.off('mousedown', layerId, this.routeMoveHandler);
      this.map.off('mousemove', layerId, this.routeMoveHandler);
    });
  }

  private eventIsCancelled(event: MapLayerMouseEvent): boolean {
    //@ts-ignore
    return event.originalEvent.handledFor ? !!event.originalEvent.handledFor.includes(event.type) : false;
  }

  private stopEventPropagation(event: MapLayerMouseEvent): void {
    //@ts-ignore
    event.originalEvent.handledFor = [...(event.originalEvent.handledFor || []), event.type];
  }
}
