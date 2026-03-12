import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// ============================================================
// POST /api/voice
//
// Accepts { lesson_id, voice_id } and queues the lesson for
// audio regeneration using a specific VoiceVox speaker ID.
//
// NOTE: This is a separate route from GET /api/voices.
//   GET /api/voices  → lists available voices from VoiceVox
//   POST /api/voice  → triggers regeneration with a chosen voice
//
// Flow:
//   1. Verify the caller's Supabase session via Bearer JWT.
//   2. Confirm the lesson belongs to that user (RLS enforced read).
//   3. Update lessons row: voice_id = <new>, status = 'generating_audio'.
//   4. The local worker's Realtime listener picks up the UPDATE,
//      reads voice_id, and passes it straight to the VoiceVox API
//      instead of running the character-name → speaker-ID mapping.
// ============================================================

export async function POST(request: NextRequest) {

  // ── 1. Auth ────────────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or malformed Authorization header." },
      { status: 401 }
    );
  }

  // Anon client scoped to the user's JWT — RLS applies on every query.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized. Invalid or expired session." },
      { status: 401 }
    );
  }

  // ── 2. Parse and validate body ─────────────────────────────
  let lesson_id: string;
  let voice_id: number;

  try {
    const body = await request.json();
    lesson_id = body?.lesson_id;
    voice_id  = body?.voice_id;

    if (typeof lesson_id !== "string" || !lesson_id.trim()) {
      throw new Error("lesson_id must be a non-empty string.");
    }
    if (typeof voice_id !== "number" || !Number.isInteger(voice_id) || voice_id < 0) {
      throw new Error("voice_id must be a non-negative integer.");
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request body." },
      { status: 400 }
    );
  }

  // ── 3. Ownership check — read lesson through RLS ───────────
  // The anon client uses the user's JWT so RLS silently filters to
  // only rows the user owns. A null result means either the lesson
  // doesn't exist or it belongs to someone else — same 404 in both
  // cases to avoid leaking row existence information.
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, status")
    .eq("id", lesson_id.trim())
    .maybeSingle();

  if (lessonError) {
    return NextResponse.json(
      { error: "Database error while looking up lesson." },
      { status: 500 }
    );
  }
  if (!lesson) {
    return NextResponse.json(
      { error: "Lesson not found or access denied." },
      { status: 404 }
    );
  }

  // ── 4. Queue regeneration — service role bypasses RLS write ──
  // We've already verified ownership above. The admin client is
  // needed because some RLS policies block UPDATE on rows whose
  // status is managed server-side only.
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: updateError } = await supabaseAdmin
    .from("lessons")
    .update({
      voice_id,
      status: "generating_audio",
      error_message: null, // clear any stale error from a previous run
    })
    .eq("id", lesson_id.trim());

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to queue voice regeneration." },
      { status: 500 }
    );
  }

  // 202 Accepted — the worker processes this asynchronously.
  return NextResponse.json(
    { lesson_id, voice_id, status: "generating_audio" },
    { status: 202 }
  );
}
