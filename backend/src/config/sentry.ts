import * as Sentry from '@sentry/node';
import { env } from './env.js';
import { logger } from './logger.js';

export function initSentry() {
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      // Adjust this value in production, or use tracesSampler for greater control
      tracesSampleRate: 1.0,

      // Profiles sample rate for profiling data
      profilesSampleRate: 1.0,
    });
    logger.info('Sentry initialized.');
  } else {
    if (env.NODE_ENV === 'production') {
      logger.warn('Sentry DSN not provided in production environment.');
    }
  }
}
