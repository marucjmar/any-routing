# osrm-data-provider

`AnyRoutingDataProvider` implementation backed by an [OSRM](https://project-osrm.org/) HTTP server (`route` service, see the [OSRM HTTP API docs](https://project-osrm.org/docs/v5.24.0/api/#requests)).

## Usage

```ts
import { AnyRouting } from '@any-routing/core';
import { OsrmProvider } from '@any-routing/osrm-data-provider';

const dataProvider = new OsrmProvider({
  baseUrl: 'https://router.project-osrm.org/route/v1/driving',
  alternatives: 2,
});

const routing = new AnyRouting({
  dataProvider,
  waypointsSyncStrategy: 'none',
});
```

By default requests run inside a Web Worker (`worker: true`), mirroring `@any-routing/here-data-provider`. Set `worker: false` to run the executor on the main thread instead.

## Building

Run `nx build osrm-data-provider` to build the library.

## Running unit tests

Run `nx test osrm-data-provider` to execute the unit tests via [Vitest](https://vitest.dev/).

