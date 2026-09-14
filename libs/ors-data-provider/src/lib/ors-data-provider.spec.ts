import { describe, expect, it, vi } from 'vitest';

import { OrsProvider } from './ors-data-provider';

describe('OrsProvider', () => {
  it('sends an ORS GeoJSON directions request with longitude/latitude coordinates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [19, 52],
                  [20, 53],
                ],
              },
              properties: {
                summary: { distance: 1000, duration: 120 },
              },
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/geo+json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OrsProvider({
      apiKey: 'test-key',
      baseUrl: 'https://api.openrouteservice.org/v2/directions',
      worker: false,
    });
    const data = await provider.request(
      [
        { position: { lat: 52, lng: 19 } },
        { position: { lat: 53, lng: 20 } },
      ],
      { mode: 'default' },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openrouteservice.org/v2/directions/driving-car',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'test-key' }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      coordinates: [
        [19, 52],
        [20, 53],
      ],
    });
    expect(data.routes[0]?.distance).toBe(1000);
    expect(data.routes[0]?.path).toEqual([
      [52, 19],
      [53, 20],
    ]);
  });
});
