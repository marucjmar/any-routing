# mapbox-data-provider

`AnyRoutingDataProvider` implementation backed by the
[Mapbox Directions API](https://docs.mapbox.com/api/navigation/directions/).

```ts
import { MapboxProvider } from '@any-routing/mapbox-data-provider';

const dataProvider = new MapboxProvider({
  accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
  profile: 'driving',
  alternatives: true,
});
```

The provider requests GeoJSON geometry and turn-by-turn steps by default.
Requests run in a Web Worker by default; use `worker: false` when a worker is
not available.
