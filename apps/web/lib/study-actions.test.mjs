import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAppModule } from "./test-loader.mjs";

function client(rows, user = { id: "alice" }) {
  const queries = [];
  const writes = [];
  let writeError = null;
  return {
    queries, writes, setWriteError: error => { writeError = error; },
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      const query = { table, filters: [], columns: "" };
      queries.push(query);
      const builder = {
        select(columns) { query.columns = columns; return builder; },
        eq(key, value) { query.filters.push([key, value]); return builder; },
        order() { return builder; },
        async range(from, to) { const data = rows[table] ?? []; return { data: data.slice(from, to + 1), error: null, count: data.length }; },
        upsert(payload, options) { writes.push({ table, payload, options }); return builder; },
        async single() { return { data: writeError ? null : { card_id: writes.at(-1).payload.card_id }, error: writeError }; },
      };
      return builder;
    },
  };
}

test("one study warmup fetches all levels with progress restricted to the signed-in user", async () => {
  const db = client({ vocabulary: [{ id: "1", level: "n5", kanji: "猫" }, { id: "2", level: "n4", kanji: "犬" }], user_card_progress: [] });
  const actions = loadAppModule("app/actions/study.ts", { "@/utils/supabase/server": { createClient: async () => db } });
  const data = await actions.getStudySnapshot("ja-en", -600);
  assert.equal(data.userId, "alice");
  assert.deepEqual(data.vocabulary.map(row => row.level), ["n5", "n4"]);
  assert.equal(db.queries.length, 2);
  assert.deepEqual(db.queries.find(query => query.table === "user_card_progress").filters, [["user_id", "alice"]]);
  assert.deepEqual(db.queries.find(query => query.table === "vocabulary").filters, []);
});

test("save retries upsert the same SM-2 result and verify the stored row", async () => {
  const db = client({});
  const actions = loadAppModule("app/actions/study.ts", { "@/utils/supabase/server": { createClient: async () => db } });
  const state = { repetition: 0, interval: 1, ease_factor: 2.1 };
  const first = await actions.saveCardProgress("猫", "good", state, "ja-en", -600);
  const second = await actions.saveCardProgress("猫", "good", state, "ja-en", -600);
  assert.deepEqual(first, { repetition: 1, interval: 5, ease_factor: 2.1 });
  assert.deepEqual(second, first);
  assert.equal(db.writes[0].payload.card_id, "ja-en:猫");
  assert.equal(db.writes[0].payload.user_id, "alice");
  assert.deepEqual(db.writes[0].options, { onConflict: "user_id,card_id" });
  assert.equal(db.queries[0].columns, "card_id");
});

test("a rejected database write cannot be mistaken for a saved answer", async () => {
  const db = client({});
  db.setWriteError({ code: "42501", message: "Permission denied" });
  const actions = loadAppModule("app/actions/study.ts", { "@/utils/supabase/server": { createClient: async () => db } });
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(actions.saveCardProgress("猫", "good", { repetition: 0, interval: 1, ease_factor: 2.1 }), /could not be saved/);
  } finally { console.error = originalError; }
});

test("a retry cannot write the original learner's answer into a switched account", async () => {
  const db = client({}, { id: "bob" });
  const actions = loadAppModule("app/actions/study.ts", { "@/utils/supabase/server": { createClient: async () => db } });
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(actions.saveCardProgress("猫", "good", { repetition: 7, interval: 5, ease_factor: 2.1 }, "ja-en", 0, "alice"), /account changed/);
    assert.equal(db.writes.length, 0);
  } finally { console.error = originalError; }
});
