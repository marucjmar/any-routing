// @ts-nocheck
import type {
  Map as MapLibreMap,
  MapLayerMouseEvent as MapLayerMouseEventMapLibre,
  MapMouseEvent as MapMouseEventMapLibre,
} from 'maplibre-gl';
import type {
  Map as MapBoxMap,
  MapLayerMouseEvent as MapLayerMouseEventMapBox,
  MapMouseEvent as MapMouseEventMapBox,
} from 'mapbox-gl';

type Map = MapBoxMap | MapLibreMap;
type MapLayerMouseEvent = MapLayerMouseEventMapLibre | MapLayerMouseEventMapBox;
type MapMouseEvent = MapMouseEventMapBox | MapMouseEventMapLibre;

export type PropagationEvent<E extends MapLayerMouseEvent | MapMouseEvent> = E & {
  stopPropagationCancelledLayerId?: string;
  immediatePropagationCancelledLayerId?: string;
  stopPropagation?(): void;
  isCancelled?: () => boolean;
  stopImmediatePropagation?(): void;
  originalEvent: E['originalEvent'] & { isCancelled?: () => boolean };
};

function reorderHandlers(map, eventName: string, layers: string[]) {
  if (!map._delegatedListeners || !map._listeners) {
    return;
  }

  map._delegatedListeners[eventName]?.sort(function (a, b) {
    return layers.indexOf(b.layer) - layers.indexOf(a.layer);
  });

  map._listeners[eventName]?.sort((a, b) => {
    const delegatedIndexA: number =
      map._delegatedListeners[eventName]?.findIndex((x) => x.delegates[eventName] === a) ?? -1;
    const delegatedIndexB: number =
      map._delegatedListeners[eventName]?.findIndex((x) => x.delegates[eventName] === b) ?? -1;

    return (delegatedIndexA != -1 ? delegatedIndexA : Infinity) - (delegatedIndexB != -1 ? delegatedIndexB : Infinity);
  });
}

function wrapCallback(originalCallback) {
  return (...args) => {
    const event: PropagationEvent<MapMouseEvent | MapLayerMouseEvent> = args[0];
    const _layerId = (): boolean => {
      return event && 'features' in event && event.features ? event.features[0]?.layer?.id : '__no-layer__';
    };
    const layerId = _layerId();

    const isCancelled = () => {
      const layerId = _layerId();

      return (
        !event?.type ||
        (event?.originalEvent.stopPropagationCancelledLayerId &&
          event?.originalEvent.stopPropagationCancelledLayerId !== layerId) ||
        event?.immediatePropagationCancelledLayerId === layerId
      );
    };

    if (!event.isCancelled) {
      event.originalEvent.isCancelled = isCancelled;

      event.originalEvent.layerStopPropagation = () => {
        event.originalEvent.stopPropagationCancelledLayerId = layerId;
      };

      event.originalEvent.layerStopImmediatePropagation = () => {
        event.immediatePropagationCancelledLayerId = layerId;
      };

      event.isCancelled = event.originalEvent.isCancelled;
      event.stopPropagation = event.originalEvent.layerStopPropagation;
      event.stopImmediatePropagation = event.originalEvent.layerStopImmediatePropagation;
    }

    originalCallback(...args);
  };
}

export function setupLayerEventsPropagator(map: Map): void {
  if ('_anyRoutingLayersEventPropagatorAdded' in map) {
    return;
  }

  //@ts-ignore
  map._anyRoutingLayersEventPropagatorAdded = true;

  const originalOn = map.on;
  let layers = map.getStyle().layers.map((l) => l.id);

  const reorderAll = (): void => {
    if (!map._delegatedListeners) {
      return;
    }

    Object.keys(map._delegatedListeners).forEach((eventName) => {
      reorderHandlers(map, eventName, layers);
    });
  };

  map.on('styledata', () => {
    layers = map.getStyle().layers.map((l) => l.id);
    reorderAll();
  });

  reorderAll();

  const ownOn = (...args): Map => {
    if (args[2] === undefined) {
      map.on = originalOn;
      //@ts-ignore
      map.on(...args);
      map.on = ownOn;
      reorderHandlers(map, args[0], layers);

      return map;
    }

    args[2] = wrapCallback(args[2]);
    map.on = originalOn;
    map.on(...args);
    map.on = ownOn;
    reorderHandlers(map, args[0], layers);

    return map;
  };

  map.on = ownOn;
}
