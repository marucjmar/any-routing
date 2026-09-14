import bboxClip from '@turf/bbox-clip';
import { expose } from 'comlink';

import type { AnyRoutingDataResponse } from '@any-routing/core';
import { calculatePos, getDistinctSegments } from './line-diff';
import type { Feature, FeatureCollection, LineString, MultiLineString } from 'geojson';
import type { LngLat } from 'maplibre-gl';

type RouteProperties = { routeId: number; waypoint: number };
type RouteFeature = Feature<LineString | MultiLineString, RouteProperties>;
type RecalculateInput = {
  bbox: { ne: Pick<LngLat, 'lng' | 'lat'>; sw: Pick<LngLat, 'lng' | 'lat'> };
};
type AnnotationPoint = ReturnType<typeof calculatePos>[number];

let chunks: RouteFeature[] = [];

const api = {
  createChunks(data: AnyRoutingDataResponse): void {
    const fc: FeatureCollection = data.routesShapeGeojson;

    chunks = getDistinctSegments(fc.features as RouteFeature[]);
  },

  recalculatePos({ bbox: { ne, sw } }: RecalculateInput): {
    points: AnnotationPoint[];
    allInBbox: boolean;
  } {
    const bboxChunks = chunks
      .reduce((acc, chunk) => {
        const clipped = bboxClip(chunk, [sw.lng, sw.lat, ne.lng, ne.lat]);
        if (clipped.geometry.coordinates.length >= 2) {
          acc.push(clipped);
        }
        return acc;
      }, [] as Feature[]);

    const points = calculatePos(bboxChunks as RouteFeature[]);
    const allInBbox = points.length === chunks.length;

    return { points, allInBbox };
  },
};

export type AnnotationWorkerApi = typeof api;

expose(api);
