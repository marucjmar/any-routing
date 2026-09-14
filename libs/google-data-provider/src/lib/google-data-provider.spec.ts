import { GoogleProvider } from './google-data-provider';

describe('GoogleProvider', () => {
  it('creates a provider with Google Routes defaults', () => {
    const provider = new GoogleProvider({ worker: false });
    expect(provider.options.baseUrl).toContain('routes.googleapis.com');
    provider.destroy();
  });
});
