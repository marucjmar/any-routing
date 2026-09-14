import { describe, expect, it, vi } from 'vitest';
import { MapboxExecutor } from './mapbox.executor';

describe('MapboxExecutor', () => {
  it('requests GeoJSON routes and normalizes route geometry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [
            {
              distance: 1250,
              duration: 90,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-73.99, 40.75],
                  [-73.98, 40.76],
                ],
              },
              legs: [
                {
                  distance: 1250,
                  duration: 90,
                  steps: [
                    {
                      distance: 1250,
                      duration: 90,
                      geometry: {
                        type: 'LineString',
                        coordinates: [
                          [-73.99, 40.75],
                          [-73.98, 40.76],
                        ],
                      },
                      maneuver: { location: [-73.99, 40.75] },
                    },
                  ],
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new MapboxExecutor().request({
      url: 'https://api.mapbox.com/directions/v5/mapbox/driving/coordinates',
      mode: 'default',
      accessToken: 'test-token',
      profile: 'driving',
      geometries: 'geojson',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/directions/'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.routes[0]?.distance).toBe(1250);
    expect(result.routes[0]?.durationTime).toBe(90);
    expect(result.routes[0]?.path).toEqual([
      [40.75, -73.99],
      [40.76, -73.98],
    ]);
    expect(result.routesShapeGeojson.features).toHaveLength(1);
  });
});
