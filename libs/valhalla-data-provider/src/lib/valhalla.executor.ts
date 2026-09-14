import bbox from '@turf/bbox';
import { featureCollection, lineString } from '@turf/helpers';
import type { BBox, Feature, LineString } from 'geojson';
import { Requester, UnauthorizedError } from '@any-routing/core';
import {
  ValhallaAPIError,
  type Options,
  type ValhallaApiResponse,
  type ValhallaRawLeg,
  type ValhallaRawTrip,
  type ValhallaRouteSummary,
  type ValhallaRoutingData,
} from './valhalla-provider.types';

export type ExecutorRequestOptions = {
  url: string;
  requestLocations: Array<{ lat: number; lon: number; type: string }>;
} & Options;

type ShapeProperties = { waypoint: number; routeId: number };

export class ValhallaExecutor {
  private readonly requester = new Requester();

  async request(opts: ExecutorRequestOptions): Promise<ValhallaRoutingData> {
    const body = {
      locations: opts.requestLocations,
      costing: opts.costing,
      costing_options: opts.costingOptions,
      units: opts.units,
      language: opts.language,
      alternates: opts.alternatives ?? 0,
      shape_format: opts.shapeFormat,
      directions_options: opts.directionsOptions,
    };

    try {
      const response = (await this.requester.request(opts.url, {
        ...opts.requestParams,
        method: 'POST',
        headers: {
          ...opts.requestParams?.headers,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })) as ValhallaApiResponse;

      if (!response.trip || (response.trip.status && response.trip.status !== 0)) {
        throw new Error(
          response.error ||
            response.status_message ||
            response.trip?.status_message ||
            'Valhalla returned no route',
        );
      }

      const trips = [response.trip, ...(response.alternates ?? []).map(({ trip }) => trip)];
      const routes = trips.map((trip, routeId) => summarizeRoute(trip, routeId, opts.shapeFormat));
      const features = routes.flatMap((route, fid) =>
        route.shape.features.map((feature) => ({
          id: fid,
          ...feature,
          properties: { ...feature.properties, routeId: route.id, id: fid },
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
    } catch (error: unknown) {
      if (error instanceof Response) {
        const body = await error.json();

        if (error.status === 401) {
          throw new UnauthorizedError(body);
        }

        throw new ValhallaAPIError(
          body.error || body.status_message || 'Valhalla returned an error',
          error.status,
          body
        );
      }

      throw error;
    }
  }

  hasPendingRequests(): boolean {
    return this.requester.hasPendingRequests;
  }

  abortAllRequests(): void {
    this.requester.abortAllRequests();
  }
}

function summarizeRoute(
  trip: ValhallaRawTrip,
  routeId: number,
  shapeFormat: Options['shapeFormat'],
): ValhallaRouteSummary {
  const now = new Date();
  const precision = shapeFormat === 'polyline5' ? 5 : 6;
  const legPaths = trip.legs.map((leg) => decodePolyline(leg.shape, precision));
  const path = legPaths.flatMap((legPath, index) => (index ? legPath.slice(1) : legPath));
  const shapeFeatures: Feature<LineString, ShapeProperties>[] = legPaths
    .filter((legPath) => legPath.length > 1)
    .map((legPath, waypoint) =>
      lineString(
        legPath.map(([lat, lon]) => [lon, lat]),
        { waypoint, routeId },
      ),
    );
  const summary = trip.summary ?? {};
  const duration =
    summary.time ?? trip.legs.reduce((total, leg) => total + (leg.summary?.time ?? 0), 0);
  const distance =
    summary.length ?? trip.legs.reduce((total, leg) => total + (leg.summary?.length ?? 0), 0);
  const locations = trip.locations.map(({ lat, lon }) => ({ lat, lng: lon }));

  return {
    id: routeId,
    durationTime: duration,
    distance,
    arriveTime: new Date(now.getTime() + duration * 1000),
    departureTime: now,
    path,
    waypoints: locations,
    shape: featureCollection(shapeFeatures),
    rawRoute: trip,
  };
}

function decodePolyline(encoded: string, precision: number): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  const factor = 10 ** precision;
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const latitudeResult = decodeValue(encoded, index);
    index = latitudeResult.index;
    latitude += latitudeResult.value;
    const longitudeResult = decodeValue(encoded, index);
    index = longitudeResult.index;
    longitude += longitudeResult.value;
    coordinates.push([latitude / factor, longitude / factor]);
  }

  return coordinates;
}

function decodeValue(encoded: string, start: number): { value: number; index: number } {
  let result = 0;
  let shift = 0;
  let index = start;
  let byte: number;

  do {
    if (index >= encoded.length) {
      throw new Error('Invalid Valhalla polyline geometry');
    }
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return { value: (result & 1) !== 0 ? ~(result >> 1) : result >> 1, index };
}
