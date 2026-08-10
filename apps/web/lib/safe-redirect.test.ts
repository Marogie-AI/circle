import assert from "node:assert/strict";
import { test } from "bun:test";
import { safeRedirectTarget } from "@/lib/safe-redirect";

test("safeRedirectTarget keeps local paths and rejects external normalizations", () => {
  assert.equal(safeRedirectTarget("/groups/friends?sort=old#top"), "/groups/friends?sort=old#top");
  assert.equal(safeRedirectTarget("//evil.example"), "/");
  assert.equal(safeRedirectTarget("/\\evil.example"), "/");
  assert.equal(safeRedirectTarget("https://evil.example"), "/");
  assert.equal(safeRedirectTarget("javascript:alert(1)"), "/");
  assert.equal(safeRedirectTarget("/groups\n/elsewhere"), "/");
});
