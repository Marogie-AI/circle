import assert from "node:assert/strict";
import { test } from "bun:test";
import { coverExcerpt, coverWash, hashSeed } from "@/lib/cover";

test("the cover a post gets is stable, not random", () => {
  // Same post, same cover on every render — otherwise the feed reshuffles its own
  // artwork on each refresh.
  assert.equal(coverWash("post-a"), coverWash("post-a"));
  assert.equal(hashSeed("post-a"), hashSeed("post-a"));
  // And different posts should not all land on one wash.
  const spread = new Set(
    Array.from({ length: 40 }, (_, i) => coverWash(`post-${i}`)),
  );
  assert.ok(spread.size > 1, "every post got the same wash");
});

test("coverExcerpt strips markdown rather than showing it raw", () => {
  assert.equal(coverExcerpt("## A heading\n\nSome text."), "A heading Some text.");
  assert.equal(coverExcerpt("**bold** and _italic_"), "bold and italic");
  assert.equal(coverExcerpt("- one\n- two"), "one two");
  assert.equal(coverExcerpt("> quoted"), "quoted");
  assert.equal(coverExcerpt("see [the docs](https://x.test)"), "see the docs");
  assert.equal(coverExcerpt("![alt](https://x.test/a.png) after"), "after");
  assert.equal(coverExcerpt("before ```js\nconst a = 1;\n``` after"), "before after");
  assert.equal(coverExcerpt("`code` here"), "code here");
});

test("coverExcerpt handles nothing-to-show without throwing", () => {
  assert.equal(coverExcerpt(null), null);
  assert.equal(coverExcerpt(undefined), null);
  assert.equal(coverExcerpt(""), null);
  assert.equal(coverExcerpt("   \n\n  "), null);
  // A body that is nothing but an image has no text to fall back on.
  assert.equal(coverExcerpt("![alt](https://x.test/a.png)"), null);
});

test("coverExcerpt breaks on a word and marks the cut", () => {
  const body = `${"word ".repeat(60)}end`;
  const out = coverExcerpt(body, 50);
  assert.ok(out, "expected an excerpt");
  assert.ok(out.length <= 51, `too long: ${out.length}`);
  assert.ok(out.endsWith("…"), out);
  assert.ok(!out.includes("wor…"), `cut mid-word: ${out}`);

  // Short bodies are returned whole, with no ellipsis promising more text.
  assert.equal(coverExcerpt("Short one.", 50), "Short one.");

  // One unbroken token longer than the budget still has to be cut somewhere.
  const long = coverExcerpt("x".repeat(200), 50);
  assert.ok(long, "expected an excerpt");
  assert.ok(long.length <= 51 && long.endsWith("…"), long);
});
