import assert from "node:assert/strict";
import { test } from "bun:test";
import {
  extractMentionIds,
  linkifyMarkdown,
  type Mentionable,
} from "@/lib/mentions";

const members: Mentionable[] = [
  { id: "1", name: "Ada" },
  { id: "2", name: "Ada Lovelace" },
  { id: "3", name: "Bob" },
];

test("mention matching: longest-wins, case-insensitive, boundaries, dedup", () => {
  // longest name wins over the shorter prefix name
  assert.deepEqual(extractMentionIds("hi @Ada Lovelace!", members), ["2"]);
  // plain shorter name still matches when the longer one doesn't follow
  assert.deepEqual(extractMentionIds("hi @Ada!", members), ["1"]);
  // trailing word char breaks the match: "@Adam" is not "Ada"
  assert.deepEqual(extractMentionIds("@Adam", members), []);
  // case-insensitive
  assert.deepEqual(extractMentionIds("@ada and @BOB", members), ["1", "3"]);
  // duplicates collapse
  assert.deepEqual(extractMentionIds("@Ada @Ada", members), ["1"]);
  // non-members never match
  assert.deepEqual(extractMentionIds("@Zoe", members), []);
  // an @ preceded by a word char (email-ish) is not a mention
  assert.deepEqual(extractMentionIds("mail a@Ada.com", members), []);
});

test("linkifyMarkdown turns mentions into profile links, leaves the rest", () => {
  assert.equal(linkifyMarkdown("hey @Bob!", members), "hey [@Bob](/u/3)!");
  assert.equal(
    linkifyMarkdown("cc @Ada Lovelace and @Bob", members),
    "cc [@Ada Lovelace](/u/2) and [@Bob](/u/3)",
  );
  // no members named here → unchanged
  assert.equal(linkifyMarkdown("just text @nobody", members), "just text @nobody");
});
