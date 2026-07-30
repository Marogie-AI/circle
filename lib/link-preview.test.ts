import assert from "node:assert/strict";
import { test } from "bun:test";
import { assertPublicUrl, safeFetchPreview } from "@/lib/link-preview";

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
