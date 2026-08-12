import assert from "node:assert/strict";
import { test } from "bun:test";
import { fetchStockImage, stockImagesEnabled, stockKeywords } from "@/lib/stock-image";

/**
 * stockKeywords decides what leaves the server, so it gets the closest scrutiny here.
 * Everything it returns is sent to a third party and logged there.
 */
test("keywords prefer tags, which leak less than prose", () => {
  assert.equal(stockKeywords("Some private musing", ["engineering"]), "engineering");
  // At most two tags.
  assert.equal(
    stockKeywords("x", ["engineering", "books", "career", "money"]),
    "engineering books",
  );
  // Junk tags are dropped rather than forwarded.
  assert.equal(
    stockKeywords("fallback title here", ["a", "!!!", ""]),
    "fallback title here",
  );
});

test("keywords fall back to the title, capped and de-stopworded", () => {
  assert.equal(
    stockKeywords("The Unreasonable Effectiveness of Just Showing Up", []),
    "unreasonable effectiveness showing",
  );
  assert.equal(stockKeywords("How do I fix this", []), "fix");
  const long = stockKeywords("alpha beta gamma delta epsilon zeta eta theta", []);
  assert.equal(long?.split(" ").length, 3);
});

test("keywords never forward digits, punctuation or pasted identifiers", () => {
  // "sk-abc123" survives only as its letters, split into words: the digits are gone.
  assert.equal(stockKeywords("key sk-abc123 leaked", []), "key abc leaked");
  const out = stockKeywords("contact bob@corp.test about ticket 4821", []) ?? "";
  assert.ok(!out.includes("@"), out);
  assert.ok(!/\d/.test(out), `digits forwarded: ${out}`);
  const urlish = stockKeywords("see https://internal.corp.test/secret/path", []) ?? "";
  assert.ok(!urlish.includes("/") && !urlish.includes(":"), urlish);
});

test("keywords return null when there is nothing safe to send", () => {
  assert.equal(stockKeywords(null, []), null);
  assert.equal(stockKeywords("", []), null);
  assert.equal(stockKeywords("the a of to and", []), null, "only stopwords");
  assert.equal(stockKeywords("12345 !!! ???", []), null);
});

/** A complete Openverse result, which each case below then breaks in one way. */
const FULL = {
  url: "https://upload.wikimedia.org/a.jpg",
  creator: "Ada Lovelace",
  foreign_landing_url: "https://example.test/photos/1",
  license: "by-sa",
  license_version: "4.0",
  license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
};

function reply(results: unknown[]) {
  return (async () =>
    new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

function withStubbedFetch(
  stub: typeof fetch,
  run: () => Promise<void>,
): Promise<void> {
  const real = globalThis.fetch;
  globalThis.fetch = stub;
  return run().finally(() => {
    globalThis.fetch = real;
  });
}

test("no key is needed — a complete result is accepted and labelled", async () => {
  await withStubbedFetch(reply([FULL]), async () => {
    const image = await fetchStockImage("engineering");
    assert.equal(image?.authorName, "Ada Lovelace");
    assert.equal(image?.url, "https://upload.wikimedia.org/a.jpg");
    // license + license_version become one human label.
    assert.equal(image?.licenseName, "CC BY-SA 4.0");
    assert.equal(image?.licenseUrl, FULL.license_url);
  });
});

test("CC0 and public-domain marks are not mislabelled as 'CC CC0'", async () => {
  await withStubbedFetch(
    reply([{ ...FULL, license: "cc0", license_version: "1.0" }]),
    async () => {
      assert.equal((await fetchStockImage("x"))?.licenseName, "CC0 1.0");
    },
  );
  await withStubbedFetch(
    reply([{ ...FULL, license: "pdm", license_version: undefined }]),
    async () => {
      assert.equal((await fetchStockImage("x"))?.licenseName, "PDM");
    },
  );
});

test("an image we cannot fully credit is refused", async () => {
  // Each of these is a licence condition we could not meet, so the cover is unusable.
  for (const missing of [
    "creator",
    "foreign_landing_url",
    "license",
    "license_url",
    "url",
  ] as const) {
    const broken: Record<string, unknown> = { ...FULL };
    delete broken[missing];
    await withStubbedFetch(reply([broken]), async () => {
      assert.equal(
        await fetchStockImage("engineering"),
        null,
        `accepted a result with no ${missing}`,
      );
    });
  }
});

test("a non-https image is refused, because the CSP would drop it anyway", async () => {
  await withStubbedFetch(
    reply([{ ...FULL, url: "http://insecure.test/a.jpg", thumbnail: undefined }]),
    async () => {
      assert.equal(await fetchStockImage("engineering"), null);
    },
  );
  await withStubbedFetch(
    reply([{ ...FULL, url: "not a url", thumbnail: undefined }]),
    async () => {
      assert.equal(await fetchStockImage("engineering"), null);
    },
  );
});

test("an uncreditable first result is skipped, not treated as 'no image'", async () => {
  // The real failure this fixes: searching "bell test" returned 240 results whose FIRST
  // row had no creator. Asking for one row made that look like an empty search.
  const page = [
    { ...FULL, creator: undefined }, // cannot credit
    { ...FULL, license_url: undefined }, // cannot name the licence
    { ...FULL, url: "http://insecure.test/a.jpg", thumbnail: undefined }, // CSP would drop
    { ...FULL, creator: "Third Time Lucky" }, // usable
  ];
  await withStubbedFetch(reply(page), async () => {
    const image = await fetchStockImage("bell test");
    assert.equal(image?.authorName, "Third Time Lucky");
  });
});

test("a page of entirely uncreditable results still yields nothing", async () => {
  const page = [
    { ...FULL, creator: undefined },
    { ...FULL, license: undefined },
  ];
  // Both the original query and the one-word retry return the same unusable page.
  await withStubbedFetch(reply(page), async () => {
    assert.equal(await fetchStockImage("bell test"), null);
  });
});

test("a multi-word query that finds nothing retries with the first word", async () => {
  // "engineering career" AND-s to zero results even though "engineering" has plenty.
  const seen: string[] = [];
  const stub = (async (input: URL | string) => {
    const q = new URL(String(input)).searchParams.get("q") ?? "";
    seen.push(q);
    const results = q === "engineering" ? [FULL] : [];
    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  await withStubbedFetch(stub, async () => {
    const image = await fetchStockImage("engineering career");
    assert.equal(image?.authorName, "Ada Lovelace", "the retry should have found one");
    assert.deepEqual(seen, ["engineering career", "engineering"]);
  });
});

test("the retry happens at most once, so a miss costs two calls not N", async () => {
  let calls = 0;
  const stub = (async () => {
    calls++;
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  await withStubbedFetch(stub, async () => {
    assert.equal(await fetchStockImage("one two three"), null);
    assert.equal(calls, 2, `expected 2 requests, made ${calls}`);
  });
});

test("a single-word query is not retried against itself", async () => {
  let calls = 0;
  const stub = (async () => {
    calls++;
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  await withStubbedFetch(stub, async () => {
    assert.equal(await fetchStockImage("engineering"), null);
    assert.equal(calls, 1, "a one-word query has nothing to narrow to");
  });
});

test("an empty query never becomes a request", async () => {
  let called = false;
  const stub = (async () => {
    called = true;
    throw new Error("should not have been called");
  }) as unknown as typeof fetch;

  await withStubbedFetch(stub, async () => {
    assert.equal(await fetchStockImage("   "), null);
    assert.equal(called, false);
  });
});

test("STOCK_IMAGES_DISABLED=1 stops every outbound request", async () => {
  const previous = process.env.STOCK_IMAGES_DISABLED;
  process.env.STOCK_IMAGES_DISABLED = "1";

  let called = false;
  const stub = (async () => {
    called = true;
    throw new Error("called out while disabled");
  }) as unknown as typeof fetch;

  try {
    await withStubbedFetch(stub, async () => {
      assert.equal(stockImagesEnabled(), false);
      assert.equal(await fetchStockImage("engineering"), null);
      assert.equal(called, false, "a request was made while disabled");
    });
  } finally {
    if (previous === undefined) delete process.env.STOCK_IMAGES_DISABLED;
    else process.env.STOCK_IMAGES_DISABLED = previous;
  }
});

test("a failing or malformed response yields no cover, never an error", async () => {
  const cases: [string, typeof fetch][] = [
    [
      "429 rate limited",
      (async () => new Response("slow down", { status: 429 })) as unknown as typeof fetch,
    ],
    [
      "bad JSON",
      (async () => new Response("not json", { status: 200 })) as unknown as typeof fetch,
    ],
    [
      "network error",
      (async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    ],
    ["no results", reply([])],
  ];

  for (const [label, stub] of cases) {
    await withStubbedFetch(stub, async () => {
      assert.equal(
        await fetchStockImage("engineering"),
        null,
        `${label} must be soft`,
      );
    });
  }
});
