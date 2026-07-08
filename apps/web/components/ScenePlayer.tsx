"use client";

import { useEffect, useRef, useCallback, useReducer, useState, useMemo } from "react";
import { Howl } from "howler";
import { createClient } from "@supabase/supabase-js";
import DOMPurify from "isomorphic-dompurify";
import { ensureSession, supabase as browserSupabase } from "@/lib/supabase";
import {
  DEFAULT_LEARNING_DIRECTION,
  adaptExampleForDirection,
  adaptLessonLineForDirection,
  getLanguageDirectionConfig,
  type LearningDirection,
} from "@/lib/language";

const _supabaseRT = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============================================================
// SECTION 1: TYPES
// ============================================================

export interface LessonLine {
  id: string;
  order_index: number;
  speaker: string;
  kanji: string;
  romaji: string;
  english: string;
  audio_url: string;
}

export interface StructuredContent {
  title: string;
  background_tag: string;
  vocabulary: { 
    word: string; reading: string; meaning: string; 
    example_jp: string; example_romaji: string; example_en: string;
  }[];
  grammar_points: { 
    pattern: string; explanation: string; 
    example_jp: string; example_romaji: string; example_en: string;
  }[];
}

// Separate from StructuredContent (which mirrors the AI payload) so the DB
// column can be passed cleanly alongside it without schema contamination.
export interface LessonMeta {
  background_image_url: string | null;
}

// Theme is defined here and exported so page.tsx can import it.
// This is the single source of truth for all accent-color tokens.
export interface Theme {
  name: string;
  label: string;
  accent: string;       // primary hex colour, e.g. theme.accent
  accentRgb: string;    // bare "r,g,b" for use inside rgba()
  accentMid: string;    // ~18% alpha fill
  accentLow: string;    // ~7% alpha fill (backgrounds, glows)
  accentGlow: string;   // ~35% alpha (hover box-shadows)
  cardBorder: string;   // ~40% alpha border
  gradient: string;     // page background radial gradients
}

export interface LessonProps {
  lesson_id: string;              // UUID — needed by the voice-changer API and Realtime listener
  structured_content: StructuredContent;
  background_image_url: string | null; // Supabase public URL set after image generation
  lesson_lines: LessonLine[];
  learningDirection?: LearningDirection;
  theme: Theme;                   // active theme passed from page.tsx
}

// ============================================================
// SECTION 2: STATE MACHINE
// ============================================================

type PlayerStatus =
  | "IDLE"
  | "PRELOADING"
  | "PLAYING_LINE"
  | "PAUSED"
  | "WAITING_NEXT"
  | "COMPLETED";

interface PlayerState {
  status: PlayerStatus;
  currentIndex: number;
  preloadProgress: number;
  error: string | null;
}

type PlayerAction =
  | { type: "START_PRELOAD" }
  | { type: "PRELOAD_PROGRESS"; progress: number }
  | { type: "PRELOAD_COMPLETE" }
  | { type: "PLAY_LINE"; index: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "LINE_ENDED" }
  | { type: "COMPLETE" }
  | { type: "ERROR"; message: string };

const initialState: PlayerState = {
  status: "IDLE",
  currentIndex: 0,
  preloadProgress: 0,
  error: null,
};

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "START_PRELOAD":
      return { ...state, status: "PRELOADING", preloadProgress: 0 };
    case "PRELOAD_PROGRESS":
      return { ...state, preloadProgress: action.progress };
    case "PRELOAD_COMPLETE":
      return { ...state, status: "IDLE", preloadProgress: 100 };
    case "PLAY_LINE":
      return { ...state, status: "PLAYING_LINE", currentIndex: action.index };
    case "PAUSE":
      // Accept from PLAYING_LINE *and* WAITING_NEXT — the end event fires and
      // sets WAITING_NEXT before the 400ms transition timer expires, so a pause
      // pressed in that window must still latch into PAUSED to block the advance.
      return state.status === "PLAYING_LINE" || state.status === "WAITING_NEXT"
        ? { ...state, status: "PAUSED" }
        : state;
    case "RESUME":
      return state.status === "PAUSED"
        ? { ...state, status: "PLAYING_LINE" }
        : state;
    case "LINE_ENDED":
      return { ...state, status: "WAITING_NEXT" };
    case "COMPLETE":
      return { ...state, status: "COMPLETED" };
    case "ERROR":
      return { ...state, error: action.message, status: "IDLE" };
    default:
      return state;
  }
}

// ============================================================
// SECTION 3: FURIGANA ENGINE
// Pure TypeScript port of the kuromoji algorithm.
// Requires /public/kuromoji.js + /public/dict/ to be present.
// ============================================================

declare global {
  interface Window {
    kuromoji: {
      builder: (opts: { dicPath: string }) => {
        build: (cb: (err: Error | null, tokenizer: KuromojiTokenizer) => void) => void;
      };
    };
  }
}

interface KuromojiToken {
  surface_form: string;
  reading?: string;
  pos: string;
}

interface KuromojiTokenizer {
  tokenize: (text: string) => KuromojiToken[];
}

let kuromojiScriptPromise: Promise<void> | null = null;

function loadKuromojiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Kuromoji can only load in the browser."));
  if (window.kuromoji) return Promise.resolve();

  kuromojiScriptPromise ??= new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="/kuromoji.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load /kuromoji.js")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "/kuromoji.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load /kuromoji.js"));
    document.head.appendChild(script);
  });

  return kuromojiScriptPromise;
}

function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, (m) =>
    String.fromCharCode(m.charCodeAt(0) - 0x60)
  );
}

function hasKanji(str: string): boolean {
  return /[\u4e00-\u9faf\u3400-\u4dbf]/.test(str);
}

function addFurigana(token: KuromojiToken): string {
  const surface = token.surface_form;
  const reading = token.reading;
  if (!hasKanji(surface) || !reading) return surface;

  const hira = katakanaToHiragana(reading);
  if (hira === surface) return surface;

  const surf = surface.split("");
  const read = hira.split("");

  // Strip matching trailing hiragana (okurigana suffix: 食べる → べる)
  let suffix = "";
  while (
    surf.length > 0 &&
    read.length > 0 &&
    /^[\u3041-\u3096]$/.test(surf[surf.length - 1]) &&
    surf[surf.length - 1] === read[read.length - 1]
  ) {
    suffix = surf.pop()! + suffix;
    read.pop();
  }

  // Strip matching leading hiragana (prefix: お金 → お)
  let prefix = "";
  while (
    surf.length > 0 &&
    read.length > 0 &&
    /^[\u3041-\u3096]$/.test(surf[0]) &&
    surf[0] === read[0]
  ) {
    prefix += surf.shift()!;
    read.shift();
  }

  const kanjiPart   = surf.join("");
  const readingPart = read.join("");

  if (!kanjiPart || !readingPart) {
    return `<ruby>${surface}<rt>${hira}</rt></ruby>`;
  }
  return `${prefix}<ruby>${kanjiPart}<rt>${readingPart}</rt></ruby>${suffix}`;
}

function buildFuriganaHTML(
  text: string,
  tokenizer: KuromojiTokenizer | null,
  showFurigana: boolean
): string {
  const html = tokenizer
    ? tokenizer
        .tokenize(text)
        .map((token) => (showFurigana ? addFurigana(token) : token.surface_form))
        .join("")
    : text;

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["ruby", "rt"],
    ALLOWED_ATTR: [],
  });
}


// ============================================================
// SECTION 4: HELPERS
// ============================================================

function getExpression(kanji: string): "thinking" | "surprised" | "neutral" {
  if (/[?？]/.test(kanji)) return "thinking";
  if (/[!！]/.test(kanji)) return "surprised";
  return "neutral";
}

// Returns a CSS backgroundImage value from a Supabase public URL.
// Falls back to a dark solid so the scene card is never empty while
// the image is still being generated (typically 5–15s after lesson creation).
function getBackgroundStyle(imageUrl: string | null): string {
  if (imageUrl) return `url('${imageUrl}')`;
  return "none"; // scene card shows its own dark background until the image arrives
}

function hasJapaneseText(value?: string | null): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value ?? "");
}

function normalizeComparableText(value: string): string {
  return value.replace(/[\s.,!?。、“”‘’'"!！?？、]/g, "").toLowerCase();
}

// ── SUBTITLE CHUNKER ────────────────────────────────────────────
// Splits a Japanese sentence into display chunks at natural pause points.
//
// Split triggers (kept with the preceding chunk):
//   。full stop   、comma      ！exclamation
//   ？question    …ellipsis (U+2026)   ...ASCII ellipsis
//
// After raw splitting a balancing loop iterates until no chunk is shorter
// than MIN_CHUNK, merging each short chunk into whichever neighboring chunk
// is currently shorter — UNLESS doing so would push the combined length
// above MAX_CHUNK, in which case the merge is skipped and the short chunk
// is kept as-is. It is better to show a 9-char chunk than a 30-char block.
//
// Lines at or below SPLIT_THRESHOLD are returned as-is.
const MIN_CHUNK       = 11; // prefer chunks at least this long
const MAX_CHUNK       = 22; // never merge if combined length exceeds this
const SPLIT_THRESHOLD = 18; // skip splitting for very short lines

const SPLIT_TRIGGERS = new Set(["。", "、", "！", "？", "…"]);

function chunkJapaneseLine(text: string): string[] {
  if (text.length <= SPLIT_THRESHOLD) return [text];

  // ── Step 1: raw split at punctuation boundaries ──────────────
  const raw: string[] = [];
  let last = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] === "." && text.slice(i, i + 3) === "...") {
      raw.push(text.slice(last, i + 3));
      last = i + 3;
      i += 3;
      continue;
    }
    if (SPLIT_TRIGGERS.has(text[i])) {
      raw.push(text.slice(last, i + 1));
      last = i + 1;
    }
    i++;
  }
  if (last < text.length) raw.push(text.slice(last));

  const segs = raw.filter(s => s.length > 0);
  if (segs.length <= 1) return [text];

  // ── Step 2: balance — merge short chunks, respecting MAX_CHUNK ─
  // Each iteration finds the first chunk below MIN_CHUNK and tries to merge
  // it into its shorter neighbor. If BOTH merges would exceed MAX_CHUNK the
  // chunk is left alone (marked "exempt") and the scan continues.
  const out = [...segs];
  const exempt = new Set<number>(); // indices of chunks we've decided to keep short
  let changed = true;
  while (changed && out.length > 1) {
    changed = false;
    for (let j = 0; j < out.length; j++) {
      if (out[j].length >= MIN_CHUNK) continue;
      if (exempt.has(j)) continue;

      const leftLen  = j > 0              ? out[j - 1].length : Infinity;
      const rightLen = j < out.length - 1 ? out[j + 1].length : Infinity;

      // Prefer the shorter neighbor; fall back to the other if the preferred
      // merge would breach MAX_CHUNK.
      const preferLeft = leftLen <= rightLen;
      const canMergeLeft  = j > 0              && out[j - 1].length + out[j].length <= MAX_CHUNK;
      const canMergeRight = j < out.length - 1 && out[j].length + out[j + 1].length <= MAX_CHUNK;

      if (preferLeft ? canMergeLeft : canMergeRight) {
        if (preferLeft) {
          out[j - 1] += out[j];
        } else {
          out[j + 1] = out[j] + out[j + 1];
        }
        out.splice(j, 1);
        // Rebuild exempt set with adjusted indices after splice
        const adjusted = new Set<number>();
        exempt.forEach(idx => { if (idx < j) adjusted.add(idx); else if (idx > j) adjusted.add(idx - 1); });
        exempt.clear(); adjusted.forEach(idx => exempt.add(idx));
        changed = true;
        break;
      } else if (!preferLeft ? canMergeLeft : canMergeRight) {
        // Preferred direction blocked by MAX_CHUNK — try the other direction
        if (!preferLeft) {
          out[j - 1] += out[j];
        } else {
          out[j + 1] = out[j] + out[j + 1];
        }
        out.splice(j, 1);
        const adjusted = new Set<number>();
        exempt.forEach(idx => { if (idx < j) adjusted.add(idx); else if (idx > j) adjusted.add(idx - 1); });
        exempt.clear(); adjusted.forEach(idx => exempt.add(idx));
        changed = true;
        break;
      } else {
        // Both directions would exceed MAX_CHUNK. 
        // Forgiving merge: If the chunk is extremely short (<= 5 characters), 
        // force-merge it with the shorter neighbor anyway to avoid orphaned fragments like "まあ、".
        if (out[j].length <= 5) {
          if (preferLeft) {
            out[j - 1] += out[j];
          } else {
            out[j + 1] = out[j] + out[j + 1];
          }
          out.splice(j, 1);
          const adjusted = new Set<number>();
          exempt.forEach(idx => { if (idx < j) adjusted.add(idx); else if (idx > j) adjusted.add(idx - 1); });
          exempt.clear(); adjusted.forEach(idx => exempt.add(idx));
          changed = true;
          break;
        } else {
          // Chunk is not extremely short, so keep it as-is
          exempt.add(j);
        }
      }
    }
  }

  return out.length > 1 ? out : [text];
}

// ── WESTERN LINE CHUNKER ────────────────────────────────────────
// Splits a romaji or English string into exactly `count` chunks so each
// chunk is displayed in sync with the corresponding Japanese kanji chunk.
//
// Strategy: prefer splitting at sentence ends (. ! ?) then clause boundaries
// (, ; :) then word boundaries (space). If no good split point exists at the
// exact target character position, we search outward in a small window.
// Always produces exactly `count` non-empty pieces — falls back to evenly
// spaced word splits or a single repeated string if the text is very short.
function chunkWesternLine(text: string, count: number): string[] {
  if (count <= 1 || !text.trim()) return [text];

  const words = text.split(" ").filter(w => w.length > 0);
  if (words.length <= count) {
    // Fewer words than chunks — pad by repeating last word group per chunk.
    // In practice this only happens for very short lines that shouldn't have
    // been chunked in the first place, but we guard defensively.
    const result: string[] = [];
    const chunkSize = Math.ceil(words.length / count);
    for (let i = 0; i < count; i++) {
      const slice = words.slice(i * chunkSize, (i + 1) * chunkSize);
      result.push(slice.length > 0 ? slice.join(" ") : words[words.length - 1]);
    }
    return result;
  }

  // Find `count - 1` split points dividing the text into `count` segments.
  // Each target is a character-fraction boundary, same proportions as kanji.
  const totalChars = text.length;
  const splitPoints: number[] = [];

  for (let i = 1; i < count; i++) {
    const targetChar = Math.round((i / count) * totalChars);

    // Search window: look up to 15% of total length in each direction for a
    // preferred split character. Prioritise: [.!?] > [,;:] > [ ] > hard cut.
    const window = Math.max(8, Math.round(totalChars * 0.15));
    let best = targetChar;
    let bestPriority = 4; // 4 = hard cut (worst)

    for (let delta = 0; delta <= window; delta++) {
      for (const dir of [1, -1]) {
        const pos = targetChar + delta * dir;
        if (pos <= 0 || pos >= totalChars) continue;
        const ch = text[pos - 1]; // char just before the cut
        const priority =
          /[.!?]/.test(ch) ? 1 :
          /[,;:]/.test(ch) ? 2 :
          ch === " "       ? 3 : 4;
        if (priority < bestPriority) {
          bestPriority = priority;
          best = pos;
          if (priority === 1) break; // sentence end — can't do better
        }
      }
      if (bestPriority === 1) break;
    }

    // Snap to nearest word boundary if we landed mid-word.
    const spaceAfter  = text.indexOf(" ", best);
    const spaceBefore = text.lastIndexOf(" ", best);
    if (bestPriority === 4) {
      // Hard cut — snap to nearest word boundary to avoid cutting mid-word.
      const distAfter  = spaceAfter  >= 0 ? spaceAfter  - best : Infinity;
      const distBefore = spaceBefore >= 0 ? best - spaceBefore : Infinity;
      best = distAfter <= distBefore && spaceAfter >= 0 ? spaceAfter : spaceBefore >= 0 ? spaceBefore : best;
    }

    // If best landed mid-ellipsis ("..." or ".."), advance past all consecutive
    // dots so the next chunk doesn't open with stray "." or ".." characters.
    // Also consume one trailing space so chunks don't need trimming to start clean.
    while (best < totalChars && text[best] === ".") best++;
    if (best < totalChars && text[best] === " ") best++;

    splitPoints.push(Math.max(1, Math.min(best, totalChars - 1)));
  }

  // Deduplicate and sort split points, then slice.
  const unique = [...new Set(splitPoints)].sort((a, b) => a - b);
  const chunks: string[] = [];
  let prev = 0;
  for (const pt of unique) {
    const slice = text.slice(prev, pt).trim();
    if (slice) chunks.push(slice);
    prev = pt;
  }
  const tail = text.slice(prev).trim();
  if (tail) chunks.push(tail);

  // If we ended up with fewer chunks than requested (e.g. very short text),
  // pad by duplicating the last chunk so indexing is always safe.
  while (chunks.length < count) chunks.push(chunks[chunks.length - 1] ?? text);

  return chunks;
}

// ============================================================
// SECTION 5: useScenePlayer HOOK
// ============================================================

function useScenePlayer(lines: LessonLine[]) {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const howlsRef            = useRef<Howl[]>([]);
  const transitionTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── SINGLE-VOICE ENFORCER ────────────────────────────────────
  // Tracks the active Howler sound ID so we can pause/resume/stop
  // the exact sound instance rather than letting Howler multiplex.
  //
  // Background: Howler's Web Audio backend can host multiple concurrent
  // sound instances on a single Howl object. Calling howl.play() on an
  // already-playing Howl spawns a *new* sound ID instead of resuming the
  // existing one, producing two overlapping audio streams. The fix is:
  //   - Store the sound ID returned by howl.play() in currentSoundIdRef.
  //   - Pass that ID to howl.pause(id) / howl.stop(id) to target exactly
  //     the one active voice.
  //   - On resume, pass the same ID to howl.play(id) — Howler resumes
  //     that specific sound rather than creating a new one.
  //   - On every new line, stop the previous line's howl entirely before
  //     starting the next one.
  const currentSoundIdRef = useRef<number | null>(null);
  const currentHowlRef    = useRef<Howl | null>(null);
  // True once the "end" event fires for the current line. Used to guard
  // resume() from replaying a line that already finished naturally — which
  // was the root cause of the double-audio bug (resume spawned a new sound
  // on the current line at the same time the transition timer fired the next).
  const lineEndedRef = useRef<boolean>(false);
  // Set to true by pause(), cleared by resume() and playLine().
  // The "end" handler checks this before scheduling the next-line transition so
  // a pause pressed in the ~400ms WAITING_NEXT window cancels the advance.
  const isPausedRef = useRef<boolean>(false);

  // ── AUTHORIZED-INDEX GUARD ───────────────────────────────────
  // Root cause of the "line 0 repeats" bug:
  //
  // Howler's howl.off("end") removes listeners registered with howl.on(),
  // but once() listeners that were already internally queued by the Web Audio
  // scheduler are NOT always cancelled — the stale callback can still fire
  // after off() is called if the audio reached its end in the Web Audio graph.
  //
  // Additionally, rapid calls to playLine(0) (React Strict Mode double-mount,
  // rewind-to-start, etc.) can register two separate "end" closures on the
  // same Howl, both of which fire and both try to advance the sequence.
  //
  // Fix: every playLine() call increments/stamps authorizedIndexRef with its
  // own index. The "end" closure snapshots the generation counter at the time
  // it was registered and exits immediately if the counter has since changed,
  // meaning another playLine() ran and "owns" the sequence now.
  //
  // This is O(1), ref-based (no React re-render), and safe across
  // pause/resume/rewind because those paths always call playLine() which
  // re-stamps the ref.
  const authorizedIndexRef = useRef<number>(-1);

  // ── PLAYBACK RATE ────────────────────────────────────────────
  // We keep BOTH a ref and a state value:
  //   playbackRateRef — read synchronously inside playLine (closure-safe, no
  //                     stale-capture risk even though playLine is memoised).
  //   playbackRate    — React state so the UI re-renders when the value changes.
  const playbackRateRef = useRef<number>(1.0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  type PitchPreservingAudioElement = HTMLAudioElement & {
    preservesPitch?: boolean;
    mozPreservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };

  type HowlWithHtml5Sounds = Howl & {
    _sounds?: Array<{ _node?: PitchPreservingAudioElement }>;
  };

  const preservePitch = useCallback((howl: Howl) => {
    const sounds = (howl as HowlWithHtml5Sounds)._sounds ?? [];
    sounds.forEach((sound) => {
      const node = sound._node;
      if (!node) return;
      node.preservesPitch = true;
      node.mozPreservesPitch = true;
      node.webkitPreservesPitch = true;
    });
  }, []);

  // changeSpeed — update rate mid-sentence without restarting audio.
  // Howler's .rate(value, soundId) changes the playback speed of a live sound
  // instance immediately.  We also update the ref so the next playLine() call
  // picks up the new rate without needing to rebuild the callback.
  const changeSpeed = useCallback((rate: number) => {
    const clamped = Math.min(2.0, Math.max(0.5, rate));
    playbackRateRef.current = clamped;
    setPlaybackRate(clamped);
    // Apply to the currently-playing sound if one exists.
    const howl = currentHowlRef.current;
    const id   = currentSoundIdRef.current;
    if (howl) {
      preservePitch(howl);
      if (id !== null) {
        howl.rate(clamped, id);
      } else {
        howl.rate(clamped);
      }
    }
  }, [preservePitch]);

  // Helper: unconditionally silence whatever is currently playing.
  const stopCurrent = useCallback(() => {
    const howl = currentHowlRef.current;
    const id   = currentSoundIdRef.current;
    if (!howl) return;
    if (id !== null) {
      howl.stop(id);
    } else {
      howl.stop();
    }
    currentHowlRef.current    = null;
    currentSoundIdRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      transitionTimerRef.current && clearTimeout(transitionTimerRef.current);
      if (seekTickRef.current) clearInterval(seekTickRef.current);
      stopCurrent();
      howlsRef.current.forEach((h) => h.unload());
    };
  }, [stopCurrent]);

  // cacheBust: when non-null, appended as ?v=<value> to every audio URL.
  //
  // WHY THIS IS NECESSARY:
  // The worker overwrites the same storage paths (e.g. lessonId/line_0.wav)
  // on every voice change. The audio_url stored in lesson_lines therefore
  // never changes between regenerations — it's the same path, same filename.
  // The browser HTTP cache (and Supabase CDN in front of Storage) see the same
  // URL and serve the previously cached response, so the old voice keeps playing
  // even though the worker successfully uploaded fresh bytes.
  //
  // Appending a unique timestamp query string forces the browser and CDN to
  // treat it as a brand-new resource and fetch the real bytes. Normal first-time
  // loads pass cacheBust=null so their URLs stay clean.
  const preloadAudio = useCallback(async (cacheBust: string | null = null) => {
    dispatch({ type: "START_PRELOAD" });
    howlsRef.current.forEach((h) => h.unload());
    howlsRef.current = [];
    let loaded = 0;

    try {
      const howls = await Promise.all(
        lines.map(
          (line) =>
            new Promise<Howl>((resolve, reject) => {
              // Append cache-bust param when reloading after a voice change.
              // The param value is a timestamp so every voice swap gets a unique URL.
              const src = cacheBust
                ? `${line.audio_url}?v=${cacheBust}`
                : line.audio_url;

              const howl = new Howl({
                src: [src],
                preload: true,
                html5: true,
                format: ["wav"],
                onload: () => {
                  preservePitch(howl);
                  loaded++;
                  dispatch({
                    type: "PRELOAD_PROGRESS",
                    progress: Math.round((loaded / lines.length) * 100),
                  });
                  resolve(howl);
                },
                onloaderror: (_id, err) => {
                  reject(new Error(`Audio load failed for line ${line.order_index}: ${err}`));
                },
              });
            })
        )
      );
      howlsRef.current = howls;
      dispatch({ type: "PRELOAD_COMPLETE" });
    } catch (err) {
      dispatch({
        type: "ERROR",
        message: err instanceof Error ? err.message : "Audio preload failed.",
      });
    }
  }, [lines]);

  const playLine = useCallback(
    (index: number) => {
      const howl = howlsRef.current[index];
      if (!howl) return;

      // ── Single-voice enforcement ──────────────────────────────
      // Stop whatever is currently playing BEFORE starting the new line.
      // This prevents overlap when the transition timer fires while a
      // previous "end" event handler is still in flight.
      if (currentHowlRef.current && currentHowlRef.current !== howl) {
        const prevId = currentSoundIdRef.current;
        if (prevId !== null) {
          currentHowlRef.current.stop(prevId);
        } else {
          currentHowlRef.current.stop();
        }
      }

      dispatch({ type: "PLAY_LINE", index });

      // ── Stamp the authorized index BEFORE any async work ─────
      // Any "end" closure from a previous playLine() call that is still
      // queued in the JS event loop will see its own snapshot no longer
      // matches authorizedIndexRef.current and will exit without advancing
      // the sequence. This is the primary fix for the "line 0 repeats" bug.
      authorizedIndexRef.current = index;
      const myAuthorizedIndex = index; // snapshot for this closure's lifetime

      // Reset seek tracker — new line starts at 0.
      seekPositionRef.current = 0;
      intendedSeekRef.current = 0;
      lastSeekTimeRef.current = 0;
      lineEndedRef.current    = false;
      isPausedRef.current     = false;  // starting a new line — not paused
      // Clear any existing tick interval from a previous line.
      if (seekTickRef.current) clearInterval(seekTickRef.current);

      // Strip all "end" and "play" listeners from previous session on this howl.
      // Note: off() removes howl.on() listeners reliably. For once() listeners
      // already queued by the Web Audio scheduler, the authorizedIndexRef guard
      // below provides the second line of defence.
      howl.off("end");
      howl.off("play");

      // Tick seekPositionRef forward every 100ms so rewind always
      // has an accurate current position to subtract from.
      // The timestamp guard (lastSeekTimeRef) prevents the tick from overwriting a
      // position that was just set by seekTo() before Web Audio has flushed it.
      howl.once("play", (soundId: number) => {
        // Guard: if another playLine() has already taken ownership, discard.
        if (authorizedIndexRef.current !== myAuthorizedIndex) return;

        // Record this specific sound instance — used by pause/resume/stop.
        preservePitch(howl);
        currentSoundIdRef.current = soundId;
        currentHowlRef.current    = howl;

        seekTickRef.current = setInterval(() => {
          const pos = howl.seek(soundId);
          if (typeof pos === "number") {
            seekPositionRef.current = pos;
            // Only sync the authoritative intended position when audio is
            // playing normally (not freshly seeked) — 500ms settle window.
            if (Date.now() - lastSeekTimeRef.current >= 500) {
              intendedSeekRef.current = pos;
            }
          }
        }, 100);
      });

      howl.once("end", () => {
        // ── Stale-closure guard ───────────────────────────────────
        // If authorizedIndexRef has been updated by a newer playLine() call
        // (e.g. rewind, rapid double-start, React Strict Mode remount),
        // this "end" callback is stale — exit without advancing the sequence.
        if (authorizedIndexRef.current !== myAuthorizedIndex) return;

        if (seekTickRef.current) clearInterval(seekTickRef.current);
        currentSoundIdRef.current = null;
        currentHowlRef.current    = null;
        lineEndedRef.current      = true;  // mark this line as naturally finished
        // If the user pressed pause in the last milliseconds of this line,
        // isPausedRef is already true. Do NOT schedule the transition —
        // resume() will call playLine(index + 1) when the user unpauses.
        if (isPausedRef.current) return;
        dispatch({ type: "LINE_ENDED" });
        // 400ms breath between lines.
        // Null the ref BEFORE the body runs so resume() can see "no timer pending".
        const timer = setTimeout(() => {
          transitionTimerRef.current = null;
          // Double-check: if pause was pressed during the 400ms gap, abort.
          if (isPausedRef.current) return;
          // Double-check: if another playLine() took ownership, abort.
          if (authorizedIndexRef.current !== myAuthorizedIndex) return;
          const nextIndex = index + 1;
          if (nextIndex < lines.length) {
            playLine(nextIndex);
          } else {
            dispatch({ type: "COMPLETE" });
          }
        }, 400);
        transitionTimerRef.current = timer;
      });

      // Apply the current playback rate so new lines start at the right speed.
      // We read from the ref (not state) to avoid a stale closure.
      preservePitch(howl);
      howl.rate(playbackRateRef.current);

      // ── Last-resort AudioContext guard ───────────────────────
      // If the context somehow fell back to "suspended" between primeAudioContext()
      // and now (common on iOS Safari when the page briefly loses focus), kick off
      // a non-awaited resume().  We do NOT await here because playLine is
      // synchronous and we don't want to delay subsequent lines — the context
      // typically resumes within a single event-loop tick on a warm path, and
      // the 50 ms settle in primeAudioContext has already covered the cold path.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const _ctx: AudioContext | undefined = (window as any).Howler?.ctx;
      if (_ctx && _ctx.state === "suspended") {
        _ctx.resume().catch(() => { /* best-effort */ });
      }

      // play() returns a sound ID — we capture it via the "play" event above
      // because play() itself is synchronous but the ID arrives in the callback.
      howl.play();
    },
    [lines.length, preservePitch, stopCurrent]
  );

  // ── PAUSE ────────────────────────────────────────────────────
  const pause = useCallback(() => {
    // Mark as paused FIRST so any in-flight "end" handler sees it before
    // it checks isPausedRef and before we clear the transition timer.
    isPausedRef.current = true;
    if (transitionTimerRef.current !== null) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (seekTickRef.current) clearInterval(seekTickRef.current);
    // Pause the exact sound instance so Howler doesn't create a new one on resume.
    // If the line already ended naturally (lineEndedRef true), currentHowlRef is
    // null — there is nothing to pause on the Howl side, which is correct.
    const howl = currentHowlRef.current;
    const id   = currentSoundIdRef.current;
    if (howl) {
      if (id !== null) {
        howl.pause(id);
      } else {
        howl.pause();
      }
    }
    dispatch({ type: "PAUSE" });
  }, []);

  // ── RESUME ───────────────────────────────────────────────────
  // CRITICAL: pass the captured sound ID to howl.play(id).
  // Without the ID, Howler spawns a brand-new sound instance on the same
  // Howl object, producing two overlapping audio streams. Passing the ID
  // resumes the paused instance instead.
  //
  // Special case — "paused at end of line":
  // If the user pressed pause right as the line finished (lineEndedRef true,
  // currentSoundIdRef null), the Howl has already ended. Calling play() with
  // no ID would start the clip from the beginning and overlap with the next
  // line. Instead we advance to the next line directly.
  const resume = useCallback(() => {
    // Kill any pending transition timer FIRST — before clearing isPausedRef.
    // This is the titanium lock: if the timer is still live when the user
    // clicks Play during WAITING_NEXT, we own the advance; the timer won't.
    if (transitionTimerRef.current !== null) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    isPausedRef.current = false;  // clear before any playLine call

    if (lineEndedRef.current) {
      // The line finished naturally while paused.
      // Two sub-cases:
      //
      //   A) Timer is still pending (transitionTimerRef.current !== null):
      //      pause() called clearTimeout but the "end" closure had already
      //      entered the JS event queue before isPausedRef was set — i.e. the
      //      timer was scheduled and clearTimeout missed it by one tick.
      //      The timer body checks isPausedRef and will return early now that
      //      we cleared it above, so we must call playLine ourselves.
      //
      //   B) Timer already fired and nulled itself (transitionTimerRef.current === null):
      //      That means the timer body ran, saw isPausedRef=true and returned.
      //      Nobody has called playLine yet — we must do it here.
      //
      // In both cases we call playLine(nextIndex). The timer body is safe because
      // it null-checks transitionTimerRef itself and isPausedRef was true when it ran.
      // Do NOT dispatch RESUME here — playLine dispatches PLAY_LINE which is correct.
      const nextIndex = state.currentIndex + 1;
      if (nextIndex < lines.length) {
        playLine(nextIndex);
      } else {
        dispatch({ type: "COMPLETE" });
      }
      return;
    }

    const howl = howlsRef.current[state.currentIndex];
    if (!howl) return;
    const id = currentSoundIdRef.current;

    // Restart the seek tick so rewind stays accurate after a resume.
    if (seekTickRef.current) clearInterval(seekTickRef.current);
    seekTickRef.current = setInterval(() => {
      const pos = id !== null ? howl.seek(id) : howl.seek();
      if (typeof pos === "number") {
        seekPositionRef.current = pos;
        if (Date.now() - lastSeekTimeRef.current >= 500) {
          intendedSeekRef.current = pos;
        }
      }
    }, 100);

    if (id !== null) {
      preservePitch(howl);
      howl.play(id);
    } else {
      preservePitch(howl);
      howl.play();
    }
    dispatch({ type: "RESUME" });
  }, [state.currentIndex, lines.length, playLine, preservePitch]);

  // ── REWIND DEBOUNCE / OVERLAP GUARD ─────────────────────────
  // Rapid rewind clicks can spawn multiple playLine() calls in quick succession,
  // each starting a new Howl sound before the previous stop() has flushed —
  // causing momentary audio overlap. We gate rewind behind a short lock:
  //   - After a rewind is processed, set the lock for REWIND_DEBOUNCE_MS.
  //   - Any click that arrives while the lock is held is silently dropped.
  //   - The lock clears automatically, so the button stays functional.
  const REWIND_DEBOUNCE_MS = 350;
  const rewindLockRef = useRef<boolean>(false);

  // ── REWIND 3s ────────────────────────────────────────────────
  // Seek position tracking uses two separate refs:
  //
  //   seekPositionRef  — updated by the 100ms tick via howl.seek().
  //                      Reflects "where the audio actually is" during normal playback.
  //
  //   intendedSeekRef  — written by seekTo() and by the tick ONLY when
  //                      no seek has occurred within the last 500ms.
  //                      This is the authoritative baseline for rewind clicks.
  //
  // Why two refs? howl.seek() (getter) returns a stale value for ~200-400ms
  // after a seek() call because Web Audio buffers the operation.  If we
  // reuse the same ref for both "current position" and "seek target", a
  // rapid second rewind click reads the stale Web-Audio position and rewinds
  // from the wrong baseline.  By keeping intendedSeekRef independent and
  // updating it from the tick only after the 500ms settle window, every
  // consecutive rewind click correctly subtracts 3s from the last intended
  // position rather than from whatever Web Audio has flushed so far.
  const seekPositionRef  = useRef<number>(0); // live audio position from howl.seek()
  const intendedSeekRef  = useRef<number>(0); // authoritative seek target for rewind
  const lastSeekTimeRef  = useRef<number>(0); // timestamp of last seekTo() call
  const seekTickRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  const seekTo = useCallback((howl: Howl, seconds: number) => {
    const clamped = Math.max(0, seconds);
    // Update BOTH refs immediately so the next rewind click has the right baseline.
    seekPositionRef.current = clamped;
    intendedSeekRef.current = clamped;
    lastSeekTimeRef.current = Date.now();
    const id = currentSoundIdRef.current;
    if (id !== null) {
      howl.seek(clamped, id);
    } else {
      howl.seek(clamped);
    }
  }, []);

  const rewind = useCallback(() => {
    // ── Debounce guard — drop rapid repeat clicks ─────────────
    if (rewindLockRef.current) return;
    rewindLockRef.current = true;
    setTimeout(() => { rewindLockRef.current = false; }, REWIND_DEBOUNCE_MS);

    const howl = howlsRef.current[state.currentIndex];
    if (!howl) return;

    // ── Always stop the current sound before seeking/switching ─
    // This is the core overlap fix: if the user clicks rewind while a line
    // is playing, stop() terminates it before we either seek or call playLine().
    // Without this, seekTo() can leave the old sound running in parallel with
    // the re-started one for the ~200 ms it takes Web Audio to flush the seek.
    stopCurrent();

    // Clear the transition timer so it can't fire the *next* line
    // concurrently with what we're about to play.
    if (transitionTimerRef.current !== null) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    const currentPos = seekPositionRef.current;

    if (currentPos > 1.5) {
      // More than 1.5 s in — restart the current line from the beginning.
      // playLine() will call howl.play() on a fresh, stopped Howl.
      playLine(state.currentIndex);
    } else {
      // Right at the start — go back to the previous line.
      const prevIndex = Math.max(0, state.currentIndex - 1);
      playLine(prevIndex);
    }
  }, [state.currentIndex, stopCurrent, playLine, seekPositionRef]);

  // ── START LOCK ───────────────────────────────────────────────
  // Prevents start() from being invoked twice concurrently (double-click,
  // React Strict Mode double-invoke of the onClick handler, etc.).
  // Without this, two preloadAudio() calls run in parallel and both fire
  // requestAnimationFrame(() => playLine(0)), registering two "end" listeners
  // on howl[0] — which both advance the sequence when line 0 finishes.
  const startLockRef = useRef<boolean>(false);

  // ── AUDIO CONTEXT PRIMER ─────────────────────────────────────
  // Resumes the shared Web Audio context (which browsers suspend until a
  // user-gesture chain explicitly unlocks it) and waits until the state
  // flips to "running" before returning.  Called once from start() — right
  // after preloadAudio() resolves and before the very first playLine() call.
  //
  // Story playback uses HTML5 audio so browser pitch preservation can keep
  // speed changes natural. This unlock step is harmless when Howler exposes
  // a shared AudioContext, and protects browsers that still suspend it until
  // a user gesture.
  const primeAudioContext = useCallback(async (): Promise<void> => {
    // Howler exposes the shared AudioContext via Howler.ctx once at least
    // one Howl has been constructed (which preloadAudio() guarantees above).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx: AudioContext | undefined = (window as any).Howler?.ctx;
    if (!ctx) return;

    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        // resume() can throw if called in a non-user-gesture context on
        // some browsers.  We swallow the error — playback may still work
        // and there is nothing useful we can do here.
      }
    }

    // Small settle window: even after ctx.resume() resolves the underlying
    // audio hardware buffer may not yet be fully primed.  50 ms is enough
    // to prevent the "first syllable clipped" artefact on mobile Chrome/Safari
    // without being perceptible as a delay to the user.
    await new Promise<void>(resolve => setTimeout(resolve, 50));
  }, []);

  const start = useCallback(async () => {
    if (startLockRef.current) return;
    startLockRef.current = true;
    try {
      await ensureSession();
      await preloadAudio();
      await primeAudioContext();
      setTimeout(() => { playLine(0); }, 100);  // HTML5 cold-start delay
    } catch (err) {
      console.error("Start failed:", err);
      window.location.href = "/login";
    } finally {
      setTimeout(() => { startLockRef.current = false; }, 500);
    }
  }, [preloadAudio, primeAudioContext, playLine]);

  // cacheBust: pass Date.now().toString() when restarting after a voice change
  // so the browser fetches fresh bytes instead of serving cached old-voice audio.
  const restart = useCallback(async (cacheBust: string | null = null) => {
    // Cleanup always runs — even if auth fails below.
    transitionTimerRef.current && clearTimeout(transitionTimerRef.current);
    if (seekTickRef.current) clearInterval(seekTickRef.current);
    stopCurrent();
    try {
      await ensureSession();
      await preloadAudio(cacheBust);
      // Re-prime the context: after a voice-change reload the context may have
      // been suspended again (e.g. tab was backgrounded).
      await primeAudioContext();
      setTimeout(() => { playLine(0); }, 100);
    } catch (err) {
      console.error("Restart failed:", err);
      window.location.href = "/login";
    }
  }, [preloadAudio, primeAudioContext, playLine, stopCurrent]);

  // Expose real Howl duration (seconds) for a given line index.
  // Available after preload completes. Returns 0 if not yet loaded.
  const getDuration = useCallback((index: number): number => {
    return howlsRef.current[index]?.duration() ?? 0;
  }, []);

  return { state, dispatch, start, restart, pause, resume, rewind, getDuration, playbackRate, changeSpeed, seekPositionRef };
}

// ============================================================
// SECTION 6: TOGGLE BUTTON
// ============================================================


// ============================================================
// SECTION 6b: TTS AUDIO HELPER (used by InteractiveLesson)
// ============================================================

async function playBase64Wav(base64: string, ctx: AudioContext): Promise<void> {
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
  return new Promise((resolve, reject) => {
    const source   = ctx.createBufferSource();
    source.buffer  = audioBuffer;
    source.onended = () => resolve();
    source.connect(ctx.destination);
    source.start(0);
    // AudioBufferSourceNode has no onerror — listen on the AudioContext instead.
    ctx.addEventListener("statechange", function onStateChange() {
      if (ctx.state === "closed" || ctx.state === "suspended") {
        ctx.removeEventListener("statechange", onStateChange);
        reject(new Error(`AudioContext state changed to: ${ctx.state}`));
      }
    });
  });
}

function ToggleButton({
  active,
  onClick,
  children,
  theme,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  theme: Theme;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150"
      style={{
        background: active ? theme.accentMid : "rgba(255,255,255,0.05)",
        border: active
          ? `1px solid ${theme.cardBorder}`
          : "1px solid rgba(255,255,255,0.1)",
        color: active ? theme.accent : "#6b7a8d",
        fontFamily: "'Noto Sans JP', sans-serif",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </button>
  );
}

// Shape of a single flattened voice entry as returned by /api/voices.
// Matches the object the API route builds from VoiceVox's /speakers response:
//   { id: number, label: string (character name), sublabel: string (style name) }
export interface VoiceEntry {
  id: number;
  label: string;
  sublabel: string;
}

// ============================================================
// SECTION 7: SPEED CONTROL
// ============================================================

function SpeedControl({
  rate,
  onChange,
  theme,
  panelAlign = "right",
}: {
  rate: number;
  onChange: (r: number) => void;
  theme: Theme;
  panelAlign?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Round to 1 decimal place for display, e.g. "1.0x", "1.5x".
  const label = rate.toFixed(1) + "x";
  // Highlight the button when non-default speed is active so the user can
  // tell at a glance that speed is modified.
  const isModified = rate !== 1.0;

  return (
    <div className="relative" style={{ userSelect: "none" }} ref={wrapRef}>
      {/* ── Trigger button — gear icon, same dimensions as fullscreen button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Playback speed"
        className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150"
        style={{
          background: open || isModified
            ? theme.accentMid
            : "rgba(255,255,255,0.05)",
          border: open || isModified
            ? `1px solid ${theme.cardBorder}`
            : "1px solid rgba(255,255,255,0.1)",
          color: open || isModified ? theme.accent : "#6b7a8d",
        }}
        onMouseEnter={e => {
          if (!open && !isModified) {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
            (e.currentTarget as HTMLElement).style.color = "#c0cad8";
          }
        }}
        onMouseLeave={e => {
          if (!open && !isModified) {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
            (e.currentTarget as HTMLElement).style.color = "#6b7a8d";
          }
        }}
      >
        {/* Settings / gear icon — same stroke style as the fullscreen button */}
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="2.2" />
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
        </svg>
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className="absolute z-50"
          style={{
            left: panelAlign === "left" ? 0 : undefined,
            right: panelAlign === "right" ? 0 : undefined,
            top: "calc(100% + 6px)",
            background: "rgba(12,12,24,0.97)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
            padding: "12px 14px",
            minWidth: "188px",
            animation: "fadeSlideDown 0.12s ease both",
          }}
        >
          {/* Header row: label left, value right */}
          <div className="flex items-center justify-between mb-2.5">
            <span style={{
              fontSize: "0.68rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6b7a8d",
              fontFamily: "'Noto Sans JP', sans-serif",
            }}>
              Speed
            </span>
            <span style={{
              fontSize: "0.82rem",
              fontFamily: "monospace",
              fontWeight: 600,
              color: theme.accent,
              minWidth: "3ch",
              textAlign: "right",
            }}>
              {label}
            </span>
          </div>

          {/* Slider — fill percentage computed inline so the track always reflects */}
          {/* the current value without needing a separate CSS variable update.    */}
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={rate}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="speed-slider"
            style={{
              width: "100%",
              // fill% = (value - min) / (max - min) * 100
              background: `linear-gradient(to right, ${theme.accent} 0%, ${theme.accent} ${((rate - 0.5) / 1.5) * 100}%, rgba(255,255,255,0.1) ${((rate - 0.5) / 1.5) * 100}%, rgba(255,255,255,0.1) 100%)`,
              ["--slider-accent" as string]: theme.accent,
              ["--slider-accent-mid" as string]: theme.accentMid,
            }}
          />

          {/* Tick marks: 0.5 · 1.0 · 1.5 · 2.0 */}
          <div className="flex justify-between mt-1.5" style={{ paddingLeft: "1px", paddingRight: "1px" }}>
            {["0.5", "1.0", "1.5", "2.0"].map(t => (
              <button
                key={t}
                onClick={() => onChange(parseFloat(t))}
                style={{
                  fontSize: "0.6rem",
                  fontFamily: "monospace",
                  color: rate.toFixed(1) === t ? theme.accent : "#3a4458",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transition: "color 0.1s ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#a8b4c8"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = rate.toFixed(1) === t ? theme.accent : "#3a4458"; }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}




// ============================================================
// SECTION 9: INTERACTIVE LESSON COMPONENT
// ============================================================

const EDGE_VOICES = [
  { name: "ja-JP-NanamiNeural", label: "Nanami",  desc: "Female · Friendly" },
  { name: "ja-JP-KeitaNeural",  label: "Keita",   desc: "Male · Natural" },
  { name: "ja-JP-AoiNeural",    label: "Aoi",     desc: "Female · Bright" },
  { name: "ja-JP-DaichiNeural", label: "Daichi",  desc: "Male · Casual" },
  { name: "ja-JP-MayuNeural",   label: "Mayu",    desc: "Female · Soft" },
  { name: "ja-JP-NaokiNeural",  label: "Naoki",   desc: "Male · Calm" },
  { name: "ja-JP-ShioriNeural", label: "Shiori",  desc: "Female · Warm" },
];

const ENGLISH_EDGE_VOICES = [
  { name: "en-US-AriaNeural", label: "Aria", desc: "Female · Friendly" },
  { name: "en-US-JennyNeural", label: "Jenny", desc: "Female · Natural" },
  { name: "en-US-GuyNeural", label: "Guy", desc: "Male · Warm" },
  { name: "en-US-ChristopherNeural", label: "Christopher", desc: "Male · Calm" },
];

const KOKORO_VOICES = [
  { name: "af_heart", label: "Heart", desc: "Female · Warm" },
  { name: "af_bella", label: "Bella", desc: "Female · Natural" },
  { name: "af_sarah", label: "Sarah", desc: "Female · Clear" },
  { name: "af_sky", label: "Sky", desc: "Female · Bright" },
  { name: "am_adam", label: "Adam", desc: "Male · Natural" },
  { name: "am_michael", label: "Michael", desc: "Male · Calm" },
];

type LessonTTSProvider = "edge" | "voicevox";

interface InteractiveLessonProps {
  structured_content: StructuredContent;
  lesson_lines: LessonLine[]; // <--- ADD THIS
  learningDirection: LearningDirection;
  theme: Theme;
  onPlayAudio: () => void;
  availableVoices: VoiceEntry[];
  voicesLoading: boolean;
  tokenizer: KuromojiTokenizer | null;
}

function InteractiveLesson({ structured_content, lesson_lines, learningDirection, theme, onPlayAudio, availableVoices, voicesLoading, tokenizer }: InteractiveLessonProps) {
  const directionConfig = getLanguageDirectionConfig(learningDirection);
  const targetLanguage = directionConfig.targetLanguage;
  const isJapaneseTarget = targetLanguage === "ja";

  // ── Display toggles (Saved to localStorage independently from the main story) ──
  const [showRomaji, setShowRomaji] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pref_lessonRomaji");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });
  
  const [showFurigana, setShowFurigana] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pref_lessonFurigana");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });

  useEffect(() => { localStorage.setItem("pref_lessonRomaji", showRomaji.toString()); }, [showRomaji]);
  useEffect(() => { localStorage.setItem("pref_lessonFurigana", showFurigana.toString()); }, [showFurigana]);

  // ── TTS provider settings (Saved to localStorage) ────────────
  const [showTTSSettings, setShowTTSSettings] = useState(false);

  const [ttsProvider, setTtsProvider] = useState<LessonTTSProvider>(() => {
    if (typeof window === "undefined") return "edge";
    const saved = localStorage.getItem("pref_ttsProvider");
    return saved === "voicevox" || saved === "edge" ? saved : "edge";
  });
  const [edgeVoice, setEdgeVoice] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("pref_edgeVoice") || "ja-JP-NanamiNeural";
    return "ja-JP-NanamiNeural";
  });
  const [kokoroVoice, setKokoroVoice] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("pref_kokoroVoice") || "af_heart";
    return "af_heart";
  });
  const [voiceVoxId, setVoiceVoxId] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pref_voiceVoxId");
      return stored ? parseInt(stored, 10) : 1;
    }
    return 1;
  });

  useEffect(() => { localStorage.setItem("pref_ttsProvider", ttsProvider); }, [ttsProvider]);
  useEffect(() => { localStorage.setItem("pref_edgeVoice", edgeVoice); }, [edgeVoice]);
  useEffect(() => { localStorage.setItem("pref_voiceVoxId", voiceVoxId.toString()); }, [voiceVoxId]);

  const settingsRef = useRef<HTMLDivElement>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const ttsAudioCacheRef = useRef<Map<string, string>>(new Map());
  const preloadRunRef = useRef(0);

  const getAudioCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowTTSSettings(false);
      }
    }
    if (showTTSSettings) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showTTSSettings]);

  // Finds the matching story line and reuses its pre-generated character audio.
  const getMatchingAudio = useCallback((exampleTarget: string) => {
    if (!exampleTarget || !lesson_lines) return undefined;
    const normalize = (value: string) => value.replace(/[\s.,!?。、！？]/g, "").toLowerCase();
    const cleanTarget = normalize(exampleTarget);
    if (!cleanTarget) return undefined;
    const match = lesson_lines.find(line => {
      const displayLine = adaptLessonLineForDirection(line, learningDirection);
      const cleanLineTarget = normalize(displayLine.targetText);
      return cleanLineTarget.includes(cleanTarget) || cleanTarget.includes(cleanLineTarget);
    });
    return match ? match.audio_url : undefined;
  }, [lesson_lines, learningDirection]);

  const getMatchingSupportText = useCallback((exampleTarget: string) => {
    if (!exampleTarget || !lesson_lines) return "";
    const cleanTarget = normalizeComparableText(exampleTarget);
    if (!cleanTarget) return "";
    const match = lesson_lines.find(line => {
      const displayLine = adaptLessonLineForDirection(line, learningDirection);
      const cleanLineTarget = normalizeComparableText(displayLine.targetText);
      return cleanLineTarget.includes(cleanTarget) || cleanTarget.includes(cleanLineTarget);
    });
    if (!match) return "";
    return adaptLessonLineForDirection(match, learningDirection).supportText;
  }, [lesson_lines, learningDirection]);

  const getExampleSupportText = useCallback((example: ReturnType<typeof adaptExampleForDirection>, repeatedFallback?: string) => {
    const support = example.exampleSupport?.trim() ?? "";

    if (isJapaneseTarget) return support;

    const repeated = repeatedFallback?.trim();
    const supportIsRepeatedFallback = !!repeated && normalizeComparableText(support) === normalizeComparableText(repeated);

    if (support && hasJapaneseText(support) && !supportIsRepeatedFallback) return support;

    const matchingSupport = getMatchingSupportText(example.exampleTarget);
    return hasJapaneseText(matchingSupport) ? matchingSupport : "";
  }, [getMatchingSupportText, isJapaneseTarget]);

  const effectiveTtsProvider = targetLanguage === "en"
    ? "edge"
    : (ttsProvider === "voicevox" ? "voicevox" : "edge");
  const activeEdgeVoice = targetLanguage === "en" && !ENGLISH_EDGE_VOICES.some(v => v.name === edgeVoice)
    ? ENGLISH_EDGE_VOICES[0].name
    : edgeVoice;
  const ttsVoice = effectiveTtsProvider === "edge" ? activeEdgeVoice : voiceVoxId;

  const ttsCacheKey = useCallback((text: string) => {
    return `${effectiveTtsProvider}:${String(ttsVoice)}:${text}`;
  }, [effectiveTtsProvider, ttsVoice]);

  const exampleTtsPreloadQueue = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ id: string; text: string }> = [];

    const add = (id: string, text?: string) => {
      const trimmed = text?.trim();
      if (!trimmed || seen.has(trimmed) || getMatchingAudio(trimmed)) return;
      seen.add(trimmed);
      items.push({ id, text: trimmed });
    };

    structured_content.vocabulary.forEach((v, i) => {
      const example = adaptExampleForDirection(v, learningDirection);
      add(`vocab-${i}`, example.exampleTarget);
    });
    structured_content.grammar_points.forEach((g, i) => {
      const example = adaptExampleForDirection(g, learningDirection);
      add(`grammar-${i}`, example.exampleTarget);
    });

    return items;
  }, [structured_content.vocabulary, structured_content.grammar_points, getMatchingAudio, learningDirection]);

  const fetchTtsBase64 = useCallback(async (text: string, signal?: AbortSignal): Promise<string | null> => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        provider: effectiveTtsProvider,
        voice: ttsVoice,
        learningDirection,
        targetLanguage,
      }),
      signal,
    });
    if (!res.ok) throw new Error(`TTS API ${res.status}`);
    const data = await res.json();
    return typeof data.audioBase64 === "string" ? data.audioBase64 : null;
  }, [effectiveTtsProvider, ttsVoice, learningDirection, targetLanguage]);

  useEffect(() => {
    if (exampleTtsPreloadQueue.length === 0) return;

    const runId = ++preloadRunRef.current;
    const controller = new AbortController();

    async function preloadExamplesTopToBottom() {
      for (const item of exampleTtsPreloadQueue) {
        if (controller.signal.aborted || runId !== preloadRunRef.current) return;

        const key = ttsCacheKey(item.text);
        if (ttsAudioCacheRef.current.has(key)) continue;

        try {
          const base64 = await fetchTtsBase64(item.text, controller.signal);
          if (base64 && runId === preloadRunRef.current) {
            ttsAudioCacheRef.current.set(key, base64);
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            console.warn("[InteractiveLesson] Example TTS preload failed:", item.id, err instanceof Error ? err.message : err);
          }
        }
      }
    }

    preloadExamplesTopToBottom();
    return () => controller.abort();
  }, [exampleTtsPreloadQueue, fetchTtsBase64, ttsCacheKey]);

  const playTTS = useCallback(async (text: string, key: string, overrideAudioUrl?: string) => {
    if (playingKey) return;
    onPlayAudio();
    setPlayingKey(key);
    
    try {
      if (overrideAudioUrl) {
        // Play the character's pre-generated audio from the story!
        await new Promise<void>((resolve, reject) => {
          const howl = new Howl({
            src: [overrideAudioUrl],
            html5: true,
            onend: () => resolve(),
            onloaderror: () => reject(new Error("Failed to load audio URL")),
          });
          howl.play();
        });
      } else {
        const cacheKey = ttsCacheKey(text);
        let audioBase64 = ttsAudioCacheRef.current.get(cacheKey);

        if (!audioBase64) {
          audioBase64 = await fetchTtsBase64(text) ?? undefined;
          if (audioBase64) ttsAudioCacheRef.current.set(cacheKey, audioBase64);
        }

        if (audioBase64) {
          await playBase64Wav(audioBase64, getAudioCtx());
        } else {
          const utt = new SpeechSynthesisUtterance(text);
          utt.lang = "ja-JP";
          window.speechSynthesis.speak(utt);
          await new Promise<void>(res => { utt.onend = () => res(); });
        }
      }
    } catch (err) {
      console.error("[InteractiveLesson] TTS error:", err);
      try {
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = "ja-JP";
        window.speechSynthesis.speak(utt);
      } catch { }
    } finally {
      setPlayingKey(null);
    }
  }, [playingKey, fetchTtsBase64, getAudioCtx, onPlayAudio, ttsCacheKey]);

  // ── Enlarged Font Styles for Single-Column Readability ──
  // padding is handled via className for responsive breakpoints (see sectionCardCls / exampleBlockCls)
  const sectionCard: React.CSSProperties = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" };
  const sectionCardCls = "px-1 py-3 md:p-5"; // tighter mobile padding → more horizontal text space
  const sectionHeading: React.CSSProperties = { fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: theme.accent, fontFamily: "'Noto Sans JP', sans-serif", marginBottom: "16px" };
  // exampleBlock: 99% width so sentences use the full container width on mobile
  const exampleBlock: React.CSSProperties = { background: "rgba(0,0,0,0.35)", border: `1px solid ${theme.cardBorder}`, borderRadius: "10px", marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px", width: "100%" };
  const exampleBlockCls = "px-2 py-2 md:px-4 md:py-2.5"; // less padding on mobile = more text space
  const jpText: React.CSSProperties = { 
    fontFamily: "'Kikai Chokoku JIS', 'Noto Sans JP', 'Noto Serif JP', serif", 
    fontSize: "2rem", 
    color: "rgba(255,255,255,0.92)", 
    lineHeight: 1.6,
    ["--furi-opacity" as string]: isJapaneseTarget && showFurigana ? 1 : 0, // <--- NEW
  };
  const romajiText: React.CSSProperties = { fontFamily: "'Noto Sans JP', sans-serif", fontSize: "0.9rem", color: `rgba(${theme.accentRgb},0.75)`, letterSpacing: "0.03em", marginTop: "4px" };
  const enText: React.CSSProperties = { fontSize: "0.9rem", color: "#7a8fa8", marginTop: "4px", fontStyle: "italic" };

  function TTSPlayBtn({ text, id, overrideAudioUrl }: { text: string; id: string; overrideAudioUrl?: string }) {
    const isThis = playingKey === id;
    return (
      <button
        onClick={() => playTTS(text, id, overrideAudioUrl)}
        disabled={!!playingKey && !isThis}
        title="Play pronunciation"
        style={{
          flexShrink: 0, width: "26px", height: "26px", borderRadius: "50%",
          marginTop: "0px",
          background: isThis ? `rgba(${theme.accentRgb},0.3)` : `rgba(${theme.accentRgb},0.1)`,
          border: `1px solid ${isThis ? theme.accent : theme.cardBorder}`,
          color: isThis ? theme.accent : "#6b7a8d",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: !!playingKey && !isThis ? "not-allowed" : "pointer", transition: "all 0.15s ease", opacity: !!playingKey && !isThis ? 0.4 : 1,
        }}
      >
        {isThis ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <rect x="1" y="2" width="2" height="6" rx="1" opacity="1"><animate attributeName="height" values="6;3;6" dur="0.7s" repeatCount="indefinite"/><animate attributeName="y" values="2;3.5;2" dur="0.7s" repeatCount="indefinite"/></rect>
            <rect x="4" y="1" width="2" height="8" rx="1" opacity="0.8"><animate attributeName="height" values="8;4;8" dur="0.7s" begin="0.15s" repeatCount="indefinite"/><animate attributeName="y" values="1;3;1" dur="0.7s" begin="0.15s" repeatCount="indefinite"/></rect>
            <rect x="7" y="2" width="2" height="6" rx="1" opacity="0.6"><animate attributeName="height" values="6;2;6" dur="0.7s" begin="0.3s" repeatCount="indefinite"/><animate attributeName="y" values="2;4;2" dur="0.7s" begin="0.3s" repeatCount="indefinite"/></rect>
          </svg>
        ) : (
          <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor"><path d="M1 1l6 4-6 4V1z"/></svg>
        )}
      </button>
    );
  }

  return (
    <div className="w-full flex flex-col gap-0" style={{ fontFamily: "'Noto Sans JP', sans-serif", animation: "fadeSlideUp 0.4s ease 0.15s both" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap interactive-lesson-toolbar" style={{ position: "sticky", top: 0, zIndex: 80, background: "rgba(8,8,18,0.94)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "10px 4px", marginBottom: "18px" }}>
        <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#6b7a8d" }}>Interactive Lesson</span>
        <div className="flex items-center gap-1.5">
          {isJapaneseTarget && (
            <>
              <ToggleButton active={showFurigana} onClick={() => setShowFurigana(v => !v)} theme={theme}>振り仮名</ToggleButton>
              <ToggleButton active={showRomaji} onClick={() => setShowRomaji(v => !v)} theme={theme}>Romaji</ToggleButton>
            </>
          )}
          <div style={{ position: "relative" }} ref={settingsRef}>
            <button
              onClick={() => setShowTTSSettings(v => !v)}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 flex items-center gap-1.5"
              style={{ background: showTTSSettings ? theme.accentMid : "rgba(255,255,255,0.05)", border: showTTSSettings ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.1)", color: showTTSSettings ? theme.accent : "#6b7a8d", fontFamily: "'Noto Sans JP', sans-serif", letterSpacing: "0.04em" }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.85 }}><path d="M9 2.5a.5.5 0 0 1 .854-.354l4 4a.5.5 0 0 1 0 .708l-4 4A.5.5 0 0 1 9 10.5V8.7c-2.28.24-4.16 1.48-5.33 3.3-.25.4-.84.1-.73-.37C3.67 8.86 6.07 6.37 9 5.87V2.5z"/><path d="M2 5h3v6H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>
              TTS
            </button>
            {showTTSSettings && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "rgba(12,12,24,0.97)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 16px 48px rgba(0,0,0,0.7)", padding: "14px 16px", minWidth: "220px", zIndex: 30, animation: "fadeSlideDown 0.12s ease both" }}>
                <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7a8d", marginBottom: "10px" }}>Voice Engine</p>
                <div className="flex gap-2 mb-3">
                  {(targetLanguage === "en"
                    ? (["edge"] as LessonTTSProvider[])
                    : (["edge", "voicevox"] as LessonTTSProvider[])
                  ).map(p => (
                    <button key={p} onClick={() => setTtsProvider(p)} className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all duration-150" style={{ background: (targetLanguage === "en" ? effectiveTtsProvider : ttsProvider) === p ? theme.accentMid : "rgba(255,255,255,0.05)", border: (targetLanguage === "en" ? effectiveTtsProvider : ttsProvider) === p ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.1)", color: (targetLanguage === "en" ? effectiveTtsProvider : ttsProvider) === p ? theme.accent : "#6b7a8d" }}>
                      {p === "edge" ? "Edge" : "VoiceVox"}
                    </button>
                  ))}
                </div>

                {effectiveTtsProvider === "edge" && (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {(targetLanguage === "en" ? ENGLISH_EDGE_VOICES : EDGE_VOICES).map(v => (
                      <button key={v.name} onClick={() => setEdgeVoice(v.name)} className="text-left px-2.5 py-1.5 rounded-md text-xs transition-all duration-150 flex justify-between" style={{ background: activeEdgeVoice === v.name ? theme.accentMid : "transparent", border: activeEdgeVoice === v.name ? `1px solid ${theme.cardBorder}` : "1px solid transparent", color: activeEdgeVoice === v.name ? theme.accent : "#8a9ab8" }}>
                        <span>{v.label}</span>
                        <span style={{ fontSize: "0.6rem", color: "#6b7a8d" }}>{v.desc.split(" · ")[1] ?? v.desc}</span>
                      </button>
                    ))}
                  </div>
                )}

                {false && (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {KOKORO_VOICES.map(v => (
                      <button key={v.name} onClick={() => setKokoroVoice(v.name)} className="text-left px-2.5 py-1.5 rounded-md text-xs transition-all duration-150 flex justify-between" style={{ background: kokoroVoice === v.name ? theme.accentMid : "transparent", border: kokoroVoice === v.name ? `1px solid ${theme.cardBorder}` : "1px solid transparent", color: kokoroVoice === v.name ? theme.accent : "#8a9ab8" }}>
                        <span>{v.label}</span>
                        <span style={{ fontSize: "0.6rem", color: "#6b7a8d" }}>{v.desc.split(" · ")[1] ?? v.desc}</span>
                      </button>
                    ))}
                  </div>
                )}

                {targetLanguage !== "en" && ttsProvider === "voicevox" && (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {availableVoices.length === 0 ? <p style={{ fontSize: "0.65rem", color: "#6b7a8d" }}>{voicesLoading ? "Loading…" : "No voices"}</p> : availableVoices.map(v => (
                      <button key={v.id} onClick={() => setVoiceVoxId(v.id)} className="text-left px-2.5 py-1.5 rounded-md text-xs transition-all duration-150 flex justify-between" style={{ background: voiceVoxId === v.id ? theme.accentMid : "transparent", border: voiceVoxId === v.id ? `1px solid ${theme.cardBorder}` : "1px solid transparent", color: voiceVoxId === v.id ? theme.accent : "#8a9ab8" }}>
                        <span>{v.label}</span><span style={{ fontSize: "0.6rem", color: "#6b7a8d" }}>{v.sublabel}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Single Column Layout ────────────────────────────── */}
      <div className="flex flex-col gap-6">

        {/* ── Story Transcript ──────────────────────────────────── */}
        <div style={sectionCard} className={sectionCardCls}>
          <h3 style={sectionHeading}>Transcript</h3>
          <div className="flex flex-col gap-6">
            {lesson_lines.map((line, i) => {
              const displayLine = adaptLessonLineForDirection(line, learningDirection);
              return (
              <div key={line.id || i}>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {line.speaker}
                  </span>
                </div>
                <div style={exampleBlock} className={exampleBlockCls}>
                  {/* Japanese text — full width, no play button competing for space */}
                  <div style={{ minWidth: 0, width: "100%" }}>
                    {displayLine.targetLanguage === "ja" ? (
                      <p style={{ ...jpText, margin: 0 }} dangerouslySetInnerHTML={{ __html: buildFuriganaHTML(displayLine.targetText, tokenizer, true) }} />
                    ) : (
                      <p style={{ ...jpText, margin: 0 }}>{displayLine.targetText}</p>
                    )}
                  </div>
                  {/* Romaji & English */}
                  {((isJapaneseTarget && showRomaji && displayLine.targetReading) || displayLine.supportText) && (
                    <div>
                      {isJapaneseTarget && showRomaji && displayLine.targetReading && <p style={{ ...romajiText, marginTop: 0 }}>{displayLine.targetReading}</p>}
                      {displayLine.supportText && <p style={enText}>{displayLine.supportText}</p>}
                    </div>
                  )}
                  {/* Play button — bottom-left corner of the sentence block */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-20px", position: "relative", zIndex: 10 }}>
                    <TTSPlayBtn text={displayLine.targetText} id={`transcript-${i}`} overrideAudioUrl={line.audio_url} />
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* ── Vocabulary ──────────────────────────────────── */}
        <div style={sectionCard} className={sectionCardCls}>
          <h3 style={sectionHeading}>Vocabulary</h3>
          <div className="flex flex-col gap-6">
            {structured_content.vocabulary.map((v, i) => {
              const example = adaptExampleForDirection(v, learningDirection);
              const meaningText = isJapaneseTarget || hasJapaneseText(v.meaning) ? v.meaning : "";
              const exampleSupportText = getExampleSupportText(example, v.meaning);
              return (
              <div key={i}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span style={{ fontFamily: "'Kikai Chokoku JIS', 'Noto Sans JP', 'Noto Serif JP', serif", fontSize: "1.3rem", color: "white", fontWeight: 200 }}>{v.word}</span>
                    <span style={{ fontSize: "0.85rem", color: "#a8b4c8" }}>{v.reading}</span>
                  </div>
                  {meaningText && <span style={{ fontSize: "0.9rem", color: "#a8b4c8", fontStyle: "italic", flexShrink: 0 }}>{meaningText}</span>}
                </div>
                {example.exampleTarget && (
                  <div style={exampleBlock} className={exampleBlockCls}>
                    <div style={{ minWidth: 0, width: "100%" }}>
                      {example.targetLanguage === "ja" ? (
                        <p style={{ ...jpText, margin: 0 }} dangerouslySetInnerHTML={{ __html: buildFuriganaHTML(example.exampleTarget, tokenizer, true) }} />
                      ) : (
                        <p style={{ ...jpText, margin: 0 }}>{example.exampleTarget}</p>
                      )}
                    </div>
                    {((isJapaneseTarget && showRomaji && example.exampleTargetReading) || exampleSupportText) && (
                      <div>
                        {isJapaneseTarget && showRomaji && example.exampleTargetReading && <p style={{ ...romajiText, marginTop: 0 }}>{example.exampleTargetReading}</p>}
                        {exampleSupportText && <p style={enText}>{exampleSupportText}</p>}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-20px", position: "relative", zIndex: 10 }}>
                      <TTSPlayBtn text={example.exampleTarget} id={`vocab-${i}`} overrideAudioUrl={getMatchingAudio(example.exampleTarget)} />
                    </div>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        </div>

        {/* ── Grammar ─────────────────────────────────────── */}
        <div style={sectionCard} className={sectionCardCls}>
          <h3 style={sectionHeading}>Grammar Points</h3>
          <div className="flex flex-col gap-8">
            {structured_content.grammar_points.map((g, i) => {
              const example = adaptExampleForDirection(g, learningDirection);
              const explanationText = isJapaneseTarget || hasJapaneseText(g.explanation) ? g.explanation : "";
              const exampleSupportText = getExampleSupportText(example, g.explanation);
              return (
              <div key={i}>
                <p style={{ color: "white", fontSize: "1.15rem", fontWeight: 200, fontFamily: "'Kikai Chokoku JIS', 'Noto Sans JP', 'Noto Serif JP', serif", marginBottom: "6px" }}>{g.pattern}</p>
                {explanationText && <p style={{ fontSize: "0.9rem", color: "#a8b4c8", lineHeight: 1.6, marginBottom: "8px" }}>{explanationText}</p>}
                {example.exampleTarget && (
                  <div style={exampleBlock} className={exampleBlockCls}>
                    <div style={{ minWidth: 0, width: "100%" }}>
                      {example.targetLanguage === "ja" ? (
                        <p style={{ ...jpText, margin: 0 }} dangerouslySetInnerHTML={{ __html: buildFuriganaHTML(example.exampleTarget, tokenizer, true) }} />
                      ) : (
                        <p style={{ ...jpText, margin: 0 }}>{example.exampleTarget}</p>
                      )}
                    </div>
                    {((isJapaneseTarget && showRomaji && example.exampleTargetReading) || exampleSupportText) && (
                      <div>
                        {isJapaneseTarget && showRomaji && example.exampleTargetReading && <p style={{ ...romajiText, marginTop: 0 }}>{example.exampleTargetReading}</p>}
                        {exampleSupportText && <p style={enText}>{exampleSupportText}</p>}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-20px", position: "relative", zIndex: 10 }}>
                      <TTSPlayBtn text={example.exampleTarget} id={`grammar-${i}`} overrideAudioUrl={getMatchingAudio(example.exampleTarget)} />
                    </div>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScenePlayer({
  lesson_id,
  structured_content,
  background_image_url,
  lesson_lines,
  learningDirection = DEFAULT_LEARNING_DIRECTION,
  theme,
}: LessonProps) {
  const { state, start, restart, pause, resume, rewind, getDuration, playbackRate, changeSpeed, seekPositionRef } = useScenePlayer(lesson_lines);
  const { status, currentIndex, preloadProgress, error } = state;
  const directionConfig = getLanguageDirectionConfig(learningDirection);
  const isJapaneseTarget = directionConfig.targetLanguage === "ja";
  const translationToggleLabel = directionConfig.supportLanguage.toUpperCase();

  // ── Fullscreen ───────────────────────────────────────────────
  // iOS Safari does NOT support requestFullscreen on div elements — only <video>.
  // Solution: CSS simulation via fixed positioning for iOS, real Fullscreen API elsewhere.
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Detect iOS once (covers iPhone, iPad, iPod)
  const isIOS = typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;

  const toggleFullscreen = useCallback(() => {
    if (isIOS) {
      // iOS: toggle CSS-based fullscreen simulation — no native API call
      setIsFullscreen(v => {
        const next = !v;
        // Lock/unlock body scroll while simulated fullscreen is active
        document.body.style.overflow = next ? "hidden" : "";
        return next;
      });
      return;
    }
    // All other browsers: use real Fullscreen API with webkit fallback
    const el = containerRef.current;
    if (!el) return;
    const fsElement = document.fullscreenElement ?? (document as any).webkitFullscreenElement;
    if (!fsElement) {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(err => console.warn("[ScenePlayer] Fullscreen failed:", err));
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  }, [isIOS]);

  // Sync isFullscreen with native API events (non-iOS only)
  useEffect(() => {
    if (isIOS) return;
    const handler = () => {
      const active = !!(document.fullscreenElement ?? (document as any).webkitFullscreenElement);
      setIsFullscreen(active);
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, [isIOS]);

  // Clean up body scroll lock if component unmounts while iOS-fullscreen is active
  useEffect(() => {
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ── Display toggles ─────────────────────────────────────────
  const [showFurigana, setShowFurigana] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pref_storyFurigana");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });

  const [showRomaji, setShowRomaji] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pref_storyRomaji");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });

  const [showTranslation, setShowTranslation] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pref_storyTranslation");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });

  // Save to localStorage whenever they change
  useEffect(() => { localStorage.setItem("pref_storyFurigana", showFurigana.toString()); }, [showFurigana]);
  useEffect(() => { localStorage.setItem("pref_storyRomaji", showRomaji.toString()); }, [showRomaji]);
  useEffect(() => { localStorage.setItem("pref_storyTranslation", showTranslation.toString()); }, [showTranslation]);

  // ── Dynamic voice list fetched from /api/voices ──────────────
  // voicesLoading tracks whether the fetch is still in flight so the
  // dropdown can show a spinner vs "no voices available" vs a real list.
  // Previously there was no loading flag — empty array was indistinguishable
  // from "still loading", so the dropdown showed "Loading voices…" forever
  // if the request succeeded but returned an unexpected shape, or if the
  // fetch resolved quickly with the fallback array.
  // ── CLIENT-SIDE FALLBACK VOICES ─────────────────────────────
  // Used when /api/voices is unreachable, returns a non-array, or returns
  // an empty array. These are the 5 most popular VoiceVox characters and
  // match the server-side FALLBACK_VOICES in api/voices/route.ts exactly,
  // so the dropdowns are ALWAYS populated — even if VoiceVox and its
  // cloud fallback are both offline.
  const CLIENT_FALLBACK_VOICES: VoiceEntry[] = [
    { id: 3,  label: "ずんだもん",   sublabel: "ノーマル" },
    { id: 1,  label: "四国めたん",   sublabel: "ノーマル" },
    { id: 8,  label: "春日部つむぎ", sublabel: "ノーマル" },
    { id: 14, label: "冥鳴ひまり",   sublabel: "ノーマル" },
    { id: 2,  label: "四国めたん",   sublabel: "あまあま" },
  ];

  const [availableVoices, setAvailableVoices] = useState<VoiceEntry[]>([]);
  const [voicesLoading,   setVoicesLoading]   = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/voices")
      .then(res => {
        // Accept any 2xx. The route always returns 200 even for fallback data.
        if (!res.ok) throw new Error(`/api/voices returned ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;

        // Validate: must be a non-empty array whose first element has a numeric id.
        const isValidArray =
          Array.isArray(data) &&
          data.length > 0 &&
          typeof (data[0] as VoiceEntry).id === "number" &&
          typeof (data[0] as VoiceEntry).label === "string";

        if (isValidArray) {
          setAvailableVoices(data as VoiceEntry[]);
        } else {
          // API returned something unexpected (wrapped object, empty array, etc.).
          // Use the client-side fallback so the dropdown is always populated.
          console.warn("[ScenePlayer] /api/voices returned unexpected shape — using client fallback:", JSON.stringify(data).slice(0, 120));
          setAvailableVoices(CLIENT_FALLBACK_VOICES);
        }
        setVoicesLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        // Network error or route crash — populate with client fallback voices
        // so the dropdown is never stuck on "No voices available".
        console.warn("[ScenePlayer] /api/voices fetch failed — using client fallback:", err.message);
        setAvailableVoices(CLIENT_FALLBACK_VOICES);
        setVoicesLoading(false);
      });

    return () => { cancelled = true; };
  }, []);


  // ── Kuromoji tokenizer ──────────────────────────────────────
  const [tokenizer, setTokenizer] = useState<KuromojiTokenizer | null>(null);
  const [kuroReady, setKuroReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadKuromojiScript()
      .then(() => {
        if (cancelled || !window.kuromoji) return;
        window.kuromoji
          .builder({ dicPath: "/dict" })
          .build((err, t) => {
            if (cancelled) return;
            if (err) {
              console.warn("[ScenePlayer] Kuromoji failed to load:", err);
              return;
            }
            setTokenizer(t);
            setKuroReady(true);
          });
      })
      .catch(err => {
        if (!cancelled) console.warn("[ScenePlayer] Kuromoji script failed to load:", err);
      });

    return () => { cancelled = true; };
  }, []);


  const furiganaCacheRef = useRef<Record<string, string>>({});
  // Always render Furigana to the DOM, rely on CSS opacity to hide it
  const getFuriganaHTML = useCallback(
    (text: string): string => {
      const key = `furi:${text}`;
      if (furiganaCacheRef.current[key]) return furiganaCacheRef.current[key];
      const html = buildFuriganaHTML(text, tokenizer, true); // <--- ALWAYS TRUE
      furiganaCacheRef.current[key] = html;
      return html;
    },
    [tokenizer]
  );

  const currentLine = lesson_lines[currentIndex];
  const currentDisplayLine = currentLine
    ? adaptLessonLineForDirection(currentLine, learningDirection)
    : null;
  const expression  = currentDisplayLine ? getExpression(currentDisplayLine.targetText) : "neutral";

  // ── Live background URL ──────────────────────────────────────
  // background_image_url prop is the value at the moment fetchLessonData ran.
  // Image generation runs in parallel with the 202 response, so the prop is
  // often null when ScenePlayer first mounts — even though the image arrives
  // ~10s later. We keep a local state copy and update it via Realtime so the
  // background appears automatically once the DB column is written.
  const [liveBgUrl, setLiveBgUrl] = useState<string | null>(background_image_url ?? null);

  useEffect(() => {
    // Sync if the prop later becomes non-null (e.g. parent re-renders)
    if (background_image_url) setLiveBgUrl((currentUrl) => currentUrl ?? background_image_url);
  }, [background_image_url]);

  useEffect(() => {
    // Already have a URL - nothing to watch for.
    if (liveBgUrl) return;

    let settled = false;
    const realtimeSupabase = _supabaseRT;
    const backgroundLessonTable = learningDirection === "en-ja" ? "english_lessons" : "lessons";

    const settle = (url: string) => {
      if (settled) return;
      settled = true;
      setLiveBgUrl(url);
      if (channel) realtimeSupabase.removeChannel(channel);
    };

    const channel = realtimeSupabase
      .channel(`lesson-bg-${lesson_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: backgroundLessonTable, filter: `id=eq.${lesson_id}` },
        (payload) => {
          const url = (payload.new as { background_image_url?: string | null }).background_image_url;
          if (url) settle(url);
        }
      )
      .subscribe();

    const startedAt = Date.now();
    const poll = window.setInterval(async () => {
      if (settled) {
        window.clearInterval(poll);
        return;
      }

      if (Date.now() - startedAt > 90_000) {
        window.clearInterval(poll);
        return;
      }

      try {
        const { data } = await browserSupabase
          .from(backgroundLessonTable)
          .select("background_image_url")
          .eq("id", lesson_id)
          .maybeSingle();
        const url = (data as { background_image_url?: string | null } | null)?.background_image_url;
        if (url) {
          window.clearInterval(poll);
          settle(url);
        }
      } catch {
        // Realtime is the primary path; polling is only a missed-event fallback.
      }
    }, 2_000);

    return () => {
      settled = true;
      window.clearInterval(poll);
      if (channel) realtimeSupabase.removeChannel(channel);
    };
  }, [lesson_id, learningDirection, liveBgUrl]);

  const bgImage = getBackgroundStyle(liveBgUrl);

  const isPlaying      = status === "PLAYING_LINE" || status === "WAITING_NEXT";
  const isPaused       = status === "PAUSED";
  const isCompleted    = status === "COMPLETED";
  const isActive       = isPlaying || isPaused;
  const showControls   = isActive;

  // ── Spacebar play/pause — desktop only, only when scene is visible ──────────
  useEffect(() => {
    // Skip entirely on touch devices — spacebar is a desktop-only concept
    if (typeof window === "undefined") return;
    const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    if (isTouchDevice) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      // Don't hijack spacebar when user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (!isActive) return;

      // Only fire if the scene player container is currently visible in the viewport.
      // This prevents spacebar from triggering when user has scrolled down to the
      // transcript / vocabulary sections.
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      // Consider "visible" if the top of the container is still on screen
      const isVisible = rect.top < viewportHeight && rect.bottom > 0;
      if (!isVisible) return;

      e.preventDefault(); // prevent page scroll
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, isPlaying, pause, resume]);

  // ── Subtitle chunking ───────────────────────────────────────
  // Split the current line's kanji into display chunks at 。/ 、boundaries.
  // The active chunk advances using the actual Howl audio duration so timing
  // is always perfectly proportional to the real audio, not a character guess.
  const [chunkState, setChunkState] = useState({ lineIndex: 0, chunkIndex: 0 });
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chunks = currentDisplayLine
    ? currentDisplayLine.targetLanguage === "ja"
      ? chunkJapaneseLine(currentDisplayLine.targetText)
      : [currentDisplayLine.targetText]
    : [""];

  // Reset chunk index whenever the line changes.
  useEffect(() => {
    setChunkState(prev =>
      prev.lineIndex === currentIndex && prev.chunkIndex === 0
        ? prev
        : { lineIndex: currentIndex, chunkIndex: 0 }
    );
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
  }, [currentIndex]);

  // ── Seek-position-based chunk advancement ────────────────────
  // Previous approach used setTimeout with duration()-derived offsets.
  // This stays seek-position based so chunk timing remains correct even if
  // duration metadata resolves late or a rate change happens mid-line.
  //
  // Fix: poll seekPositionRef every 80ms (already kept accurate by the
  // existing seek tick in playLine). When duration IS available, compute
  // which chunk should be active from the live seek fraction. When duration
  // is still 0, stay on chunk 0 until it resolves — then catch up instantly.
  // This is always correct regardless of when metadata arrives.
  useEffect(() => {
    if (!isPlaying || !currentDisplayLine || chunks.length <= 1) return;
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);

    const lineIndexForTimer = currentIndex;
    const totalChars = chunks.reduce((s, c) => s + c.length, 0);

    // Cumulative char fractions for each chunk boundary (length = chunks.length - 1).
    // chunkFractions[i] = fraction of audio at which chunk i+1 should start.
    const chunkFractions: number[] = [];
    let cum = 0;
    for (let i = 0; i < chunks.length - 1; i++) {
      cum += chunks[i].length;
      chunkFractions.push(cum / totalChars);
    }

    chunkTimerRef.current = setInterval(() => {
      const durationSec = getDuration(currentIndex);
      if (durationSec <= 0) return; // duration not ready yet — wait, stay on chunk 0

      const pos = seekPositionRef.current;
      // Clamp position to [0, duration] in case of rounding
      const fraction = Math.min(pos / durationSec, 1);

      // Find the highest chunk whose start fraction is <= current fraction.
      // Walk backwards so we always land on the correct chunk even when
      // seeking backwards or when multiple chunk boundaries are crossed at once.
      let target = 0;
      for (let i = chunkFractions.length - 1; i >= 0; i--) {
        if (fraction >= chunkFractions[i]) {
          target = i + 1;
          break;
        }
      }

      setChunkState(prev =>
        prev.lineIndex === lineIndexForTimer && prev.chunkIndex === target
          ? prev
          : { lineIndex: lineIndexForTimer, chunkIndex: target }
      );
    }, 80) as unknown as ReturnType<typeof setTimeout>;

    return () => {
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentIndex, playbackRate]);

  // The text to display in the subtitle panel.
  // When a line is split into multiple kanji chunks, romaji and English are
  // also split into the same number of proportional segments so all three
  // tracks advance together. chunkWesternLine aligns splits to sentence and
  // clause boundaries so each piece reads naturally in isolation.
  const romajiChunks  = currentDisplayLine?.targetReading && chunks.length > 1
    ? chunkWesternLine(currentDisplayLine.targetReading,  chunks.length)
    : null;
  const englishChunks = currentDisplayLine && chunks.length > 1
    ? chunkWesternLine(currentDisplayLine.supportText, chunks.length)
    : null;

  const displayedChunkIndex = chunkState.lineIndex === currentIndex ? chunkState.chunkIndex : 0;
  const safeIndex     = Math.min(displayedChunkIndex, chunks.length - 1);
  const displayKanji  = chunks[safeIndex]                          ?? currentDisplayLine?.targetText   ?? "";
  const displayRomaji = romajiChunks  ? (romajiChunks[safeIndex]  ?? currentDisplayLine?.targetReading  ?? "") : (currentDisplayLine?.targetReading  ?? "");
  const displayEnglish = englishChunks ? (englishChunks[safeIndex] ?? currentDisplayLine?.supportText ?? "") : (currentDisplayLine?.supportText ?? "");
  const subtitleLength = displayKanji.length;
  const subtitleSizeVars = {
    ["--subtitle-font-size" as string]: subtitleLength > 38 ? "1.28rem" : subtitleLength > 28 ? "1.42rem" : "1.58rem",
    ["--subtitle-font-size-mobile" as string]: subtitleLength > 32 ? "1rem" : subtitleLength > 24 ? "1.12rem" : "1.28rem",
    ["--subtitle-font-size-fs" as string]: subtitleLength > 38 ? "2.05rem" : subtitleLength > 28 ? "2.35rem" : "2.7rem",
    ["--subtitle-font-size-fs-mobile" as string]: subtitleLength > 32 ? "1.45rem" : subtitleLength > 24 ? "1.65rem" : "1.85rem",
  };

  // Progress fraction for the slim timeline bar (0–1).
  const progressFraction = lesson_lines.length > 1
    ? currentIndex / (lesson_lines.length - 1)
    : 0;

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col gap-2 relative"
      style={isFullscreen ? {
        // CSS-based fullscreen simulation (required for iOS Safari which blocks
        // requestFullscreen on non-video elements). Also works for real fullscreen.
        //
        // WHY top/left/width/height instead of inset+100%:
        // Mobile Safari confines `position:fixed` to the nearest ancestor that
        // creates a stacking context (transform, will-change, filter, etc.).
        // The page wrapper has zIndex:10 which creates one. By spelling out
        // top:0/left:0 and using 100vw/100dvh we ensure the element truly
        // covers the full viewport regardless of ancestor stacking contexts.
        // 100dvh = dynamic viewport height (excludes/includes browser chrome
        // as it shows/hides on scroll) — avoids the "wrong height on iOS" bug.
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100dvh",
        margin: 0,
        padding: 0,
        zIndex: 9999,
        background: "#000",
        overflow: "hidden",
        ["--accent-rt" as string]: `rgba(${theme.accentRgb},0.85)`,
      } : {
        ["--accent-rt" as string]: `rgba(${theme.accentRgb},0.85)`,
      }}
    >

      {/* ── Scene Title + Display Toggles ───────────────────────── */}
      {!isFullscreen && (
      <div className={`flex items-start justify-between gap-3 flex-wrap scene-page-header${isJapaneseTarget ? " scene-page-header-ja" : ""}`}>
        <div className="scene-title-wrap flex items-center gap-3 min-w-0 flex-1">
          <h2
            className="text-white font-semibold text-lg tracking-tight min-w-0"
            style={{ fontFamily: "'Noto Serif JP', serif", textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
          >
            {structured_content.title}
          </h2>
        </div>

        {/* Subtitle visibility toggles */}
        <div className="scene-controls ml-auto flex items-center justify-end gap-1.5 flex-wrap">
          {isJapaneseTarget && (
            <>
              <ToggleButton active={showFurigana} onClick={() => setShowFurigana(v => !v)} theme={theme}>振り仮名</ToggleButton>
              <ToggleButton active={showRomaji} onClick={() => setShowRomaji(v => !v)} theme={theme}>Romaji</ToggleButton>
            </>
          )}
          <ToggleButton active={showTranslation} onClick={() => setShowTranslation(v => !v)} theme={theme}>{translationToggleLabel}</ToggleButton>
          <SpeedControl rate={playbackRate} onChange={changeSpeed} theme={theme} />
          {isJapaneseTarget && !kuroReady && (
            <span className="text-xs ml-1" style={{ color: "#3a3a4a" }}>dict…</span>
          )}
        </div>
      </div>
      )}

      {/* ── Scene Viewport ──────────────────────────────────────── */}
      <div
        className={isFullscreen ? "relative w-full h-full flex flex-col" : "relative w-full rounded-2xl overflow-hidden"}
        style={isFullscreen
          ? { flex: 1 }
          : { boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 24px 80px rgba(0,0,0,0.7)" }
        }
      >
        {/* ── MEDIA BOX — true 16:9 (normal) or full-height (fullscreen) ─ */}
        <div
          className="relative w-full"
          style={isFullscreen
            ? { flex: 1, background: "#0a0a12", overflow: "hidden" }
            : { aspectRatio: "16 / 9", background: "#0a0a12" }
          }
        >
          <div className="absolute inset-0">
            {/* Background image */}
            <div
              className="absolute inset-0 transition-opacity duration-300"
              style={{
                backgroundImage: bgImage,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                opacity: liveBgUrl
                  ? (status === "IDLE" && preloadProgress === 0 ? 0.4 : 0.65)
                  : 0,
                filter: "saturate(1.2) brightness(0.7)",
                transition: "opacity 0.6s ease, background-image 0.4s ease",
              }}
            />
            {/* Vignette */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%)" }}
            />
            {/* Bottom fade */}
            <div
              className="absolute bottom-0 left-0 right-0 pointer-events-none"
              style={{
                height: "40%",
                background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
              }}
            />

            {/* Character Sprite */}
            {currentLine && status !== "IDLE" && (() => {
              // Sprites only exist for known ASCII character names like "chihiro",
              // "hana", etc. Japanese character names (春斗, 千尋) are AI-generated
              // and have no corresponding PNG file — attempting to load them causes
              // 404s AND a jarring broken-image / placeholder shape on screen.
              //
              // Rule: only render the <img> if the name is pure ASCII. For
              // Japanese-named characters we simply skip the sprite entirely —
              // the scene still plays correctly with the speaker name tag below.
              const speakerSlug = currentLine.speaker.toLowerCase();
              const isAsciiName = /^[a-z0-9_\- ]+$/.test(speakerSlug);
              if (!isAsciiName) return null;

              return (
                <div
                  className="absolute left-1/2 flex items-end justify-center"
                  style={{ transform: "translateX(-50%)", bottom: isFullscreen ? "28%" : "0", height: "80%", width: "30%" }}
                >
                  <img
                    src={`/sprites/${speakerSlug}_${expression}.png`}
                    alt={`${currentLine.speaker} ${expression}`}
                    className="h-full w-auto object-contain drop-shadow-2xl"
                    decoding="async"
                    loading="eager"
                    style={{
                      animation: isPlaying ? "spriteBounce 0.55s ease-in-out infinite alternate" : "none",
                      filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.6))",
                      opacity: isPaused ? 0.65 : 1,
                      transition: "opacity 0.25s ease",
                      willChange: "transform",
                    }}
                    onError={(e) => {
                      // ASCII name but file doesn't exist — hide the img entirely.
                      // Setting display:none is cleaner than a placeholder shape.
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              );
            })()}

            {/* Speaker Name Tag */}
            {currentLine && status !== "IDLE" && (
              <div
                className="absolute left-6 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-widest"
                style={{
                  bottom: isFullscreen ? "calc(28% + 0.6rem)" : "0.6rem",
                  background: theme.accentMid,
                  border: `1px solid ${theme.cardBorder}`,
                  color: theme.accent,
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                {currentLine.speaker}
                {isPaused && <span className="ml-2 opacity-50">⏸</span>}
              </div>
            )}

            {/* ── Fullscreen toggle button — always visible top-right ── */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className={`absolute flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150${isFullscreen ? " fs-fullscreen-btn" : ""}`}
              style={{
                // top is handled by .fs-fullscreen-btn (stylesheet) in fullscreen so
                // env(safe-area-inset-top) is resolved by WebKit, not the CSSOM.
                top: isFullscreen ? undefined : "0.75rem",
                right: "0.75rem",
                background: "rgba(0,0,0,0.45)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.75)",
                backdropFilter: "blur(8px)",
                zIndex: 20,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.7)";
                (e.currentTarget as HTMLElement).style.color = "#fff";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.45)";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
              }}
            >
              {isFullscreen ? (
                /* Compress icon */
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M5 1v4H1M9 1v4h4M5 13v-4H1M9 13v-4h4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                /* Expand icon */
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

            {/* ── Fullscreen: floating toggle bar top-left ── */}
            {isFullscreen && (
              <div
                className="absolute top-0 left-3 flex items-center gap-1.5 z-20 fs-toggle-bar"
              >
                {isJapaneseTarget && (
                  <>
                    <ToggleButton active={showFurigana} onClick={() => setShowFurigana(v => !v)} theme={theme}>振り仮名</ToggleButton>
                    <ToggleButton active={showRomaji} onClick={() => setShowRomaji(v => !v)} theme={theme}>Romaji</ToggleButton>
                  </>
                )}
                <ToggleButton active={showTranslation} onClick={() => setShowTranslation(v => !v)} theme={theme}>{translationToggleLabel}</ToggleButton>
                <SpeedControl rate={playbackRate} onChange={changeSpeed} theme={theme} panelAlign={isJapaneseTarget ? "right" : "left"} />
              </div>
            )}

            {/* ── Fullscreen subtitle panel — pinned to bottom of media box ── */}
            {isFullscreen && currentLine && isActive && (
              <div
                className="absolute bottom-0 left-0 right-0"
                style={{ zIndex: 10 }}
              >
                {/* Gradient backdrop — blends into the scene */}
                <div style={{
                  background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.65) 60%, transparent 100%)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: isJapaneseTarget ? "flex-start" : "flex-end",
                  minHeight: isJapaneseTarget ? "32dvh" : "24dvh",
                  paddingTop: isJapaneseTarget ? "4rem" : "2rem",
                  paddingBottom: isJapaneseTarget ? "2rem" : "2.5rem",
                  paddingLeft: "4rem",
                  paddingRight: "4rem",
                  transform: "translateZ(0)",
                  backfaceVisibility: "hidden",
                }}>
                  {/* Japanese text — centred, no controls overlapping */}
                  <div className="relative flex items-center justify-center w-full">
                    <p
                      className="scene-subtitle-primary scene-subtitle-primary-fs text-white text-center"
                      style={{
                        ...subtitleSizeVars,
                        fontFamily: "'Kikai Chokoku JIS', 'Noto Sans JP', 'Noto Serif JP', serif",
                        fontWeight: 700,
                        textShadow: "0 2px 24px rgba(0,0,0,1), 0 0 60px rgba(0,0,0,0.8)",
                        lineHeight: "2.2",
                        letterSpacing: "0.02em",
                        ["--furi-opacity" as string]: isJapaneseTarget && showFurigana && kuroReady ? 1 : 0,
                      }}
                      dangerouslySetInnerHTML={{ __html: getFuriganaHTML(displayKanji) }}
                    />
                  </div>
                  {/* Fullscreen controls — absolute bottom-right corner of gradient panel, 4px from edges */}
                  {showControls && (
                    <div className="absolute flex items-center gap-1.5" style={{ bottom: "4px", right: "12px" }}>
                      <button
                        onClick={rewind}
                        title="Previous Line / Restart"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-all duration-150"
                        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", color: "#a8b4c8" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.22)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "#a8b4c8"; }}
                      >
                        <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
                          <path d="M6 1L1 6l5 5V7.5c2.8.3 4.5 1.8 5 4.5C11 7 9 3.5 6 3V1z" />
                        </svg>
                      </button>
                      <button
                        onClick={isPlaying ? pause : resume}
                        title={isPlaying ? "Pause" : "Resume"}
                        className="flex items-center justify-center w-9 h-9 rounded-md transition-all duration-150"
                        style={{
                          background: isPlaying ? `rgba(${theme.accentRgb},0.15)` : `rgba(${theme.accentRgb},0.25)`,
                          border: `1px solid ${theme.cardBorder}`,
                          color: theme.accent,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `rgba(${theme.accentRgb},0.4)`; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isPlaying ? `rgba(${theme.accentRgb},0.15)` : `rgba(${theme.accentRgb},0.25)`; }}
                      >
                        {isPlaying ? (
                          <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
                            <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" />
                            <rect x="6"   y="1" width="2.5" height="8" rx="0.5" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
                            <path d="M2 1.5l7 3.5-7 3.5V1.5z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Romaji */}
                  {isJapaneseTarget && showRomaji && displayRomaji && (
                    <p className="text-center mt-2" style={{
                      fontFamily: "'Noto Sans JP', sans-serif",
                      fontSize: "clamp(1rem, 1.8vw, 1.4rem)",
                      color: "rgba(255,255,255,0.6)",
                      letterSpacing: "0.04em",
                      lineHeight: 1.5,
                      textShadow: "0 1px 8px rgba(0,0,0,0.9)",
                    }}>
                      {displayRomaji}
                    </p>
                  )}

                  {/* Divider */}
                  {showTranslation && (
                    <div style={{ width: "50%", height: "1px", background: "rgba(255,255,255,0.12)", margin: "0.5rem auto" }} />
                  )}

                  {/* English */}
                  {showTranslation && (
                    <p className="text-center" style={{
                      fontFamily: "'Noto Sans JP', sans-serif",
                      fontSize: "clamp(1rem, 1.8vw, 1.4rem)",
                      color: "rgba(255,255,255,0.6)",
                      letterSpacing: "0.04em",
                      lineHeight: 1.5,
                      textShadow: "0 1px 8px rgba(0,0,0,0.9)",
                    }}>
                      {displayEnglish}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>{/* end MEDIA BOX */}

        {/* ── SUBTITLE PANEL (normal mode only) ───────────────────
            In fullscreen the panel lives inside the media box above.
        ── */}
        {!isFullscreen && currentLine && isActive && (
          <div
            style={{
              background: "rgba(4,4,16,0.97)",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {/* Slim progress bar — replaces clickable dots */}
            <div style={{ height: "2px", background: "rgba(255,255,255,0.07)" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progressFraction * 100}%`,
                  background: `linear-gradient(to right, ${theme.accent}cc, ${theme.accent})`,
                  transition: "width 0.35s ease",
                }}
              />
            </div>

            {/* Subtitle content — centered vertical stack */}
            <div
              className="relative flex flex-col items-center justify-center text-center gap-1.5 w-full"
              style={{
                paddingTop: isJapaneseTarget && showFurigana && kuroReady ? "0.8em" : "0.5rem",
                paddingBottom: "1rem",
                paddingLeft: "1.5rem",
                paddingRight: "1.5rem",
                minHeight: "128px",
                transform: "translateZ(0)",
                backfaceVisibility: "hidden",
              }}
            >
              {/* ── Japanese line + desktop controls ── */}
              <div className="relative w-full flex items-center justify-center">
                {/* Japanese text — centered */}
                <p
                  className="scene-subtitle-primary text-white"
                  style={{
                    ...subtitleSizeVars,
                    fontFamily: "'Kikai Chokoku JIS', 'Noto Sans JP', 'Noto Serif JP', serif",
                    fontWeight: 600,
                    textShadow: "0 2px 16px rgba(0,0,0,0.9), 0 0 40px rgba(255,255,255,0.05)",
                    lineHeight: "2.2",
                    letterSpacing: "0.01em",
                    ["--furi-opacity" as string]: isJapaneseTarget && showFurigana && kuroReady ? 1 : 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: getFuriganaHTML(displayKanji) }}
                />
                {/* Desktop controls — vertically centred beside Japanese text, flush right */}
                {showControls && (
                  <div className="absolute right-0 hidden md:flex items-center gap-1" style={{ top: "50%", transform: "translateY(-50%)" }}>
                    <button
                      onClick={rewind}
                      title="Previous Line / Restart"
                      className="flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-150"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#a8b4c8" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.13)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "#a8b4c8"; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M6 1L1 6l5 5V7.5c2.8.3 4.5 1.8 5 4.5C11 7 9 3.5 6 3V1z" />
                      </svg>
                    </button>
                    <button
                      onClick={isPlaying ? pause : resume}
                      title={isPlaying ? "Pause" : "Resume"}
                      className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150"
                      style={{
                        background: isPlaying ? `rgba(${theme.accentRgb},0.15)` : `rgba(${theme.accentRgb},0.25)`,
                        border: `1px solid ${theme.cardBorder}`,
                        color: theme.accent,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `rgba(${theme.accentRgb},0.35)`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isPlaying ? `rgba(${theme.accentRgb},0.15)` : `rgba(${theme.accentRgb},0.25)`; }}
                    >
                      {isPlaying ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                          <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" />
                          <rect x="6"   y="1" width="2.5" height="8" rx="0.5" />
                        </svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                          <path d="M2 1.5l7 3.5-7 3.5V1.5z" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
              {/* Mobile controls — absolute bottom-right corner of the subtitle panel, 4px from edges */}
              {showControls && (
                <div className="absolute flex md:hidden items-center gap-1" style={{ bottom: "4px", right: "4px" }}>
                  <button
                    onClick={rewind}
                    title="Previous Line / Restart"
                    className="flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-150"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#a8b4c8" }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M6 1L1 6l5 5V7.5c2.8.3 4.5 1.8 5 4.5C11 7 9 3.5 6 3V1z" />
                    </svg>
                  </button>
                  <button
                    onClick={isPlaying ? pause : resume}
                    title={isPlaying ? "Pause" : "Resume"}
                    className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150"
                    style={{
                      background: isPlaying ? `rgba(${theme.accentRgb},0.15)` : `rgba(${theme.accentRgb},0.25)`,
                      border: `1px solid ${theme.cardBorder}`,
                      color: theme.accent,
                    }}
                  >
                    {isPlaying ? (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" />
                        <rect x="6"   y="1" width="2.5" height="8" rx="0.5" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M2 1.5l7 3.5-7 3.5V1.5z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}

              {/* ── Romaji ── */}
              {isJapaneseTarget && showRomaji && displayRomaji && (
                <p
                  style={{
                    fontFamily: "'Noto Sans JP', sans-serif",
                    fontSize: "clamp(0.72rem, 1.35vw, 0.9rem)",
                    color: "#7a8fa8",
                    letterSpacing: "0.03em",
                    lineHeight: 1.5,
                  }}
                >
                  {displayRomaji}
                </p>
              )}

              {/* ── Divider — only shown when English is visible ── */}
              {showTranslation && (
                <div
                  style={{
                    width: "66%",
                    height: "1px",
                    background: "rgba(255,255,255,0.07)",
                    margin: "0.15rem 0",
                    flexShrink: 0,
                  }}
                />
              )}

              {/* ── English ── */}
              {showTranslation && (
                <p
                  style={{
                    fontFamily: "'Noto Sans JP', sans-serif",
                    fontSize: "clamp(0.72rem, 1.35vw, 0.9rem)",
                    color: "#7a8fa8",
                    letterSpacing: "0.03em",
                    lineHeight: 1.5,
                  }}
                >
                  {displayEnglish}
                </p>
              )}
            </div>

          </div>
        )}

        {/* ── Completion Overlay — scoped inside Scene Viewport ── */}
        {isCompleted && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-2xl"
            style={{ background: "rgba(4,4,16,0.85)", backdropFilter: "blur(8px)", zIndex: 10 }}
          >
            <div className="text-5xl" style={{ filter: `drop-shadow(0 0 20px rgba(${theme.accentRgb},0.7))` }}>✨</div>
            <p className="text-white text-xl font-semibold" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              Scene Complete
            </p>
            <p className="text-sm" style={{ color: "#6b7a8d" }}>
              {lesson_lines.length} lines · {structured_content.vocabulary.length} vocabulary
            </p>
            <button
              onClick={() => restart()}
              className="mt-2 px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200"
              style={{
                background: `rgba(${theme.accentRgb},0.15)`,
                border: `1px solid ${theme.cardBorder}`,
                color: theme.accent,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `rgba(${theme.accentRgb},0.28)`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `rgba(${theme.accentRgb},0.15)`; }}
            >
              ↺ Watch Again
            </button>
          </div>
        )}

        {/* ── IDLE / PRELOADING Overlay — scoped inside Scene Viewport ── */}
        {(status === "IDLE" || status === "PRELOADING") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl" style={{ zIndex: 10 }}>
            {status === "IDLE" && preloadProgress === 0 && (
              <>
                <div className="mb-2 px-3 py-1 rounded text-xs tracking-widest uppercase" style={{ color: "#6b7a8d", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {lesson_lines.length} Lines · {structured_content.background_tag.replace(/_/g, " ")}
                </div>
                {error && <p className="text-red-400 text-xs max-w-xs text-center px-4">{error}</p>}
                <button
                  onClick={start}
                  className="flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-sm transition-all duration-300"
                  style={{
                    background: `rgba(${theme.accentRgb},0.12)`,
                    border: `1.5px solid ${theme.cardBorder}`,
                    color: theme.accent,
                    fontFamily: "'Noto Sans JP', sans-serif",
                    letterSpacing: "0.05em",
                    boxShadow: `0 0 32px rgba(${theme.accentRgb},0.1)`,
                  }}
                  onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = `rgba(${theme.accentRgb},0.25)`; b.style.boxShadow = `0 0 40px rgba(${theme.accentRgb},0.25)`; b.style.transform = "scale(1.04)"; }}
                  onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = `rgba(${theme.accentRgb},0.12)`; b.style.boxShadow = `0 0 32px rgba(${theme.accentRgb},0.1)`; b.style.transform = "scale(1)"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3 2.5l10 5.5-10 5.5V2.5z" />
                  </svg>
                  Start Lesson
                </button>
              </>
            )}
            {status === "PRELOADING" && (
              <div className="flex flex-col items-center gap-3 w-48">
                <p className="text-xs tracking-widest uppercase" style={{ color: "#6b7a8d", fontFamily: "'Noto Sans JP', sans-serif" }}>Loading audio…</p>
                <div className="w-full h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${preloadProgress}%`, background: `linear-gradient(to right, ${theme.accent}, ${theme.accent}cc)` }} />
                </div>
                <p className="text-xs tabular-nums" style={{ color: `rgba(${theme.accentRgb},0.7)` }}>{preloadProgress}%</p>
              </div>
            )}
          </div>
        )}

      </div>{/* end Scene Viewport */}
      {/* ── Interactive Lesson (Vocabulary + Grammar with TTS) ─── */}
      {!isFullscreen && (
        <InteractiveLesson
          structured_content={structured_content}
          lesson_lines={lesson_lines}
          learningDirection={learningDirection}
          theme={theme}
          onPlayAudio={pause}
          availableVoices={availableVoices}
          voicesLoading={voicesLoading}
          tokenizer={tokenizer}
        />
      )}

      {/* ── Keyframes + Ruby CSS ────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600&family=Noto+Serif+JP:wght@400;600&display=swap');

        @keyframes spriteBounce {
          from { transform: translateY(0px); }
          to   { transform: translateY(-6px); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-150%); }
          100% { transform: translateX(350%); }
        }

        ruby {
          ruby-align: center;
          ruby-position: over;
        }
        rt {
          font-size: 0.5em;
          color: var(--accent-rt, rgba(245,200,66,0.85));
          font-weight: 400;
          font-family: 'Noto Sans JP', sans-serif;
          letter-spacing: 0;
          opacity: var(--furi-opacity, 1);
          transition: opacity 0.2s ease;
          user-select: none;
        }

        /* ── Speed slider ── */
        .scene-subtitle-primary {
          display: block;
          width: max-content;
          max-width: min(100%, 72rem);
          margin: 0 auto;
          font-size: var(--subtitle-font-size, 1.58rem);
          white-space: nowrap;
          overflow: visible;
          overflow-wrap: normal;
          text-wrap: nowrap;
          transform: translateZ(0);
          backface-visibility: hidden;
        }

        .scene-subtitle-primary-fs {
          max-width: min(94vw, 86rem);
          font-size: var(--subtitle-font-size-fs, 2.7rem);
        }

        @media (max-width: 640px) {
          .scene-subtitle-primary {
            font-size: var(--subtitle-font-size-mobile, 1.28rem);
          }

          .scene-subtitle-primary-fs {
            font-size: var(--subtitle-font-size-fs-mobile, 1.85rem);
          }
        }

        .speed-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 3px;
          border-radius: 99px;
          outline: none;
          cursor: pointer;
        }
        .speed-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 13px;
          margin-top: -5px;
          height: 13px;
          border-radius: 50%;
          background: var(--slider-accent);
          box-shadow: 0 0 0 3px var(--slider-accent-mid), 0 0 8px var(--slider-accent);
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        .speed-slider::-moz-range-thumb {
          width: 13px;
          height: 13px;
          border-radius: 50%;
          border: none;
          background: var(--slider-accent);
          box-shadow: 0 0 0 3px var(--slider-accent-mid), 0 0 8px var(--slider-accent);
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        .speed-slider::-webkit-slider-thumb:hover {
          transform: scale(1.25);
          box-shadow: 0 0 0 4px var(--slider-accent-mid), 0 0 14px var(--slider-accent);
        }
        .speed-slider::-moz-range-thumb:hover {
          transform: scale(1.25);
          box-shadow: 0 0 0 4px var(--slider-accent-mid), 0 0 14px var(--slider-accent);
        }
        .speed-slider::-webkit-slider-runnable-track {
          height: 3px;
          border-radius: 99px;
        }
        .speed-slider::-moz-range-track {
          height: 3px;
          border-radius: 99px;
          background: rgba(255,255,255,0.1);
        }
        .speed-slider::-moz-range-progress {
          height: 3px;
          border-radius: 99px;
          background: var(--slider-accent);
        }

        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /*
         * Safe-area rules MUST live in a real stylesheet — iOS WebKit only resolves
         * env() in stylesheets, not via the CSSOM / React inline styles.
         *
         * .scene-page-header   — non-fullscreen portrait header; needs top padding
         *                        so it clears the Dynamic Island when the page
         *                        scrolls to the top or is the first element.
         * .interactive-lesson-toolbar — sticky study controls below the scene.
         * .fs-toggle-bar       — fullscreen top-left toggle bar.
         * .fs-fullscreen-btn   — fullscreen expand/compress button (top-right).
         *
         * NO hardcoded 59px floor: that value is the portrait Dynamic Island height
         * and causes gross over-padding in landscape where safe-area-inset-top is
         * nearly 0. viewport-fit=cover is confirmed set in layout.tsx so env() gives
         * the correct value in both orientations automatically.
         */
        .scene-page-header {
          padding-top: calc(env(safe-area-inset-top, 0px) + 8px);
        }
        @media (max-width: 640px) {
          .scene-page-header {
            align-items: flex-end;
            flex-direction: row;
            flex-wrap: nowrap;
            gap: 8px;
            margin-bottom: 2px;
          }
          .scene-title-wrap {
            width: auto;
            flex: 1 1 auto;
            min-width: 0;
          }
          .scene-title-wrap h2 {
            line-height: 1.25;
            overflow-wrap: anywhere;
          }
          .scene-controls {
            width: auto;
            flex: 0 0 auto;
            align-self: flex-end;
            flex-wrap: nowrap;
            justify-content: flex-end;
            margin-left: auto;
          }
          .scene-page-header-ja {
            align-items: stretch;
            flex-direction: column;
            flex-wrap: wrap;
          }
          .scene-page-header-ja .scene-title-wrap {
            width: 100%;
            flex: none;
          }
          .scene-page-header-ja .scene-controls {
            width: 100%;
            align-self: stretch;
            flex-wrap: wrap;
            justify-content: flex-start;
            margin-left: 0;
          }
        }
        .interactive-lesson-toolbar {
          top: calc(env(safe-area-inset-top, 0px) + 0px);
        }
        .fs-toggle-bar {
          padding-top: calc(env(safe-area-inset-top, 0px) + 12px);
        }
        .fs-fullscreen-btn {
          top: calc(env(safe-area-inset-top, 0px) + 8px);
        }
      `}</style>
    </div>
  );
}
