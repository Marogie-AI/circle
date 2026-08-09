import path from "node:path";
import type { NextConfig } from "next";

/**
 * script-src carries 'unsafe-inline' deliberately, and it is worth saying why rather
 * than leaving a weak directive looking like an oversight.
 *
 * The App Router streams its RSC payload as inline `self.__next_f.push(...)` scripts
 * whose contents change on every render, so a hash-based policy cannot work. A nonce
 * would mean widening proxy.ts from `/groups/:path*` to every route and forcing all
 * rendering dynamic. Meanwhile the XSS vector CSP would be defending against is already
 * closed at the source: components/markdown-preview.tsx omits rehype-raw (a documented
 * repo invariant) and there is no dangerouslySetInnerHTML anywhere in the app.
 *
 * So: ship the directives that are strict and free, and revisit script-src if a
 * third-party script ever lands. img-src allows https: because post cards render
 * Open Graph images from arbitrary origins.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "media-src 'self'",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Pin the workspace root. Left to inference, Turbopack walks up looking for a lockfile
  // and can settle on a directory above the repo entirely — it picked ~/Desktop here.
  // Dependencies hoist to the repo root, so that is the correct root.
  turbopack: { root: path.join(import.meta.dirname, "..", "..") },

  // keeps the dev overlay badge out of captured review evidence
  devIndicators: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Two years and preload-eligible. Only ever sent over HTTPS, so it is inert
          // against a local http dev server.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // frame-ancestors in the CSP supersedes this for modern browsers; kept for
          // the ones that do not implement it.
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
        ],
      },
    ];
  },
};

export default nextConfig;
