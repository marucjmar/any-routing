import bboxClip from '@turf/bbox-clip';
import { FeatureCollection } from '@turf/helpers';
import { expose } from 'comlink';

import type { AnyRoutingDataResponse } from '@any-routing/core';
import { calculatePos, getDistinctSegments } from './line-diff';

let chunks = [];

const api = {
  createChunks(data: AnyRoutingDataResponse) {
    const fc: FeatureCollection = data.routesShapeGeojson;

    // @ts-ignore
    chunks = getDistinctSegments(fc.features);
  },

  recalculatePos({ bbox: { ne, sw } }) {
    const bboxChunks = chunks
      .map((chunk) => {
        return bboxClip(chunk, [sw.lng, sw.lat, ne.lng, ne.lat]);
      })
      .filter(({ geometry: { coordinates } }) => coordinates.length > 0);

    const points = calculatePos(bboxChunks);
    const allInBbox = points.length === chunks.length;

    return { points, allInBbox };
  },
};

export type AnnotationWorkerApi = typeof api;

expose(api);
