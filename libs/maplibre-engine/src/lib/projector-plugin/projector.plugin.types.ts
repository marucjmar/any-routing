import type {
  AnyRouting,
  AnyRoutingDataProvider,
  AnyRoutingDataResponse,
  AnyRoutingProjectorEventMap,
  InternalWaypoint,
} from '@any-routing/core';
import type { Feature, Geometry } from 'geojson';
import type { LayerSpecification, Map, Marker } from 'maplibre-gl';

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

export type LayerFactoryContext = { routing: AnyRouting; sourceId: string };

export type LayerRef = { specification: LayerSpecification; addBefore?: string };
export type LayerFactory = (context: LayerFactoryContext) => LayerRef;

export type MarkerFactoryContext = {
  waypoint?: InternalWaypoint;
  routeHover?: Feature<Geometry, RouteFeatureProperties>;
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
  hoverEnabled?: boolean;
  routesWhileDragging?: boolean;
  waypointDragCommitDebounceTime?: number;
  sourceLineMetrics?: boolean;
  sourceTolerance?: number;
  previewDataProvider?: AnyRoutingDataProvider;
  markerFactory: (ctx: MarkerFactoryContext) => Marker;
};

export type RouteFeatureProperties = {
  routeId: number;
  waypoint: number;
  selected?: boolean;
};
