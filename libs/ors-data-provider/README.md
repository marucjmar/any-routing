# ors-data-provider

`@any-routing/ors-data-provider` uses the openrouteservice Directions API v2
GeoJSON endpoint.

```ts
import { OrsProvider } from '@any-routing/ors-data-provider';

const dataProvider = new OrsProvider({
  apiKey: 'YOUR_ORS_API_KEY',
  profile: 'driving-car',
  alternatives: 2,
});
```

Requests use `POST /openrouteservice/v2/directions/{profile}/geojson` on the
documented `api.heigit.org` server, send
coordinates as `[longitude, latitude]` pairs, and authenticate with the
`Authorization` header as required by the
[openrouteservice Directions API](https://docs.openrouteservice.org/all/docs).
Requests run in a Web Worker by default; set `worker: false` to execute on the
main thread.
