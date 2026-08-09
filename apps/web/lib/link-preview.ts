import { lookup } from "node:dns/promises";

/**
 * Fetching a URL the user typed, from our server, is textbook SSRF: without guards an
 * attacker posts http://169.254.169.254/latest/meta-data/ and we hand them cloud
 * credentials, or probes services on the private network that are not otherwise
 * reachable. Everything in this file exists to make that impossible.
 */

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5_000;
const MAX_BYTES = 256 * 1024;

export type LinkPreview = {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

/**
 * An IPv4-mapped IPv6 address in EITHER notation, as dotted IPv4. Otherwise null.
 *
 * Both spellings are required, and getting this wrong was a real hole. `new URL()`
 * normalises `[::ffff:127.0.0.1]` to the hex form `::ffff:7f00:1` on every platform,
 * and then the resolvers disagree: macOS hands back the dotted `::ffff:127.0.0.1`,
 * Linux hands back the hex `::ffff:7f00:1` verbatim. A dotted-only check therefore
 * passes on a developer's Mac and lets `http://[::ffff:a9fe:a9fe]` — 169.254.169.254,
 * the cloud metadata endpoint — straight through in production. CI on Linux is what
 * caught it.
 */
function mappedIpv4(ip: string): string | null {
  const suffix = ip.match(/^::ffff:(.+)$/)?.[1];
  if (!suffix) return null;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(suffix)) return suffix;

  const groups = suffix.split(":");
  if (groups.length !== 2) return null;

  const high = Number.parseInt(groups[0], 16);
  const low = Number.parseInt(groups[1], 16);
  if (Number.isNaN(high) || Number.isNaN(low)) return null;

  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

/**
 * IPv4/IPv6 literals that must never be requested server-side.
 *
 * Exported for tests. It is deliberately pure — no DNS — because a test that goes
 * through the resolver silently passes on macOS while the same code is exploitable on
 * Linux. Assert on this directly and the answer is the same everywhere.
 */
export function isBlockedAddress(address: string, family: number): boolean {
  if (family === 6) {
    const ip = address.toLowerCase();
    const mapped = mappedIpv4(ip);
    if (mapped) return isBlockedAddress(mapped, 4);
    if (ip === "::1" || ip === "::") return true;
    if (/^f[cd]/.test(ip)) return true; // fc00::/7 unique-local
    if (/^fe[89ab]/.test(ip)) return true; // fe80::/10 link-local
    return false;
  }

  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local INCLUDING cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/**
 * Throws unless `raw` is an http(s) URL whose hostname resolves to a public address.
 * MUST be called for the initial URL and again for every redirect target — a public
 * host answering 302 -> http://169.254.169.254/ is the standard bypass.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid url");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`blocked protocol: ${url.protocol}`);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("blocked host");
  }

  // Judge an IP literal directly, before asking the resolver. Otherwise the verdict
  // depends on how the local resolver chooses to spell what you gave it — macOS rewrites
  // ::ffff:7f00:1 to ::ffff:127.0.0.1, Linux does not — and a guard whose answer differs
  // between a laptop and production is not a guard.
  const literalFamily = url.hostname.startsWith("[")
    ? 6
    : /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
      ? 4
      : null;
  if (literalFamily && isBlockedAddress(hostname.toLowerCase(), literalFamily)) {
    throw new Error(`blocked address: ${hostname}`);
  }

  // Resolve rather than trust the literal: "spoofed.example.com" can have an A record
  // pointing at 127.0.0.1 (DNS rebinding's simpler cousin).
  let resolved: { address: string; family: number }[];
  try {
    resolved = await lookup(hostname, { all: true });
  } catch {
    throw new Error("dns failure");
  }
  if (resolved.length === 0) throw new Error("dns empty");

  for (const { address, family } of resolved) {
    if (isBlockedAddress(address, family)) {
      throw new Error(`blocked address: ${address}`);
    }
  }

  return url;
}

function meta(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const value = m[1]
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
      if (value) return value.slice(0, 500);
    }
  }
  return null;
}

function extract(html: string, base: URL): LinkPreview {
  const title =
    meta(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']*)["']/i,
      /<title[^>]*>([^<]*)<\/title>/i,
    ]) ?? null;

  const description = meta(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  ]);

  const rawImage = meta(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']*)["']/i,
  ]);

  let image: string | null = null;
  if (rawImage) {
    try {
      const abs = new URL(rawImage, base);
      // only ever hand the browser an http(s) image URL
      if (abs.protocol === "http:" || abs.protocol === "https:") image = abs.toString();
    } catch {
      image = null;
    }
  }

  const siteName =
    meta(html, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i,
    ]) ?? base.hostname.replace(/^www\./, "");

  return { title, description, image, siteName };
}

/**
 * Best-effort preview. Returns null on ANY failure — a bad, slow or hostile link must
 * never break posting, so callers save the post first and treat this as decoration.
 */
export async function safeFetchPreview(raw: string): Promise<LinkPreview | null> {
  try {
    let target = await assertPublicUrl(raw);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(target, {
          method: "GET",
          redirect: "manual", // we re-validate every hop ourselves
          signal: controller.signal,
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "CircleBot/1.0 (+link preview)",
          },
        });
      } finally {
        clearTimeout(timer);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        // resolve relative redirects, then re-run the full public-address check
        target = await assertPublicUrl(new URL(location, target).toString());
        continue;
      }

      if (!response.ok) return null;

      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("html")) return null;

      const body = response.body;
      if (!body) return null;

      // read at most MAX_BYTES: meta tags live in <head>, and an endless response
      // must not be able to exhaust memory
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
      }
      await reader.cancel().catch(() => {});

      const merged = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk.subarray(0, Math.min(chunk.length, total - offset)), offset);
        offset += chunk.length;
        if (offset >= total) break;
      }

      const html = new TextDecoder("utf-8", { fatal: false }).decode(merged);
      const preview = extract(html, target);
      return preview.title || preview.description || preview.image ? preview : null;
    }

    return null; // too many redirects
  } catch {
    return null;
  }
}
