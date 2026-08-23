import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";

function assetResponse(requests) {
  return {
    ASSETS: {
      fetch: async (request) => {
        const url = new URL(request.url);
        requests.push(url.pathname + url.search);
        if (url.pathname === "/index.html") return new Response("app", { status: 200 });
        if (url.pathname === "/release.json") return new Response("{}", { status: 200 });
        return new Response("missing", { status: 404 });
      },
    },
  };
}

test("falls back to the app shell for an unknown browser route", async () => {
  const requests = [];
  const response = await worker.fetch(
    new Request("https://example.test/dashboard?source=demo", {
      headers: { accept: "text/html" },
    }),
    assetResponse(requests),
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "app");
  assert.deepEqual(requests, ["/dashboard?source=demo", "/index.html"]);
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.equal(response.headers.get("Content-Security-Policy"), "frame-ancestors 'none';");
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const request of [
    new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
    new Request("https://example.test/dashboard", { method: "POST", headers: { accept: "text/html" } }),
  ]) {
    const requests = [];
    const response = await worker.fetch(request, assetResponse(requests));
    assert.equal(response.status, 404);
    assert.equal(requests.length, 1);
  }
});

test("marks release provenance as non-cacheable", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/release.json"),
    assetResponse([]),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
});
