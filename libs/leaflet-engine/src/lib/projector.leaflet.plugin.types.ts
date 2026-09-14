import type {
  AnyRouting,
  AnyRoutingDataProvider,
  AnyRoutingDataResponse,
  AnyRoutingProjectorEventMap,
  InternalWaypoint,
} from '@any-routing/core';
import type { Feature, Geometry } from 'geojson';
import type { LatLngExpression, Layer, LeafletMouseEvent, Map, Marker } from 'leaflet';

export type WaypointDragEvent = {
  waypoint: InternalWaypoint;
};

export type RouteClickEvent = {
  routeId: number;
};

export type RoutesProjectedEvent = {
  routesShapeGeojson: AnyRoutingDataResponse['routesShapeGeojson'];
};

export type WaypointsProjectedEvent = {
  waypoints: InternalWaypoint[];
};

export type WaypointDragEndEvent = {
  waypoint: InternalWaypoint;
};

export type WaypointAddedEvent = {
  waypoint: InternalWaypoint;
};

export interface LeafletProjectorEventMap {
  previewStarted: Record<string, never>;
  previewFinished: { data: AnyRoutingDataResponse };
  previewError: { error: Error };
  waypointDrag: WaypointDragEvent;
  waypointDragCommit: WaypointDragEvent;
  waypointDragEnd: WaypointDragEndEvent;
  waypointAdded: WaypointAddedEvent;
  routesProjected: RoutesProjectedEvent;
  waypointsProjected: WaypointsProjectedEvent;
  routeClick: RouteClickEvent;
  viewStateChanged: AnyRoutingProjectorEventMap['viewStateChanged'];
}

export type MarkerFactoryContext = {
  waypoint?: InternalWaypoint;
  routeHover?: Feature<Geometry, RouteFeatureProperties>;
};

export type LeafletMarkerFactory = (
  ctx: MarkerFactoryContext,
) => Marker;

export type LeafletProjectorOptions = {
  map: Map;

  editable?: boolean;

  maxWaypoints?: number;

  canAddWaypoints?: boolean;

  canDragWaypoints?: boolean;

  canSelectRoute?: boolean;

  hoverEnabled?: boolean;

  routesWhileDragging?: boolean;

  waypointDragCommitDebounceTime?: number;

  previewDataProvider?: AnyRoutingDataProvider;

  markerFactory: LeafletMarkerFactory;

  /**
   * Optional custom route style.
   */
  routeStyle?: LeafletRouteStyle;

  /**
   * Optional selected route style.
   */
  selectedRouteStyle?: LeafletRouteStyle;

  /**
   * Optional style for the route casing rendered underneath each route.
   */
  routeOutlineStyle?: LeafletRouteStyle;

  /**
   * Optional z-index for selected routes.
   */
  selectedRouteZIndex?: number;

  /**
   * Optional z-index for regular routes.
   */
  routeZIndex?: number;
};

export type LeafletRouteStyle = {
  color?: string;

  weight?: number;

  opacity?: number;

  dashArray?: string;

  lineCap?: 'butt' | 'round' | 'square';

  lineJoin?: 'miter' | 'round' | 'bevel';

  className?: string;
};

export type RouteFeatureProperties = {
  routeId: number;

  waypoint: number;

  selected?: boolean;

  offset?: number;
};

export type LeafletRouteFeature = Feature<
  Geometry,
  RouteFeatureProperties
>;