import assert from "node:assert/strict";
import { test } from "node:test";
import { WordAudioSession, clearWordAudioSession, getWordAudioSession, retainWordAudioForPath } from "./word-audio-session.ts";

globalThis.window = {};

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("a requested late word jumps ahead of the remaining background queue", async () => {
  const started = [];
  const resolvers = [];
  const session = new WordAudioSession("lesson-a", item => new Promise(resolve => {
    started.push(item.key);
    resolvers.push(() => resolve(item.key));
  }));
  const items = ["first", "middle", "last"].map(key => ({ key, text: key, reading: key, provider: "voicevox", voice: 1 }));
  session.setItems(items);
  assert.deepEqual(started, ["first"]);
  const wanted = session.request(items[2]);
  resolvers.shift()();
  await tick();
  assert.deepEqual(started, ["first", "last"]);
  resolvers.shift()();
  assert.equal(await wanted, "last");
  await tick();
  assert.deepEqual(started, ["first", "last", "middle"]);
  session.clear();
});

test("dashboard return reuses the lesson cache, another lesson clears it", async () => {
  clearWordAudioSession();
  const fetcher = async item => item.key;
  const first = getWordAudioSession("lesson-a", fetcher);
  const item = { key: "word", text: "語", reading: "ご", provider: "voicevox", voice: 1 };
  assert.equal(await first.request(item), "word");
  assert.strictEqual(getWordAudioSession("lesson-a", fetcher), first);
  assert.equal(first.get(item.key), "word");
  const second = getWordAudioSession("lesson-b", fetcher);
  assert.notStrictEqual(second, first);
  assert.equal(second.get(item.key), undefined);
  clearWordAudioSession();
});

test("dashboard navigation retains clips but study mode retires them", async () => {
  clearWordAudioSession();
  const fetcher = async item => item.key;
  const session = getWordAudioSession("lesson-a", fetcher);
  const item = { key: "word", text: "語", reading: "ご", provider: "voicevox", voice: 1 };
  await session.request(item);
  retainWordAudioForPath("/");
  assert.equal(getWordAudioSession("lesson-a", fetcher).get("word"), "word");
  retainWordAudioForPath("/study/n5/session");
  assert.equal(getWordAudioSession("lesson-a", fetcher).get("word"), undefined);
  clearWordAudioSession();
});

test("background requests wait during lesson preload and resume afterward", async () => {
  const started = [];
  const session = new WordAudioSession("lesson-a", async item => {
    started.push(item.key);
    return item.key;
  });
  session.setSuspended(true);
  session.setItems([{ key: "word", text: "語", reading: "ご", provider: "voicevox", voice: 1 }]);
  await tick();
  assert.deepEqual(started, []);
  session.setSuspended(false);
  await tick();
  assert.deepEqual(started, ["word"]);
  session.clear();
});

test("a tapped word keeps priority when the background list is refreshed", async () => {
  const started = [];
  const session = new WordAudioSession("lesson-a", async item => {
    started.push(item.key);
    return item.key;
  });
  const items = ["first", "last"].map(key => ({ key, text: key, reading: key, provider: "voicevox", voice: 1 }));
  session.setSuspended(true);
  session.setItems(items);
  const wanted = session.request(items[1]);
  session.setItems(items);
  session.setSuspended(false);
  assert.equal(await wanted, "last");
  assert.equal(started[0], "last");
  session.clear();
});
