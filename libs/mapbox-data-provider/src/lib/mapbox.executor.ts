import bbox from '@turf/bbox';
import { featureCollection, lineString } from '@turf/helpers';
import type { BBox, Feature, LineString } from 'geojson';
import { Requester } from '@any-routing/core';
import type {
  MapboxApiResponse,
  MapboxRawLeg,
  MapboxRawRoute,
  MapboxRouteSummary,
  MapboxRoutingData,
  Options,
} from './mapbox-provider.types';

export type ExecutorRequestOptions = { url: string } & Options;

type ShapeProperties = { waypoint: number; routeId: number };

export class MapboxExecutor {
  private readonly requester = new Requester();

  async request(opts: ExecutorRequestOptions): Promise<MapboxRoutingData> {
    const data = (await this.requester.request(opts.url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      ...opts.requestParams,
    })) as MapboxApiResponse;

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(data.message || `Mapbox request failed with code "${data.code}"`);
    }

    const routes = data.routes.map((route, routeId) => summarizeRoute(route, routeId));
    const features = routes.flatMap((route, fid) =>
      route.shape.features.map((feature) => ({
        id: fid,
        ...feature,
        properties: { ...feature.properties, id: fid, routeId: route.id },
      })),
    );
    const routesShapeGeojson = featureCollection(features);
    return {
      routesShapeBounds: bbox(routesShapeGeojson) as BBox,
      rawResponse: data,
      routes,
      selectedRouteId: routes.length ? 0 : null,
      routesShapeGeojson,
      version: performance.now(),
      latest: !this.requester.hasPendingRequests,
      requestOptions: opts,
    };
  }

  hasPendingRequests(): boolean {
    return this.requester.hasPendingRequests;
  }

  abortAllRequests(): void {
    this.requester.abortAllRequests();
  }
}

function summarizeRoute(route: MapboxRawRoute, routeId: number): MapboxRouteSummary {
  const now = new Date();
  const shapeFeatures = route.legs.flatMap((leg, waypoint) =>
    buildLegShape(leg, route, routeId, waypoint),
  );
  const path = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
  const waypoints = route.legs.flatMap((leg, index) => {
    const firstStep = leg.steps?.[0];
    const location = firstStep?.maneuver?.location;
    if (location) {
      const [lng, lat] = location;
      return [{ lat, lng }, ...(index === route.legs.length - 1 ? getLastWaypoint(leg) : [])];
    }
    return index === 0 ? [{ lat: path[0]?.[0] ?? 0, lng: path[0]?.[1] ?? 0 }] : [];
  });

  return {
    id: routeId,
    durationTime: route.duration,
    distance: route.distance,
    arriveTime: new Date(now.getTime() + route.duration * 1000),
    departureTime: now,
    path,
    waypoints,
    shape: featureCollection(
      shapeFeatures.length
        ? shapeFeatures
        : [lineString(route.geometry.coordinates, { waypoint: 0, routeId })],
    ),
    rawRoute: route,
  };
}

function buildLegShape(
  leg: MapboxRawLeg,
  route: MapboxRawRoute,
  routeId: number,
  waypoint: number,
): Feature<LineString, ShapeProperties>[] {
  const coordinates = leg.steps?.flatMap((step) => step.geometry?.coordinates ?? []) ?? [];
  const deduplicated = coordinates.filter(
    (coordinate, index) =>
      index === 0 ||
      coordinate[0] !== coordinates[index - 1]?.[0] ||
      coordinate[1] !== coordinates[index - 1]?.[1],
  );
  const legCoordinates = deduplicated.length > 1 ? deduplicated : route.geometry.coordinates;
  return legCoordinates.length > 1 ? [lineString(legCoordinates, { waypoint, routeId })] : [];
}

function getLastWaypoint(leg: MapboxRawLeg): { lat: number; lng: number }[] {
  const step = leg.steps?.[leg.steps.length - 1];
  const location = step?.maneuver?.location;
  return location ? [{ lat: location[1], lng: location[0] }] : [];
}
