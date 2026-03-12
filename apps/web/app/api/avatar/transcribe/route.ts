import { NextRequest, NextResponse } from "next/server";

// POST /api/avatar/transcribe
// Accepts multipart/form-data with a "file" field (audio/webm or audio/mp4).
// Proxies to Groq Whisper — GROQ_API_KEY never touches the browser.

export async function POST(req: NextRequest) {
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

  // Next.js / the Fetch API delivers uploaded files as File (subclass of Blob).
  // We accept either — both have .arrayBuffer() and .type.
  if (!fileField || !(fileField instanceof Blob)) {
    console.error("[/api/avatar/transcribe] No valid file field in form data.");
    return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
  }

  // ── Sanity-check the blob size ────────────────────────────
  // Groq rejects files under ~100 bytes with a 400. We guard here
  // so we can return a clean error instead of proxying Groq's 400.
  if (fileField.size < 100) {
    console.warn("[/api/avatar/transcribe] Audio blob too small:", fileField.size, "bytes — skipping.");
    return NextResponse.json({ text: "" });   // treat as silence, not an error
  }

  // ── Determine file extension for Groq ────────────────────
  // Groq requires the filename to have a supported extension so it
  // can detect the container format. Map the MIME type to an extension.
  const mime = fileField.type || "audio/webm";
  const ext  = mime.includes("mp4") ? "m4a"
             : mime.includes("ogg") ? "ogg"
             : "webm"; // covers audio/webm and audio/webm;codecs=opus

  // ── Build the FormData for Groq ───────────────────────────
  const groqForm = new FormData();
  // Pass the raw Blob with a filename — Groq identifies format from the extension
  groqForm.append("file", fileField, `audio.${ext}`);
  groqForm.append("model", "whisper-large-v3");
  groqForm.append("language", "ja");       // hints Japanese; Whisper still handles English fine
  groqForm.append("response_format", "json");

  // ── Call Groq Whisper ─────────────────────────────────────
  try {
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method:  "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      // Do NOT set Content-Type — fetch will set multipart/form-data + boundary automatically
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
