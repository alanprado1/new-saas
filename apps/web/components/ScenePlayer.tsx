"use client";

import { useEffect, useRef, useCallback, useReducer, useState } from "react";
import { Howl } from "howler";
import { createClient } from "@supabase/supabase-js";

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
  | "COMPLETED"
  | "REGENERATING"; // voice change in flight — waiting for worker to finish

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
  | { type: "REGENERATING" }
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
    case "REGENERATING":
      // Stop current playback index and show the waiting overlay.
      return { ...state, status: "REGENERATING", currentIndex: 0, preloadProgress: 0 };
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
  if (!tokenizer) return text;
  return tokenizer
    .tokenize(text)
    .map((token) => (showFurigana ? addFurigana(token) : token.surface_form))
    .join("");
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
        // Both directions would exceed MAX_CHUNK — keep this chunk as-is
        exempt.add(j);
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

  // ── PLAYBACK RATE ────────────────────────────────────────────
  // We keep BOTH a ref and a state value:
  //   playbackRateRef — read synchronously inside playLine (closure-safe, no
  //                     stale-capture risk even though playLine is memoised).
  //   playbackRate    — React state so the UI re-renders when the value changes.
  const playbackRateRef = useRef<number>(1.0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

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
      if (id !== null) {
        howl.rate(clamped, id);
      } else {
        howl.rate(clamped);
      }
    }
  }, []);

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
                html5: false, // Web Audio API — fully decodes into buffer, enables clean sequential switching
                format: ["wav"],
                onload: () => {
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

      // Reset seek tracker — new line starts at 0.
      seekPositionRef.current = 0;
      intendedSeekRef.current = 0;
      lastSeekTimeRef.current = 0;
      lineEndedRef.current    = false;
      isPausedRef.current     = false;  // starting a new line — not paused
      // Clear any existing tick interval from a previous line.
      if (seekTickRef.current) clearInterval(seekTickRef.current);

      // Strip all "end" and "play" listeners from previous session on this howl.
      howl.off("end");
      howl.off("play");

      // Tick seekPositionRef forward every 100ms so rewind always
      // has an accurate current position to subtract from.
      // The timestamp guard (lastSeekTimeRef) prevents the tick from overwriting a
      // position that was just set by seekTo() before Web Audio has flushed it.
      howl.once("play", (soundId: number) => {
        // Record this specific sound instance — used by pause/resume/stop.
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
      howl.rate(playbackRateRef.current);

      // play() returns a sound ID — we capture it via the "play" event above
      // because play() itself is synchronous but the ID arrives in the callback.
      howl.play();
    },
    [lines.length, stopCurrent]
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
      howl.play(id);
    } else {
      howl.play();
    }
    dispatch({ type: "RESUME" });
  }, [state.currentIndex, lines.length, playLine]);

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
    const howl = howlsRef.current[state.currentIndex];
    if (!howl) return;

    // Read the actual current audio position
    const currentPos = seekPositionRef.current;

    // If we are more than 1.5 seconds into the audio, 
    // just restart the current line from the beginning.
    if (currentPos > 1.5) {
      seekTo(howl, 0);
    } 
    // If we are right at the beginning of the line, 
    // jump back to the previous character's line entirely.
    else {
      const prevIndex = Math.max(0, state.currentIndex - 1);
      playLine(prevIndex);
    }
  }, [state.currentIndex, seekTo, playLine]);

  const start = useCallback(async () => {
    await preloadAudio();
    requestAnimationFrame(() => playLine(0));
  }, [preloadAudio, playLine]);

  // cacheBust: pass Date.now().toString() when restarting after a voice change
  // so the browser fetches fresh bytes instead of serving cached old-voice audio.
  const restart = useCallback(async (cacheBust: string | null = null) => {
    transitionTimerRef.current && clearTimeout(transitionTimerRef.current);
    if (seekTickRef.current) clearInterval(seekTickRef.current);
    stopCurrent();
    await preloadAudio(cacheBust);
    requestAnimationFrame(() => playLine(0));
  }, [preloadAudio, playLine, stopCurrent]);

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
    source.onerror = (e) => reject(new Error(String(e)));
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

// ============================================================
// SECTION 7: VOICE DROPDOWN
// ============================================================

// Shape of a single flattened voice entry as returned by /api/voices.
// Matches the object the API route builds from VoiceVox's /speakers response:
//   { id: number, label: string (character name), sublabel: string (style name) }
export interface VoiceEntry {
  id: number;
  label: string;
  sublabel: string;
}

function VoiceDropdown({
  selectedId,
  onChange,
  voices,
  theme,
}: {
  selectedId: number;
  onChange: (id: number) => void;
  voices: VoiceEntry[];
  theme: Theme;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null); // Add this ref

  // Add this useEffect to close the dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    // Attach the ref to the parent div
    <div className="relative" style={{ userSelect: "none" }} ref={dropdownRef}> 
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150"
        style={{
          background: open ? theme.accentMid : "rgba(255,255,255,0.05)",
          border: open ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.1)",
          color: open ? theme.accent : "#6b7a8d",
          fontFamily: "'Noto Sans JP', sans-serif",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ flexShrink: 0 }}>
          <path d="M5 0a3 3 0 100 6A3 3 0 005 0zM1 8.5C1 7.1 2.8 6 5 6s4 1.1 4 2.5" strokeWidth="0" />
        </svg>
        Voice
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ opacity: 0.6 }}>
          <path d="M1 2l3 3 3-3" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 rounded-lg overflow-hidden z-50"
          style={{
            background: "rgba(12,12,24,0.97)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
            minWidth: "200px",
            maxHeight: "260px",
            overflowY: "auto",
          }}
        >
          {voices.length === 0 && (
            <div
              className="px-3 py-3 text-center"
              style={{ color: "#4a5568", fontSize: "0.75rem", fontFamily: "'Noto Sans JP', sans-serif" }}
            >
              Loading voices…
            </div>
          )}

          {voices.map(v => (
            <button
              key={v.id}
              onClick={() => { onChange(v.id); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 transition-all duration-100 text-left"
              style={{
                background: v.id === selectedId ? theme.accentMid : "transparent",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = v.id === selectedId ? theme.accentMid : "transparent"; }}
            >
              <span style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: "0.8rem", color: v.id === selectedId ? theme.accent : "#e0e8f0" }}>
                {v.label}
              </span>
              <span style={{ fontSize: "0.68rem", color: "#4a5568", marginLeft: "8px", flexShrink: 0 }}>
                {v.sublabel}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SECTION 7b: SPEED CONTROL
// ============================================================

function SpeedControl({
  rate,
  onChange,
  theme,
}: {
  rate: number;
  onChange: (r: number) => void;
  theme: Theme;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside — same pattern as VoiceDropdown.
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
            right: 0,
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

interface InteractiveLessonProps {
  structured_content: StructuredContent;
  lesson_lines: LessonLine[]; // <--- ADD THIS
  theme: Theme;
  onPlayAudio: () => void;
  availableVoices: VoiceEntry[];
  tokenizer: KuromojiTokenizer | null;
}

function InteractiveLesson({ structured_content, lesson_lines, theme, onPlayAudio, availableVoices, tokenizer }: InteractiveLessonProps) {

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

  const [ttsProvider, setTtsProvider] = useState<"gemini" | "edge" | "voicevox">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("pref_ttsProvider") as any) || "gemini";
    return "gemini";
  });
  const [geminiVoice, setGeminiVoice] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("pref_geminiVoice") || "Kore";
    return "Kore";
  });
  const [edgeVoice, setEdgeVoice] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("pref_edgeVoice") || "ja-JP-NanamiNeural";
    return "ja-JP-NanamiNeural";
  });
  const [voiceVoxId, setVoiceVoxId] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pref_voiceVoxId");
      return stored ? parseInt(stored, 10) : 1;
    }
    return 1;
  });

  useEffect(() => { localStorage.setItem("pref_ttsProvider", ttsProvider); }, [ttsProvider]);
  useEffect(() => { localStorage.setItem("pref_geminiVoice", geminiVoice); }, [geminiVoice]);
  useEffect(() => { localStorage.setItem("pref_edgeVoice", edgeVoice); }, [edgeVoice]);
  useEffect(() => { localStorage.setItem("pref_voiceVoxId", voiceVoxId.toString()); }, [voiceVoxId]);

  const settingsRef = useRef<HTMLDivElement>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

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
        // Fallback to generating new TTS
        const voice = ttsProvider === "gemini" ? geminiVoice : ttsProvider === "edge" ? edgeVoice : voiceVoxId;
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, provider: ttsProvider, voice }),
        });
        if (!res.ok) throw new Error(`TTS API ${res.status}`);
        const data = await res.json();
        if (data.audioBase64) {
          await playBase64Wav(data.audioBase64, getAudioCtx());
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
  }, [playingKey, ttsProvider, geminiVoice, edgeVoice, voiceVoxId, getAudioCtx, onPlayAudio]);

  // ── Enlarged Font Styles for Single-Column Readability ──
  const sectionCard: React.CSSProperties = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px" };
  const sectionHeading: React.CSSProperties = { fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: theme.accent, fontFamily: "'Noto Sans JP', sans-serif", marginBottom: "16px" };
  const exampleBlock: React.CSSProperties = { background: "rgba(0,0,0,0.35)", border: `1px solid ${theme.cardBorder}`, borderRadius: "10px", padding: "10px 14px", marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" };
  const jpText: React.CSSProperties = { 
    fontFamily: "'Kikai Chokoku JIS', 'Noto Sans JP', 'Noto Serif JP', serif", 
    fontSize: "2rem", 
    color: "rgba(255,255,255,0.92)", 
    lineHeight: 1.6,
    ["--furi-opacity" as string]: showFurigana ? 1 : 0, // <--- NEW
  };
  const romajiText: React.CSSProperties = { fontFamily: "'Noto Sans JP', sans-serif", fontSize: "0.9rem", color: `rgba(${theme.accentRgb},0.75)`, letterSpacing: "0.03em", marginTop: "4px" };
  const enText: React.CSSProperties = { fontSize: "0.9rem", color: "#7a8fa8", marginTop: "4px", fontStyle: "italic" };

  // Finds the matching story line and steals its pre-generated character audio
  const getMatchingAudio = (exampleJp: string) => {
    if (!exampleJp || !lesson_lines) return undefined;
    const cleanTarget = exampleJp.replace(/[。、！？\s]/g, "");
    if (!cleanTarget) return undefined;
    const match = lesson_lines.find(line => {
      const cleanKanji = line.kanji.replace(/[。、！？\s]/g, "");
      return cleanKanji.includes(cleanTarget) || cleanTarget.includes(cleanKanji);
    });
    return match ? match.audio_url : undefined;
  };

  function TTSPlayBtn({ text, id, overrideAudioUrl }: { text: string; id: string; overrideAudioUrl?: string }) {
    const isThis = playingKey === id;
    return (
      <button
        onClick={() => playTTS(text, id, overrideAudioUrl)}
        disabled={!!playingKey && !isThis}
        title="Play pronunciation"
        style={{
          flexShrink: 0, width: "26px", height: "26px", borderRadius: "50%",
          marginTop: "10px", // <--- OPTICAL NUDGE TO COUNTER THE FURIGANA HEIGHT
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
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(8,8,18,0.88)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 4px", marginBottom: "18px" }}>
        <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#6b7a8d" }}>Interactive Lesson</span>
        <div className="flex items-center gap-1.5">
          <ToggleButton active={showFurigana} onClick={() => setShowFurigana(v => !v)} theme={theme}>振り仮名</ToggleButton>
          <ToggleButton active={showRomaji} onClick={() => setShowRomaji(v => !v)} theme={theme}>Romaji</ToggleButton>
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
                  {(["gemini", "edge", "voicevox"] as const).map(p => (
                    <button key={p} onClick={() => setTtsProvider(p)} className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all duration-150" style={{ background: ttsProvider === p ? theme.accentMid : "rgba(255,255,255,0.05)", border: ttsProvider === p ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.1)", color: ttsProvider === p ? theme.accent : "#6b7a8d" }}>
                      {p === "gemini" ? "Gemini" : p === "edge" ? "Edge" : "VoiceVox"}
                    </button>
                  ))}
                </div>

                {ttsProvider === "gemini" && (
                  <div className="flex flex-col gap-1.5">
                    {["Kore","Charon","Aoede","Leda","Zephyr"].map(v => (
                      <button key={v} onClick={() => setGeminiVoice(v)} className="text-left px-2.5 py-1.5 rounded-md text-xs transition-all duration-150" style={{ background: geminiVoice === v ? theme.accentMid : "transparent", border: geminiVoice === v ? `1px solid ${theme.cardBorder}` : "1px solid transparent", color: geminiVoice === v ? theme.accent : "#8a9ab8" }}>{v}</button>
                    ))}
                  </div>
                )}

                {ttsProvider === "edge" && (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {EDGE_VOICES.map(v => (
                      <button key={v.name} onClick={() => setEdgeVoice(v.name)} className="text-left px-2.5 py-1.5 rounded-md text-xs transition-all duration-150 flex justify-between" style={{ background: edgeVoice === v.name ? theme.accentMid : "transparent", border: edgeVoice === v.name ? `1px solid ${theme.cardBorder}` : "1px solid transparent", color: edgeVoice === v.name ? theme.accent : "#8a9ab8" }}>
                        <span>{v.label}</span>
                        <span style={{ fontSize: "0.6rem", color: "#6b7a8d" }}>{v.desc.split(' · ')[1]}</span>
                      </button>
                    ))}
                  </div>
                )}

                {ttsProvider === "voicevox" && (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {availableVoices.length === 0 ? <p style={{ fontSize: "0.65rem", color: "#6b7a8d" }}>Loading...</p> : availableVoices.map(v => (
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
        <div style={sectionCard}>
          <h3 style={sectionHeading}>Transcript</h3>
          <div className="flex flex-col gap-6">
            {lesson_lines.map((line, i) => (
              <div key={line.id || i}>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {line.speaker}
                  </span>
                </div>
                <div style={exampleBlock}>
                  {/* Top Row: Play Button + Centered Japanese Text */}
                  <div className="flex items-center gap-3">
                    <TTSPlayBtn text={line.kanji} id={`transcript-${i}`} overrideAudioUrl={line.audio_url} />
                    <div style={{ minWidth: 0, width: "100%" }}>
                      <p style={{ ...jpText, margin: 0 }} dangerouslySetInnerHTML={{ __html: buildFuriganaHTML(line.kanji, tokenizer, true) }} />
                    </div>
                  </div>
                  {/* Bottom Row: Indented Romaji & English */}
                  {(showRomaji && line.romaji || line.english) && (
                    <div style={{ paddingLeft: "38px" }}>
                      {showRomaji && line.romaji && <p style={{ ...romajiText, marginTop: 0 }}>{line.romaji}</p>}
                      {line.english && <p style={enText}>{line.english}</p>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Vocabulary ──────────────────────────────────── */}
        <div style={sectionCard}>
          <h3 style={sectionHeading}>Vocabulary</h3>
          <div className="flex flex-col gap-6">
            {structured_content.vocabulary.map((v, i) => (
              <div key={i}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span style={{ fontFamily: "'Kikai Chokoku JIS', 'Noto Sans JP', 'Noto Serif JP', serif", fontSize: "1.3rem", color: "white", fontWeight: 200 }}>{v.word}</span>
                    <span style={{ fontSize: "0.85rem", color: "#a8b4c8" }}>{v.reading}</span>
                  </div>
                  <span style={{ fontSize: "0.9rem", color: "#a8b4c8", fontStyle: "italic", flexShrink: 0 }}>{v.meaning}</span>
                </div>
                {v.example_jp && (
                  <div style={exampleBlock}>
                    {/* Top Row: Play Button + Centered Japanese Text */}
                    <div className="flex items-center gap-3">
                      <TTSPlayBtn text={v.example_jp} id={`vocab-${i}`} overrideAudioUrl={getMatchingAudio(v.example_jp)} />
                      <div style={{ minWidth: 0, width: "100%" }}>
                        <p style={{ ...jpText, margin: 0 }} dangerouslySetInnerHTML={{ __html: buildFuriganaHTML(v.example_jp, tokenizer, true) }} />
                      </div>
                    </div>
                    {/* Bottom Row: Indented Romaji & English */}
                    {(showRomaji && v.example_romaji || v.example_en) && (
                      <div style={{ paddingLeft: "38px" }}>
                        {showRomaji && v.example_romaji && <p style={{ ...romajiText, marginTop: 0 }}>{v.example_romaji}</p>}
                        {v.example_en && <p style={enText}>{v.example_en}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Grammar ─────────────────────────────────────── */}
        <div style={sectionCard}>
          <h3 style={sectionHeading}>Grammar Points</h3>
          <div className="flex flex-col gap-8">
            {structured_content.grammar_points.map((g, i) => (
              <div key={i}>
                <p style={{ color: "white", fontSize: "1.15rem", fontWeight: 200, fontFamily: "'Kikai Chokoku JIS', 'Noto Sans JP', 'Noto Serif JP', serif", marginBottom: "6px" }}>{g.pattern}</p>
                {g.explanation && <p style={{ fontSize: "0.9rem", color: "#a8b4c8", lineHeight: 1.6, marginBottom: "8px" }}>{g.explanation}</p>}
                {g.example_jp && (
                  <div style={exampleBlock}>
                    {/* Top Row: Play Button + Centered Japanese Text */}
                    <div className="flex items-center gap-3">
                      <TTSPlayBtn text={g.example_jp} id={`grammar-${i}`} overrideAudioUrl={getMatchingAudio(g.example_jp)} />
                      <div style={{ minWidth: 0, width: "100%" }}>
                        <p style={{ ...jpText, margin: 0 }} dangerouslySetInnerHTML={{ __html: buildFuriganaHTML(g.example_jp, tokenizer, true) }} />
                      </div>
                    </div>
                    {/* Bottom Row: Indented Romaji & English */}
                    {(showRomaji && g.example_romaji || g.example_en) && (
                      <div style={{ paddingLeft: "38px" }}>
                        {showRomaji && g.example_romaji && <p style={{ ...romajiText, marginTop: 0 }}>{g.example_romaji}</p>}
                        {g.example_en && <p style={enText}>{g.example_en}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScenePlayer({ lesson_id, structured_content, background_image_url, lesson_lines, theme }: LessonProps) {
  const { state, dispatch, start, restart, pause, resume, rewind, getDuration, playbackRate, changeSpeed, seekPositionRef } = useScenePlayer(lesson_lines);
  const { status, currentIndex, preloadProgress, error } = state;

  // ── Fullscreen ───────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.warn("[ScenePlayer] Fullscreen request failed:", err);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Keep isFullscreen in sync with native Esc key / browser controls
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
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

  // ── Voice selection & changer ────────────────────────────────
  const [selectedVoiceId, setSelectedVoiceId] = useState(1);
  const [voiceError, setVoiceError]           = useState<string | null>(null);

  // ── Dynamic voice list fetched from /api/voices ──────────────
  // Starts empty ([]) — VoiceDropdown shows "Loading voices…" while this is
  // in flight. /api/voices proxies GET /speakers from the local VoiceVox engine
  // and returns a flat array of { id, label, sublabel } objects so we always
  // show exactly the voices the user actually has installed.
  const [availableVoices, setAvailableVoices] = useState<VoiceEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/voices")
      .then(res => {
        if (!res.ok) throw new Error(`/api/voices returned ${res.status}`);
        return res.json();
      })
      .then((data: VoiceEntry[]) => {
        if (!cancelled) setAvailableVoices(data);
      })
      .catch(err => {
        // Non-fatal — the dropdown will stay in "Loading voices…" state.
        // The user can still play the lesson; voice switching just won't list options.
        console.warn("[ScenePlayer] Could not fetch available voices:", err.message);
      });
    return () => { cancelled = true; };
  }, []);

  // handleVoiceChange — calls /api/voice, enters REGENERATING state,
  // then a Supabase Realtime listener (below) fires restart() when
  // the worker marks the lesson as 'ready' again.
  const handleVoiceChange = useCallback(async (speakerId: number) => {
    if (speakerId === selectedVoiceId) return; // no-op if already selected
    setVoiceError(null);
    setSelectedVoiceId(speakerId);

    // Stop whatever is playing so the user doesn't hear stale audio.
    dispatch({ type: "REGENERATING" });

    try {
      // Grab the Supabase session token from localStorage (Supabase JS SDK persists it there).
      const storageKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
      const sessionRaw = storageKey ? localStorage.getItem(storageKey) : null;
      const accessToken = sessionRaw ? JSON.parse(sessionRaw)?.access_token : null;

      if (!accessToken) {
        throw new Error("No active session. Please reload and try again.");
      }

      const res = await fetch("/api/voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ lesson_id, voice_id: speakerId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Server error ${res.status}`);
      }
      // Success — stay in REGENERATING. The Realtime listener below
      // will call restart() once the worker flips status → 'ready'.
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Voice change failed.";
      console.error("[ScenePlayer] Voice change error:", msg);
      setVoiceError(msg);
      // Roll back to IDLE so the user can still press Start manually.
      dispatch({ type: "ERROR", message: msg });
    }
  }, [lesson_id, selectedVoiceId, dispatch]);

  // ── Supabase Realtime — watch for lesson status → 'ready' ────
  // When the worker finishes regenerating audio it sets status = 'ready'
  // on the lessons row. We listen for that UPDATE here and call restart()
  // so the player picks up the fresh audio_url values automatically.
  //
  // We use the anon key (public, safe for the browser). The channel filter
  // targets only this specific lesson UUID so we never react to other users'
  // lessons. No auth token needed for the Realtime subscription itself.
  useEffect(() => {
    if (!lesson_id) return;

    const supabase = _supabaseRT;

    const channel = supabase
      .channel(`lesson-ready-${lesson_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lessons",
          filter: `id=eq.${lesson_id}`,
        },
        (payload: { new: { status: string } }) => {
          const newStatus = payload?.new?.status;
          if (newStatus === "ready") {
            // Pass a cache-bust timestamp so the browser fetches the new voice
            // bytes instead of serving the old WAV from its HTTP cache.
            // The worker overwrites the same storage paths on every voice change,
            // so without this the browser would play the old voice indefinitely.
            const bust = Date.now().toString();
            console.log("[ScenePlayer] Lesson ready — restarting with new audio (cache bust:", bust, ")");
            restart(bust);
          } else if (newStatus === "failed") {
            const msg = "Voice regeneration failed. Please try again.";
            setVoiceError(msg);
            dispatch({ type: "ERROR", message: msg });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // restart is stable (useCallback with no deps that change), lesson_id is constant.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson_id]);

  // ── Kuromoji tokenizer ──────────────────────────────────────
  const [tokenizer, setTokenizer] = useState<KuromojiTokenizer | null>(null);
  const [kuroReady, setKuroReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.kuromoji) return;
    window.kuromoji
      .builder({ dicPath: "/dict" })
      .build((err, t) => {
        if (err) {
          console.warn("[ScenePlayer] Kuromoji failed to load:", err);
          return;
        }
        setTokenizer(t);
        setKuroReady(true);
      });
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
  const expression  = currentLine ? getExpression(currentLine.kanji) : "neutral";

  // ── Live background URL ──────────────────────────────────────
  // background_image_url prop is the value at the moment fetchLessonData ran.
  // Image generation runs in parallel with the 202 response, so the prop is
  // often null when ScenePlayer first mounts — even though the image arrives
  // ~10s later. We keep a local state copy and update it via Realtime so the
  // background appears automatically once the DB column is written.
  const [liveBgUrl, setLiveBgUrl] = useState<string | null>(background_image_url ?? null);

  useEffect(() => {
    // Sync if the prop later becomes non-null (e.g. parent re-renders)
    if (background_image_url && !liveBgUrl) setLiveBgUrl(background_image_url);
  }, [background_image_url]);

  useEffect(() => {
    // Already have a URL — nothing to watch for
    if (liveBgUrl) return;

    const supabase = _supabaseRT;
    const channel = supabase
      .channel(`lesson-bg-${lesson_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lessons", filter: `id=eq.${lesson_id}` },
        (payload) => {
          const url = (payload.new as { background_image_url?: string | null }).background_image_url;
          if (url) {
            setLiveBgUrl(url);
            supabase.removeChannel(channel);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lesson_id, liveBgUrl]);

  const bgImage = getBackgroundStyle(liveBgUrl);

  const isPlaying      = status === "PLAYING_LINE" || status === "WAITING_NEXT";
  const isPaused       = status === "PAUSED";
  const isCompleted    = status === "COMPLETED";
  const isRegenerating = status === "REGENERATING";
  const isActive       = isPlaying || isPaused || status === "WAITING_NEXT";
  const showControls   = isActive;

  // ── Subtitle chunking ───────────────────────────────────────
  // Split the current line's kanji into display chunks at 。/ 、boundaries.
  // The active chunk advances using the actual Howl audio duration so timing
  // is always perfectly proportional to the real audio, not a character guess.
  const [chunkIndex, setChunkIndex] = useState(0);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chunks = currentLine ? chunkJapaneseLine(currentLine.kanji) : [""];

  // Reset chunk index whenever the line changes.
  useEffect(() => {
    setChunkIndex(0);
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
  }, [currentIndex]);

  // ── Seek-position-based chunk advancement ────────────────────
  // Previous approach used setTimeout with duration()-derived offsets.
  // Bug: html5:true Howlers return duration()=0 until the audio actually
  // starts playing (HTML5 Audio metadata loads async). The character-count
  // fallback produced wrong offsets — chunk timers fired after the line had
  // already ended, so setChunkIndex had no visible effect.
  //
  // Fix: poll seekPositionRef every 80ms (already kept accurate by the
  // existing seek tick in playLine). When duration IS available, compute
  // which chunk should be active from the live seek fraction. When duration
  // is still 0, stay on chunk 0 until it resolves — then catch up instantly.
  // This is always correct regardless of when metadata arrives.
  useEffect(() => {
    if (!isPlaying || !currentLine || chunks.length <= 1) return;
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);

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

      setChunkIndex(prev => (prev !== target ? target : prev));
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
  const romajiChunks  = currentLine && chunks.length > 1
    ? chunkWesternLine(currentLine.romaji,  chunks.length)
    : null;
  const englishChunks = currentLine && chunks.length > 1
    ? chunkWesternLine(currentLine.english, chunks.length)
    : null;

  const safeIndex     = Math.min(chunkIndex, chunks.length - 1);
  const displayKanji  = chunks[safeIndex]                          ?? currentLine?.kanji   ?? "";
  const displayRomaji = romajiChunks  ? (romajiChunks[safeIndex]  ?? currentLine?.romaji  ?? "") : (currentLine?.romaji  ?? "");
  const displayEnglish = englishChunks ? (englishChunks[safeIndex] ?? currentLine?.english ?? "") : (currentLine?.english ?? "");

  // Progress fraction for the slim timeline bar (0–1).
  const progressFraction = lesson_lines.length > 1
    ? currentIndex / (lesson_lines.length - 1)
    : 0;

  // ── Memoised subtitle font sizes (Locked sizes so they don't jump) ──────
  const subtitleFontSize = (() => {
    const len = displayKanji.length;
    // Locked to the "safe" sizes that leave room for Furigana
    if (len <= 10) return "clamp(1.65rem, 3.3vw, 2.25rem)";
    if (len <= 20) return "clamp(1.5rem, 3.0vw, 1.875rem)";
    return "clamp(1.275rem, 2.4vw, 1.575rem)";
  })();

  const subtitleFontSizeFS = (() => {
    const len = displayKanji.length;
    if (len <= 10) return "clamp(2.5rem, 4.5vw, 4rem)";
    if (len <= 20) return "clamp(2.1rem, 3.8vw, 3.2rem)";
    return "clamp(1.7rem, 3.0vw, 2.5rem)";
  })();

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col gap-2 select-none relative"
      style={isFullscreen ? {
        background: "#000",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        ["--accent-rt" as string]: `rgba(${theme.accentRgb},0.85)`,
      } : {
        ["--accent-rt" as string]: `rgba(${theme.accentRgb},0.85)`,
      }}
    >

      {/* ── Scene Title + Display Toggles ───────────────────────── */}
      {!isFullscreen && (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-mono tracking-widest uppercase px-2 py-1 rounded"
            style={{ background: `rgba(${theme.accentRgb},0.15)`, color: theme.accent, border: `1px solid ${theme.cardBorder}` }}
          >
            {structured_content.background_tag.replace(/_/g, " ")}
          </span>
          <h2
            className="text-white font-semibold text-lg tracking-tight"
            style={{ fontFamily: "'Noto Serif JP', serif", textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
          >
            {structured_content.title}
          </h2>
        </div>

        {/* Subtitle visibility toggles + voice dropdown */}
        <div className="flex items-center gap-1.5">
          <ToggleButton active={showFurigana}    onClick={() => setShowFurigana(v => !v)}    theme={theme}>振り仮名</ToggleButton>
          <ToggleButton active={showRomaji}      onClick={() => setShowRomaji(v => !v)}      theme={theme}>Romaji</ToggleButton>
          <ToggleButton active={showTranslation} onClick={() => setShowTranslation(v => !v)} theme={theme}>EN</ToggleButton>
          <VoiceDropdown selectedId={selectedVoiceId} onChange={handleVoiceChange} voices={availableVoices} theme={theme} />
          <SpeedControl rate={playbackRate} onChange={changeSpeed} theme={theme} />
          {!kuroReady && (
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
                    key={`${currentLine.speaker}-${expression}-${currentIndex}`}
                    src={`/sprites/${speakerSlug}_${expression}.png`}
                    alt={`${currentLine.speaker} ${expression}`}
                    className="h-full w-auto object-contain drop-shadow-2xl"
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
              className="absolute flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150"
              style={{
                top: "0.75rem",
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
                className="absolute top-3 left-3 flex items-center gap-1.5 z-20"
              >
                <ToggleButton active={showFurigana}    onClick={() => setShowFurigana(v => !v)}    theme={theme}>振り仮名</ToggleButton>
                <ToggleButton active={showRomaji}      onClick={() => setShowRomaji(v => !v)}      theme={theme}>Romaji</ToggleButton>
                <ToggleButton active={showTranslation} onClick={() => setShowTranslation(v => !v)} theme={theme}>EN</ToggleButton>
                <VoiceDropdown selectedId={selectedVoiceId} onChange={handleVoiceChange} voices={availableVoices} theme={theme} />
                <SpeedControl rate={playbackRate} onChange={changeSpeed} theme={theme} />
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
                  paddingTop: "4rem",
                  paddingBottom: "2rem",
                  paddingLeft: "4rem",
                  paddingRight: "4rem",
                }}>
                  {/* Japanese + controls row */}
                  <div className="relative flex items-center justify-center w-full">
                    <p
                      className="text-white text-center"
                      style={{
                        fontFamily: "'Kikai Chokoku JIS', 'Noto Sans JP', 'Noto Serif JP', serif",
                        fontSize: subtitleFontSizeFS,
                        fontWeight: 700,
                        textShadow: "0 2px 24px rgba(0,0,0,1), 0 0 60px rgba(0,0,0,0.8)",
                        lineHeight: "2.2", // <--- LOCKED
                        letterSpacing: "0.02em",
                        ["--furi-opacity" as string]: showFurigana && kuroReady ? 1 : 0, // <--- NEW
                      }}
                      dangerouslySetInnerHTML={{ __html: getFuriganaHTML(displayKanji) }}
                    />
                    {/* Fullscreen controls — right-pinned */}
                    {showControls && (
                      <div className="absolute right-0 flex items-center gap-1.5" style={{ top: "50%", transform: "translateY(-50%)" }}>
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
                          {/* <span style={{ fontSize: "11px", fontFamily: "monospace", lineHeight: 1 }}>|◁</span> */}
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
                  </div>

                  {/* Romaji */}
                  {showRomaji && (
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
              className="flex flex-col items-center justify-center text-center gap-1.5 w-full"
              style={{
                paddingTop: showFurigana && kuroReady ? "0.8em" : "0.5rem",
                paddingBottom: "1rem",
                paddingLeft: "1.5rem",
                paddingRight: "1.5rem",
                minHeight: "90px",
              }}
            >
              {/* ── Japanese line + inline controls ── */}
              <div className="relative w-full flex items-center justify-center">
                {/* Japanese text — centered */}
                <p
                  className="text-white"
                  style={{
                    fontFamily: "'Kikai Chokoku JIS', 'Noto Sans JP', 'Noto Serif JP', serif",
                    fontSize: subtitleFontSize,
                    fontWeight: 600,
                    textShadow: "0 2px 16px rgba(0,0,0,0.9), 0 0 40px rgba(255,255,255,0.05)",
                    lineHeight: "2.2", // <--- LOCKED
                    letterSpacing: "0.01em",
                    ["--furi-opacity" as string]: showFurigana && kuroReady ? 1 : 0, // <--- NEW
                  }}
                  dangerouslySetInnerHTML={{ __html: getFuriganaHTML(displayKanji) }}
                />
                {/* Controls — pinned to right edge, vertically centered with the text */}
                {showControls && (
                  <div className="absolute right-0 flex items-center gap-1" style={{ top: "50%", transform: "translateY(-50%)" }}>
                    {/* ⏪ Rewind 3s */}
                    {/* ⏪ Previous Line / Restart */}
                    <button
                      onClick={rewind}
                      title="Previous Line / Restart"
                      className="flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-150"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#a8b4c8",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.13)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "#a8b4c8"; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M6 1L1 6l5 5V7.5c2.8.3 4.5 1.8 5 4.5C11 7 9 3.5 6 3V1z" />
                      </svg>
                      {/* <span style={{ fontSize: "10px", fontFamily: "monospace", lineHeight: 1 }}>|◁</span> */}
                    </button>
                    {/* ▶ / ⏸ Play-Pause */}
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

              {/* ── Romaji ── */}
              {showRomaji && (
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
              onClick={restart}
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

        {/* ── REGENERATING Overlay — scoped inside Scene Viewport ── */}
        {isRegenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl" style={{ zIndex: 10 }}>
            <div className="flex flex-col items-center gap-3 w-56">
              <p className="text-xs tracking-widest uppercase text-center" style={{ color: theme.accent, fontFamily: "'Noto Sans JP', sans-serif" }}>
                Changing Voice…
              </p>
              <p className="text-xs text-center" style={{ color: "#6b7a8d" }}>
                Regenerating audio with the new voice.
              </p>
              <div className="w-full h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full" style={{ width: "40%", background: `linear-gradient(to right, transparent, ${theme.accent}, transparent)`, animation: "shimmer 1.4s ease-in-out infinite" }} />
              </div>
              {voiceError && <p className="text-xs text-center text-red-400 mt-1">{voiceError}</p>}
            </div>
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
          theme={theme}
          onPlayAudio={pause}
          availableVoices={availableVoices}
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
      `}</style>
    </div>
  );
}
