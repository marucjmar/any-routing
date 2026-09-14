# valhalla-data-provider

`AnyRoutingDataProvider` implementation backed by the [Valhalla route API](https://valhalla.github.io/valhalla/api/route/api-reference/).

```ts
import { ValhallaProvider } from '@any-routing/valhalla-data-provider';

const dataProvider = new ValhallaProvider({
  baseUrl: 'https://valhalla1.openstreetmap.de/route',
  costing: 'auto',
});
```

The provider sends Valhalla's JSON route request with `POST`, decodes Valhalla's
polyline6 geometry, and supports alternative routes through `alternates`.
Requests run in a Web Worker by default; use `worker: false` when a worker is
not available.
