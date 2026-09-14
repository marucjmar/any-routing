import type { RouteSummary } from '@any-routing/core';
import { SelectRouteStrategy } from '../here-provider.types';

type RouteWithCost = RouteSummary & {
  cost: number;
};

const hasCost = (route: RouteSummary): route is RouteWithCost =>
  route.cost != null;

export function selectRouteByStrategy(routeSummaries: RouteSummary[], strategy?: SelectRouteStrategy) {
  if (routeSummaries.length === 0) {
    return null;
  }

  if (strategy === 'fastest') {
    const fastest = routeSummaries.reduce(function (prev, current) {
      return prev?.arriveTime.valueOf() < current?.arriveTime.valueOf() ? prev : current;
    });

    return fastest?.id;
  } else if (strategy === 'shortest') {
    const shortest = routeSummaries.reduce(function (prev, current) {
      return prev?.distance < current?.distance ? prev : current;
    });

    return shortest?.id;
  } else if (strategy === 'cheapest') {
    const routesWithCost = routeSummaries.filter(hasCost);
    const cheapest = routesWithCost.reduce(function (prev, current) {
        return prev?.cost < current?.cost ? prev : current;
    }, routesWithCost[0]);

    return cheapest?.id;
  } else if (strategy === 'none') {
    return null;
  }

  return 0;
}
