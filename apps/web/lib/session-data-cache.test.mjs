import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAppModule } from "./test-loader.mjs";

const { SessionDataCache } = loadAppModule("lib/session-data-cache.ts");
const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key), key: i => [...data.keys()][i], get length() { return data.size; } };
};

test("warm levels and repeated visits share one request", async () => {
  const cache = new SessionDataCache(() => storage());
  let calls = 0;
  const fetcher = async () => { calls++; return { cards: ["猫"] }; };
  const [first, second] = await Promise.all([cache.load("alice:ja:today", fetcher), cache.load("alice:ja:today", fetcher)]);
  assert.equal(first, second);
  await cache.load("alice:ja:today", fetcher);
  assert.equal(calls, 1);
});

test("browser reload restores cached data without refetching", async () => {
  const store = storage();
  const first = new SessionDataCache(() => store);
  await first.load("alice:ja:today", async () => ({ studied: 4 }));
  const reopened = new SessionDataCache(() => store);
  const value = await reopened.load("alice:ja:today", async () => { throw new Error("Should use browser cache"); });
  assert.deepEqual(value, { studied: 4 });
  assert.equal(reopened.get("bob:ja:today"), null);
  assert.equal(reopened.get("alice:ja:tomorrow"), null);
});

test("stale data stays visible during refresh and a failed refresh", async () => {
  let now = 0;
  const cache = new SessionDataCache(() => storage(), () => now);
  await cache.load("level", async () => ({ studied: 4 }));
  now = 360_000;
  await assert.rejects(cache.load("level", async () => {
    assert.deepEqual(cache.get("level"), { studied: 4 });
    throw new Error("Offline");
  }));
  assert.deepEqual(cache.get("level"), { studied: 4 });
  assert.deepEqual(await cache.load("level", async () => ({ studied: 5 })), { studied: 5 });
});

test("an old refresh cannot overwrite a newly saved rating", async () => {
  const cache = new SessionDataCache(() => storage());
  cache.set("level", { studied: 4 });
  let resolve;
  const refresh = cache.load("level", () => new Promise(done => { resolve = done; }), true);
  await Promise.resolve();
  cache.set("level", { studied: 5 });
  resolve({ studied: 4 });
  await refresh;
  assert.deepEqual(cache.get("level"), { studied: 5 });
});

test("sign-out clears persisted progress and ignores requests already running", async () => {
  const store = storage();
  const cache = new SessionDataCache(() => store);
  let resolve;
  const pending = cache.load("alice", () => new Promise(done => { resolve = done; }));
  await Promise.resolve();
  cache.clear();
  resolve({ studied: 6 });
  await pending;
  assert.equal(cache.get("alice"), null);
  assert.equal(store.length, 0);
});

test("blocked browser storage still permits memory caching", async () => {
  const cache = new SessionDataCache(() => { throw new Error("Storage blocked"); });
  await cache.load("level", async () => ({ studied: 2 }));
  assert.deepEqual(cache.get("level"), { studied: 2 });
});

test("overlapping updates from another tab finish with the latest progress", async () => {
  const cache = new SessionDataCache(() => storage());
  cache.set("level", { studied: 0 });
  let resolve;
  let calls = 0;
  const fetcher = () => {
    calls++;
    return calls === 1 ? new Promise(done => { resolve = done; }) : Promise.resolve({ studied: 2 });
  };
  cache.markStale("level");
  const first = cache.load("level", fetcher, true);
  await Promise.resolve();
  cache.markStale("level");
  const second = cache.load("level", fetcher, true);
  resolve({ studied: 1 });
  await Promise.all([first, second]);
  assert.deepEqual(cache.get("level"), { studied: 2 });
});

test("an external update after a local save during refresh still gets refreshed", async () => {
  const cache = new SessionDataCache(() => storage());
  cache.set("level", { studied: 0 });
  let resolve;
  let calls = 0;
  const fetcher = () => ++calls === 1 ? new Promise(done => { resolve = done; }) : Promise.resolve({ studied: 2 });
  const pending = cache.load("level", fetcher, true);
  await Promise.resolve();
  cache.set("level", { studied: 1 });
  cache.markStale("level");
  const external = cache.load("level", fetcher, true);
  resolve({ studied: 0 });
  await Promise.all([pending, external]);
  assert.deepEqual(cache.get("level"), { studied: 2 });
  assert.equal(cache.isFresh("level"), true);
});
