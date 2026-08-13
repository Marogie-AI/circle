/**
 * Fail the build, not the first request.
 *
 * Without this a missing DATABASE_URL produces a green deploy that 500s the moment
 * someone loads a page, a missing BETTER_AUTH_SECRET produces sessions that silently
 * never validate, and a half-configured Redis cache quietly turns every request into a
 * database read. Some of these are consumed implicitly by their libraries, which is
 * exactly why their absence would otherwise be invisible here.
 *
 * Imported by db/index.ts, so every server entrypoint (pages, Server Actions,
 * /api/mobile/*, lib/auth.ts, the test suite) runs it. On Vercel it throws at module
 * scope during `next build`: the build fails and the previous deployment keeps serving.
 */

const isProduction = process.env.NODE_ENV === "production";

// Keyed on VERCEL_ENV, not NODE_ENV: `next build` sets NODE_ENV=production for every
// build — CI, Vercel preview, and a local production build alike — none of which have (or
// should need) Upstash credentials. VERCEL_ENV is only "production" on an actual
// production deployment, which is the thing that must fail before it silently runs
// uncached. See the DEV_LOGIN gate below, which relies on the same distinction.
const isProductionDeploy = process.env.VERCEL_ENV === "production";

// better-auth generates a dev fallback locally, and Redis is an optional optimization in
// development. Requiring either outside production would break existing checkouts for no
// gain; a production deploy, by contrast, should fail before it silently runs uncached.
const required = [
  "DATABASE_URL",
  ...(isProduction ? ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] : []),
  ...(isProductionDeploy
    ? ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]
    : []),
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment ${missing.length === 1 ? "variable" : "variables"}: ${missing.join(", ")}. ` +
      `See apps/web/.env.example.`,
  );
}

function parseOrigin(value: string, key: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid absolute URL.`);
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${key} must be an http(s) origin with no path, credentials, query, or hash.`);
  }

  return url;
}

export function validateProductionAuthConfig(secret: string, authUrl: string) {
  const normalizedSecret = secret.toLowerCase();
  if (
    secret.length < 32 ||
    new Set(secret).size < 12 ||
    /(change.?me|example|not.?real|password|replace|secret)/.test(normalizedSecret)
  ) {
    throw new Error(
      "BETTER_AUTH_SECRET must be a randomly generated value of at least 32 characters.",
    );
  }

  const authOrigin = parseOrigin(
    authUrl,
    "BETTER_AUTH_URL",
  );
  const isLoopback =
    authOrigin.hostname === "localhost" ||
    authOrigin.hostname === "127.0.0.1" ||
    authOrigin.hostname === "[::1]";
  if (authOrigin.protocol !== "https:" && !isLoopback) {
    throw new Error("BETTER_AUTH_URL must use https:// on a production deployment.");
  }
}

if (isProduction) {
  validateProductionAuthConfig(
    process.env.BETTER_AUTH_SECRET as string,
    process.env.BETTER_AUTH_URL as string,
  );
}

// app/dev-login/route.ts is already double-gated (NODE_ENV plus both variables being
// set). This makes the second gate loud: a production deploy carrying these values fails
// to build rather than quietly shipping a login bypass. isProductionDeploy (VERCEL_ENV)
// is used rather than NODE_ENV because `next build` sets NODE_ENV=production even on a
// laptop, where DEV_LOGIN_* legitimately lives in .env.local.
if (isProductionDeploy && (process.env.DEV_LOGIN_EMAIL || process.env.DEV_LOGIN_PASSWORD)) {
  throw new Error(
    "DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD must not be set in production — they bypass the login form.",
  );
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL as string,
};
