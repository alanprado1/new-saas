"use client";

import { useEffect, useRef, useCallback, useReducer, useState, useMemo } from "react";
import { Howl } from "howler";
import { createClient } from "@supabase/supabase-js";
import DOMPurify from "isomorphic-dompurify";
import { segmentJapaneseWords, type JapaneseWordSegment } from "@/lib/japanese-word-segments";
import { resolveJapaneseCharacterVoices } from "@/lib/lesson-word-voices";
import { getWordAudioSession, type WordClipItem } from "@/lib/word-audio-session";
import { ensureSession, supabase as browserSupabase } from "@/lib/supabase";
import { useDock } from "@/components/shell/DockFrame";
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
  character_voices?: Record<string, number | string>;
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
  voice_id?: number | null;
  structured_content: StructuredContent;
  background_image_url: string | null; // Supabase public URL set after image generation
  lesson_lines: LessonLine[];
  learningDirection?: LearningDirection;
  /** Optional legacy prop: colours now come from CSS variables, so it is unused. */
  theme?: Theme;
  /** When provided, the page header shows a back button that calls it. */
  onBack?: () => void;
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

type WebkitFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

type WebkitFullscreenElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => void;
};

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
  pos_detail_1?: string;
  conjugated_form?: string;
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

function makeWordClipItem(segment: JapaneseWordSegment, provider: LessonTTSProvider, voice: string | number): WordClipItem {
  return {
    key: `${provider}:${String(voice)}:${segment.speech}`,
    text: segment.surface,
    reading: segment.speech,
    provider,
    voice,
  };
}

async function fetchWordClip(item: WordClipItem, signal: AbortSignal): Promise<string | null> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: item.text,
      reading: item.reading,
      provider: item.provider,
      voice: item.voice,
      learningDirection: "ja-en",
      targetLanguage: "ja",
    }),
    signal,
  });
  if (!response.ok) throw new Error(`Word TTS API ${response.status}`);
  const data = await response.json();
  return typeof data.audioBase64 === "string" ? data.audioBase64 : null;
}

function JapaneseWordText({ text, tokenizer, provider, voice, onWord }: {
  text: string;
  tokenizer: KuromojiTokenizer | null;
  provider: LessonTTSProvider;
  voice: string | number;
  onWord: (item: WordClipItem) => void;
}) {
  const segments = useMemo(() => tokenizer ? segmentJapaneseWords(text, tokenizer) : null, [text, tokenizer]);
  if (!segments) {
    return <span data-sentence-japanese style={{ cursor: "default" }} dangerouslySetInnerHTML={{ __html: buildFuriganaHTML(text, tokenizer, true) }} />;
  }
  return (
    <span data-sentence-japanese style={{ cursor: "default" }}>
      {segments.map((segment, index) => {
        const html = DOMPurify.sanitize(segment.tokens.map(addFurigana).join(""), {
          ALLOWED_TAGS: ["ruby", "rt"], ALLOWED_ATTR: [],
        });
        if (!segment.clickable) return <span key={index} style={{ cursor: "default" }} dangerouslySetInnerHTML={{ __html: html }} />;
        const item = makeWordClipItem(segment, provider, voice);
        return (
          <span key={index} role="button" tabIndex={0} className="lesson-japanese-word" title={`Play ${segment.surface}`}
            style={{ cursor: "pointer" }}
            onClick={event => { event.stopPropagation(); onWord(item); }}
            onKeyDown={event => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              onWord(item);
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
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

  // ── NEXT LINE ────────────────────────────────────────────────
  // Skips to the following line using the same stop → clear-timer → playLine
  // sequence rewind uses for a different line, behind the same debounce lock.
  // On the last line it does nothing (the scene still completes naturally).
  const next = useCallback(() => {
    if (rewindLockRef.current) return;
    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= lines.length || !howlsRef.current[nextIndex]) return;
    rewindLockRef.current = true;
    setTimeout(() => { rewindLockRef.current = false; }, REWIND_DEBOUNCE_MS);

    stopCurrent();
    if (transitionTimerRef.current !== null) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    playLine(nextIndex);
  }, [state.currentIndex, lines.length, stopCurrent, playLine]);

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

  // Live position (seconds) of the sound that is currently playing or paused,
  // read straight from the Howl (HTML5 audio currentTime, so it is continuous).
  // Null when no sound is active (not yet started, or the line has ended).
  // Read-only: used for the karaoke underline.
  const getPosition = useCallback((): number | null => {
    const howl = currentHowlRef.current;
    const id   = currentSoundIdRef.current;
    if (!howl || id === null) return null;
    const pos = howl.seek(id);
    return typeof pos === "number" ? pos : null;
  }, []);

  return { state, dispatch, start, restart, pause, resume, rewind, next, getDuration, getPosition, playbackRate, changeSpeed, seekPositionRef };
}

// ============================================================
// SECTION 6: TOGGLE BUTTON
// ============================================================


// ============================================================
// SECTION 6b: TTS AUDIO HELPER (used by InteractiveLesson)
// ============================================================

// Small outlined toggle. On-state: --acc-soft fill, --acc-line border, --acc text
// (styles in the .sp-chip rules of the ScenePlayer stylesheet).
function ToggleButton({
  active,
  onClick,
  children,
  jp = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  jp?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`sp-chip${jp ? " jp" : ""}`}
    >
      {children}
    </button>
  );
}

// Inline icon set (24px grid, stroked with currentColor via the .sp-cb / .sp-start rules).
const ICON = {
  back: "M15 6l-6 6 6 6",
  prev: "M18 6l-7 6 7 6M6 6v12",
  next: "M6 6l7 6-7 6M18 6v12",
  play: "M8 5.5v13l11-6.5z",
  pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  compress: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  refresh: "M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5",
  menu: "M4 7h16M4 12h16M4 17h16",
};

function Icon({ path, filled = false }: { path: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={filled ? "fill" : undefined}>
      <path d={path} />
    </svg>
  );
}

// Previous line / restart · play-pause · next line (+ optional extra control, e.g. speed).
function LineControls({ className, isPlaying, onPrev, onToggle, onNext, children }: {
  className: string;
  isPlaying: boolean;
  onPrev: () => void;
  onToggle: () => void;
  onNext: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={className}>
      <button type="button" className="sp-cb" onClick={onPrev} title="Previous Line / Restart" aria-label="Previous line or restart">
        <Icon path={ICON.prev} />
      </button>
      <button type="button" className="sp-cb pri" onClick={onToggle} title={isPlaying ? "Pause" : "Resume"} aria-label={isPlaying ? "Pause" : "Resume"}>
        <Icon path={isPlaying ? ICON.pause : ICON.play} filled />
      </button>
      <button type="button" className="sp-cb" onClick={onNext} title="Next Line" aria-label="Next line">
        <Icon path={ICON.next} />
      </button>
      {children}
    </div>
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
  panelAlign = "right",
  variant = "chip",
}: {
  rate: number;
  onChange: (r: number) => void;
  panelAlign?: "left" | "right";
  variant?: "chip" | "cb";
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
  const triggerLabel = `${Number(rate.toFixed(1))}×`;
  // Highlight the button when non-default speed is active so the user can
  // tell at a glance that speed is modified.
  const isModified = rate !== 1.0;

  return (
    <div className="relative" style={{ userSelect: "none" }} ref={wrapRef}>
      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Playback speed"
        aria-label="Playback speed"
        aria-expanded={open}
        data-on={open || isModified}
        className={variant === "cb" ? "sp-cb spd" : "sp-chip"}
      >
        {triggerLabel}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className="sp-pop"
          style={{
            left: panelAlign === "left" ? 0 : undefined,
            right: panelAlign === "right" ? 0 : undefined,
            padding: "12px 14px",
            minWidth: "188px",
          }}
        >
          {/* Header row: label left, value right */}
          <div className="flex items-center justify-between mb-2.5">
            <span style={{
              fontSize: "0.68rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--mut)",
            }}>
              Speed
            </span>
            <span style={{
              fontSize: "0.82rem",
              fontFamily: "monospace",
              fontWeight: 600,
              color: "var(--acc)",
              minWidth: "3ch",
              textAlign: "right",
            }}>
              {label}
            </span>
          </div>

          {/* Native range input: the accent colour fills the track (accent-color) */}
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={rate}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="sp-speed-range"
            aria-label="Playback speed"
          />

          {/* Tick marks: 0.5 · 1.0 · 1.5 · 2.0 */}
          <div className="flex justify-between mt-1.5" style={{ paddingLeft: "1px", paddingRight: "1px" }}>
            {["0.5", "1.0", "1.5", "2.0"].map(t => (
              <button
                type="button"
                key={t}
                onClick={() => onChange(parseFloat(t))}
                style={{
                  fontSize: "0.6rem",
                  fontFamily: "monospace",
                  color: rate.toFixed(1) === t ? "var(--acc)" : "var(--faint)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
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
const AUDIO_COOLDOWN_MS = 10;

interface InteractiveLessonProps {
  lesson_id: string;
  voice_id?: number | null;
  mainPlayerStatus: PlayerStatus;
  structured_content: StructuredContent;
  lesson_lines: LessonLine[];
  /** Index of the line the main player is on (highlighted in the transcript while it plays). */
  currentLineIndex: number;
  learningDirection: LearningDirection;
  onPlayAudio: () => void;
  onWordBusyChange: (busy: boolean) => void;
  availableVoices: VoiceEntry[];
  voicesLoading: boolean;
  tokenizer: KuromojiTokenizer | null;
}

function InteractiveLesson({ lesson_id, voice_id, mainPlayerStatus, currentLineIndex, structured_content, lesson_lines, learningDirection, onPlayAudio, onWordBusyChange, availableVoices, voicesLoading, tokenizer }: InteractiveLessonProps) {
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
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [ttsPaused, setTtsPaused] = useState(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const ttsAudioCacheRef = useRef<Map<string, string>>(new Map());
  const preloadRunRef = useRef(0);
  const [sentencePreloadVoiceKey, setSentencePreloadVoiceKey] = useState<string | null>(null);
  const wordBusyRef = useRef(false);
  const wordAudioCtxRef = useRef<AudioContext | null>(null);
  const wordSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCooldownUntilRef = useRef(0);
  const wordSession = useMemo(() => getWordAudioSession(lesson_id, fetchWordClip), [lesson_id]);

  useEffect(() => () => {
    activeAudioRef.current?.pause();
    if (activeUtteranceRef.current) window.speechSynthesis.cancel();
    try { wordSourceRef.current?.stop(); } catch { /* already finished */ }
    void wordAudioCtxRef.current?.close();
    wordSession.setSuspended(true);
    onWordBusyChange(false);
  }, [wordSession, onWordBusyChange]);

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
  const selectedVoiceKey = `${effectiveTtsProvider}:${String(ttsVoice)}`;

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
      if (!controller.signal.aborted && runId === preloadRunRef.current) {
        setSentencePreloadVoiceKey(selectedVoiceKey);
      }
    }

    preloadExamplesTopToBottom();
    return () => controller.abort();
  }, [exampleTtsPreloadQueue, fetchTtsBase64, ttsCacheKey, selectedVoiceKey]);

  const characterVoices = useMemo(() => resolveJapaneseCharacterVoices(
    lesson_lines.map(line => line.speaker), structured_content.character_voices, voice_id ?? null,
  ), [lesson_lines, structured_content.character_voices, voice_id]);

  const wordItems = useMemo(() => {
    if (!tokenizer || !isJapaneseTarget) return [];
    const items: WordClipItem[] = [];
    const add = (text: string, provider: LessonTTSProvider, voice: string | number) => {
      for (const segment of segmentJapaneseWords(text, tokenizer)) {
        if (segment.clickable) items.push(makeWordClipItem(segment, provider, voice));
      }
    };
    for (const line of lesson_lines) {
      const display = adaptLessonLineForDirection(line, learningDirection);
      if (display.targetLanguage === "ja") add(display.targetText, "voicevox", characterVoices[line.speaker] ?? 3);
    }
    for (const vocab of structured_content.vocabulary) {
      const example = adaptExampleForDirection(vocab, learningDirection);
      if (example.targetLanguage === "ja" && example.exampleTarget) add(example.exampleTarget, effectiveTtsProvider, ttsVoice);
    }
    for (const grammar of structured_content.grammar_points) {
      const example = adaptExampleForDirection(grammar, learningDirection);
      if (example.targetLanguage === "ja" && example.exampleTarget) add(example.exampleTarget, effectiveTtsProvider, ttsVoice);
    }
    return items;
  }, [tokenizer, isJapaneseTarget, lesson_lines, learningDirection, characterVoices,
    structured_content.vocabulary, structured_content.grammar_points, effectiveTtsProvider, ttsVoice]);

  const wordsReady = Boolean(tokenizer && isJapaneseTarget && sentencePreloadVoiceKey === selectedVoiceKey);
  useEffect(() => {
    wordSession.setSuspended(true);
    if (wordsReady) wordSession.setItems(wordItems);
    wordSession.setSuspended(!wordsReady || mainPlayerStatus === "PRELOADING");
  }, [wordSession, wordsReady, wordItems, mainPlayerStatus]);

  const wasMainAudioActiveRef = useRef(false);
  useEffect(() => {
    const active = mainPlayerStatus === "PLAYING_LINE" || mainPlayerStatus === "WAITING_NEXT";
    if (wasMainAudioActiveRef.current && !active) audioCooldownUntilRef.current = Date.now() + AUDIO_COOLDOWN_MS;
    wasMainAudioActiveRef.current = active;
  }, [mainPlayerStatus]);

  const playWord = useCallback(async (item: WordClipItem) => {
    if (mainPlayerStatus === "PLAYING_LINE" || mainPlayerStatus === "WAITING_NEXT" ||
        mainPlayerStatus === "PRELOADING" || activeKeyRef.current || wordBusyRef.current ||
        Date.now() < audioCooldownUntilRef.current) return;
    wordBusyRef.current = true;
    onWordBusyChange(true);
    try {
      const context = wordAudioCtxRef.current ?? new AudioContext();
      wordAudioCtxRef.current = context;
      if (context.state === "suspended") await context.resume();
      const base64 = await wordSession.request(item);
      if (!base64) return;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
      const buffer = await context.decodeAudioData(bytes.buffer);
      await new Promise<void>(resolve => {
        const source = context.createBufferSource();
        wordSourceRef.current = source;
        source.buffer = buffer;
        source.connect(context.destination);
        source.onended = () => resolve();
        source.start();
      });
    } catch (error) {
      console.warn("[InteractiveLesson] Word audio failed:", error);
    } finally {
      wordSourceRef.current = null;
      wordBusyRef.current = false;
      onWordBusyChange(false);
      audioCooldownUntilRef.current = Date.now() + AUDIO_COOLDOWN_MS;
    }
  }, [mainPlayerStatus, onWordBusyChange, wordSession]);

  const playTTS = useCallback(async (text: string, key: string, overrideAudioUrl?: string) => {
    if (wordBusyRef.current || Date.now() < audioCooldownUntilRef.current) return;
    if (activeKeyRef.current === key) {
      if (activeAudioRef.current) {
        if (activeAudioRef.current.paused) {
          await activeAudioRef.current.play();
          setTtsPaused(false);
        } else {
          activeAudioRef.current.pause();
          setTtsPaused(true);
        }
      } else if (activeUtteranceRef.current) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setTtsPaused(false);
        } else {
          window.speechSynthesis.pause();
          setTtsPaused(true);
        }
      }
      return;
    }
    if (activeKeyRef.current) return;
    activeKeyRef.current = key;
    onPlayAudio();
    setPlayingKey(key);
    setTtsPaused(false);

    try {
      let audioUrl = overrideAudioUrl;
      if (!audioUrl) {
        const cacheKey = ttsCacheKey(text);
        let audioBase64 = ttsAudioCacheRef.current.get(cacheKey);
        if (!audioBase64) {
          audioBase64 = await fetchTtsBase64(text) ?? undefined;
          if (audioBase64) ttsAudioCacheRef.current.set(cacheKey, audioBase64);
        }
        if (audioBase64) {
          const mime = audioBase64.startsWith("UklGR") ? "audio/wav" : "audio/mpeg";
          audioUrl = `data:${mime};base64,${audioBase64}`;
        }
      }

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        activeAudioRef.current = audio;
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Failed to play sentence audio"));
          audio.play().catch(reject);
        });
      } else {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = targetLanguage === "ja" ? "ja-JP" : "en-US";
        activeUtteranceRef.current = utterance;
        await new Promise<void>((resolve, reject) => {
          utterance.onend = () => resolve();
          utterance.onerror = () => reject(new Error("Speech synthesis failed"));
          window.speechSynthesis.speak(utterance);
        });
      }
    } catch (err) {
      console.error("[InteractiveLesson] TTS error:", err);
      // Keep the existing spoken fallback when a recording cannot load.
      if (!activeUtteranceRef.current) {
        try {
          activeAudioRef.current = null;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = targetLanguage === "ja" ? "ja-JP" : "en-US";
          activeUtteranceRef.current = utterance;
          await new Promise<void>((resolve, reject) => {
            utterance.onend = () => resolve();
            utterance.onerror = () => reject(new Error("Speech synthesis failed"));
            window.speechSynthesis.speak(utterance);
          });
        } catch (fallbackError) {
          console.error("[InteractiveLesson] Speech fallback error:", fallbackError);
        }
      }
    } finally {
      activeAudioRef.current = null;
      activeUtteranceRef.current = null;
      activeKeyRef.current = null;
      setPlayingKey(null);
      setTtsPaused(false);
      audioCooldownUntilRef.current = Date.now() + AUDIO_COOLDOWN_MS;
    }
  }, [fetchTtsBase64, onPlayAudio, targetLanguage, ttsCacheKey]);

  // ── Tabs: Transcript · Vocabulary · Grammar ─────────────────
  type SideTab = "transcript" | "vocabulary" | "grammar";
  const [tab, setTab] = useState<SideTab>("transcript");
  const bodyRef = useRef<HTMLDivElement>(null);
  const lineActive = mainPlayerStatus === "PLAYING_LINE" || mainPlayerStatus === "WAITING_NEXT" || mainPlayerStatus === "PAUSED";

  // Keep the current transcript row in view. Only when the body is its own
  // scroll container (desktop right column); on phones the page scrolls and
  // we never move it.
  useEffect(() => {
    if (!lineActive || tab !== "transcript") return;
    const body = bodyRef.current;
    if (!body || getComputedStyle(body).overflowY !== "auto") return;
    const row = body.querySelector<HTMLElement>(`[data-line="${currentLineIndex}"]`);
    if (!row) return;
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    if (rowTop < body.scrollTop || rowBottom > body.scrollTop + body.clientHeight) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      body.scrollTo({ top: Math.max(0, rowTop - 16), behavior: reduced ? "auto" : "smooth" });
    }
  }, [lineActive, tab, currentLineIndex]);

  // ── Text styles (colours come from CSS variables so the dock re-themes live) ──
  const jpText: React.CSSProperties = {
    fontFamily: "var(--sp-study)",
    fontWeight: 600,
    fontSize: "1.15rem",
    color: "var(--ink)",
    lineHeight: 1.7,
    margin: 0,
    ["--furi-opacity" as string]: isJapaneseTarget && showFurigana ? 1 : 0,
  };

  function handleSentenceClick(event: React.MouseEvent<HTMLDivElement>, text: string, id: string, audioUrl?: string) {
    if ((event.target as HTMLElement).closest("[data-sentence-japanese]")) return;
    void playTTS(text, id, audioUrl);
  }

  function handleSentenceKeyDown(event: React.KeyboardEvent<HTMLDivElement>, text: string, id: string, audioUrl?: string) {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    void playTTS(text, id, audioUrl);
  }

  function sentenceLabel(id: string) {
    return `${playingKey === id ? (ttsPaused ? "Resume" : "Pause") : "Play"} sentence pronunciation`;
  }

  // Japanese (or target-language) sentence with its optional romaji / support lines.
  function sentenceText(
    target: string,
    targetLanguage: string,
    provider: LessonTTSProvider,
    voice: string | number,
    reading: string | undefined,
    support: string,
    classes: { jp: string; ro: string; en: string },
  ) {
    return (
      <>
        <div style={{ minWidth: 0, width: "100%" }}>
          {targetLanguage === "ja" ? (
            <p className={classes.jp} style={jpText}><JapaneseWordText text={target} tokenizer={tokenizer}
              provider={provider} voice={voice} onWord={item => { void playWord(item); }} /></p>
          ) : (
            <p className={classes.jp} style={jpText}>{target}</p>
          )}
        </div>
        {((isJapaneseTarget && showRomaji && reading) || support) && (
          <div>
            {isJapaneseTarget && showRomaji && reading && <p className={classes.ro}>{reading}</p>}
            {support && <p className={classes.en}>{support}</p>}
          </div>
        )}
      </>
    );
  }

  function renderExample(id: string, example: ReturnType<typeof adaptExampleForDirection>, supportText: string) {
    const audioUrl = getMatchingAudio(example.exampleTarget);
    return (
      <div
        className={`sp-ex${playingKey === id ? " playing" : ""}`}
        style={{ cursor: playingKey && playingKey !== id ? "default" : "pointer" }}
        role="button" tabIndex={0} aria-label={sentenceLabel(id)}
        onClick={event => handleSentenceClick(event, example.exampleTarget, id, audioUrl)}
        onKeyDown={event => handleSentenceKeyDown(event, example.exampleTarget, id, audioUrl)}>
        {sentenceText(example.exampleTarget, example.targetLanguage, effectiveTtsProvider, ttsVoice,
          example.exampleTargetReading, supportText, { jp: "sp-ex-j", ro: "sp-ex-r", en: "sp-ex-e" })}
      </div>
    );
  }

  const vocabCount = structured_content.vocabulary.length;
  const grammarCount = structured_content.grammar_points.length;
  const tabs: { id: SideTab; label: string }[] = [
    { id: "transcript", label: "Transcript" },
    { id: "vocabulary", label: vocabCount > 0 ? `Vocabulary · ${vocabCount}` : "Vocabulary" },
    { id: "grammar", label: grammarCount > 0 ? `Grammar · ${grammarCount}` : "Grammar" },
  ];

  return (
    <aside className="sp-side" aria-label="Transcript, vocabulary and grammar">
      <div className="sp-side-head interactive-lesson-toolbar">
        <div className="sp-tabs" role="tablist" aria-label="Lesson material">
          {tabs.map(t => (
            <button key={t.id} type="button" role="tab" id={`sp-tab-${t.id}`} aria-selected={tab === t.id}
              aria-controls="sp-tabpanel" className="sp-tab" onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="sp-tools">
          {isJapaneseTarget && (
            <>
              <ToggleButton active={showFurigana} onClick={() => setShowFurigana(v => !v)} jp>振り仮名</ToggleButton>
              <ToggleButton active={showRomaji} onClick={() => setShowRomaji(v => !v)}>Romaji</ToggleButton>
            </>
          )}
          <div style={{ position: "relative" }} ref={settingsRef}>
            <button
              type="button"
              onClick={() => setShowTTSSettings(v => !v)}
              aria-expanded={showTTSSettings}
              data-on={showTTSSettings}
              className="sp-chip"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M9 2.5a.5.5 0 0 1 .854-.354l4 4a.5.5 0 0 1 0 .708l-4 4A.5.5 0 0 1 9 10.5V8.7c-2.28.24-4.16 1.48-5.33 3.3-.25.4-.84.1-.73-.37C3.67 8.86 6.07 6.37 9 5.87V2.5z"/><path d="M2 5h3v6H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>
              TTS
            </button>
            {showTTSSettings && (
              <div className="sp-pop" style={{ padding: "14px 16px", minWidth: "220px" }}>
                <p className="sp-pop-label">Voice Engine</p>
                <div className="flex gap-2 mb-3">
                  {(targetLanguage === "en"
                    ? (["edge"] as LessonTTSProvider[])
                    : (["edge", "voicevox"] as LessonTTSProvider[])
                  ).map(p => (
                    <button type="button" key={p} onClick={() => setTtsProvider(p)} className="sp-chip flex-1 justify-center"
                      aria-pressed={(targetLanguage === "en" ? effectiveTtsProvider : ttsProvider) === p}>
                      {p === "edge" ? "Edge" : "VoiceVox"}
                    </button>
                  ))}
                </div>

                {effectiveTtsProvider === "edge" && (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {(targetLanguage === "en" ? ENGLISH_EDGE_VOICES : EDGE_VOICES).map(v => (
                      <button type="button" key={v.name} onClick={() => setEdgeVoice(v.name)} className="sp-opt" aria-pressed={activeEdgeVoice === v.name}>
                        <span>{v.label}</span>
                        <small>{v.desc.split(" · ")[1] ?? v.desc}</small>
                      </button>
                    ))}
                  </div>
                )}

                {false && (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {KOKORO_VOICES.map(v => (
                      <button type="button" key={v.name} onClick={() => setKokoroVoice(v.name)} className="sp-opt" aria-pressed={kokoroVoice === v.name}>
                        <span>{v.label}</span>
                        <small>{v.desc.split(" · ")[1] ?? v.desc}</small>
                      </button>
                    ))}
                  </div>
                )}

                {targetLanguage !== "en" && ttsProvider === "voicevox" && (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {availableVoices.length === 0 ? <p style={{ fontSize: "0.65rem", color: "var(--mut)" }}>{voicesLoading ? "Loading…" : "No voices"}</p> : availableVoices.map(v => (
                      <button type="button" key={v.id} onClick={() => setVoiceVoxId(v.id)} className="sp-opt" aria-pressed={voiceVoxId === v.id}>
                        <span>{v.label}</span><small>{v.sublabel}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sp-side-body" id="sp-tabpanel" role="tabpanel" aria-labelledby={`sp-tab-${tab}`} ref={bodyRef}>

        {/* ── Story Transcript ──────────────────────────────────── */}
        {tab === "transcript" && lesson_lines.map((line, i) => {
          const displayLine = adaptLessonLineForDirection(line, learningDirection);
          const id = `transcript-${i}`;
          const isCurrent = lineActive && i === currentLineIndex;
          const isPast = lineActive && i < currentLineIndex;
          return (
            <div key={line.id || i} data-line={i}
              className={`sp-t${isCurrent ? " on" : ""}${isPast ? " past" : ""}`}
              style={{ cursor: playingKey && playingKey !== id ? "default" : "pointer" }}
              aria-current={isCurrent ? "true" : undefined}
              role="button" tabIndex={0} aria-label={sentenceLabel(id)}
              onClick={event => handleSentenceClick(event, displayLine.targetText, id, line.audio_url)}
              onKeyDown={event => handleSentenceKeyDown(event, displayLine.targetText, id, line.audio_url)}>
              <span className="sp-t-s">{line.speaker}</span>
              {sentenceText(displayLine.targetText, displayLine.targetLanguage, "voicevox", characterVoices[line.speaker] ?? 3,
                displayLine.targetReading, displayLine.supportText, { jp: "sp-t-j", ro: "sp-t-r", en: "sp-t-e" })}
            </div>
          );
        })}

        {/* ── Vocabulary ──────────────────────────────────── */}
        {tab === "vocabulary" && (
          vocabCount === 0 ? <p className="sp-empty">No vocabulary for this scene.</p> :
          structured_content.vocabulary.map((v, i) => {
            const example = adaptExampleForDirection(v, learningDirection);
            const meaningText = isJapaneseTarget || hasJapaneseText(v.meaning) ? v.meaning : "";
            const exampleSupportText = getExampleSupportText(example, v.meaning);
            return (
              <div key={i} className="sp-item">
                <div className="sp-item-head">
                  <div className="flex items-baseline min-w-0">
                    <span className="sp-word">{v.word}</span>
                    <span className="sp-reading">{v.reading}</span>
                  </div>
                  {meaningText && <span className="sp-meaning">{meaningText}</span>}
                </div>
                {example.exampleTarget && renderExample(`vocab-${i}`, example, exampleSupportText)}
              </div>
            );
          })
        )}

        {/* ── Grammar ─────────────────────────────────────── */}
        {tab === "grammar" && (
          grammarCount === 0 ? <p className="sp-empty">No grammar points for this scene.</p> :
          structured_content.grammar_points.map((g, i) => {
            const example = adaptExampleForDirection(g, learningDirection);
            const explanationText = isJapaneseTarget || hasJapaneseText(g.explanation) ? g.explanation : "";
            const exampleSupportText = getExampleSupportText(example, g.explanation);
            return (
              <div key={i} className="sp-item">
                <p className="sp-pattern">{g.pattern}</p>
                {explanationText && <p className="sp-explain">{explanationText}</p>}
                {example.exampleTarget && renderExample(`grammar-${i}`, example, exampleSupportText)}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

export default function ScenePlayer({
  lesson_id,
  voice_id,
  structured_content,
  background_image_url,
  lesson_lines,
  learningDirection = DEFAULT_LEARNING_DIRECTION,
  onBack,
}: LessonProps) {
  const { state, start, restart, pause, resume, rewind, next, getDuration, getPosition, playbackRate, changeSpeed, seekPositionRef } = useScenePlayer(lesson_lines);
  const { status, currentIndex, preloadProgress, error } = state;
  const [wordAudioBusy, setWordAudioBusy] = useState(false);
  const startWithoutWordAudio = useCallback(() => { if (!wordAudioBusy) void start(); }, [start, wordAudioBusy]);
  const resumeWithoutWordAudio = useCallback(() => { if (!wordAudioBusy) resume(); }, [resume, wordAudioBusy]);
  const restartWithoutWordAudio = useCallback(() => { if (!wordAudioBusy) void restart(); }, [restart, wordAudioBusy]);
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
    !("MSStream" in window);

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
    const el = containerRef.current as WebkitFullscreenElement | null;
    if (!el) return;
    const fullscreenDocument = document as WebkitFullscreenDocument;
    const fsElement = document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement;
    if (!fsElement) {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(err => console.warn("[ScenePlayer] Fullscreen failed:", err));
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (fullscreenDocument.webkitExitFullscreen) {
        fullscreenDocument.webkitExitFullscreen();
      }
    }
  }, [isIOS]);

  // Sync isFullscreen with native API events (non-iOS only)
  useEffect(() => {
    if (isIOS) return;
    const handler = () => {
      const fullscreenDocument = document as WebkitFullscreenDocument;
      const active = !!(document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement);
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
        resumeWithoutWordAudio();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, isPlaying, pause, resumeWithoutWordAudio]);

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

  // ── Signature: karaoke underline ─────────────────────────────
  // The span wrapping the line being spoken carries a 3px accent underline
  // whose width is the CSS variable --kara-w. While a line plays, a rAF loop
  // writes that variable straight onto the element (no React re-render per
  // frame) from the live Howl position and duration. When a line is split into
  // display chunks, the width is the progress through the chunk currently on
  // screen (chunk boundaries use the same character fractions as the chunk
  // timer above). Without a usable duration the underline is full width while
  // playing; with prefers-reduced-motion it is a static full-width underline.
  const karaRef = useRef<HTMLSpanElement>(null);
  const chunkTotalChars = chunks.reduce((sum, chunk) => sum + chunk.length, 0) || 1;
  const chunkStartFraction = chunks.slice(0, safeIndex).reduce((sum, chunk) => sum + chunk.length, 0) / chunkTotalChars;
  const chunkEndFraction = chunks.slice(0, safeIndex + 1).reduce((sum, chunk) => sum + chunk.length, 0) / chunkTotalChars;

  useEffect(() => {
    const element = karaRef.current;
    if (!element) return;
    const setWidth = (fraction: number) => {
      const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 1));
      element.style.setProperty("--kara-w", `${(clamped * 100).toFixed(1)}%`);
    };
    if (status === "WAITING_NEXT" || status === "COMPLETED") { setWidth(1); return; }
    if (status !== "PLAYING_LINE" && status !== "PAUSED") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) { setWidth(1); return; }

    const update = () => {
      const duration = getDuration(currentIndex);
      if (duration <= 0) { setWidth(1); return; }
      const lineFraction = (getPosition() ?? 0) / duration;
      const span = chunkEndFraction - chunkStartFraction;
      setWidth(span > 0 ? (lineFraction - chunkStartFraction) / span : lineFraction);
    };
    update();
    if (status !== "PLAYING_LINE") return;

    let frame = 0;
    const tick = () => {
      update();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, currentIndex, chunkStartFraction, chunkEndFraction, isFullscreen, getDuration, getPosition]);

  const showLinePanel = !isFullscreen && !!currentLine && isActive;
  const dock = useDock();
  const karaKey = `${currentIndex}:${safeIndex}`;
  const furiganaOpacity = isJapaneseTarget && showFurigana && kuroReady ? 1 : 0;

  // The fullscreen toggle sits in the page header normally and inside the
  // stage while fullscreen (the header is hidden then).
  const fullscreenButton = (className: string) => (
    <button
      type="button"
      onClick={toggleFullscreen}
      title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      className={className}
    >
      <Icon path={isFullscreen ? ICON.compress : ICON.expand} />
    </button>
  );

  // The same display toggles are rendered twice (page header on desktop, below
  // the current line on phones); CSS shows exactly one. Playback speed joins
  // them only while the line panel (which carries its own speed control) is hidden.
  const displayToggles = (className: string) => (
    <div className={`sp-tog ${className}`}>
      {isJapaneseTarget && (
        <>
          <ToggleButton active={showFurigana} onClick={() => setShowFurigana(v => !v)} jp>振り仮名</ToggleButton>
          <ToggleButton active={showRomaji} onClick={() => setShowRomaji(v => !v)}>Romaji</ToggleButton>
        </>
      )}
      <ToggleButton active={showTranslation} onClick={() => setShowTranslation(v => !v)}>{translationToggleLabel}</ToggleButton>
      <SpeedControl rate={playbackRate} onChange={changeSpeed} />
      {isJapaneseTarget && !kuroReady && <span className="sp-dict">dict…</span>}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={isFullscreen ? "sp-root sp-fs" : "sp-root sp-grid"}
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
        background: "var(--g)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      } : undefined}
    >

      {/* ── Scene Title + Display Toggles ───────────────────────── */}
      {!isFullscreen && (
        <header className="sp-top">
          {dock?.collapsed && (
            <button type="button" className="sp-cb sm" onClick={() => dock.setOpen(true)} title="Show navigation" aria-label="Show navigation" aria-expanded={dock.open}>
              <Icon path={ICON.menu} />
            </button>
          )}
          {onBack && (
            <button type="button" className="sp-cb sm" onClick={onBack} title="Back to library" aria-label="Back to library">
              <Icon path={ICON.back} />
            </button>
          )}
          <h2 className="sp-title">{structured_content.title}</h2>
          {displayToggles("sp-tog-d")}
          {fullscreenButton("sp-cb sm")}
        </header>
      )}

      {/* ── Stage (scene art, speaker chip, progress line) ──────── */}
      <div className="sp-stagewrap" style={isFullscreen ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : undefined}>
        <div
          className="sp-stage"
          style={isFullscreen ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", borderRadius: 0 } : undefined}
        >
          {/* ── MEDIA BOX — true 16:9 (normal) or full-height (fullscreen) ─ */}
          <div
            className="relative w-full"
            style={isFullscreen
              ? { flex: 1, background: "var(--g)", overflow: "hidden" }
              : { aspectRatio: "16 / 9", background: "var(--s1)" }
            }
          >
            <div className="absolute inset-0">
              {/* Background image */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: bgImage,
                  backgroundSize: "cover",
                  backgroundPosition: "50% 58%",
                  backgroundRepeat: "no-repeat",
                  opacity: liveBgUrl ? 1 : 0,
                  transition: "opacity 0.6s ease, background-image 0.4s ease",
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/sprites/${speakerSlug}_${expression}.png`}
                      alt={`${currentLine.speaker} ${expression}`}
                      className="h-full w-auto object-contain"
                      decoding="async"
                      loading="eager"
                      style={{
                        animation: isPlaying ? "spriteBounce 0.55s ease-in-out infinite alternate" : "none",
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

              {/* Speaker chip */}
              {currentLine && status !== "IDLE" && (
                <div
                  className="sp-chip-scrim sp-speaker"
                  style={{ bottom: isFullscreen ? "calc(28% + 0.6rem)" : "16px" }}
                >
                  {currentLine.speaker}
                  {isPaused && (
                    <svg viewBox="0 0 24 24" width="12" height="12" aria-label="Paused" role="img" fill="currentColor" style={{ marginLeft: 8, opacity: 0.7 }}>
                      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
                    </svg>
                  )}
                </div>
              )}

              {/* ── Fullscreen toggle button — always visible top-right while fullscreen ── */}
              {isFullscreen && fullscreenButton("sp-cb sm sp-scrim fs-fullscreen-btn")}

              {/* ── Fullscreen: floating toggle bar top-left ── */}
              {isFullscreen && (
                <div className="absolute top-0 left-3 flex items-center gap-1.5 z-20 fs-toggle-bar">
                  {isJapaneseTarget && (
                    <>
                      <ToggleButton active={showFurigana} onClick={() => setShowFurigana(v => !v)} jp>振り仮名</ToggleButton>
                      <ToggleButton active={showRomaji} onClick={() => setShowRomaji(v => !v)}>Romaji</ToggleButton>
                    </>
                  )}
                  <ToggleButton active={showTranslation} onClick={() => setShowTranslation(v => !v)}>{translationToggleLabel}</ToggleButton>
                  <SpeedControl rate={playbackRate} onChange={changeSpeed} panelAlign={isJapaneseTarget ? "right" : "left"} />
                </div>
              )}

              {/* ── Fullscreen subtitle panel — pinned to bottom of media box ── */}
              {isFullscreen && currentLine && isActive && (
                <div
                  className="absolute bottom-0 left-0 right-0"
                  style={{ zIndex: 10 }}
                >
                  <div className="sp-fs-scrim" style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: isJapaneseTarget ? "flex-start" : "flex-end",
                    minHeight: isJapaneseTarget ? "40dvh" : "30dvh",
                    paddingTop: isJapaneseTarget ? "7rem" : "4.5rem",
                    paddingBottom: "0.9rem",
                    paddingLeft: "4rem",
                    paddingRight: "4rem",
                    transform: "translateZ(0)",
                    backfaceVisibility: "hidden",
                  }}>
                    {/* Japanese text — centred, no controls overlapping */}
                    <div className="relative flex items-center justify-center w-full">
                      <p
                        className="scene-subtitle-primary scene-subtitle-primary-fs text-center"
                        style={{
                          ...subtitleSizeVars,
                          fontFamily: "var(--sp-study)",
                          fontWeight: 700,
                          color: "var(--ink)",
                          lineHeight: "2.2",
                          letterSpacing: "0.02em",
                          ["--furi-opacity" as string]: furiganaOpacity,
                        }}
                      >
                        <span key={karaKey} ref={karaRef} className="sp-kara" dangerouslySetInnerHTML={{ __html: getFuriganaHTML(displayKanji) }} />
                      </p>
                    </div>
                    {/* Romaji */}
                    {isJapaneseTarget && showRomaji && displayRomaji && (
                      <p className="text-center mt-2" style={{
                        fontFamily: "var(--sp-ui)",
                        fontSize: "clamp(1rem, 1.8vw, 1.4rem)",
                        color: "color-mix(in srgb, var(--ink) 72%, transparent)",
                        letterSpacing: "0.04em",
                        lineHeight: 1.5,
                      }}>
                        {displayRomaji}
                      </p>
                    )}

                    {/* Divider */}
                    {showTranslation && (
                      <div style={{ width: "50%", height: "1px", background: "rgba(255,255,255,0.14)", margin: "0.5rem auto" }} />
                    )}

                    {/* English on the bottom row, controls at its right end */}
                    <div className="sp-fs-row">
                      <span aria-hidden="true" />
                      {showTranslation ? (
                        <p className="text-center" style={{
                          margin: 0,
                          fontFamily: "var(--sp-ui)",
                          fontSize: "clamp(0.85rem, 1.35vw, 1.1rem)",
                          color: "color-mix(in srgb, var(--ink) 72%, transparent)",
                          letterSpacing: "0.02em",
                          lineHeight: 1.5,
                        }}>
                          {displayEnglish}
                        </p>
                      ) : <span aria-hidden="true" />}
                      {showControls ? (
                        <LineControls
                          className="sp-ctrls sp-ctrls-fs"
                          isPlaying={isPlaying}
                          onPrev={rewind}
                          onToggle={isPlaying ? pause : resumeWithoutWordAudio}
                          onNext={next}
                        />
                      ) : <span aria-hidden="true" />}
                    </div>
                  </div>
                </div>
              )}

              {/* Thin accent progress line along the bottom of the stage */}
              {!isFullscreen && isActive && (
                <div className="sp-prog" aria-hidden="true">
                  <div className="sp-prog-fill" style={{ width: `${progressFraction * 100}%` }} />
                </div>
              )}
            </div>
          </div>{/* end MEDIA BOX */}

          {/* ── Completion Overlay — scoped inside the stage ── */}
          {isCompleted && (
            <div className="sp-overlay sp-overlay-done" style={{ zIndex: 10 }}>
              <p className="sp-overlay-title">Scene Complete</p>
              <p className="sp-overlay-sub">
                {lesson_lines.length} lines · {structured_content.vocabulary.length} vocabulary
              </p>
              <button type="button" onClick={restartWithoutWordAudio} className="sp-start sp-start-sm">
                <Icon path={ICON.refresh} />
                Watch Again
              </button>
            </div>
          )}

          {/* ── IDLE / PRELOADING Overlay — scoped inside the stage ── */}
          {(status === "IDLE" || status === "PRELOADING") && (
            <div className="sp-overlay sp-overlay-idle" style={{ zIndex: 10 }}>
              {status === "IDLE" && preloadProgress === 0 && (
                <>
                  <div className="sp-chip-scrim sp-meta">
                    {lesson_lines.length} Lines · {structured_content.background_tag.replace(/_/g, " ")}
                  </div>
                  {error && <p className="max-w-xs text-center px-4 text-xs" style={{ color: "var(--bad)" }}>{error}</p>}
                  <button type="button" onClick={startWithoutWordAudio} className="sp-start">
                    <Icon path={ICON.play} filled />
                    Start Lesson
                  </button>
                </>
              )}
              {status === "PRELOADING" && (
                <div className="flex flex-col items-center gap-3 w-48">
                  <p className="sp-chip-scrim sp-meta">Loading audio…</p>
                  <div className="sp-load-track">
                    <div className="sp-load-fill" style={{ width: `${preloadProgress}%` }} />
                  </div>
                  <p className="sp-chip-scrim sp-meta tabular-nums">{preloadProgress}%</p>
                </div>
              )}
            </div>
          )}
        </div>{/* end stage */}
      </div>

      {/* ── CURRENT LINE PANEL (normal mode only) ──────────────────
          In fullscreen the subtitle lives inside the stage above.
      ── */}
      {showLinePanel && (
        <section className="sp-line" aria-label="Current line">
          <div className="sp-line-text">
            <p
              className="sp-jp"
              style={{ ["--furi-opacity" as string]: furiganaOpacity }}
            >
              <span key={karaKey} ref={karaRef} className="sp-kara" dangerouslySetInnerHTML={{ __html: getFuriganaHTML(displayKanji) }} />
            </p>
            {isJapaneseTarget && showRomaji && displayRomaji && <p className="sp-ro">{displayRomaji}</p>}
            {showTranslation && displayEnglish && <p className="sp-en">{displayEnglish}</p>}
          </div>
          {showControls && (
            <LineControls
              className="sp-ctrls"
              isPlaying={isPlaying}
              onPrev={rewind}
              onToggle={isPlaying ? pause : resumeWithoutWordAudio}
              onNext={next}
            />
          )}
        </section>
      )}

      {/* Phone: display toggles sit below the current line */}
      {!isFullscreen && displayToggles("sp-tog-p")}

      {/* ── Right column / below the player: Transcript · Vocabulary · Grammar ─── */}
      {!isFullscreen && (
        <InteractiveLesson
          lesson_id={lesson_id}
          voice_id={voice_id}
          mainPlayerStatus={status}
          currentLineIndex={currentIndex}
          structured_content={structured_content}
          lesson_lines={lesson_lines}
          learningDirection={learningDirection}
          onPlayAudio={pause}
          onWordBusyChange={setWordAudioBusy}
          availableVoices={availableVoices}
          voicesLoading={voicesLoading}
          tokenizer={tokenizer}
        />
      )}

      {/* ── Keyframes + layout + ruby CSS ───────────────────────── */}
      <style>{`
        .sp-root {
          --sp-ui: var(--f-ui, system-ui, sans-serif);
          --sp-jp: var(--f-jp, "BIZ UDPGothic", "Yu Gothic", sans-serif);
          --sp-study: var(--f-study, "Klee One", "Yu Mincho", serif);
          font-family: var(--sp-ui);
          color: var(--ink);
          box-sizing: border-box;
        }
        .sp-root *, .sp-root *::before, .sp-root *::after { box-sizing: border-box; }

        @keyframes spriteBounce {
          from { transform: translateY(0px); }
          to   { transform: translateY(-6px); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .sp-root ruby {
          ruby-align: center;
          ruby-position: over;
        }
        .sp-root rt {
          font-family: var(--sp-jp);
          font-size: 0.45em;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--acc);
          opacity: var(--furi-opacity, 1);
          transition: opacity 0.2s ease;
          user-select: none;
        }

        .lesson-japanese-word:hover,
        .lesson-japanese-word:focus-visible {
          text-decoration: underline;
          text-decoration-color: var(--mut);
          text-underline-offset: 0.12em;
        }

        /* ── Signature: accent underline that follows the spoken line ── */
        .sp-kara {
          background-image: linear-gradient(var(--acc), var(--acc));
          background-repeat: no-repeat;
          background-position: 0 100%;
          background-size: var(--kara-w, 0%) 3px;
          padding-bottom: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .sp-kara { background-size: 100% 3px; }
          .sp-root *, .sp-root *::before, .sp-root *::after {
            animation: none !important;
            transition: none !important;
          }
        }

        /* ── Layout: phone first (stage, line, controls, toggles, tabs) ── */
        .sp-grid { display: flex; flex-direction: column; }
        .sp-top {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 16px 10px;
        }
        .sp-title {
          margin: 0 auto 0 0; min-width: 0;
          font-family: var(--sp-ui), var(--sp-jp);
          font-size: 17px; font-weight: 800; line-height: 1.25;
          overflow-wrap: anywhere;
        }
        .sp-tog { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .sp-tog-d { display: none; }
        .sp-tog-p { padding: 12px 12px 0; }
        .sp-dict { font-size: 12px; color: var(--faint); margin-left: 4px; }

        .sp-stage { position: relative; overflow: hidden; background: var(--s1); }
        .sp-speaker {
          position: absolute; left: 16px; height: 28px; padding: 0 11px;
          display: inline-flex; align-items: center;
          font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
        }
        .sp-chip-scrim {
          border-radius: 8px;
          background: color-mix(in srgb, var(--g) 78%, transparent);
          color: var(--ink);
        }
        .sp-scrim {
          background: color-mix(in srgb, var(--g) 70%, transparent);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .sp-meta {
          padding: 6px 12px; font-size: 12px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--mut);
        }
        .sp-prog {
          position: absolute; left: 0; right: 0; bottom: 0; height: 4px;
          background: color-mix(in srgb, var(--ink) 18%, transparent);
        }
        .sp-prog-fill { height: 100%; background: var(--acc); transition: width 0.35s ease; }
        .sp-fs-scrim {
          background: linear-gradient(to top, rgba(0, 0, 0, 0.94) 0%, rgba(0, 0, 0, 0.84) 32%, rgba(0, 0, 0, 0.55) 62%, rgba(0, 0, 0, 0.2) 85%, transparent 100%);
        }
        .sp-fs-row {
          display: grid; grid-template-columns: 1fr auto 1fr;
          align-items: center; gap: 16px;
        }
        .sp-fs-row > :last-child { justify-self: end; }
        /* No karaoke underline over the full-screen picture */
        .sp-fs .sp-kara { background-image: none; padding-bottom: 0; }

        .sp-overlay {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
        }
        .sp-overlay-idle { background: color-mix(in srgb, var(--g) 38%, transparent); }
        .sp-overlay-done {
          background: color-mix(in srgb, var(--g) 86%, transparent);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .sp-overlay-title { margin: 0; font-size: 22px; font-weight: 800; color: var(--ink); }
        .sp-overlay-sub { margin: 0; font-size: 14px; color: var(--mut); }
        .sp-start {
          display: inline-flex; align-items: center; gap: 10px;
          height: 52px; padding: 0 28px; border: 0; border-radius: 16px; cursor: pointer;
          background: var(--acc); color: var(--acc-ink);
          font-family: var(--sp-ui); font-size: 15px; font-weight: 700; letter-spacing: 0.02em;
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .sp-start:hover { filter: brightness(1.08); }
        .sp-start:active { transform: scale(0.98); }
        .sp-start svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
        .sp-start svg.fill { fill: currentColor; }
        .sp-start-sm { height: 44px; padding: 0 22px; border-radius: 12px; font-size: 14px; }
        .sp-load-track { width: 100%; height: 4px; border-radius: 999px; overflow: hidden; background: var(--s3); }
        .sp-load-fill { height: 100%; border-radius: 999px; background: var(--acc); transition: width 0.3s ease; }

        .sp-line {
          display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 6px 14px;
          margin: 12px 12px 0; padding: 14px 16px;
          background: var(--s1); border: 1px solid var(--ln); border-radius: 16px;
        }
        .sp-line-text { display: contents; }
        .sp-jp, .sp-ro { grid-column: 1 / -1; }
        .sp-en { grid-column: 1; align-self: center; }
        .sp-line .sp-ctrls { grid-column: 2; align-self: end; }
        .sp-jp {
          margin: 0; padding-top: 0.2em;
          font-family: var(--sp-study); font-weight: 600;
          font-size: 23px; line-height: 1.75; letter-spacing: 0.02em;
          color: var(--ink); overflow-wrap: anywhere;
        }
        .sp-ro { margin: 0; font-size: 14px; color: var(--mut); line-height: 1.5; }
        .sp-en { margin: 0; font-size: 12.5px; color: var(--mut); line-height: 1.5; }

        .sp-ctrls { display: flex; align-items: center; gap: 8px; flex: none; justify-content: space-between; }
        .sp-cb {
          display: inline-grid; place-items: center; flex: none;
          width: 44px; height: 44px; padding: 0; border-radius: 12px; cursor: pointer;
          background: var(--s2); color: var(--ink); border: 1px solid var(--ln);
          font-family: var(--sp-ui); transition: background 0.15s ease, color 0.15s ease;
        }
        .sp-cb:hover { background: var(--s3); }
        .sp-cb.sm { width: 36px; height: 36px; border-radius: 10px; }
        .sp-cb.pri { width: 56px; height: 56px; border-radius: 16px; background: var(--acc); color: var(--acc-ink); border: 0; }
        .sp-ctrls .sp-cb { width: 36px; height: 36px; border-radius: 10px; }
        .sp-ctrls .sp-cb.pri { width: 44px; height: 44px; border-radius: 13px; }
        .sp-ctrls .sp-cb svg { width: 17px; height: 17px; }
        .sp-ctrls .sp-cb.pri svg { width: 20px; height: 20px; }
        .sp-cb.pri:hover { background: var(--acc); filter: brightness(1.08); }
        .sp-cb.spd { width: auto; min-width: 44px; padding: 0 10px; font-size: 13px; font-weight: 700; }
        .sp-cb.spd[data-on="true"] { color: var(--acc); background: var(--acc-soft); border-color: var(--acc-line); }
        .sp-cb svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
        .sp-cb.pri svg { width: 24px; height: 24px; }
        .sp-cb svg.fill { fill: currentColor; }
        .sp-cb.sp-scrim { background: color-mix(in srgb, var(--g) 70%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
        .sp-ctrls-fs .sp-cb { background: color-mix(in srgb, var(--g) 70%, transparent); backdrop-filter: blur(8px); }
        .sp-ctrls-fs .sp-cb.pri { background: var(--acc); backdrop-filter: none; }
        .sp-ctrls-fs { justify-content: flex-end; }

        .sp-chip {
          display: inline-flex; align-items: center; gap: 6px;
          height: 32px; padding: 0 11px; border-radius: 8px; cursor: pointer;
          background: transparent; color: var(--mut); border: 1px solid var(--ln);
          font-family: var(--sp-ui); font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .sp-chip.jp { font-family: var(--sp-jp); }
        .sp-chip:hover { color: var(--ink); }
        .sp-chip[aria-pressed="true"], .sp-chip[data-on="true"] {
          background: var(--acc-soft); border-color: var(--acc-line); color: var(--acc);
        }
        .sp-fs .sp-chip { background: var(--s1); border-color: var(--ln); color: var(--ink); }
        .sp-fs .sp-chip:hover { background: var(--s2); }
        .sp-fs .sp-chip[aria-pressed="true"], .sp-fs .sp-chip[data-on="true"] { background: var(--acc); border-color: var(--acc); color: var(--acc-ink); }
        .sp-fs .fs-fullscreen-btn { background: var(--s1); backdrop-filter: none; -webkit-backdrop-filter: none; }

        /* Subtitle in fullscreen keeps the single-line, auto-sized layout */
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
          .scene-subtitle-primary { font-size: var(--subtitle-font-size-mobile, 1.28rem); }
          .scene-subtitle-primary-fs { font-size: var(--subtitle-font-size-fs-mobile, 1.85rem); }
        }

        /* ── Right column (below the player on phones) ── */
        .sp-side {
          display: flex; flex-direction: column; min-width: 0; position: relative;
          margin-top: 16px; background: var(--s1); border-top: 1px solid var(--ln);
        }
        .sp-side-head { position: sticky; z-index: 30; background: var(--s1); }
        .interactive-lesson-toolbar { top: calc(env(safe-area-inset-top, 0px) + 0px); }
        .sp-tabs {
          display: flex; gap: 2px; padding: 14px 14px 0;
          border-bottom: 1px solid var(--ln);
          overflow-x: auto; scrollbar-width: none;
        }
        .sp-tabs::-webkit-scrollbar { display: none; }
        .sp-tab {
          flex: none; padding: 10px 12px; margin-bottom: -1px; cursor: pointer;
          background: none; border: 0; border-bottom: 2px solid transparent;
          font-family: var(--sp-ui); font-size: 14px; font-weight: 600; line-height: 1.2;
          color: var(--mut); white-space: nowrap;
        }
        .sp-tab:hover { color: var(--ink); }
        .sp-tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--acc); }
        .sp-tools {
          position: relative; z-index: 40;
          display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
          padding: 10px 14px; border-bottom: 1px solid var(--ln);
        }
        .sp-side-body { position: relative; display: grid; align-content: start; gap: 4px; padding: 10px 12px 24px; }

        .sp-t {
          display: grid; gap: 4px; padding: 12px; border-radius: 12px; cursor: pointer; text-align: left;
        }
        .sp-t:hover { background: color-mix(in srgb, var(--s2) 55%, transparent); }
        .sp-t.on, .sp-t.on:hover { background: var(--s2); }
        .sp-t-s { font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mut); }
        .sp-t.on .sp-t-s { color: var(--acc); }
        .sp-t.past .sp-t-j { color: var(--mut); }
        .sp-t-j { margin: 0; font-family: var(--sp-study); font-weight: 600; font-size: 17px; line-height: 1.7; color: var(--ink); }
        .sp-t-r { margin: 0; font-size: 13px; color: var(--mut); }
        .sp-t-e { margin: 0; font-size: 13px; color: var(--mut); }
        .sp-t.on .sp-t-e { color: var(--ink); }

        .sp-item { display: grid; gap: 8px; padding: 12px; border-bottom: 1px solid var(--ln); }
        .sp-item:last-child { border-bottom: 0; }
        .sp-item-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px; }
        .sp-word { font-family: var(--sp-study); font-size: 1.3rem; font-weight: 600; color: var(--ink); }
        .sp-reading { font-size: 0.85rem; color: var(--mut); margin-left: 10px; }
        .sp-meaning { font-size: 0.9rem; color: var(--ink); }
        .sp-pattern { margin: 0; font-family: var(--sp-study); font-size: 1.15rem; font-weight: 600; color: var(--ink); }
        .sp-explain { margin: 0; font-size: 0.9rem; line-height: 1.6; color: var(--mut); }
        .sp-ex {
          display: grid; gap: 4px; padding: 10px 12px; border-radius: 12px; cursor: pointer;
          background: var(--s2); border: 1px solid var(--ln);
        }
        .sp-ex.playing { border-color: var(--acc-line); }
        .sp-ex-j { margin: 0; font-family: var(--sp-study); font-weight: 600; font-size: 1.15rem; line-height: 1.7; color: var(--ink); }
        .sp-ex-r { margin: 0; font-size: 0.85rem; color: var(--mut); }
        .sp-ex-e { margin: 0; font-size: 0.85rem; color: var(--ink); }
        .sp-empty { padding: 16px 12px; font-size: 14px; color: var(--mut); }

        .sp-pop {
          position: absolute; right: 0; top: calc(100% + 6px); z-index: 50;
          background: var(--s2); border: 1px solid var(--ln); border-radius: 14px;
          box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.55);
          animation: fadeSlideDown 0.12s ease both;
        }
        .sp-pop-label { margin: 0 0 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mut); }
        .sp-opt {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          text-align: left; padding: 6px 10px; border-radius: 8px; cursor: pointer;
          background: transparent; border: 1px solid transparent; color: var(--mut);
          font-family: var(--sp-ui); font-size: 12px;
        }
        .sp-opt:hover { color: var(--ink); }
        .sp-opt[aria-pressed="true"] { background: var(--acc-soft); border-color: var(--acc-line); color: var(--acc); }
        .sp-opt small { font-size: 10px; color: var(--faint); }
        .sp-speed-range { width: 100%; accent-color: var(--acc); cursor: pointer; }

        /* Safe-area rules MUST live in a real stylesheet — iOS WebKit only resolves
           env() in stylesheets, not via the CSSOM / React inline styles. */
        .fs-toggle-bar { padding-top: calc(env(safe-area-inset-top, 0px) + 12px); }
        .fs-fullscreen-btn { position: absolute; right: 0.75rem; z-index: 20; top: calc(env(safe-area-inset-top, 0px) + 8px); }

        /* ── Desktop: stage + current line on the left, 360px tabs on the right ── */
        @media (min-width: 1024px) {
          .sp-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 360px;
            grid-template-rows: auto auto auto 1fr;
            align-items: start;
            min-height: 100dvh;
          }
          .sp-top { grid-column: 1; grid-row: 1; padding: 24px 28px 0; }
          .sp-title { font-size: 24px; }
          .sp-tog-d { display: flex; }
          .sp-tog-p { display: none; }
          .sp-grid .sp-stagewrap { grid-column: 1; grid-row: 2; padding: 16px 28px 0; }
          .sp-grid .sp-stage { border-radius: 18px; }
          .sp-line {
            grid-column: 1; grid-row: 3; margin: 16px 28px 0;
            column-gap: 18px; padding: 18px 22px; border-radius: 18px;
          }
          .sp-jp { font-size: 30px; line-height: 1.6; }
          .sp-ro { font-size: 15px; }
          .sp-en { font-size: 13.5px; }
          .sp-ctrls { justify-content: flex-start; }
          .sp-side {
            grid-column: 2; grid-row: 1 / -1; align-self: start;
            position: sticky; top: 0; height: 100dvh; margin-top: 0;
            border-top: 0; border-left: 1px solid var(--ln);
          }
          .sp-side-head { position: static; }
          .sp-side-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
        }
        @media (max-width: 1023px) {
          .sp-grid .sp-stage { border-radius: 0; }
        }
      `}</style>
    </div>
  );
}
