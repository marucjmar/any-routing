# Google data provider

Provider for the Google Maps Routes API `computeRoutes` endpoint.

```ts
import { GoogleProvider } from '@any-routing/google-data-provider';

const provider = new GoogleProvider({ apiKey: 'YOUR_GOOGLE_MAPS_API_KEY' });
```

The API key must have the Routes API enabled. The provider sends the API key and
field mask using the `X-Goog-Api-Key` and `X-Goog-FieldMask` headers.
