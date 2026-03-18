import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// POST /api/avatar/transcribe
// Accepts multipart/form-data with a "file" field (audio/webm or audio/mp4).
// Proxies to Groq Whisper — GROQ_API_KEY never touches the browser.

export async function POST(req: NextRequest) {
  // ── Auth check ────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("[/api/avatar/transcribe] GROQ_API_KEY is not set.");
    return NextResponse.json({ error: "GROQ_API_KEY is not set." }, { status: 500 });
  }

  // ── Parse the incoming FormData ───────────────────────────
  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch (e) {
    console.error("[/api/avatar/transcribe] Failed to parse form data:", e);
    return NextResponse.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  const fileField = incoming.get("file");

  if (!fileField || !(fileField instanceof Blob)) {
    console.error("[/api/avatar/transcribe] No valid file field in form data.");
    return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
  }

  // ── Sanity-check the blob size ────────────────────────────
  if (fileField.size < 100) {
    console.warn("[/api/avatar/transcribe] Audio blob too small:", fileField.size, "bytes — skipping.");
    return NextResponse.json({ text: "" });
  }

  // ── Determine file extension for Groq ────────────────────
  const mime = fileField.type || "audio/webm";
  const ext  = mime.includes("mp4") ? "m4a"
             : mime.includes("ogg") ? "ogg"
             : "webm";

  // ── Build the FormData for Groq ───────────────────────────
  const groqForm = new FormData();
  groqForm.append("file", fileField, `audio.${ext}`);
  groqForm.append("model", "whisper-large-v3");
  groqForm.append("language", "ja");
  groqForm.append("response_format", "json");

  // ── Call Groq Whisper ─────────────────────────────────────
  try {
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method:  "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqForm,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => res.statusText);
      console.error("[/api/avatar/transcribe] Groq Whisper error:", res.status, errBody);
      return NextResponse.json(
        { error: `Whisper ${res.status}: ${errBody}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const text: string = (data?.text ?? "").trim();
    return NextResponse.json({ text });

  } catch (e) {
    console.error("[/api/avatar/transcribe] Network error calling Groq:", e);
    return NextResponse.json({ error: "Transcription request failed." }, { status: 502 });
  }
}
