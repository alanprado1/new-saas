import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAllPages } from "./load-all-pages.ts";

test("loads every row when the server caps each response", async () => {
  const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const ranges = [];
  const result = await loadAllPages(async (from, to) => {
    ranges.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + 300)), error: null, count: rows.length };
  });

  assert.deepEqual(result, rows);
  assert.deepEqual(ranges, [[0, 499], [300, 599], [600, 899], [900, 1199], [1200, 1200]]);
});

test("fails when a page is incomplete instead of displaying false counts", async () => {
  await assert.rejects(
    loadAllPages(async (from) => ({
      data: from === 0 ? [{ id: 1 }] : [], error: null, count: 2,
    })),
    /incomplete/i,
  );
});

test("loads a short first page when the server cap is smaller than the requested range", async () => {
  const rows = Array.from({ length: 400 }, (_, id) => ({ id }));
  const result = await loadAllPages(async (from, to) => ({
    data: rows.slice(from, Math.min(to + 1, from + 300)), error: null, count: rows.length,
  }));
  assert.deepEqual(result, rows);
});
