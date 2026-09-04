import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  API_PORT: z.coerce.number().default(3333),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().optional(),

  // Meta Conversions API (CRM)
  META_CAPI_DATASET_ID: z.string().optional(),
  META_CAPI_ACCESS_TOKEN: z.string().optional(),
  META_CAPI_API_VERSION: z.string().default('v26.0'),
  META_CAPI_LEAD_EVENT_SOURCE: z.string().default('CRM SWIFT'),
  META_CAPI_TEST_EVENT_CODE: z.string().optional(),
  META_CAPI_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type EnvConfig = z.infer<typeof envSchema>;
