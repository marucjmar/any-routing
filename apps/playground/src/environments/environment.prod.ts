import { sharedEnv } from './env.shared';

export const environment = {
  production: true,
  hereApiKey: sharedEnv.hereApiKey,
  googleApiKey: sharedEnv.googleApiKey,
  orsApiKey: sharedEnv.orsApiKey,
  mapboxAccessToken: sharedEnv.mapboxAccessToken,
};
