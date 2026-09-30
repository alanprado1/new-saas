import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAppModule } from "./test-loader.mjs";

const { playBase64Audio } = loadAppModule("components/StudyCard.tsx", {}, "\nexport { playBase64Audio };\n");

async function play(channels) {
  let stopTime;
  let source;
  const listeners = new Set();
  const ctx = {
    currentTime: 0, state: "running", destination: {},
    decodeAudioData: async () => ({ duration: channels[0].length / 1000, sampleRate: 1000, length: channels[0].length, numberOfChannels: channels.length, getChannelData: i => channels[i] }),
    createGain: () => ({ connect() {}, disconnect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {} } }),
    createBufferSource: () => (source = { connect() {}, disconnect() {}, start() {}, stop(time) { stopTime = time; queueMicrotask(() => source.onended?.()); } }),
    addEventListener: (_, cb) => listeners.add(cb), removeEventListener: (_, cb) => listeners.delete(cb),
  };
  await playBase64Audio("AA==", ctx);
  return { stopTime, listeners };
}

test("study audio releases playback after speech instead of the silent file tail", async () => {
  const samples = new Float32Array(2000);
  samples.fill(0.1, 0, 500);
  const { stopTime } = await play([samples]);
  assert.ok(stopTime >= 0.5 && stopTime < 0.6, `Playback stayed locked until ${stopTime}s`);
});

test("study audio retains quiet speech and sound in either stereo channel", async () => {
  const left = new Float32Array(2000);
  const right = new Float32Array(2000);
  left.fill(0.1, 0, 500);
  right.fill(0.001, 1400, 1500);
  const { stopTime } = await play([left, right]);
  assert.ok(stopTime >= 1.5 && stopTime < 1.6, `Quiet ending was cut or silence retained: ${stopTime}`);
});

test("finished study audio removes its context listener", async () => {
  const { listeners } = await play([new Float32Array(500).fill(0.1)]);
  assert.equal(listeners.size, 0);
});
