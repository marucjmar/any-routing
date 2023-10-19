import type { RouteSummary } from '@any-routing/core';
import type { SelectRouteStrategy } from '../here-data-provider';

export function selectRouteByStrategy(summaryRoutes: RouteSummary[], strategy?: SelectRouteStrategy) {
  if (strategy === 'fastest') {
    const fastest = summaryRoutes.reduce(function (prev, current) {
      return prev?.arriveTime.valueOf() < current?.arriveTime.valueOf() ? prev : current;
    });

    return fastest?.id;
  } else if (strategy === 'shortest') {
    const shortest = summaryRoutes.reduce(function (prev, current) {
      return prev?.distance < current?.distance ? prev : current;
    });

    return shortest?.id;
  } else if (strategy === 'cheapest') {
    const cheapest = summaryRoutes
      .filter((s) => s.cost != null)
      .reduce(function (prev, current) {
        //@ts-ignore
        return prev?.cost < current?.cost ? prev : current;
      });

    return cheapest?.id;
  } else if (strategy === 'none') {
    return null;
  }

  return 0;
}
