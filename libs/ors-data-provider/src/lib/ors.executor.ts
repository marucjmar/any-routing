import bbox from '@turf/bbox';
import { featureCollection, lineString } from '@turf/helpers';
import type { BBox, LineString } from 'geojson';

import { Requester } from '@any-routing/core';
import type {
  Options,
  OrsApiErrorResponse,
  OrsApiResponse,
  OrsRawFeature,
  OrsRouteSummary,
  OrsRoutingData,
} from './ors-provider.types';

export type ExecutorRequestOptions = {
  url: string;
  requestCoordinates: [number, number][];
} & Options;

type ShapeProperties = { waypoint: number; routeId: number };

export class OrsExecutor {
  private readonly requester = new Requester();

  async request(opts: ExecutorRequestOptions): Promise<OrsRoutingData> {
    const body = {
      coordinates: opts.requestCoordinates,
      preference: opts.preference,
      units: opts.units,
      language: opts.language,
      instructions: opts.instructions,
      instructions_format: opts.instructionsFormat,
      maneuvers: opts.maneuvers,
      geometry: opts.geometry,
      extra_info: opts.extraInfo,
      attributes: opts.attributes,
      continue_straight: opts.continueStraight,
      elevation: opts.elevation,
      options: opts.options,
      alternative_routes:
        opts.alternatives
          ? { target_count: opts.alternatives }
          : undefined,
    };
    const response = (await this.requester.request(opts.url, {
      ...opts.requestParams,
      method: 'POST',
      headers: {
        ...opts.requestParams?.headers,
        Accept: 'application/geo+json, application/json',
        'Content-Type': 'application/json',
        Authorization: opts.apiKey,
      },
      body: JSON.stringify(body),
    })) as OrsApiResponse & OrsApiErrorResponse;

    if (response.type !== 'FeatureCollection' || !response.features?.length) {
      const error = response.error;
      const message = error?.message ?? response.message;
      const code = error?.code ?? response.code;
      throw new Error(
        message
          ? `openrouteservice request failed${code ? ` (${code})` : ''}: ${message}`
          : 'openrouteservice returned no routes',
      );
    }

    const routes = response.features.map((route, id) => summarizeRoute(route, id));

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
      rawResponse: response,
      routes,
      selectedRouteId: 0,
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

function summarizeRoute(route: OrsRawFeature, routeId: number): OrsRouteSummary {
  const now = new Date();
  const summary = route.properties.summary ?? {};
  const path = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const segments = route.properties.segments ?? [];
  const shapeFeatures = segments.flatMap((segment, waypoint) => {
    const [start, end] = segment.way_points ?? [0, route.geometry.coordinates.length - 1];
    const coordinates = route.geometry.coordinates.slice(start, end + 1);
    return coordinates.length > 1 ? [lineString(coordinates, { waypoint, routeId })] : [];
  });
  const shape = featureCollection<LineString, ShapeProperties>(
    shapeFeatures.length
      ? shapeFeatures
      : [lineString(route.geometry.coordinates, { waypoint: 0, routeId })],
  );
  const waypointIndexes = segments.length
    ? segments.flatMap((segment, index) => {
        const [start, end] = segment.way_points ?? [0, route.geometry.coordinates.length - 1];
        return index === segments.length - 1 ? [start, end] : [start];
      })
    : [0, route.geometry.coordinates.length - 1];

  return {
    id: routeId,
    durationTime: summary.duration ?? 0,
    distance: summary.distance ?? 0,
    arriveTime: new Date(now.getTime() + (summary.duration ?? 0) * 1000),
    departureTime: now,
    path,
    waypoints: waypointIndexes
      .map((index) => route.geometry.coordinates[index])
      .filter((point): point is [number, number] => Boolean(point))
      .map(([lng, lat]) => ({ lat, lng })),
    shape,
    rawRoute: route,
  };
}
