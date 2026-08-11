import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

type Json = Record<string, unknown>;

const baseUrl = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3002");
const runId = randomUUID().replaceAll("-", "");
const email = `api-smoke-${runId}@example.test`;
const password = `Circle-ci-${runId}`;
const slug = `api-smoke-${runId.slice(0, 16)}`;
const groupId = randomUUID();
const postId = randomUUID();
const client = new Client({ connectionString: process.env.DATABASE_URL });
let connected = false;
let ownerId: string | undefined;

async function request(path: string, init?: RequestInit) {
  const response = await fetch(new URL(path, baseUrl), init);
  const text = await response.text();
  let body: Json | null = null;

  if (text) {
    try {
      body = JSON.parse(text) as Json;
    } catch {
      throw new Error(`${path} returned invalid JSON: ${text}`);
    }
  }

  return { response, body };
}

function expectStatus(
  actual: { response: Response; body: Json | null },
  expected: number,
  label: string,
) {
  assert.equal(
    actual.response.status,
    expected,
    `${label}: ${JSON.stringify(actual.body)}`,
  );
  assert.ok(actual.body, `${label}: expected JSON response`);
  return actual.body;
}

try {
  await client.connect();
  connected = true;

  const unauthenticated = await request("/api/mobile/groups");
  const unauthenticatedBody = expectStatus(
    unauthenticated,
    401,
    "unauthenticated groups",
  );
  assert.equal(unauthenticatedBody.error, "unauthorized");

  const signUp = await request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "API Smoke", email, password }),
  });
  expectStatus(signUp, 200, "sign up");

  const signIn = await request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const signInBody = expectStatus(signIn, 200, "sign in");
  const token = signInBody.token;
  assert.equal(typeof token, "string", "sign in did not return a bearer token");
  const authorization = { authorization: `Bearer ${token}` };

  const owner = await client.query<{ id: string }>(
    'SELECT id FROM "user" WHERE email = $1',
    [email],
  );
  ownerId = owner.rows[0]?.id;
  assert.ok(ownerId, "sign-up user was not persisted");

  await client.query(
    `INSERT INTO groups (id, name, slug, created_by)
     VALUES ($1, $2, $3, $4)`,
    [groupId, "API Smoke Group", slug, ownerId],
  );
  await client.query(
    `INSERT INTO memberships (group_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [groupId, ownerId],
  );
  await client.query(
    `INSERT INTO posts (id, group_id, author_id, title, body)
     VALUES ($1, $2, $3, $4, $5)`,
    [postId, groupId, ownerId, "API smoke post", "A post created by the API smoke test."],
  );

  const groups = await request("/api/mobile/groups", { headers: authorization });
  const groupsBody = expectStatus(groups, 200, "authenticated groups");
  const groupRows = groupsBody.groups;
  assert.ok(Array.isArray(groupRows), "groups response did not contain an array");
  assert.ok(
    groupRows.some(
      (group) =>
        typeof group === "object" &&
        group !== null &&
        group.id === groupId &&
        group.slug === slug &&
        group.role === "owner",
    ),
    "groups response did not include the seeded membership",
  );

  const feed = await request(`/api/mobile/groups/${slug}/feed`, {
    headers: authorization,
  });
  const feedBody = expectStatus(feed, 200, "authenticated feed");
  assert.deepEqual(feedBody.group, { name: "API Smoke Group", slug });
  const items = feedBody.items;
  assert.ok(Array.isArray(items), "feed response did not contain an items array");
  assert.ok(
    items.some(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        item.id === postId &&
        item.title === "API smoke post",
    ),
    "feed response did not include the seeded post",
  );

  const notFound = await request(`/api/mobile/groups/${slug}-other/feed`, {
    headers: authorization,
  });
  const notFoundBody = expectStatus(notFound, 404, "non-member feed");
  assert.equal(notFoundBody.error, "not_found");

  const signOut = await request("/api/auth/sign-out", {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: "{}",
  });
  expectStatus(signOut, 200, "sign out");

  const revoked = await request("/api/mobile/groups", { headers: authorization });
  const revokedBody = expectStatus(revoked, 401, "revoked token");
  assert.equal(revokedBody.error, "unauthorized");

  console.log("API smoke test passed.");
} finally {
  if (connected) {
    await client.query("DELETE FROM groups WHERE id = $1", [groupId]);
    if (ownerId) {
      await client.query("DELETE FROM rate_limits WHERE key = $1", [
        `mobile:${ownerId}`,
      ]);
    }
    await client.query('DELETE FROM "user" WHERE email = $1', [email]);
    await client.end();
  }
}
