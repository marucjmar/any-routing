import bbox from '@turf/bbox';
import { featureCollection, lineString } from '@turf/helpers';
import type { BBox, Feature, LineString } from 'geojson';

import { Requester, type WaypointPosition } from '@any-routing/core';

import type {
  Options,
  OsrmApiResponse,
  OsrmRawLeg,
  OsrmRawRoute,
  OsrmRouteSummary,
  OsrmRoutingData,
} from './osrm-provider.types';

export type ExecutorRequestOptions = { url: string } & Options;

/** Properties attached to each rendered segment of a route's shape. */
type ShapeFeatureProperties = {
  waypoint: number;
  routeId: number;
};

export class OsrmExecutor {
  private readonly requester = new Requester();

  async request(opts: ExecutorRequestOptions): Promise<OsrmRoutingData> {
    const data = (await this.requester.request(opts.url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      ...opts.requestParams,
    })) as OsrmApiResponse;

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(data.message || `OSRM request failed with code "${data.code}"`);
    }

    const routeSummaries = data.routes.map((route, routeId) =>
      summarizeRoute(route, routeId),
    );

    const features = routeSummaries.flatMap((routeSummary, fid) =>
      routeSummary.shape.features.map((feature) => ({
          id: fid,
          ...feature,
          properties: {
            ...feature.properties,
            id: fid,
            routeId: routeSummary.id,
          },
      })),
    );

    const routesShapeGeojson = featureCollection(features);

    return {
      routesShapeBounds: bbox(routesShapeGeojson) as BBox,
      rawResponse: data,
      routes: routeSummaries,
      selectedRouteId: routeSummaries.length ? 0 : null,
      routesShapeGeojson,
      version: performance.now(),
      latest: !this.requester.hasPendingRequests,
      requestOptions: opts,
    };
  }

  hasPendingRequests() {
    return this.requester.hasPendingRequests;
  }

  abortAllRequests() {
    this.requester.abortAllRequests();
  }
}

/**
 * Waypoints introduced by a leg: OSRM legs don't carry per-leg
 * departure/arrival coordinates directly, so waypoints are instead derived
 * from the route's own `geometry` boundaries via the accumulated leg
 * distances — simpler and sufficient here: every leg boundary is a waypoint,
 * taken from the first/last coordinate of the leg's own geometry (built up
 * from its steps).
 */
function extractLegWaypoints(leg: OsrmRawLeg): WaypointPosition[] {
  const firstStep = leg.steps[0];
  const lastStep = leg.steps[leg.steps.length - 1];

  if (!firstStep || !lastStep) {
    return [];
  }

  const [lng, lat] = firstStep.maneuver.location;

  return [{ lat, lng }];
}

function buildLegShape(
  leg: OsrmRawLeg,
  routeId: number,
  waypointIndex: number,
): Feature<LineString, ShapeFeatureProperties>[] {
  const legPath = leg.steps.flatMap((step) => step.geometry.coordinates);

  if (!legPath.length) {
    return [];
  }

  return [
    lineString(legPath, { waypoint: waypointIndex, routeId }) as Feature<
      LineString,
      ShapeFeatureProperties
    >,
  ];
}

const summarizeRoute = (route: OsrmRawRoute, routeId: number): OsrmRouteSummary => {
  const now = new Date();

  let waypoints: WaypointPosition[] = [];
  let shapeFeatures: Feature<LineString, ShapeFeatureProperties>[] = [];
  let waypointIndex = 0;

  route.legs.forEach((leg, index) => {
    waypoints = [...waypoints, ...extractLegWaypoints(leg)];
    shapeFeatures = [...shapeFeatures, ...buildLegShape(leg, routeId, waypointIndex)];

    const isLastLeg = index === route.legs.length - 1;
    if (isLastLeg) {
      const lastStep = leg.steps[leg.steps.length - 1];
      if (lastStep) {
        const [lng, lat] = lastStep.maneuver.location;
        waypoints = [...waypoints, { lat, lng }];
      }
    }

    waypointIndex += 1;
  });

  const path = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

  return {
    id: routeId,
    durationTime: route.duration,
    distance: route.distance,
    path,
    arriveTime: new Date(now.getTime() + route.duration * 1000),
    departureTime: now,
    waypoints,
    shape: featureCollection(shapeFeatures),
    rawRoute: route,
  };
};
