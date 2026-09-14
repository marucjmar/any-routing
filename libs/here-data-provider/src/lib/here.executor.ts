import { decode } from '@here/flexpolyline';
import simplify from 'simplify-js';
import bbox from '@turf/bbox';
import { featureCollection, lineString } from '@turf/helpers';

import type {
  BaseOptions,
  GeoJsonSplitStrategy,
  HereApiResponse,
  HereRawDynamicSpeedInfo,
  HereRawRoute,
  HereRawSection,
  HereRawSpan,
  HereRawToll,
  HereRouteSummary,
  HereRoutingData,
  RouteExcludeNoticeDefinitions,
  TurnByTurnAction,
} from './here-provider.types';

import { selectRouteByStrategy } from './utils/select-route-strategy';
import { Requester, UnauthorizedError, type WaypointPosition } from '@any-routing/core';
import type { BBox, Feature, FeatureCollection, LineString } from 'geojson';

export type ExecutorRequestOptions = { url: string } & BaseOptions;

/** Properties attached to each rendered segment of a route's shape. */
type ShapeFeatureProperties = {
  waypoint: number;
  routeId: number;
  jamFactor?: number;
  isMarginalChunk?: boolean;
  selected?: boolean;
};

type SectionAccumulator = {
  distance: number;
  cost: number;
  waypoints: WaypointPosition[];
  path: number[][];
  durationTime: number;
  turnByTurnActions: TurnByTurnAction[];
  shape: FeatureCollection<LineString, ShapeFeatureProperties>;
  shapePath: number[][];
  waypointIndex: number;
};

export class HereExecutor {
  private readonly requester = new Requester();

  async request(opts: ExecutorRequestOptions): Promise<HereRoutingData> {
    try {
      const data = (await this.requester.request(opts.url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        ...opts.requestParams,
      })) as HereApiResponse;

      if (
        !data.routes?.length ||
        (opts.routeExcludeNotice && violatedResponseNotices(data, opts.routeExcludeNotice))
      ) {
        throw new Error('No routes found');
      }

      const routeSummaries = data.routes.map((route, routeId) =>
        summarizeRoute(route, routeId, opts),
      );

      const selectedRouteId = selectRouteByStrategy(routeSummaries, opts.selectRouteStrategy);

      const features = routeSummaries.flatMap((routeSummary, fid) =>
        routeSummary.shape.features.map((feature) => {
          return {
            id: fid,
            ...feature,
            properties: {
              ...feature.properties,
              id: fid,
              routeId: routeSummary.id,
            },
          };
        }),
      );

      const routesShapeGeojson = featureCollection(features);

      return {
        routesShapeBounds: bbox(routesShapeGeojson) as BBox,
        rawResponse: data,
        routes: routeSummaries,
        selectedRouteId,
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
      }

      throw error;
    }
  }

  hasPendingRequests() {
    return this.requester.hasPendingRequests;
  }

  abortAllRequests() {
    this.requester.abortAllRequests();
  }
}

/** Which split strategies apply for the current request mode, if any. */
function getSplitStrategies(options: ExecutorRequestOptions): GeoJsonSplitStrategy[] | undefined {
  return options.geoJSONShapeSplitStrategies;
}

function shouldSplitShape(options: ExecutorRequestOptions): boolean {
  const strategies = getSplitStrategies(options);
  return !!strategies && strategies.length > 0;
}

/**
 * Sum of all toll fares for a section.
 *
 * Bug fix (typing): `fare.convertedPrice || fare.price` can legitimately be
 * `undefined` if HERE returns a fare with neither field populated; reading
 * `.value` off that used to be an implicit `any` that would only blow up at
 * runtime. With real types this is now enforced at compile time via `?.` +
 * a `0` fallback instead of throwing on an unexpected payload.
 *
 * Bug fix (logic, unchanged from prior pass): the previous implementation
 * returned the result of `Array#forEach` (always `undefined`) from the
 * outer `reduce` callback instead of returning the running total, so `cost`
 * collapsed to `undefined`/`NaN` for any section that had tolls.
 */
function computeSectionCost(section: HereRawSection): number {
  return (section.tolls || []).reduce((costAcc: number, toll: HereRawToll) => {
    const tollCost = (toll.fares || []).reduce(
      (fareAcc: number, fare) => fareAcc + ((fare.convertedPrice ?? fare.price)?.value ?? 0),
      0,
    );

    return costAcc + tollCost;
  }, 0);
}

/**
 * Waypoints introduced by a section: the departure location (if it was an
 * explicit, geocoded location) and, only for the section that ends the
 * route, the arrival location.
 *
 * Simplified from the original condition
 * `(sections.length >= 2 && index === last) || sections.length === 1`,
 * which is logically identical to `index === last` (when there is only one
 * section, index 0 already equals `sections.length - 1`).
 */
function extractSectionWaypoints(
  section: HereRawSection,
  isLastSection: boolean,
): WaypointPosition[] {
  const waypoints: WaypointPosition[] = [];

  // HERE's response typings don't expose `location` on a place even though
  // the API always includes it for geocoded (`originalLocation`) points.
  // `location` is already `{ lat, lng }` (see `HereRawPlace`), matching
  // `WaypointPosition` exactly — no cast needed. The previous `as
  // LngLatPosition` was papering over a shape mismatch: `LngLatPosition` is
  // the tuple format `path`/`shapePath` use for GeoJSON coordinates, not
  // the `{ lat, lng }` object format `RouteSummary.waypoints` expects.
  if (section.departure.place.originalLocation) {
    waypoints.push(section.departure.place.location);
  }

  if (section.arrival.place.originalLocation && isLastSection) {
    waypoints.push(section.arrival.place.location);
  }

  return waypoints;
}

/**
 * Approximates HERE's `jamFactor` scale ([0, 10], 0 = free flow, 10 =
 * stationary traffic — see HERE Traffic API's `jamFactor` docs) from a
 * span's `dynamicSpeedInfo`.
 *
 * HERE doesn't publish the exact algorithm behind
 * `DynamicSpeedInfo.calculateJamFactor()` in the SDK, so this is
 * necessarily an approximation, not a reproduction of HERE's formula.
 *
 * Bug fix: the previous version returned `trafficSpeed / baseSpeed`
 * directly, which (a) sits on a [0, 1]-ish scale rather than HERE's
 * documented [0, 10] `jamFactor` range, so any downstream code branching
 * on "> 5 means bad traffic" style thresholds was silently wrong, and (b)
 * divides by zero (→ `Infinity`/`NaN`) whenever `baseSpeed` is `0`, which
 * happens on spans where HERE has no free-flow baseline.
 */
function estimateJamFactor(info: HereRawDynamicSpeedInfo): number | undefined {
  if (!info.baseSpeed || info.baseSpeed <= 0) {
    return undefined;
  }

  const speedRatio = Math.min(Math.max(info.trafficSpeed / info.baseSpeed, 0), 1);

  return +(10 * (1 - speedRatio)).toFixed(2);
}

/**
 * Builds the shape segments for a section, optionally split by the
 * configured strategies (currently only `jamFactor`), merging consecutive
 * spans that share the same jam factor into a single feature.
 */
function buildSectionShapes(
  section: HereRawSection,
  path: number[][],
  shapePath: number[][],
  routeId: number,
  waypointIndex: number,
  options: ExecutorRequestOptions,
): Feature<LineString, ShapeFeatureProperties>[] {
  if (!shouldSplitShape(options)) {
    return [
      lineString(shapePath, { waypoint: waypointIndex, routeId }) as Feature<
        LineString,
        ShapeFeatureProperties
      >,
    ];
  }

  const spans: HereRawSpan[] = section.spans ?? [];
  const splitByJamFactor = getSplitStrategies(options)?.includes('jamFactor');

  return spans.reduce(
    (
      shapesAcc: Feature<LineString, ShapeFeatureProperties>[],
      span: HereRawSpan,
      index: number,
    ) => {
      const closeOffset = index < spans.length - 1 ? spans[index + 1].offset : path.length - 1;
      const spanPath = path.slice(span.offset, closeOffset + 1);
      const spanShapePath = options.shapePolylinePrecision
        ? simplifyPath(spanPath, options.shapePolylinePrecision)
        : spanPath;
      const isMarginalChunk = index === 0 || index === spans.length - 1;
      const lastShape = shapesAcc[shapesAcc.length - 1];

      const jamFactor = span.dynamicSpeedInfo
        ? estimateJamFactor(span.dynamicSpeedInfo)
        : undefined;

      if (splitByJamFactor && jamFactor !== undefined) {
        const prevJamFactor = lastShape?.properties?.jamFactor;

        if (lastShape && jamFactor === prevJamFactor) {
          lastShape.geometry.coordinates.push(...spanShapePath.slice(1));
          lastShape.properties.isMarginalChunk = isMarginalChunk;
        } else {
          shapesAcc.push(
            lineString(spanShapePath, {
              waypoint: waypointIndex,
              routeId,
              jamFactor,
              isMarginalChunk,
            }) as Feature<LineString, ShapeFeatureProperties>,
          );
        }
      } else if (lastShape) {
        lastShape.geometry.coordinates.push(...spanShapePath.slice(1));
      } else {
        shapesAcc.push(
          lineString(spanShapePath, {
            waypoint: waypointIndex,
            routeId,
            isMarginalChunk,
          }) as Feature<LineString, ShapeFeatureProperties>,
        );
      }

      return shapesAcc;
    },
    [],
  );
}

function createInitialSectionAccumulator(): SectionAccumulator {
  return {
    distance: 0,
    cost: 0,
    waypoints: [],
    path: [],
    durationTime: 0,
    turnByTurnActions: [],
    shape: featureCollection([]),
    shapePath: [],
    waypointIndex: 0,
  };
}

const summarizeRoute = (
  route: HereRawRoute,
  routeId: number,
  options: ExecutorRequestOptions,
): HereRouteSummary => {
  const { distance, cost, durationTime, waypoints, path, shape, shapePath, turnByTurnActions } =
    route.sections.reduce(
      (acc: SectionAccumulator, section: HereRawSection, index: number): SectionAccumulator => {
        const sectionCost = computeSectionCost(section);
        const sectionDuration = section.summary?.duration ?? 0;
        const sectionDistance = section.summary?.length ?? 0;
        const isLastSection = index === route.sections.length - 1;
        const sectionWaypoints = extractSectionWaypoints(section, isLastSection);

        const sectionPath = decodePolyline(section.polyline);
        const sectionShapePath = options.shapePolylinePrecision
          ? simplifyPath(sectionPath, options.shapePolylinePrecision)
          : sectionPath;

        const sectionTurnByTurnActions = (section.turnByTurnActions || []).map(
          (action): TurnByTurnAction => {
            const [lat, lng] = sectionPath[action.offset];

            return {
              ...action,
              offset: acc.path.length + action.offset,
              position: { lat, lng },
            };
          },
        );

        const sectionShapes = buildSectionShapes(
          section,
          sectionPath,
          sectionShapePath,
          routeId,
          acc.waypointIndex,
          options,
        );

        const nextSection = route.sections[index + 1];
        const staysOnSameLeg = section.type === 'vehicle' && nextSection?.type === 'vehicle';

        return {
          // Bug fix: previously `acc.distance + section.summary?.length ?? 0`,
          // which (due to operator precedence) evaluated as
          // `(acc.distance + section.summary?.length) ?? 0` and reset the
          // whole accumulated distance to 0 whenever a section had no summary.
          distance: acc.distance + sectionDistance,
          durationTime: acc.durationTime + sectionDuration,
          cost: acc.cost + sectionCost,
          waypoints: [...acc.waypoints, ...sectionWaypoints],
          path: [...acc.path, ...sectionPath],
          turnByTurnActions: [...acc.turnByTurnActions, ...sectionTurnByTurnActions],
          shape: featureCollection([...(acc.shape?.features || []), ...sectionShapes]),
          shapePath: [...acc.shapePath, ...sectionShapePath],
          waypointIndex: staysOnSameLeg ? acc.waypointIndex + 1 : acc.waypointIndex,
        };
      },
      createInitialSectionAccumulator(),
    );

  return {
    durationTime,
    distance,
    cost,
    path,
    arriveTime: new Date(route.sections[route.sections.length - 1].arrival.time ?? 0),
    departureTime: new Date(route.sections[0].departure.time ?? 0),
    id: routeId,
    waypoints,
    label: route.routeLabels ? route.routeLabels.map((l) => l.name.value).join(', ') : undefined,
    shape,
    turnByTurnActions,
    shapePath,
    rawRoute: route,
  };
};

const violatedResponseNotices = (
  data: HereApiResponse,
  routeExcludeNotice: RouteExcludeNoticeDefinitions,
): boolean => {
  if (violatedNotices(data.notices || [], routeExcludeNotice)) {
    return true;
  }

  return (data.routes || []).some((route) =>
    (route.sections || []).some((section) =>
      violatedNotices(section.notices || [], routeExcludeNotice),
    ),
  );
};

const violatedNotices = (
  notices: { code: string; severity: 'critical' | 'info' }[],
  routeExcludeNotice: RouteExcludeNoticeDefinitions,
): boolean => {
  return notices.some((notice) => {
    const definition = routeExcludeNotice[notice.severity];

    return definition && (definition === 'all' || definition.includes(notice.code));
  });
};

function decodePolyline(polyline: string): number[][] {
  return decode(polyline).polyline;
}

function simplifyPath(path: number[][], precision: number): number[][] {
  return simplify(
    path.map(([x, y]) => ({ x, y })),
    precision,
    true,
  ).map((p) => [+p.y.toFixed(6), +p.x.toFixed(6)]);
}
