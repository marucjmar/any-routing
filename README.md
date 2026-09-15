# AnyRouting

A full-featured, performance-focused, modular, and lightweight directions plugin that is independent of any map engine and can also run without a map.

## Demo

[Demo App](https://marucjmar.github.io/any-routing/)

## Installation

```js
npm i --save @any-routing/core @any-routing/maplibre-engine @any-routing/annotation-plugin
```

## Example

```js
import { Map } from 'maplibre-gl';
import { AnyRouting } from '@any-routing/core';
import { HereProvider, HereRoutingData } from '@any-routing/here-data-provider';
import { defaultMapLibreProjectorOptions, MapLibreProjector } from '@any-routing/maplibre-engine';
import { AnnotationPlugin } from '@any-routing/annotation-plugin';

const map = new Map({...});

const dataProvider = new HereProvider({ apiKey: '1234' });
const previewDataProvider = new HereProvider({
    apiKey: '1234',
    alternatives: 0, //only one route to drag preview
});

const projector = new MapLibreProjector({
    ...defaultMapLibreProjectorOptions,
    map,
    routesWhileDragging: true,
    previewDataProvider: previewDataProvider,
});

const routing = new AnyRouting<HereRoutingData>({
  dataProvider,
  projector,
  waypointsSyncStrategy: 'none',
  plugins: [new AnnotationPlugin({ map })],
});

routing.on('routesFound', console.log);
routing.on('routeSelected', console.log);

map.on('load', () => {
  routing.initialize();
  routing.setWaypoints([
    { position: { lng: -3.385644, lat: 40.484768 }, properties: { label: 'B' } },
    { position: { lng: 23.064007, lat: 52.749891 }, properties: { label: 'C' } },
  ]);

  routing.recalculateRoute().then(() => {
    projector.fitViewToData({ padding: 20 });
  });
});
```

`projector` is optional. When omitted, `AnyRouting` still calculates routes and
exposes the result through `state`, `data` and events.

## Supported data providers

- ✅ [Here API](https://www.here.com/)
- ✅ [MapBox API](https://docs.mapbox.com/help/glossary/directions-api/)
- ✅ [Google Routes API](https://developers.google.com/maps/documentation/routes/compute_route_directions)
- ✅ [ORS API](https://openrouteservice.org/)
- ✅ [OSRM API](https://github.com/Project-OSRM/osrm-backend)
- ✅ [Valhalla API](https://valhalla.github.io/valhalla/api/)

## Supported map engines

- ✅ [MapLibre GL JS](https://maplibre.org/maplibre-gl-js-docs/api/)
- ✅ [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/guides/)
- ✅ [Leaflet](https://leafletjs.com/)
- [ ] [OpenLayers](https://openlayers.org/)

:exclamation: Help grow the library by sharing your providers

## Architecture

![Architecture](./readme/images/arch.jpg)

## AnyRouting Class

### Config

| Property                | Default | Description               |
| ----------------------- | ------- | ------------------------- |
| `dataProvider` (required) | -      | Provider used to calculate routes |
| `projector`              | `undefined` | Optional map projector |
| `geocoder`               | `undefined` | Geocoder instance or `(waypoint) => Promise<waypoint>` |
| `plugins`                | `[]`   | Plugins or plugin constructors |
| `uniqueKey`              | random | Identifier used by integrations |
| `waypointsSyncStrategy` (required) | - | `none`, `toPath` or `geocodeFirst` |

### Instance Properties

| Property | Description |
| -------- | ----------- |
| `options` | Current `AnyRoutingOptions` |
| `state` | Current state: `waypoints`, `data`, `loading`, `selectedRouteId` and `routesShapeGeojson` |
| `data` | Current provider response, if available |
| `dataProvider` | Configured data provider |
| `projector` | Current projector, if configured |
| `selectedRouteId` | Currently selected route id |

### Instance Methods

| Method | Description |
| ------ | ----------- |
| `initialize()` | Initialize plugins and the projector. Safe to call more than once. |
| `onRemove()` | Remove plugins/projector and destroy the data provider. |
| `setProjector(projector?)` | Replace or remove the projector. |
| `addPlugin(plugin)` | Add a plugin instance or constructor. Returns the resolved plugin. |
| `removePlugin(plugin)` | Remove a plugin instance. |
| `setWaypoints(waypoints)` | Replace input waypoints. |
| `getWaypoint(index)` | Return an internal waypoint by index. |
| `setState(patch)` | Apply a partial state update. |
| `reset()` | Clear routing data and waypoints. |
| `async recalculateRoute()` | Calculate routes between the current waypoints. Returns provider data. |
| `applyCalculationResult(data)` | Apply an already calculated provider response. |
| `selectRoute(routeId)` | Select an alternative route. |
| `setWaypointsSyncStrategy(strategy)` | Change waypoint synchronization strategy. |
| `syncWaypointsPositions(waypoints)` | Synchronize internal waypoint positions with a route. |
| `getUniqueName(name)` | Add the instance unique key to a name. |
| `on(event, callback)` | Subscribe to an event. |
| `off(event, callback)` | Unsubscribe from an event. |

### Events

Every routing event includes the current `state`.

| Event | When it fires | Additional data |
| ----- | ------------- | --------------- |
| `calculationStarted` | A route calculation starts | `waypoints` |
| `calculationError` | A calculation fails | `error` |
| `routesFound` | Routes are successfully calculated | `waypoints`, `data` |
| `routeSelected` | An alternative route is selected | `routeId`, `route` |
| `waypointsChanged` | Waypoints change | `waypoints` |
| `waypointGeocoded` | A waypoint is geocoded | `waypoint` |
| `loadingChanged` | Loading state changes | `loading` |
| `stateUpdated` | Any state property changes | `updatedProperties` |

### Waypoints

```ts
type Waypoint = {
  position: { lat: number; lng: number };
  originalPosition?: { lat: number; lng: number };
  properties?: Record<string, string | boolean | number>;
  geocoded?: boolean;
};
```

`waypointsSyncStrategy` controls how provider results affect waypoints:

- `none` - keep the input waypoints unchanged.
- `toPath` - synchronize waypoint positions with the first returned route.
- `geocodeFirst` - geocode waypoints before calculating; requires `geocoder`.

### Data provider contract

Custom providers implement `AnyRoutingDataProvider`:

```ts
interface AnyRoutingDataProvider {
  request(waypoints: Waypoint[], opts: Record<string, unknown>): Promise<AnyRoutingDataResponse>;
  destroy(): void;
  hasPendingRequests(): Promise<boolean>;
  abortAllRequests(): void;
}
```

The response contains `routes`, `routesShapeGeojson`, `rawResponse`, `version`,
`latest` and optionally `selectedRouteId` and `routesShapeBounds`. Each route
summary contains `path`, `shape`, `distance`, `durationTime`, `waypoints`,
`departureTime` and `arriveTime`.

## Contribute

[Nx](https://nx.dev/using-nx/nx-cli) CLI Required

First install all depenencies by

```js
npm i
```

### Build library

```js
npm run libre-routing:build
```

### Run playground app

```js
npm run start
```
