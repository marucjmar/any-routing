import {
  GeoJSON,
  LatLng,
  LatLngBounds,
  LeafletMouseEvent,
  Map,
  Marker,
  geoJSON,
  divIcon,
  Layer,
  Path,
} from 'leaflet';

import {
  type AnyRouting,
  AnyRoutingDataResponse,
  type AnyRoutingProjector,
  Dispatcher,
  type InternalWaypoint,
  InternalWaypointC,
  type RoutingEvents,
} from '@any-routing/core';

import { featureCollection } from '@turf/helpers';
import bbox from '@turf/bbox';

import { debounce } from './utils/debounce.util';
import * as Leaflet from 'leaflet';

import type {
  LeafletProjectorEventMap,
  LeafletProjectorOptions,
  LeafletRouteFeature,
  LeafletRouteStyle,
  MarkerFactoryContext,
  RouteFeatureProperties,
} from './projector.leaflet.plugin.types';

const isEqual = <T>(a: T, b: T): boolean => {
  if (a === b) return true;

  const bothAreObjects =
    a &&
    b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    Array.isArray(a) === Array.isArray(b);

  return Boolean(
    bothAreObjects &&
      Object.keys(a).length === Object.keys(b).length &&
      Object.entries(a).every(([key, value]) => isEqual(value, b[key as keyof T])),
  );
};

const DEFAULT_OPTIONS = {
  maxWaypoints: Infinity,
  canAddWaypoints: true,
  canDragWaypoints: true,
  canSelectRoute: true,
  hoverEnabled: true,
  routesWhileDragging: true,
  waypointDragCommitDebounceTime: 150,

  routeStyle: {
    color: '#33C9EB',
    weight: 5,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
  },

  selectedRouteStyle: {
    color: '#e207ff',
    weight: 5,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
  },

  routeOutlineStyle: {
    color: '#ffffff',
    weight: 9,
    opacity: 0.95,
    lineCap: 'round',
    lineJoin: 'round',
  },

  routeZIndex: 1,
  selectedRouteZIndex: 10,
} as const;

const DRAG_COMMIT_DEBOUNCE_WAIT_MS = 50;

interface LatLngPosition {
  lat: number;
  lng: number;
}

export class LeafletProjector implements AnyRoutingProjector {
  private routing!: AnyRouting;

  private readonly map: Map;

  private readonly options: LeafletProjectorOptions & {
    maxWaypoints: number;
    canAddWaypoints: boolean;
    canDragWaypoints: boolean;
    canSelectRoute: boolean;
    routesWhileDragging: boolean;
    waypointDragCommitDebounceTime: number;
    routeStyle: LeafletRouteStyle;
    selectedRouteStyle: LeafletRouteStyle;
    routeOutlineStyle: LeafletRouteStyle;
    routeZIndex: number;
    selectedRouteZIndex: number;
  };

  private readonly dispatcher: Dispatcher<LeafletProjectorEventMap> = new Dispatcher();

  private addWaypointMarker: Marker | undefined;
  private addWaypointMarkerAdded = false;

  private _waypointsMarkers: Marker[] = [];

  private _canAddWaypoints = true;

  private _canDragWaypoints = true;

  private _canSelectRoute = true;

  private _hoverEnabled = true;

  private _maxWaypoints = Infinity;

  private routesLayer?: GeoJSON;
  private routeOutlineLayer?: GeoJSON;
  private hoveredRouteLayer?: Path;
  private activeDragCleanup?: () => void;
  private recalculationId = 0;
  private previewRequestId = 0;
  private previewLoading = false;
  private lastPreviewData?: { waypoints: InternalWaypoint[]; data: AnyRoutingDataResponse };
  private _waypoints: InternalWaypoint[] = [];

  public get waypoints(): InternalWaypoint[] {
    return this._waypoints;
  }

  private readonly calculationStartedHandler = (
    _event: RoutingEvents<AnyRoutingDataResponse>['calculationStarted'],
  ): void => {
    this.clearRoutes();
  };

  private readonly stateUpdatedHandler = (
    event: RoutingEvents<AnyRoutingDataResponse>['stateUpdated'],
  ): void => {
    const touchedRouteOrWaypoints =
      event.updatedProperties.includes('routesShapeGeojson') ||
      event.updatedProperties.includes('waypoints');

    if (!touchedRouteOrWaypoints) return;

    if (event.updatedProperties.includes('routesShapeGeojson')) {
      if (event.state.routesShapeGeojson) {
      this.projectRoute(event.state.routesShapeGeojson);
      } else {
        this.clearRoutes();
      }
    }

    if (event.updatedProperties.includes('waypoints')) {
      this.projectWaypoints(event.state.waypoints);
    }

    if (event.updatedProperties.includes('selectedRouteId')) {
      this.bringSelectedRouteToFront();
    }
  };

  private readonly dragCommitHandler: ((
    newWaypoints: InternalWaypoint[],
    index: number,
  ) => void) & {
    cancel: () => void;
  };

  public get waypointsMarkers(): Marker[] {
    return this._waypointsMarkers;
  }

  public get isEditable(): boolean {
    return this._canAddWaypoints || this._canDragWaypoints;
  }

  constructor(options: LeafletProjectorOptions) {
    this.map = options.map;

    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      routeStyle: {
        ...DEFAULT_OPTIONS.routeStyle,
        ...options.routeStyle,
      },
      selectedRouteStyle: {
        ...DEFAULT_OPTIONS.selectedRouteStyle,
        ...options.selectedRouteStyle,
      },
      routeOutlineStyle: {
        ...DEFAULT_OPTIONS.routeOutlineStyle,
        ...options.routeOutlineStyle,
      },
    };

    this._maxWaypoints = this.options.maxWaypoints ?? Infinity;

    this.dragCommitHandler = debounce(
      (newWaypoints: InternalWaypoint[], index: number) => {
        this.dispatcher.fire('waypointDragCommit', {
          waypoint: newWaypoints[index],
        });

        void this.previewRoute(newWaypoints);
      },
      DRAG_COMMIT_DEBOUNCE_WAIT_MS,
      {
        maxWait: this.options.waypointDragCommitDebounceTime,
      },
    );
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  public onAdd(anyRouting: AnyRouting): void {
    this.routing = anyRouting;

    this.setCanAddWaypoints(this.options.editable ?? !!this.options.canAddWaypoints);

    this.setCanSelectRoute(this.options.editable ?? !!this.options.canSelectRoute);

    this.setCanDragWaypoint(this.options.editable ?? !!this.options.canDragWaypoints);
    this.setHoverEnabled(this.options.hoverEnabled ?? true);

    this.routing.on('calculationStarted', this.calculationStartedHandler);
    this.routing.on('stateUpdated', this.stateUpdatedHandler);
  }

  public onRemove(): void {
    this.destroy();
  }

  public destroy(): void {
    this.recalculationId += 1;
    this.dragCommitHandler.cancel();
    this.activeDragCleanup?.();
    this.activeDragCleanup = undefined;
    this.routing?.off('calculationStarted', this.calculationStartedHandler);
    this.routing?.off('stateUpdated', this.stateUpdatedHandler);

    this.destroyRoutes();

    this._waypointsMarkers.forEach((marker) => {
      marker.remove();
    });

    this._waypointsMarkers = [];
    this._waypoints = [];

    this.addWaypointMarker?.remove();
    this.addWaypointMarker = undefined;
    this.addWaypointMarkerAdded = false;
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------

  public projectRoute(routesShapeGeojson: AnyRoutingDataResponse['routesShapeGeojson']): void {
    this.destroyRoutes();
    this.hoveredRouteLayer = undefined;

    this.routeOutlineLayer = geoJSON(routesShapeGeojson, {
      style: () => this.options.routeOutlineStyle,
    }).addTo(this.map);

    this.routesLayer = geoJSON(routesShapeGeojson, {
      style: (feature) => {
        return this.getRouteStyle(feature as LeafletRouteFeature);
      },

      onEachFeature: (feature, layer) => {
        this.bindRouteFeature(feature as LeafletRouteFeature, layer);
      },
    });

    this.routesLayer.addTo(this.map);
    this.bringSelectedRouteToFront();

    this.dispatcher.fire('routesProjected', {
      routesShapeGeojson,
    });
    this.dispatcher.fire('viewStateChanged', {
      state: this.routing.state,
      reason: 'route',
    });
  }

  public clearRoutes(): void {
    this.destroyRoutes();
  }

  public projectWaypoints(waypoints: InternalWaypoint[]): void {
    this._waypoints = waypoints;
    this._waypointsMarkers.forEach((marker) => {
      marker.remove();
    });

    this._waypointsMarkers = waypoints.map((waypoint, index) => {
      const marker = this.options
        .markerFactory({ waypoint })
        .setLatLng([waypoint.position.lat, waypoint.position.lng])
        .addTo(this.map);

      this.configureWaypointDrag(marker, index);

      return marker;
    });

    this.dispatcher.fire('waypointsProjected', {
      waypoints,
    });
    this.dispatcher.fire('viewStateChanged', {
      state: { ...this.routing.state, waypoints },
      reason: 'waypoints',
    });
  }

  // ---------------------------------------------------------------------
  // Route rendering
  // ---------------------------------------------------------------------

  private getRouteStyle(feature: LeafletRouteFeature): LeafletRouteStyle {
    const routeId = feature.properties?.routeId;
    const selected =
      feature.properties?.selected === true || routeId === this.routing.state.selectedRouteId;

    const routeColors = ['#E53935', '#43A047', '#1E88E5'];
    const routeColor = routeId == null ? undefined : routeColors[routeId];

    return {
      ...(selected ? this.options.selectedRouteStyle : this.options.routeStyle),
      ...(routeColor && !selected ? { color: routeColor } : {}),

      // Leaflet's zIndexOffset is available on Marker,
      // but not directly on Path. pane is a better equivalent.
    };
  }

  private bindRouteFeature(feature: LeafletRouteFeature, layer: Layer): void {
    layer.on({
      click: (event: LeafletMouseEvent) => {
        this.onRouteClick(event, feature, layer);
      },

      mouseover: (event: LeafletMouseEvent) => {
        this.onRouteHover(event, feature, layer);
      },

      mouseout: () => {
        this.onRouteHoverOut();
      },

      mousedown: (event: LeafletMouseEvent) => {
        this.onRouteMouseDown(event, feature, layer);
      },

      mousemove: (event: LeafletMouseEvent) => {
        this.onRouteMove(event, feature);
      },
    });
  }

  // ---------------------------------------------------------------------
  // Waypoint markers
  // ---------------------------------------------------------------------

  private configureWaypointDrag(marker: Marker, index: number): void {
    marker.options.draggable = this._canDragWaypoints;

    if (!this._canDragWaypoints) {
      return;
    }

    const dragHandler = (): void => {
      const position = marker.getLatLng();

      const newWaypoints = this.withUpdatedPosition(this.waypoints, index, position);

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

      const position = marker.getLatLng();

      const newWaypoints = this.withUpdatedPosition(this.routing.state.waypoints, index, position);

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
        this.options.previewDataProvider === this.routing.dataProvider
      ) {
        this.routing.setWaypoints(newWaypoints);
        this.routing.applyCalculationResult(this.lastPreviewData.data);
      } else {
        this.setAndRecalculate(newWaypoints);
      }
    });
  }

  // ---------------------------------------------------------------------
  // Route interaction
  // ---------------------------------------------------------------------

  private onRouteClick(
    event: LeafletMouseEvent,
    feature: LeafletRouteFeature,
    _layer: Layer,
  ): void {
    const props = feature.properties;

    if (
      props.routeId != null &&
      props.routeId !== this.routing.state.selectedRouteId &&
      this._canSelectRoute &&
      !this.eventIsCancelled(event)
    ) {
      this.stopEventPropagation(event);

      this.routing.selectRoute(props.routeId);

      this.dispatcher.fire('routeClick', {
        routeId: props.routeId,
      });
      this.dispatcher.fire('viewStateChanged', {
        state: this.routing.state,
        reason: 'interaction',
      });
    }
  }

  private onRouteHover(
    event: LeafletMouseEvent,
    feature: LeafletRouteFeature,
    layer: Layer,
  ): void {
    if (!this._hoverEnabled) return;
    this.map.getContainer().style.cursor = 'pointer';
    const path = layer instanceof Path ? layer : undefined;
    if (path) {
      const previousFeature = (
        this.hoveredRouteLayer as (Layer & { feature?: LeafletRouteFeature }) | undefined
      )?.feature;
      if (previousFeature) {
        this.hoveredRouteLayer?.setStyle(this.getRouteStyle(previousFeature));
      }
      this.hoveredRouteLayer = path;
      const style = this.getRouteStyle(feature);
      path.setStyle({
        ...style,
        weight: (style.weight ?? 5) + 2,
        opacity: 1,
      });
      path.bringToFront();
    }

    const props = feature.properties;

    if (
      props.routeId != null &&
      props.routeId === this.routing.state.selectedRouteId &&
      this._canAddWaypoints &&
      this.waypoints.length < this._maxWaypoints &&
      !this.eventIsCancelled(event)
    ) {
      this.stopEventPropagation(event);

      this.addWaypointMarker?.remove();
      this.addWaypointMarkerAdded = false;

      this.addWaypointMarker = this.options.markerFactory({
        routeHover: feature,
      });

      this.showAddWaypointMarker(event.latlng);

      this.addWaypointMarker.getElement()?.style.setProperty('pointer-events', 'none');
    }
  }

  private onRouteHoverOut(): void {
    this.map.getContainer().style.cursor = '';
    if (this.hoveredRouteLayer) {
      const feature = (this.hoveredRouteLayer as Layer & { feature?: LeafletRouteFeature }).feature;
      if (feature) {
        this.hoveredRouteLayer.setStyle(this.getRouteStyle(feature));
      }
      this.hoveredRouteLayer = undefined;
    }
    this.bringSelectedRouteToFront();

    this.addWaypointMarker?.remove();
    this.addWaypointMarkerAdded = false;
  }

  private onRouteMove(event: LeafletMouseEvent, feature: LeafletRouteFeature): void {
    if (!this._hoverEnabled) return;
    if (
      !this._canAddWaypoints ||
      this.waypoints.length >= this._maxWaypoints ||
      this.eventIsCancelled(event)
    ) {
      return;
    }

    const props = feature.properties;

    if (props?.routeId === this.routing.state.selectedRouteId) {
      this.stopEventPropagation(event);

      if (!this.addWaypointMarker) {
        this.addWaypointMarker = this.options.markerFactory({
          routeHover: feature,
        });
      }

      this.showAddWaypointMarker(event.latlng);

      this.addWaypointMarker.getElement()?.style.setProperty('pointer-events', 'none');
    }
  }

  private onRouteMouseDown(
    event: LeafletMouseEvent,
    feature: LeafletRouteFeature,
    layer: Layer,
  ): void {
    const props = feature.properties;

    if (
      !props ||
      props.routeId !== this.routing.state.selectedRouteId ||
      !this._canAddWaypoints ||
      this.waypoints.length >= this._maxWaypoints ||
      this.eventIsCancelled(event)
    ) {
      return;
    }

    const target = event.originalEvent.target as HTMLElement;

    if (target.closest('.marker') || target.closest('.leaflet-marker-icon')) {
      return;
    }

    event.originalEvent.preventDefault();

    Leaflet.DomEvent.stopPropagation(event.originalEvent);
    Leaflet.DomEvent.preventDefault(event.originalEvent);

    this.stopEventPropagation(event);

    const newWaypointIndex = props.waypoint + 1;

    const waypoint = this.createWaypointAt(event.latlng, newWaypointIndex);

    console.log(this.routing.state.routesShapeGeojson)
    const newWaypointMarker = this.options
      .markerFactory({ waypoint })
      .setLatLng(event.latlng)
      .addTo(this.map);
    const newWaypoints = this.withWaypointAt(this.waypoints, newWaypointIndex, waypoint);
    this._waypoints = newWaypoints;

    this.activeDragCleanup?.();
    this.activeDragCleanup = undefined;

    this.dispatcher.fire('waypointAdded', {
      waypoint,
    });
    this.dispatcher.fire('viewStateChanged', {
      state: {
        ...this.routing.state,
        waypoints: newWaypoints,
      },
      reason: 'interaction',
    });

    void this.previewRoute(newWaypoints);

    const mouseMoveHandler = (moveEvent: LeafletMouseEvent): void => {
      newWaypointMarker.setLatLng(moveEvent.latlng);

      const draggedWaypoint = this.createWaypointAt(moveEvent.latlng, newWaypointIndex);

      const movedWaypoints = this.withUpdatedWaypointAt(
        this.waypoints,
        newWaypointIndex,
        draggedWaypoint,
      );
      this._waypoints = movedWaypoints;
      this.dispatcher.fire('waypointDrag', {
        waypoint: movedWaypoints[newWaypointIndex],
      });
      this.dispatcher.fire('viewStateChanged', {
        state: { ...this.routing.state, waypoints: movedWaypoints },
        reason: 'interaction',
      });

      if (this.options.routesWhileDragging) {
        this.dragCommitHandler(movedWaypoints, newWaypointIndex);
      }
    };

    const mouseUpHandler = (mouseUpEvent: LeafletMouseEvent): void => {
      this.activeDragCleanup = undefined;
      this.map.off('mousemove', mouseMoveHandler);
      this.map.off('mouseup', mouseUpHandler);

      this.dragCommitHandler.cancel();

      const finalWaypoint = this.createWaypointAt(mouseUpEvent.latlng, newWaypointIndex);

      const finalWaypoints = this.withUpdatedWaypointAt(
        this.waypoints,
        newWaypointIndex,
        finalWaypoint,
      );
      this._waypoints = finalWaypoints;

      this.projectWaypoints(finalWaypoints);

      newWaypointMarker.remove();

      this.dispatcher.fire('waypointDragEnd', {
        waypoint: finalWaypoints[newWaypointIndex],
      });
      this.dispatcher.fire('viewStateChanged', {
        state: { ...this.routing.state, waypoints: finalWaypoints },
        reason: 'interaction',
      });

      this.routing.setWaypoints(finalWaypoints);
      this.routing.recalculateRoute();
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
  // Editability
  // ---------------------------------------------------------------------

  public setEditable(isEditable: boolean): void {
    this.setCanAddWaypoints(isEditable);

    this.setCanSelectRoute(isEditable);

    this.setCanDragWaypoint(isEditable);
  }

  public setCanDragWaypoint(canDragWaypoints: boolean): void {
    this._canDragWaypoints = canDragWaypoints;

    this.addWaypointMarker?.remove();
    this.addWaypointMarkerAdded = false;

    this.waypointsMarkers.forEach((marker) => {
      if (canDragWaypoints) {
        marker.dragging?.enable();
      } else {
        marker.dragging?.disable();
      }
    });
  }

  public setCanSelectRoute(canSelectRoute: boolean): void {
    this._canSelectRoute = canSelectRoute;
  }

  public setCanAddWaypoints(canAddWaypoints: boolean): void {
    this._canAddWaypoints = canAddWaypoints;

    if (!canAddWaypoints) {
      this.addWaypointMarker?.remove();
      this.addWaypointMarkerAdded = false;
    }
  }

  public setMaxWaypoints(maxWaypoints: number): void {
    this._maxWaypoints = maxWaypoints;
  }

  public setHoverEnabled(hoverEnabled: boolean): void {
    this._hoverEnabled = hoverEnabled;
    if (!hoverEnabled) {
      this.map.getContainer().style.cursor = '';
      this.onRouteHoverOut();
    }
  }

  // ---------------------------------------------------------------------
  // Bounds
  // ---------------------------------------------------------------------

  public fitViewToData(
    options: {
      padding?: [number, number];
      maxZoom?: number;
    } = {},
  ): void {
    const state = this.routing.state;

    const bounds = this.computeBounds(state);

    if (!bounds) {
      return;
    }

    this.map.fitBounds(bounds, {
      padding: [40, 40],
      ...options,
    });
  }

  private computeBounds(state: AnyRouting['state']): LatLngBounds | undefined {
    if (state.data?.routesShapeBounds) {
      return new LatLngBounds([
        [state.data.routesShapeBounds[1], state.data.routesShapeBounds[0]],
        [state.data.routesShapeBounds[3], state.data.routesShapeBounds[2]],
      ]);
    }

    if (state.routesShapeGeojson) {
      const bounds = bbox(state.routesShapeGeojson) as [number, number, number, number];

      return new LatLngBounds([
        [bounds[1], bounds[0]],
        [bounds[3], bounds[2]],
      ]);
    }

    if (state.waypoints.length > 0) {
      const bounds = new LatLngBounds([]);

      state.waypoints.forEach((waypoint) => {
        bounds.extend([waypoint.position.lat, waypoint.position.lng]);
      });

      return bounds;
    }

    return undefined;
  }

  // ---------------------------------------------------------------------
  // Event bus
  // ---------------------------------------------------------------------

  public on<E extends keyof LeafletProjectorEventMap>(
    event: E,
    call: (event: LeafletProjectorEventMap[E]) => void,
  ): void {
    this.dispatcher.on(event, call);
  }

  public off<E extends keyof LeafletProjectorEventMap>(
    event: E,
    call: (event: LeafletProjectorEventMap[E]) => void,
  ): void {
    this.dispatcher.off(event, call);
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  private createWaypointAt(latlng: LatLng, index: number): InternalWaypoint {
    return InternalWaypointC.fromWaypoint(
      {
        position: {
          lat: latlng.lat,
          lng: latlng.lng,
        },
      },
      {
        isFirst: false,
        isLast: false,
        index,
      },
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
    position: LatLngPosition,
  ): InternalWaypoint[] {
    const next = [...waypoints];

    next[index] = {
      ...next[index],
      position: {
        lat: position.lat,
        lng: position.lng,
      },
      geocoded: false,
    };

    return next;
  }

  private async previewRoute(waypoints: InternalWaypoint[]): Promise<void> {
    const requestId = ++this.previewRequestId;
    if (!this.previewLoading) {
      this.previewLoading = true;
      this.dispatcher.fire('previewStarted', {});
    }

    let data: AnyRoutingDataResponse | undefined;

    try {
      const provider = this.options.previewDataProvider ?? this.routing.dataProvider;
      data = await provider.request(
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
        if (data) {
          this.lastPreviewData = { waypoints: [...waypoints], data };
        }
      }

    }
  }

  private setAndRecalculate(waypoints: InternalWaypoint[]): void {
    this.routing.setWaypoints(waypoints);
    void this.routing.recalculateRoute();
  }

  private showAddWaypointMarker(position: LatLng): void {
    if (!this.addWaypointMarker) return;

    this.addWaypointMarker.setLatLng(position);
    if (!this.addWaypointMarkerAdded) {
      this.addWaypointMarker.addTo(this.map);
      this.addWaypointMarkerAdded = true;
    }
  }

  private bringSelectedRouteToFront(): void {
    const selectedRouteId = this.routing.state.selectedRouteId;
    const getFeature = (layer: Layer): LeafletRouteFeature | undefined =>
      (layer as Layer & { feature?: LeafletRouteFeature }).feature;
    const outlineLayers: Path[] = [];
    const routeLayers: Path[] = [];

    this.routeOutlineLayer?.eachLayer((layer) => {
      if (layer instanceof Path) {
        outlineLayers.push(layer);
      }
    });
    this.routesLayer?.eachLayer((layer) => {
      if (layer instanceof Path) {
        routeLayers.push(layer);
      }
    });

    outlineLayers.forEach((layer) => layer.bringToFront());
    routeLayers.forEach((layer) => layer.bringToFront());

    if (selectedRouteId == null) return;

    outlineLayers
      .filter((layer) => getFeature(layer)?.properties?.routeId === selectedRouteId)
      .forEach((layer) => layer.bringToFront());
    routeLayers
      .filter((layer) => getFeature(layer)?.properties?.routeId === selectedRouteId)
      .forEach((layer) => layer.bringToFront());
  }

  private destroyRoutes(): void {
    this.routeOutlineLayer?.removeFrom(this.map);
    this.routeOutlineLayer = undefined;

    if (!this.routesLayer) {
      return;
    }

    this.routesLayer.removeFrom(this.map);

    this.routesLayer = undefined;
  }

  // ---------------------------------------------------------------------
  // Event cancellation
  // ---------------------------------------------------------------------

  private eventIsCancelled(event: LeafletMouseEvent): boolean {
    const original = event.originalEvent as MouseEvent & {
      handledFor?: string[];
    };

    return original.handledFor?.includes(event.type) ?? false;
  }

  private stopEventPropagation(event: LeafletMouseEvent): void {
    const original = event.originalEvent as MouseEvent & {
      handledFor?: string[];
    };

    original.handledFor = [...(original.handledFor ?? []), event.type];
  }
}
