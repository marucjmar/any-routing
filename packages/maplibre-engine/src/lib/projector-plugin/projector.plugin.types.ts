import { AnyRouting, AnyRoutingDataResponse, InternalWaypoint } from '@any-routing/core';
import { Feature, Geometry } from '@turf/helpers';
import { LayerSpecification, Map, Marker } from 'maplibre-gl';

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

export type LoadingChangedEvent = {
  loading: boolean;
};

export type WaypointAddedEvent = {
  waypoint: InternalWaypoint;
};

export interface MapLibreProjectorEventMap {
  waypointDrag: WaypointDragEvent;
  waypointDragCommit: WaypointDragEvent;
  waypointDragEnd: WaypointDragEndEvent;
  waypointAdded: WaypointAddedEvent;
  routesProjected: RoutesProjectedEvent;
  waypointsProjected: WaypointsProjectedEvent;
  routeClick: RouteClickEvent;
}

export type LayerFactoryContext = { routing: AnyRouting; sourceId: string };

export type LayerRef = { specification: LayerSpecification; addBefore?: string };
export type LayerFactory = (context: LayerFactoryContext) => LayerRef;

export type MarkerFactoryContext = {
  waypoint?: InternalWaypoint;
  routeHover?: Feature<Geometry, { routeId: number; waypoint: number }>;
};

export type MapLibreProjectorOptions = {
  map: Map;
  routesSourceId?: string;
  routeLayersFactory: LayerFactory[];
  editable?: boolean;
  maxWaypoints?: number;
  canAddWaypoints?: boolean;
  canDragWaypoints?: boolean;
  canSelectRoute?: boolean;
  routesWhileDragging?: boolean;
  waypointDragCommitDebounceTime?: number;
  sourceLineMetrics?: boolean;
  markerFactory: (ctx: MarkerFactoryContext) => Marker;
};
