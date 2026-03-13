/**
 * lib/voicevox.ts
 * ─────────────────────────────────────────────────────────────
 * Local-First, Cloud-Fallback VoiceVox URL resolver.
 *
 * Resolution order:
 *   1. Ping the local VoiceVox engine (800 ms timeout).
 *      → If it responds, return the local URL immediately.
 *   2. If the local ping fails AND we're in development,
 *      fire-and-forget a child_process.exec to launch VoiceVox
 *      in headless mode (does NOT block the response).
 *   3. Return the Hugging Face Cloud URL so the caller can
 *      still attempt synthesis while VoiceVox wakes up locally.
 *
 * Usage:
 *   const base = await getVoiceVoxUrl();
 *   // base is either "http://127.0.0.1:50021" or the HF Space URL
 */

const VOICEVOX_LOCAL = process.env.VOICEVOX_LOCAL_URL ?? "http://127.0.0.1:50021";
const VOICEVOX_CLOUD = process.env.VOICEVOX_HF_URL    ?? "https://alanweg2-my-voicevox-api.hf.space";

// Path to the VoiceVox executable — override via env if needed.
// This is only used in development when auto-start is attempted.
const VOICEVOX_EXEC = process.env.VOICEVOX_EXEC_PATH ?? "/Applications/VoiceVox.app/Contents/MacOS/VoiceVox";

/**
 * Returns the best available VoiceVox base URL.
 * Guaranteed to return a string synchronously after the promise resolves —
 * callers never need to handle null / undefined.
 */
export async function getVoiceVoxUrl(): Promise<string> {
  // ── 1. Check if local engine is already running ──────────────
  const localUp = await pingVoiceVox(VOICEVOX_LOCAL, 800);
  if (localUp) return VOICEVOX_LOCAL;

  // ── 2. Local not running — try auto-start in dev ─────────────
  if (process.env.NODE_ENV === "development") {
    tryLaunchVoiceVox();
  }

  // ── 3. Fall back to Hugging Face Cloud ───────────────────────
  return VOICEVOX_CLOUD;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Returns true if VoiceVox responds to GET /version within `timeoutMs`. */
async function pingVoiceVox(base: string, timeoutMs: number): Promise<boolean> {
  try {
    const res = await fetch(`${base}/version`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fire-and-forget: launch the VoiceVox engine in headless mode.
 * We deliberately do NOT await this — the process will keep starting
 * in the background while the current request falls back to the cloud.
 * On subsequent requests (a few seconds later) the local engine will
 * answer the ping and be used directly.
 *
 * This is dev-only and safe to call multiple times — redundant launches
 * are harmless because the OS will refuse to bind the same port twice.
 */
function tryLaunchVoiceVox(): void {
  // Dynamic import so this module compiles in edge runtimes that don't
  // have child_process available (the import is never actually called
  // outside of Node.js server routes).
  import("child_process")
    .then(({ exec }) => {
      const cmd = `"${VOICEVOX_EXEC}" --headless`;
      exec(cmd, (err) => {
        if (err) {
          // Log but don't throw — this is best-effort.
          console.warn("[VoiceVox] Auto-start failed:", err.message);
        } else {
          console.log("[VoiceVox] Auto-start launched in background.");
        }
      });
    })
    .catch(() => {
      // child_process not available in this runtime — silently ignore.
    });
}

/**
 * Poll /version until VoiceVox responds or the timeout elapses.
 * Useful when waking a sleeping Hugging Face Space (~20-30 s cold start).
 *
 * @param base       Base URL to poll (e.g. VOICEVOX_CLOUD)
 * @param timeoutMs  Give up after this many milliseconds (default 60 s)
 * @param intervalMs Retry interval in milliseconds (default 3 s)
 */
export async function waitForVoiceVox(
  base: string,
  timeoutMs = 60_000,
  intervalMs = 3_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  console.log(`[VoiceVox] Waiting for ${base} to wake up…`);

  while (Date.now() < deadline) {
    const up = await pingVoiceVox(base, 5_000);
    if (up) {
      console.log(`[VoiceVox] ${base} is ready.`);
      return;
    }
    // Wait before next attempt, but don't overshoot the deadline.
    const remaining = deadline - Date.now();
    await sleep(Math.min(intervalMs, remaining));
  }

  throw new Error(`[VoiceVox] ${base} did not respond within ${timeoutMs} ms.`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
