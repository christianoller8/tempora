import { z } from 'zod';
import 'dotenv/config';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // Database — runtime (RLS-enforced app role)
  DATABASE_URL: z.string().url(),
  // Database — migrations (owner role, BYPASSRLS)
  DIRECT_DATABASE_URL: z.string().url().optional(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  // Cookies
  REFRESH_COOKIE_NAME: z.string().default('refresh_token'),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('strict'),

  // CORS
  CORS_ORIGIN: z.string().url(),

  // Encryption — 32-byte base64 key for AES-256-GCM (special-category fields)
  FIELD_ENCRYPTION_KEY: z.string().min(44), // 32 bytes base64 = 44 chars
});

function parseEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`[env] Invalid environment variables:\n${issues}`);
    process.exit(1);
  }
  return Object.freeze(result.data);
}

export const env = parseEnv();
export type Env = typeof env;
