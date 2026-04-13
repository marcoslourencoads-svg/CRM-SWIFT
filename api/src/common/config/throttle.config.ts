/**
 * Rate-limiting configuration.
 *
 * Default (applied via APP_GUARD): 120 requests per 60 s (authenticated).
 * For unauthenticated / public endpoints you can use @SkipThrottle() or
 * apply a stricter @Throttle({ default: { ttl: 60000, limit: 60 } }).
 */
export const throttleConfig = {
  /** Authenticated users – 120 req / min */
  authenticated: { ttl: 60000, limit: 120 },
  /** Unauthenticated / public endpoints – 60 req / min */
  unauthenticated: { ttl: 60000, limit: 60 },
};
