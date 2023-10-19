import { decode } from '@liberty-rider/flexpolyline';
import * as simplify from 'simplify-js';
import bbox from '@turf/bbox';
import { featureCollection, lineString, LineString, Feature, BBox } from '@turf/helpers';

import { HereRouteSummary, HereRoutingData, Options, RouteExcludeNoticeDefinitions, TurnByTurnAction } from '..';
import { Mode, Requester, UnauthorizedError } from '@any-routing/core';
import { selectRouteByStrategy } from './utils/select-route-strategy';

export type ExecutorRequestOptions = { url: string; mode: Mode } & Options;

export class HereExecutor {
  private readonly requester = new Requester();

  async request(opts: ExecutorRequestOptions): Promise<HereRoutingData> {
    try {
      const data = await this.requester.request(opts.url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        ...opts.requestParams,
      });

      if (
        !data.routes ||
        data.routes.length === 0 ||
        (opts.routeExcludeNotice && violatedResponseNotices(data, opts.routeExcludeNotice))
      ) {
        throw new Error('No routes found');
      }

      const routesSummary: HereRouteSummary[] = data.routes.map((route, index) =>
        summaryRoutes(route, index, opts.shapePolylinePrecision)
      );

      const selectedRouteId = selectRouteByStrategy(routesSummary, opts.selectRouteStrategy);

      const features: Feature<LineString, any>[] = routesSummary.reduce((acc: Feature<LineString, any>[], c) => {
        return [
          ...acc,
          ...c.shape.features.map((f) => ({
            ...f,
            properties: {
              ...f.properties,
              selected: selectedRouteId === f.properties.routeId,
            },
          })),
        ];
      }, []);

      const FC: any = featureCollection(features);

      return {
        routesShapeBounds: bbox(FC) as BBox,
        rawResponse: data,
        routes: routesSummary,
        selectedRouteId,
        routesShapeGeojson: FC,
        version: performance.now(),
        latest: !this.requester.hasPendingRequests,
        mode: opts.mode,
        requestOptions: opts,
      };
    } catch (error: any) {
      if (error instanceof Response) {
        const response: Response = error;
        const body = await response.json();

        if (response.status === 401) {
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

const summaryRoutes = (route, routeId, precision): HereRouteSummary => {
  const { distance, cost, durationTime, waypoints, path, shape, shapePath, turnByTurnActions } = route.sections.reduce(
    (acc, section, index) => {
      const cost = (section.tolls || []).reduce(
        (costAcc, toll) => (toll.fares || []).forEach((fare) => (costAcc += (fare.convertedPrice || fare.price).value)),
        0
      );

      const durationTime = section.summary?.duration || 0;

      const waypoints = [];

      if (section.departure.place.originalLocation) {
        //@ts-ignore
        waypoints.push(section.departure.place.location);
      }

      // Push departure location
      if (
        section.arrival.place.originalLocation &&
        ((route.sections.length >= 2 && index === route.sections.length - 1) || route.sections.length === 1)
      ) {
        //@ts-ignore
        waypoints.push(section.arrival.place.location);
      }

      const path = decodePolyline(section.polyline);
      const shapePath = simplifyPath(path, precision);

      const turnByTurnActions = (section.turnByTurnActions || []).map((action): TurnByTurnAction => {
        const [lat, lng] = path[action.offset];

        return {
          ...action,
          offset: acc.path.length + action.offset,
          position: { lat, lng },
        };
      });

      const shape: Feature<LineString> = lineString(shapePath, {
        waypoint: acc.waypointIndex,
        routeId,
      });

      return {
        distance: acc.distance + section.summary?.length || 0,
        durationTime: acc.durationTime + durationTime,
        cost: acc.cost + cost,
        waypoints: [...acc.waypoints, ...waypoints],
        path: [...acc.path, ...path],
        turnByTurnActions: [...acc.turnByTurnActions, ...turnByTurnActions],
        shape: featureCollection([...(acc.shape?.features || []), shape]),
        shapePath: [...acc.shapePath, ...shapePath],
        waypointIndex:
          section.type === 'vehicle' && route.sections[index + 1] && route.sections[index + 1].type === 'vehicle'
            ? acc.waypointIndex + 1
            : acc.waypointIndex,
      };
    },
    {
      distance: 0,
      cost: 0,
      waypoints: [],
      path: [],
      durationTime: 0,
      turnByTurnActions: [],
      shape: null,
      shapePath: [],
      waypointIndex: 0,
    }
  );

  return {
    durationTime,
    distance,
    cost,
    path,
    arriveTime: new Date(route.sections[route.sections.length - 1].arrival.time),
    departureTime: new Date(route.sections[0].departure.time),
    id: routeId,
    waypoints,
    label: route.routeLabels ? route.routeLabels.map((l) => l.name.value).join(', ') : undefined,
    shape,
    turnByTurnActions,
    shapePath,
    rawRoute: route,
  };
};

const violatedResponseNotices = (data, routeExcludeNotice: RouteExcludeNoticeDefinitions): boolean => {
  if (violatedNotices(data.notices || [], routeExcludeNotice)) {
    return true;
  }

  return (data.routes || []).some((route) =>
    (route.sections || []).some((section) => violatedNotices(section.notices || [], routeExcludeNotice))
  );
};

const violatedNotices = (
  notices: { code: string; severity: 'critical' | 'info' }[],
  routeExcludeNotice: RouteExcludeNoticeDefinitions
): boolean => {
  return notices.some((notice) => {
    const definition = routeExcludeNotice[notice.severity];

    return definition && (definition === 'all' || definition.includes(notice.code));
  });
};

export function posIsDiff(posA, posB): boolean {
  const { lat: latA, lng: lngA } = posA;
  const { lat: latB, lng: lngB } = posB;

  return latA.toFixed(6) !== latB.toFixed(6) || lngA.toFixed(6) !== lngB.toFixed(6);
}

function decodePolyline(polyline: string): [number, number][] {
  return decode(polyline).polyline;
}

function simplifyPath(path: [number, number][], precision: number): [number, number][] {
  return simplify(
    path.map(([x, y]) => ({ x, y })),
    precision,
    true
  ).map((p) => [+p.y.toFixed(6), +p.x.toFixed(6)]);
}
