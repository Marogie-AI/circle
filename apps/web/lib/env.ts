/**
 * Fail the build, not the first request.
 *
 * Without this a missing DATABASE_URL produces a green deploy that 500s the moment
 * someone loads a page, and a missing BETTER_AUTH_SECRET produces sessions that silently
 * never validate. Neither variable is read anywhere in app code — better-auth picks its
 * two up implicitly — which is exactly why their absence is invisible today.
 *
 * Imported by db/index.ts, so every server entrypoint (pages, Server Actions,
 * /api/mobile/*, lib/auth.ts, the test suite) runs it. On Vercel it throws at module
 * scope during `next build`: the build fails and the previous deployment keeps serving.
 */

const isProduction = process.env.NODE_ENV === "production";

// better-auth generates a dev fallback for its two locally, so requiring them outside
// production would break every existing checkout for no gain.
const required = [
  "DATABASE_URL",
  ...(isProduction ? ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] : []),
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment ${missing.length === 1 ? "variable" : "variables"}: ${missing.join(", ")}. ` +
      `See apps/web/.env.example.`,
  );
}

// app/dev-login/route.ts is already double-gated (NODE_ENV plus both variables being
// set). This makes the second gate loud: a production deploy carrying these values fails
// to build rather than quietly shipping a login bypass.
//
// Keyed on VERCEL_ENV, not NODE_ENV: `next build` sets NODE_ENV=production even when you
// run it on your laptop, where DEV_LOGIN_* legitimately lives in .env.local. VERCEL_ENV
// is only "production" on an actual production deployment, which is the thing we care
// about. A local production build is not a production deploy.
const isProductionDeploy = process.env.VERCEL_ENV === "production";

if (isProductionDeploy && (process.env.DEV_LOGIN_EMAIL || process.env.DEV_LOGIN_PASSWORD)) {
  throw new Error(
    "DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD must not be set in production — they bypass the login form.",
  );
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL as string,
};
