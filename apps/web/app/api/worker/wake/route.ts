import { NextResponse } from "next/server";

const AUDIO_WORKER_WAKE_URL = process.env.AUDIO_WORKER_WAKE_URL ?? process.env.WORKER_WAKE_URL ?? "";

function audioWorkerWakeEndpoint(): string | null {
  const rawUrl = AUDIO_WORKER_WAKE_URL.trim();
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    if (url.pathname === "/" || !url.pathname) url.pathname = "/wake";
    return url.toString();
  } catch {
    return null;
  }
}

async function wakeAudioWorker(): Promise<{ ok: boolean; skipped?: boolean; status?: number; error?: string }> {
  const endpoint = audioWorkerWakeEndpoint();
  if (!endpoint) return { ok: false, skipped: true, error: "AUDIO_WORKER_WAKE_URL is not configured." };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
    });

    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Worker wake request failed." };
  }
}

export async function POST() {
  const result = await wakeAudioWorker();
  return NextResponse.json(result, {
    status: result.ok || result.skipped ? 202 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return POST();
}
