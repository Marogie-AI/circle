import assert from "node:assert/strict";
import { test } from "bun:test";
import {
  assertPublicUrl,
  isBlockedAddress,
  safeFetchPreview,
} from "@/lib/link-preview";

/**
 * No DNS, so this verdict is identical on every platform.
 *
 * That matters here more than it usually would. The resolvers disagree about how to
 * spell an IPv4-mapped IPv6 address — macOS rewrites ::ffff:7f00:1 to
 * ::ffff:127.0.0.1, Linux returns it verbatim — so a URL-level test of the same bug
 * passes on a developer's Mac while production stays exploitable. This is the test
 * that actually holds the line.
 */
test("isBlockedAddress covers IPv4-mapped IPv6 in both spellings", () => {
  // ::ffff:a9fe:a9fe is 169.254.169.254, the cloud metadata endpoint.
  assert.equal(isBlockedAddress("::ffff:a9fe:a9fe", 6), true, "hex metadata");
  assert.equal(isBlockedAddress("::ffff:169.254.169.254", 6), true, "dotted metadata");
  assert.equal(isBlockedAddress("::ffff:7f00:1", 6), true, "hex loopback");
  assert.equal(isBlockedAddress("::ffff:127.0.0.1", 6), true, "dotted loopback");
  assert.equal(isBlockedAddress("::ffff:a00:1", 6), true, "hex 10/8");
  assert.equal(isBlockedAddress("::ffff:c0a8:1", 6), true, "hex 192.168/16");

  // A mapped PUBLIC address must still be allowed, or the fix is just a blanket ban.
  assert.equal(isBlockedAddress("::ffff:808:808", 6), false, "hex 8.8.8.8");
  assert.equal(isBlockedAddress("::ffff:8.8.8.8", 6), false, "dotted 8.8.8.8");

  // Unmapped v6 and plain v4 keep working.
  assert.equal(isBlockedAddress("::1", 6), true, "v6 loopback");
  assert.equal(isBlockedAddress("fe80::1", 6), true, "v6 link-local");
  assert.equal(isBlockedAddress("2606:4700::1111", 6), false, "public v6");
  assert.equal(isBlockedAddress("169.254.169.254", 4), true, "v4 metadata");
  assert.equal(isBlockedAddress("8.8.8.8", 4), false, "public v4");
});

const rejects = async (url: string) => {
  try {
    await assertPublicUrl(url);
    return null; // no throw == accepted
  } catch (error) {
    return (error as Error).message;
  }
};

test("assertPublicUrl blocks everything that could reach our own network", async () => {
  // Cloud metadata — the single highest-value SSRF target.
  assert.ok(await rejects("http://169.254.169.254/latest/meta-data/"), "metadata IP");
  assert.ok(await rejects("http://[fe80::1]/"), "ipv6 link-local");

  // Loopback, in the several spellings that all reach the same place.
  assert.ok(await rejects("http://localhost:3002/"), "localhost");
  assert.ok(await rejects("http://sub.localhost/"), ".localhost suffix");
  assert.ok(await rejects("http://127.0.0.1/"), "127.0.0.1");
  assert.ok(await rejects("http://127.1.2.3/"), "rest of 127/8");
  assert.ok(await rejects("http://[::1]/"), "ipv6 loopback");
  assert.ok(await rejects("http://[::ffff:127.0.0.1]/"), "ipv4-mapped ipv6 loopback");
  // Both spellings, because they are not interchangeable in practice: new URL()
  // rewrites the dotted form to the hex one, and then macOS's resolver hands back
  // dotted while Linux hands back hex. Checking only one spelling passes locally and
  // lets the other through in production. ::ffff:a9fe:a9fe is 169.254.169.254.
  assert.ok(await rejects("http://[::ffff:7f00:1]/"), "hex ipv4-mapped loopback");
  assert.ok(await rejects("http://[::ffff:a9fe:a9fe]/"), "hex ipv4-mapped metadata IP");
  assert.ok(await rejects("http://[::ffff:169.254.169.254]/"), "dotted ipv4-mapped metadata IP");
  assert.ok(await rejects("http://[::ffff:a00:1]/"), "hex ipv4-mapped 10/8");

  // RFC1918 + CGNAT + unspecified + multicast.
  assert.ok(await rejects("http://10.0.0.5/"), "10/8");
  assert.ok(await rejects("http://172.16.4.1/"), "172.16/12");
  assert.ok(await rejects("http://192.168.1.1/"), "192.168/16");
  assert.ok(await rejects("http://100.100.0.1/"), "CGNAT");
  assert.ok(await rejects("http://0.0.0.0/"), "unspecified");
  assert.ok(await rejects("http://239.1.1.1/"), "multicast");

  // Non-HTTP schemes must never be fetched.
  assert.ok(await rejects("file:///etc/passwd"), "file://");
  assert.ok(await rejects("javascript:alert(1)"), "javascript:");
  assert.ok(await rejects("data:text/html,<h1>x"), "data:");
  assert.ok(await rejects("gopher://127.0.0.1:11211/"), "gopher:");

  // 172.32 is PUBLIC — the private range stops at 172.31. Guards that block all of
  // 172/8 are wrong, so assert we did not overshoot.
  assert.equal(
    await rejects("http://172.32.0.1/"),
    null,
    "172.32/16 is public and must be allowed",
  );
});

test("safeFetchPreview never throws and never returns a preview for a blocked host", async () => {
  // Failure must be a null, not an exception — posting depends on it.
  assert.equal(await safeFetchPreview("http://169.254.169.254/"), null);
  assert.equal(await safeFetchPreview("file:///etc/passwd"), null);
  assert.equal(await safeFetchPreview("not a url at all"), null);
  assert.equal(await safeFetchPreview("http://localhost:3002/"), null);
});
