import bbox from '@turf/bbox';
import { featureCollection, lineString } from '@turf/helpers';
import type { BBox, Feature, LineString } from 'geojson';
import { Requester, type Waypoint, type WaypointPosition } from '@any-routing/core';
import type {
  GoogleApiResponse,
  GoogleRawRoute,
  GoogleRouteSummary,
  GoogleRoutingData,
  Options,
} from './google-provider.types';

export type ExecutorRequestOptions = { url: string; requestWaypoints: Waypoint[] } & Options;
type ShapeProperties = { waypoint: number; routeId: number };

export class GoogleExecutor {
  private readonly requester = new Requester();

  async request(opts: ExecutorRequestOptions): Promise<GoogleRoutingData> {
    const response = (await this.requester.request(opts.url, {
      ...opts.requestParams,
      method: 'POST',
      headers: {
        ...opts.requestParams?.headers,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': opts.apiKey ?? '',
        'X-Goog-FieldMask': opts.fieldMask ?? '',
      },
      body: JSON.stringify(buildRequestBody(opts)),
    })) as GoogleApiResponse;

    if (!response.routes?.length) {
      throw new Error('Google Routes API returned no routes');
    }

    const routes = response.routes.map((route, routeId) =>
      summarizeRoute(route, routeId, opts.requestWaypoints),
    );
    const features = routes.flatMap((route) =>
      route.shape.features.map((feature) => ({
        id: route.id,
        ...feature,
        properties: { ...feature.properties, routeId: route.id },
      })),
    );
    const routesShapeGeojson = featureCollection(features);

    return {
      routesShapeBounds: bbox(routesShapeGeojson) as BBox,
      rawResponse: response,
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

function buildRequestBody(opts: ExecutorRequestOptions): Record<string, unknown> {
  const origin = opts.requestWaypoints[0];
  const destination = opts.requestWaypoints[opts.requestWaypoints.length - 1];
  if (!origin || !destination) {
    throw new Error('At least two waypoints are required');
  }

  return {
    origin: toWaypoint(origin.position),
    destination: toWaypoint(destination.position),
    intermediates: opts.requestWaypoints
      .slice(1, -1)
      .map(({ position }) => toWaypoint(position)),
    travelMode: opts.travelMode,
    routingPreference: opts.travelMode === 'DRIVE' ? opts.routingPreference : undefined,
    computeAlternativeRoutes: (opts.alternatives ?? 0) > 0,
    routeModifiers: opts.routeModifiers,
    languageCode: opts.languageCode,
    regionCode: opts.regionCode,
    units: opts.units,
    extraComputations: opts.extraComputations,
  };
}

function toWaypoint(position: WaypointPosition): {
  location: { latLng: { latitude: number; longitude: number } };
} {
  return {
    location: { latLng: { latitude: position.lat, longitude: position.lng } },
  };
}

function summarizeRoute(
  route: GoogleRawRoute,
  routeId: number,
  requestWaypoints: Waypoint[],
): GoogleRouteSummary {
  const now = new Date();
  const path = decodePolyline(route.polyline?.encodedPolyline ?? '');
  const shapeFeatures: Feature<LineString, ShapeProperties>[] = (route.legs ?? [])
    .map((leg, index) => {
      const coordinates = decodePolyline(leg.polyline?.encodedPolyline ?? '').map(([lat, lng]) => [
        lng,
        lat,
      ]);
      return coordinates.length > 1
        ? lineString(coordinates, { waypoint: index, routeId })
        : undefined;
    })
    .filter((feature): feature is Feature<LineString, ShapeProperties> => feature !== undefined);
  const duration = parseDuration(route.duration);

  return {
    id: routeId,
    label: route.description,
    durationTime: duration,
    distance: route.distanceMeters ?? 0,
    arriveTime: new Date(now.getTime() + duration * 1000),
    departureTime: now,
    path,
    waypoints: requestWaypoints.map(({ position }) => position),
    shape: featureCollection(shapeFeatures),
    rawRoute: route,
  };
}

function parseDuration(value?: string): number {
  const match = value?.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  return match ? Number(match[1]) : 0;
}

function decodePolyline(encoded: string): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const lat = decodeValue(encoded, index);
    index = lat.index;
    const lng = decodeValue(encoded, index);
    index = lng.index;
    latitude += lat.value;
    longitude += lng.value;
    result.push([latitude / 1e5, longitude / 1e5]);
  }
  return result;
}

function decodeValue(encoded: string, start: number): { value: number; index: number } {
  let result = 0;
  let shift = 0;
  let index = start;
  let byte = 0;
  do {
    if (index >= encoded.length) {
      throw new Error('Invalid Google encoded polyline');
    }
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  return { value: (result & 1) !== 0 ? ~(result >> 1) : result >> 1, index };
}
