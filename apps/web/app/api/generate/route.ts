import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import crypto from "crypto";

// ============================================================
// SECTION 1: ZOD SCHEMA DEFINITIONS
// ============================================================

const DialogueLineSchema = z.object({
  speaker:    z.string().min(1, "Speaker cannot be empty"),
  kanji:      z.string().min(1, "Kanji line cannot be empty"),
  romaji:     z.string().min(1, "Romaji line cannot be empty"),
  english:    z.string().min(1, "English translation cannot be empty"),
});

const VocabularyItemSchema = z.object({
  word: z.string().min(1),
  reading: z.string().min(1),
  meaning: z.string().min(1),
  example_jp: z.string().min(1),
  example_romaji: z.string().min(1),
  example_en: z.string().min(1),
});

const GrammarPointSchema = z.object({
  pattern: z.string().min(1, "Grammar pattern cannot be empty"),
  explanation: z.string().min(1, "Grammar explanation cannot be empty"),
  example_jp: z.string().min(1, "Grammar example cannot be empty"),
  example_romaji: z.string().min(1),
  example_en: z.string().min(1),
});

const BackgroundTagSchema = z.enum([
  "ramen_shop",
  "train_station",
  "convenience_store",
  "school_classroom",
  "park",
  "office",
  "shrine",
  "beach",
  "apartment",
  "arcade",
]);

const LessonPayloadSchema = z.object({
  title: z.string().min(1, "Title cannot be empty"),
  background_tag: BackgroundTagSchema,
  // character_voices: AI-assigned per-character VoiceVox IDs.
  // e.g. { "Chef": 13, "Customer": 8 }
  // Optional — only present when available_voices was supplied in the request.
  character_voices: z.record(z.string(), z.number().int().nonnegative()).optional(),
  dialogue: z.array(DialogueLineSchema).min(4).max(12),
  vocabulary: z.array(VocabularyItemSchema).min(3).max(8),
  grammar_points: z.array(GrammarPointSchema).min(1),
});

type LessonPayload = z.infer<typeof LessonPayloadSchema>;

// ============================================================
// SECTION 2: CONSTANTS & SYSTEM PROMPT
// ============================================================

const BACKGROUND_TAGS = BackgroundTagSchema.options.join(" | ");

// buildSystemPrompt dynamically constructs the Gemini system prompt.
// When availableVoices is non-empty, a VOICE CASTING block is appended that
// instructs Gemini to produce a character_voices map assigning a distinct
// VoiceVox ID to every character. The worker reads this map and synthesises
// each line with the correct voice, giving the scene a full cast.
// When availableVoices is empty (VoiceVox offline / not yet fetched), the
// casting block is omitted entirely and character_voices is absent from the
// output — the worker falls back to its hardcoded name-based speakerIdMap.
function buildSystemPrompt(
  availableVoices: Array<{ id: number; label: string; sublabel: string }> = []
): string {
  const schemaVoiceLine = availableVoices.length > 0
    ? `
  "character_voices": {
    "<character name>": <integer VoiceVox speaker ID>,
    "<character name>": <integer VoiceVox speaker ID>
  },`
    : "";

  const basePrompt = [
    "You are an expert Japanese language teacher and anime screenwriter.",
    "Your task is to generate an immersive, cinematic Japanese language lesson in JSON format.",
    "",
    "The user will provide a scenario and a JLPT level. You must generate a complete lesson.",
    "",
    "STRICT OUTPUT RULES:",
    "- Respond with ONLY a single, valid JSON object. No markdown, no backticks, no preamble.",
    "- The JSON must conform EXACTLY to the schema below.",
    "",
    "JSON SCHEMA:",
    "{",
    `  "title": "string — A short, evocative scene title in English",`,
    `  "background_tag": "enum — MUST be one of: ${BACKGROUND_TAGS}",`,
    schemaVoiceLine,
    `  "dialogue": [`,
    `    {`,
    `      "speaker": "string — character name",`,
    `      "kanji":   "string — The Japanese line in kanji/kana",`,
    `      "romaji":  "string — Full romaji romanization",`,
    `      "english": "string — Natural English translation"`,
    `    }`,
    `  ],`,
    `  "vocabulary": [`,
    `    {`,
    `      "word":           "string — Japanese word in dictionary form",`,
    `      "reading":        "string — Hiragana reading",`,
    `      "meaning":        "string — English meaning",`,
    `      "example_jp":     "string — Short Japanese sentence (~15 chars)",`,
    `      "example_romaji": "string — Romaji for the example sentence",`,
    `      "example_en":     "string — English translation of the example sentence"`,
    `    }`,
    `  ],`,
    `  "grammar_points": [`,
    `    {`,
    `      "pattern":        "string — Grammar pattern",`,
    `      "explanation":    "string — Clear English explanation",`,
    `      "example_jp":     "string — Example sentence in Japanese (~15 chars)",`,
    `      "example_romaji": "string — Romaji for the example sentence",`,
    `      "example_en":     "string — English translation of the example sentence"`,
    `    }`,
    `  ]`,
    `}`,
    "",
    "CONTENT RULES:",
    "- Dialogue must feel natural, like a real anime scene, not a textbook.",
    "- Vocabulary must come from words actually used in the dialogue. Aim for 5–8 words.",
    "- Grammar points must be appropriate for the specified JLPT level.",
    "- Do NOT include any sound effects, stage directions, or special tags of any kind in the text fields.",
  ].filter(l => l !== undefined).join("\n");

  if (availableVoices.length === 0) return basePrompt;

  const voiceList = availableVoices
    .map(v => `  - id: ${v.id}  |  character: "${v.label}"  |  style: "${v.sublabel}"`)
    .join("\n");

  const castingBlock = [
    "",
    "",
    "VOICE CASTING (REQUIRED — character_voices must be present in your response):",
    "You are casting a full anime audio drama. Assign a unique VoiceVox voice to each character.",
    "",
    "RULES:",
    "- \"character_voices\" MUST include every unique speaker name that appears in the dialogue.",
    "- Each value MUST be an integer id taken directly from the AVAILABLE VOICES list below.",
    "- Assign DIFFERENT voices to DIFFERENT characters — never reuse the same id for two characters.",
    "- Choose voices that suit the character role, personality, and gender implied by the scenario.",
    "- Do NOT invent ids. Only use ids from the list below.",
    "",
    "AVAILABLE VOICES:",
    voiceList,
  ].join("\n");

  return basePrompt + castingBlock;
}

const MAX_RETRIES = 2;

// ============================================================
// SECTION 3: HELPER FUNCTIONS
// ============================================================

function generateScenarioHash(scenario: string, level: string): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ scenario: scenario.trim().toLowerCase(), level: level.trim().toLowerCase() }))
    .digest("hex");
}

function sanitizeLLMOutput(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Calls Google AI Studio (Gemini) directly via REST API.
 */
async function callGemini(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY in environment variables.");

  const systemMessage = messages.find((m) => m.role === "system")?.content || "";
  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const response = await fetch(
    // gemini-3-flash-preview: fast, no thinking overhead for structured JSON tasks.
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemMessage }] },
        contents: conversation,
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API Error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error("Gemini returned an empty or malformed response body.");
  }

  return content;
}

async function generateAndValidateLesson(
  scenario: string,
  level: string,
  availableVoices: Array<{ id: number; label: string; sublabel: string }> = []
): Promise<LessonPayload> {
  const userPrompt = `Generate a Japanese language lesson for the following:\nScenario: ${scenario}\nJLPT Level: ${level}`;

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: buildSystemPrompt(availableVoices) },
    { role: "user", content: userPrompt },
  ];

  let lastError: Error = new Error("Generation failed before first attempt.");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const rawOutput = await callGemini(messages);
      const sanitized = sanitizeLLMOutput(rawOutput);

      let parsed: unknown;
      try {
        parsed = JSON.parse(sanitized);
      } catch (parseError) {
        throw new Error(`JSON.parse failed: ${(parseError as Error).message}`);
      }

      // Structural validation (Zod). Throws ZodError on schema mismatch.
      const validated = LessonPayloadSchema.parse(parsed);

      return validated;

    } catch (error) {
      lastError = error as Error;
      const isZodError = error instanceof ZodError;
      const errorSummary = isZodError
        ? `Zod validation failed:\n${((error as any).errors ?? []).map((e: any) => `  - ${(e.path ?? []).join(".")}: ${e.message}`).join("\n")}`
        : `Error: ${(lastError as any)?.message || "Unknown error"}`;

      console.error(`[generate] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed.\n${errorSummary}`);

      if (attempt < MAX_RETRIES) {
        messages.push(
          { role: "assistant", content: "I made an error in my previous response." },
          { role: "user", content: `Your previous response had errors. Fix ALL of the following issues and respond with ONLY the complete corrected JSON:\n\n${errorSummary}` }
        );
      }
    }
  }

  throw lastError;
}


// ============================================================
// SECTION 3b: GHIBLI BACKGROUND IMAGE GENERATION
// ============================================================
//
// Flow:
//   1. Check lessons.background_image_url — return immediately if set.
//   2. Call Gemini image model to generate a Ghibli scene.
//   3. Upload PNG buffer to Supabase "backgrounds" bucket.
//   4. UPDATE lessons SET background_image_url = <public url>.
//   5. Return the public URL.
//
// imageSize / thinkingLevel note: These parameters do NOT exist in
// the generateContent API for this model. Google has not exposed
// resolution or reasoning controls for image generation via this
// endpoint. If/when they are added, insert them into generationConfig
// in callImageGeneration below.

const IMAGE_STYLE_PREFIX =
  "Studio Ghibli style, " +
  "ABSOLUTLY NO DIALOG SUBTITLES, " +
  "ABSOLUTLY NO SPEECH BUBBLES, " +
  "NO SUBTITLES," ;

const BACKGROUNDS_BUCKET = "backgrounds";

// Derive a stable storage filename from background_tag + lesson_id.
// Using lesson_id keeps each lesson's image isolated even if two lessons
// share the same tag but were generated at different times.
function backgroundFilename(lessonId: string, tag: string): string {
  return `${tag}_${lessonId}.png`;
}

async function generateAndSaveBackground(
  supabaseAdmin: ReturnType<typeof createClient>,
  lessonId: string,
  backgroundTag: string,
  scenarioDescription: string,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[bg] GEMINI_API_KEY not set — skipping image generation");
    return null;
  }

  // ── 1. Check DB cache ──────────────────────────────────────
  const { data: row } = await supabaseAdmin
    .from("lessons")
    .select("background_image_url")
    .eq("id", lessonId)
    .maybeSingle();

  const rowData = row as any;
   if (rowData?.background_image_url) {
     console.log(`[bg] Cache HIT for lesson ${lessonId}: ${rowData.background_image_url}`);
     return rowData.background_image_url as string;
   }

  // ── 2. Generate via Gemini ─────────────────────────────────
  const prompt =
    IMAGE_STYLE_PREFIX +
    `The scene is: "${backgroundTag.replace(/_/g, " ")}" — ` +
    `Scenario context: "${scenarioDescription.slice(0, 200)}"`;

  console.log(`[bg] Generating image for lesson ${lessonId} (${backgroundTag})...`);

  let imageBuffer: Buffer;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            // TEXT must be included alongside IMAGE — the model requires both.
            // Passing ["IMAGE"] alone returns empty candidates / no image part.
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
        signal: AbortSignal.timeout(45000),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      console.warn(`[bg] Gemini image gen ${res.status}: ${errText}`);
      return null;
    }

    const data = await res.json();
    const parts: Array<{ inlineData?: { data: string; mimeType: string } }> =
      data?.candidates?.[0]?.content?.parts ?? [];

    let b64: string | null = null;
    for (const part of parts) {
      if (part?.inlineData?.data && part.inlineData.mimeType?.startsWith("image/")) {
        b64 = part.inlineData.data;
        break;
      }
    }

    if (!b64) {
      console.warn("[bg] Gemini returned no image part. Parts:", JSON.stringify(parts).slice(0, 300));
      return null;
    }

    imageBuffer = Buffer.from(b64, "base64");
    console.log(`[bg] Gemini image OK: ${imageBuffer.byteLength} bytes`);
  } catch (e) {
    console.warn("[bg] Gemini image fetch failed:", e instanceof Error ? e.message : e);
    return null;
  }

  // ── 3. Upload to Supabase Storage ─────────────────────────
  const filename    = backgroundFilename(lessonId, backgroundTag);
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BACKGROUNDS_BUCKET)
    .upload(filename, imageBuffer, { contentType: "image/png", upsert: true });

  if (uploadError) {
    console.warn(`[bg] Storage upload failed: ${uploadError.message}`);
    return null;
  }

  // ── 4. Get public URL ──────────────────────────────────────
  const { data: urlData } = supabaseAdmin.storage
    .from(BACKGROUNDS_BUCKET)
    .getPublicUrl(filename);

  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) {
    console.warn("[bg] getPublicUrl returned no URL after upload");
    return null;
  }

  // ── 5. Save URL back to lessons row ───────────────────────
  const { error: updateError } = await supabaseAdmin
    .from("lessons")
    .update({ background_image_url: publicUrl })
    .eq("id", lessonId);

  if (updateError) {
    console.warn(`[bg] DB update failed: ${updateError.message}`);
    // Still return the URL — the image is accessible even if the DB write failed
  }

  console.log(`[bg] Image saved → ${publicUrl}`);
  return publicUrl;
}

// ============================================================
// SECTION 4: ROUTE HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or malformed Authorization header." }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized. Invalid or expired session." }, { status: 401 });
  }

  // Admin client — bypasses RLS for all write operations and for the
  // lesson_lines count check (which needs to read across RLS boundaries).
  // The service role key must NEVER be exposed to the browser.
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let scenario: string;
  let level: string;
  let availableVoices: Array<{ id: number; label: string; sublabel: string }> = [];

  try {
    const body = await request.json();
    scenario = body?.scenario;
    level    = body?.level;

    if (typeof scenario !== "string" || !scenario.trim() || typeof level !== "string" || !level.trim()) {
      throw new Error("Invalid fields.");
    }

    // available_voices is optional — sent by the frontend when VoiceVox is running.
    // Absent or malformed → empty array → prompt omits casting block → worker name-map fallback.
    if (Array.isArray(body?.available_voices)) {
      availableVoices = (body.available_voices as unknown[]).filter(
        (v): v is { id: number; label: string; sublabel: string } =>
          typeof v === "object" && v !== null &&
          typeof (v as { id: unknown }).id         === "number" &&
          typeof (v as { label: unknown }).label    === "string" &&
          typeof (v as { sublabel: unknown }).sublabel === "string"
      );
    }
  } catch {
    return NextResponse.json({ error: "Request body must include 'scenario' and 'level'." }, { status: 400 });
  }

  const scenarioHash = generateScenarioHash(scenario, level);

  const { data: existingLesson, error: lookupError } = await supabase
    .from("lessons")
    .select("id, status")
    .eq("scenario_hash", scenarioHash)
    .eq("status", "ready") // Only cache completed lessons
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Database error during deduplication check." }, { status: 500 });
  }

  if (existingLesson) {
    // Guard against a "shell" lesson: the record is marked 'ready' but its
    // lesson_lines rows were deleted (e.g. during DB cleanup or manual testing).
    // Returning a reference to an empty lesson would give the client a lesson_id
    // that resolves to no audio — it appears to load but plays nothing.
    //
    // Fix: count the lines associated with this lesson. If the count is 0,
    // the cache entry is stale. Delete it so the deduplication key is freed,
    // then fall through to full regeneration as if the lesson never existed.
    const { count: lineCount, error: lineCountError } = await supabaseAdmin
      .from("lesson_lines")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", existingLesson.id);

    const linesExist = !lineCountError && typeof lineCount === "number" && lineCount > 0;

    if (linesExist) {
      // Healthy cache hit — return immediately.
      return NextResponse.json(
        { lesson_id: existingLesson.id, cached: true, status: existingLesson.status },
        { status: 200 }
      );
    }

    // Stale shell: delete the broken record so regeneration can reuse the hash.
    console.warn(`[generate] Lesson ${existingLesson.id} is 'ready' but has no lines. Invalidating cache and regenerating.`);
    await supabaseAdmin.from("lessons").delete().eq("id", existingLesson.id);
    // Fall through to regeneration below.
  }

  // ==========================================
  // BYPASSING CREDIT CHECK FOR TESTING MVP
  // ==========================================
  /*
  const { data: creditDeducted, error: creditError } = await supabase.rpc("deduct_user_credit", { user_uuid: user.id });
  if (creditError || !creditDeducted) return NextResponse.json({ error: "Insufficient credits." }, { status: 402 });
  */
  // ==========================================

  const { data: newLesson, error: insertError } = await supabaseAdmin
    .from("lessons")
    .insert({
      scenario:      scenario.trim(),
      scenario_hash: scenarioHash,
      level:         level.trim(),
      status:        "queued",
      // Explicitly null — ensures the worker uses the AI per-character cast.
      // The user can set this later via the voice-changer UI to flatten all
      // lines to a single voice. NULL = multi-actor cast; integer = override.
      voice_id:      null,
    })
    .select("id")
    .single();

  if (insertError || !newLesson) {
    return NextResponse.json({ error: "Failed to initialize lesson." }, { status: 500 });
  }

  const lessonId = newLesson.id;

  let lessonPayload: LessonPayload;

  try {
    lessonPayload = await generateAndValidateLesson(scenario, level, availableVoices);
  } catch (generationError) {
    const errorMessage = generationError instanceof Error ? generationError.message : "Unknown error";
    await supabaseAdmin.from("lessons").update({ status: "failed", error_message: errorMessage.substring(0, 500) }).eq("id", lessonId);
    return NextResponse.json({ error: "AI generation failed.", lesson_id: lessonId }, { status: 500 });
  }

  const lineRows = lessonPayload.dialogue.map((line, index) => ({
    lesson_id:   lessonId,
    order_index: index,
    speaker:     line.speaker,
    kanji:       line.kanji,
    romaji:      line.romaji,
    english:     line.english,
    highlights:  [],   // column exists in DB schema; tags are now inline in kanji/english
    audio_url:   null,
  }));

  const { error: linesInsertError } = await supabaseAdmin.from("lesson_lines").insert(lineRows);

  if (linesInsertError) {
    await supabaseAdmin.from("lessons").update({ status: "failed", error_message: "Failed to save lines." }).eq("id", lessonId);
    return NextResponse.json({ error: "Failed to save lesson content.", lesson_id: lessonId }, { status: 500 });
  }

  // Run DB status update and image generation in parallel.
  // Both must finish before returning 202 — the serverless runtime kills
  // the process the instant the response is sent (fire-and-forget dies).
  // The status update wakes the worker; image gen writes background_image_url.
  // Neither blocks the other — total wait = max(db_update, image_gen).
  const [finalizeResult] = await Promise.all([
    supabaseAdmin
      .from("lessons")
      .update({ status: "generating_audio", background_tag: lessonPayload.background_tag, structured_content: lessonPayload })
      .eq("id", lessonId),
    generateAndSaveBackground(
      supabaseAdmin,
      lessonId,
      lessonPayload.background_tag,
      scenario,
    ).catch(e => console.warn("[bg] Background generation error:", e instanceof Error ? e.message : e)),
  ]);

  if (finalizeResult.error) {
    return NextResponse.json({ error: "Lesson saved but audio failed to queue." }, { status: 500 });
  }

  return NextResponse.json(
    { lesson_id: lessonId, cached: false, status: "generating_audio", background_tag: lessonPayload.background_tag, title: lessonPayload.title, line_count: lessonPayload.dialogue.length },
    { status: 202 }
  );
}

// ============================================================
// SECTION 5: GET — ON-DEMAND BACKGROUND REGENERATION
// ============================================================
// Called by the frontend when opening a lesson that has no background_image_url
// (either it was never generated, or the storage file was deleted).
// Query param: ?lesson_id=<uuid>
// Returns: { imageUrl: string | null }

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get("lesson_id");
  if (!lessonId) {
    return NextResponse.json({ error: "lesson_id query param required." }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch the lesson to get background_tag + scenario + current image URL
  const { data: lesson, error } = await supabaseAdmin
    .from("lessons")
    .select("background_tag, scenario, background_image_url")
    .eq("id", lessonId)
    .maybeSingle();

  if (error || !lesson) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  // If URL exists, verify the storage file actually still exists (HEAD check).
  // getPublicUrl always returns a URL even for deleted files, so we must confirm.
  if (lesson.background_image_url) {
    try {
      const headRes = await fetch(lesson.background_image_url as string, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      if (headRes.ok) {
        // File exists — nothing to do
        return NextResponse.json({ imageUrl: lesson.background_image_url });
      }
      // File was deleted — clear the stale DB URL and regenerate below
      console.log(`[bg] Storage file gone for lesson ${lessonId} — regenerating`);
      await supabaseAdmin
        .from("lessons")
        .update({ background_image_url: null })
        .eq("id", lessonId);
    } catch {
      // HEAD timed out — treat as missing, regenerate
      console.log(`[bg] HEAD check timed out for lesson ${lessonId} — regenerating`);
    }
  }

  // Generate (or regenerate) the background image
  const imageUrl = await generateAndSaveBackground(
    supabaseAdmin,
    lessonId,
    lesson.background_tag as string,
    lesson.scenario as string,
  ).catch(e => {
    console.warn("[bg] On-demand generation failed:", e instanceof Error ? e.message : e);
    return null;
  });

  return NextResponse.json({ imageUrl });
}

// ============================================================
// SECTION 6: DELETE — FULL LESSON CLEANUP
// ============================================================
// Deletes everything associated with a lesson:
//   - Audio files in storage: audio/{lessonId}/line_*.wav
//   - Background image in storage: backgrounds/{tag}_{lessonId}.png
//   - lesson_lines rows
//   - lessons row
// Called from handleDelete in page.tsx instead of hitting Supabase directly,
// because storage deletion requires the service role key (never in the browser).

export async function DELETE(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get("lesson_id");
  if (!lessonId) {
    return NextResponse.json({ error: "lesson_id query param required." }, { status: 400 });
  }

  // Auth check — must be a valid signed-in user
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing Authorization header." }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── 1. Fetch the lesson to get background_tag for storage path ─────────
  const { data: lesson } = await supabaseAdmin
    .from("lessons")
    .select("background_tag")
    .eq("id", lessonId)
    .maybeSingle();

  // ── 2. Delete audio files from storage ────────────────────────────────
  // List all files under audio/{lessonId}/ then remove them in one call.
  const { data: audioFiles } = await supabaseAdmin.storage
    .from("audio")
    .list(lessonId);

  if (audioFiles && audioFiles.length > 0) {
    const audioPaths = audioFiles.map(f => `${lessonId}/${f.name}`);
    const { error: audioDeleteError } = await supabaseAdmin.storage
      .from("audio")
      .remove(audioPaths);
    if (audioDeleteError) {
      console.warn(`[delete] Audio storage cleanup failed for ${lessonId}: ${audioDeleteError.message}`);
    } else {
      console.log(`[delete] Removed ${audioPaths.length} audio file(s) for lesson ${lessonId}`);
    }
  }

  // ── 3. Delete background image from storage ───────────────────────────
  if (lesson?.background_tag) {
    const bgFilename = backgroundFilename(lessonId, lesson.background_tag);
    const { error: bgDeleteError } = await supabaseAdmin.storage
      .from(BACKGROUNDS_BUCKET)
      .remove([bgFilename]);
    if (bgDeleteError) {
      console.warn(`[delete] Background storage cleanup failed for ${lessonId}: ${bgDeleteError.message}`);
    } else {
      console.log(`[delete] Removed background image for lesson ${lessonId}`);
    }
  }

  // ── 4. Delete lesson_lines rows ───────────────────────────────────────
  await supabaseAdmin.from("lesson_lines").delete().eq("lesson_id", lessonId);

  // ── 5. Delete the lesson row itself ───────────────────────────────────
  const { error: lessonDeleteError } = await supabaseAdmin
    .from("lessons")
    .delete()
    .eq("id", lessonId);

  if (lessonDeleteError) {
    console.error(`[delete] Failed to delete lesson row ${lessonId}: ${lessonDeleteError.message}`);
    return NextResponse.json({ error: "Failed to delete lesson." }, { status: 500 });
  }

  console.log(`[delete] Lesson ${lessonId} fully deleted.`);
  return NextResponse.json({ success: true });
}
