import { describe, expect, it, vi } from 'vitest';
import { ValhallaExecutor } from './valhalla.executor';

describe('ValhallaExecutor', () => {
  it('posts a Valhalla request and normalizes polyline geometry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          trip: {
            locations: [
              { lat: 38.5, lon: -120.2 },
              { lat: 40.7, lon: -120.95 },
            ],
            legs: [
              {
                shape: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
                summary: { length: 100, time: 12 },
              },
            ],
            summary: { length: 100, time: 12 },
            status: 0,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new ValhallaExecutor().request({
      url: 'https://example.test/route',
      mode: 'default',
      requestLocations: [
        { lat: 38.5, lon: -120.2, type: 'break' },
        { lat: 40.7, lon: -120.95, type: 'break' },
      ],
      costing: 'auto',
      units: 'kilometers',
      shapeFormat: 'polyline5',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/route',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"locations"'),
      }),
    );
    expect(result.routes[0]?.distance).toBe(100);
    expect(result.routes[0]?.path).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
    expect(result.routesShapeGeojson.features[0]?.geometry.coordinates[0]).toEqual([-120.2, 38.5]);
  });
});
