import { coordAll } from '@turf/meta';
import { lineString } from '@turf/helpers';
import { getCoord } from '@turf/invariant';
import along from '@turf/along';
import lineLength from '@turf/length';
import bearing from '@turf/bearing';
import type { Feature, LineString, MultiLineString, Position } from 'geojson';

const TOLERANCE = 0.00001;
type RouteProperties = { routeId: number; waypoint: number };
type RouteFeature = Feature<LineString | MultiLineString, RouteProperties>;
type LngLatPosition = [number, number];
type ProjectedPosition = {
  lngLat: LngLatPosition;
  localLineBearing: number;
  properties: RouteProperties;
};
type AnchorPosition = { lngLat: Position; anchor: string; properties: RouteProperties };
const floatEquals = (f1: number, f2: number) => Math.abs(f1 - f2) < TOLERANCE;
const coordEquals = (c1: Position = [], c2: Position = []) =>
  floatEquals(c1[0] ?? 0, c2[0] ?? 0) && floatEquals(c1[1] ?? 0, c2[1] ?? 0);
const asKey = (coord: Position) => `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`;
const last = <T>(array: T[] = []) => array[array.length - 1];

// find the point at the given distance ratio on the linestring
const project =
  (ratio: number) =>
  (ls: RouteFeature): ProjectedPosition => {
    let line: Feature<LineString, RouteProperties>;

    if (ls.geometry.type === 'LineString') {
      line = ls as Feature<LineString, RouteProperties>;
    } else {
      line = lineString(ls.geometry.coordinates[0], ls.properties);
      let longestLength = lineLength(line);

      for (let index = 1; index < ls.geometry.coordinates.length; index += 1) {
        const candidate = lineString(ls.geometry.coordinates[index], ls.properties);
        const candidateLength = lineLength(candidate);

        if (candidateLength > longestLength) {
          line = candidate as Feature<LineString, RouteProperties>;
          longestLength = candidateLength;
        }
      }
    }

    const length = lineLength(line);
    const lngLat = getCoord(along(line, length * ratio));
    // keep the local bearing of the line to later choose an anchor minimizing the portion of line covered.
    const localLineBearing = bearing(
      along(line, length * (ratio - 0.1)),
      along(line, length * (ratio + 0.1)),
    );

    return { lngLat: lngLat as LngLatPosition, localLineBearing, properties: ls.properties };
  };

function distinctSegment(
  coordinates: Position[],
  coordCounts: Map<string, number>,
  properties: RouteProperties,
): Feature<LineString, RouteProperties> | undefined {
  const adjacentCoordsUsedOnce: Position[][] = [[]];
  coordinates.forEach((coord) => {
    if ((coordCounts.get(asKey(coord)) ?? 0) > 1) {
      adjacentCoordsUsedOnce.push([]);
    } else {
      adjacentCoordsUsedOnce[adjacentCoordsUsedOnce.length - 1].push(coord);
    }
  });
  const longestDistinctSegment = adjacentCoordsUsedOnce
    .filter((a) => a.length > 0)
    .reduce((longest, current) => (current.length > longest.length ? current : longest), []);

  const resultCoordinates =
    longestDistinctSegment.length >= 2 ? longestDistinctSegment : coordinates;

  return resultCoordinates.length >= 2 ? lineString(resultCoordinates, properties) : undefined;
}

// extract the longest segment of each linestring
// whose coordinates don't overlap with another feature
export function findDistinctSegments(linestrings: RouteFeature[]): RouteFeature[] {
  const validLinestrings = linestrings.filter((feature) => coordAll(feature).length >= 2);

  if (validLinestrings.length < 2) {
    return validLinestrings;
  }
  // extract raw coordinates
  const featuresCoords = validLinestrings.map(coordAll);
  // count occurences of each coordinate accross all features
  const coordCounts = new Map<string, number>();
  featuresCoords.flat().forEach((coord) => {
    coordCounts.set(asKey(coord), (coordCounts.get(asKey(coord)) || 0) + 1);
  });
  return featuresCoords.flatMap((coordinates, index) => {
    const segment = distinctSegment(coordinates, coordCounts, validLinestrings[index].properties);
    return segment ? [segment] : [];
  });
}

function toSimpleLinestring(feature: RouteFeature): RouteFeature | undefined {
  const allCoordsWithNoDups = coordAll(feature).reduce<Position[]>((noDups, coord) => {
    const prevCoord = last(noDups);
    if (!prevCoord || !coordEquals(prevCoord, coord)) {
      noDups.push(coord);
    }
    return noDups;
  }, []);
  return allCoordsWithNoDups.length >= 2
    ? lineString(allCoordsWithNoDups, feature.properties)
    : undefined;
}

// Reduce possibilities of collision by chosing anchors so that labels repulse each other
function optimizeAnchors(positions: ProjectedPosition[]) {
  return positions.map((position, index) => {
    const othersBearing = getBearingFromOtherPoints(position, positions, index);
    return {
      lngLat: position.lngLat,
      anchor: getAnchor(position, othersBearing),
      properties: position.properties,
    };
  });
}

function getBearingFromOtherPoints(
  position: ProjectedPosition,
  positions: ProjectedPosition[],
  excludedIndex: number,
): number {
  if (positions.length < 2) {
    return 0;
  }

  let totalBearing = 0;
  for (let index = 0; index < positions.length; index += 1) {
    if (index !== excludedIndex) {
      totalBearing += bearing(positions[index].lngLat, position.lngLat);
    }
  }

  return totalBearing / (positions.length - 1);
}

function getAnchor(position: ProjectedPosition, otherBearing: number) {
  const axis =
    Math.abs(position.localLineBearing) < 45 || Math.abs(position.localLineBearing) > 135
      ? 'vertical'
      : 'horizontal';

  if (axis === 'vertical') {
    return otherBearing > 0 ? 'left' : 'right';
  }
  return Math.abs(otherBearing) < 90 ? 'bottom' : 'top';
}

// routes can be a FeatureCollection or an array of Feature or Geometry

export function getDistinctSegments(routes: RouteFeature[] = []): RouteFeature[] {
  const featuresOrGeoms = routes;
  const mergedRoutes = mergeRoutes(featuresOrGeoms);
  const lineStrings = mergedRoutes.flatMap((feature) => {
    const lineStringFeature = toSimpleLinestring(feature);
    return lineStringFeature ? [lineStringFeature] : [];
  });
  return findDistinctSegments(lineStrings);
}

export function calculatePos(segments: RouteFeature[]): AnchorPosition[] {
  const positions = segments.map(project(0.5));
  return optimizeAnchors(positions);
}

function mergeRoutes(featureCollections: RouteFeature[]): RouteFeature[] {
  return featureCollections.reduce<RouteFeature[]>((acc, feature) => {
    if (acc[feature.properties.routeId]) {
      acc[feature.properties.routeId].geometry.coordinates = [
        ...acc[feature.properties.routeId].geometry.coordinates,
        ...feature.geometry.coordinates,
      ] as LineString['coordinates'];
    } else {
      acc[feature.properties.routeId] = feature;
    }

    return acc;
  }, []);
}
