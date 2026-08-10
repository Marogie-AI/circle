import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "bun:test";
import { validateProductionAuthConfig } from "@/lib/env";

test("production auth config rejects weak credentials and insecure public origins", () => {
  const strongValue = randomBytes(48).toString("base64url");

  assert.throws(() => validateProductionAuthConfig("a".repeat(64), "https://circle.example"));
  assert.throws(() =>
    validateProductionAuthConfig(
      "replace-with-a-generated-value-that-is-long-enough",
      "https://circle.example",
    ),
  );
  assert.throws(() => validateProductionAuthConfig(strongValue, "http://circle.example"));
  assert.throws(() =>
    validateProductionAuthConfig(strongValue, "https://circle.example/path"),
  );

  assert.doesNotThrow(() =>
    validateProductionAuthConfig(strongValue, "https://circle.example"),
  );
  assert.doesNotThrow(() =>
    validateProductionAuthConfig(strongValue, "http://localhost:3002"),
  );
});
