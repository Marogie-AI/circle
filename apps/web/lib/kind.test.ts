import assert from "node:assert/strict";
import { test } from "bun:test";
import {
  detectKind,
  parsePostKind,
  youtubeId,
  youtubeThumb,
} from "@/lib/kind";

test("parsePostKind accepts only the exact known kinds", () => {
  assert.equal(parsePostKind("video"), "video");
  assert.equal(parsePostKind("note"), "note");
  // Case matters — the column stores lowercase slugs.
  assert.equal(parsePostKind("Video"), null);
  assert.equal(parsePostKind("VIDEO"), null);
  assert.equal(parsePostKind(""), null);
  assert.equal(parsePostKind("../"), null);
  assert.equal(parsePostKind("video'; drop table posts--"), null);
  assert.equal(parsePostKind(undefined), null);
  assert.equal(parsePostKind(null), null);
  assert.equal(parsePostKind({ toString: () => "video" }), null);
  assert.equal(parsePostKind(["video"]), null);
});

test("youtubeId handles every URL shape YouTube hands out", () => {
  assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  // Extra query params and timestamps are common in pasted links.
  assert.equal(
    youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLabc"),
    "dQw4w9WgXcQ",
  );
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ?t=42"), "dQw4w9WgXcQ");
  // Ids with the URL-safe base64 extras still pass the shape check.
  assert.equal(youtubeId("https://youtu.be/a_b-c1D2e3F"), "a_b-c1D2e3F");
});

test("youtubeId rejects anything it cannot vouch for", () => {
  assert.equal(youtubeId(null), null);
  assert.equal(youtubeId(undefined), null);
  assert.equal(youtubeId(""), null);
  assert.equal(youtubeId("not a url"), null);
  assert.equal(youtubeId("https://vimeo.com/123456"), null);
  assert.equal(youtubeId("https://example.com/watch?v=dQw4w9WgXcQ"), null);
  // A lookalike host must not pass: the id goes straight into an image URL.
  assert.equal(youtubeId("https://evil-youtube.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(youtubeId("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"), null);
  // Wrong-length or out-of-alphabet ids are not real ids.
  assert.equal(youtubeId("https://youtu.be/short"), null);
  assert.equal(youtubeId("https://youtu.be/waaaaaaaytoolongforanid"), null);
  assert.equal(youtubeId("https://youtu.be/../../etc/passwd"), null);
  // A channel or playlist page is not a video.
  assert.equal(youtubeId("https://www.youtube.com/@fireship"), null);
  assert.equal(youtubeId("https://www.youtube.com/watch"), null);
});

test("youtubeThumb builds a fixed-host URL from the id", () => {
  assert.equal(
    youtubeThumb("dQw4w9WgXcQ"),
    "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  );
});

test("detectKind guesses from the link, defaulting to note", () => {
  assert.equal(detectKind("https://youtu.be/dQw4w9WgXcQ"), "video");
  assert.equal(detectKind("https://example.com/a-blog-post"), "article");
  assert.equal(detectKind(""), "note");
  assert.equal(detectKind("   "), "note");
  assert.equal(detectKind(null), "note");
  // Not a parseable URL yet — mid-typing must not throw or claim "video".
  assert.equal(detectKind("https://yout"), "article");
});
