# maplibre-layers-event-propagator

Maplibre GL and MapBox GL JS map engine add-on to stop event propagation between layers.

## Installation

```
npm i --save @any-routing/maplibre-layers-event-propagator
```

## Example of usage

```ts
import { Map } from 'maplibre';
import { PropagationEvent, setupLayerEventsPropagator } from '@any-routing/layers-event-propagator';

const map = new Map({});

map.on('load', () => {
  setupLayerEventsPropagator(map); // Must be handled after map loaded

  map.on('click', 'lake-label', (e: PropagationEvent<MapLayerMouseEvent>) => {
    if (e.isCancelled && e.isCancelled()) {
      return;
    }

    console.log(e, 'click on water label printed');
    e.stopPropagation ? e.stopPropagation() : null;
    e.stopImmediatePropagation ? e.stopImmediatePropagation() : null;
  });

  map.on('click', 'lake-label', (e: PropagationEvent<MapLayerMouseEvent>) => {
    if (e.isCancelled && e.isCancelled()) {
      return;
    }

    console.log(e, 'click on water label no printed');
    e.stopPropagation ? e.stopPropagation() : null;
  });

  map.on('click', 'water', (e: PropagationEvent<MapLayerMouseEvent>) => {
    if (e.isCancelled && e.isCancelled()) {
      return;
    }

    console.log(e, 'click on water');
    e.stopPropagation ? e.stopPropagation() : null;
  });

  map.on('click', (e: PropagationEvent<MapLayerMouseEvent>) => {
    //For non layer handlers
    if (e.originalEvent.isCancelled && e.originalEvent.isCancelled()) {
      return;
    }

    console.log(e, 'click anywhere else');
  });
});
```
