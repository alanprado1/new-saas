/**
 * app/api/generate/route.ts
 */
export const maxDuration = 60; // Gives the API up to 60 seconds to finish
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z, ZodError } from "zod";
import crypto from "crypto";

// ============================================================
// SECTION 1: ZOD SCHEMA DEFINITIONS
// ============================================================

const DialogueLineSchema = z.object({
  speaker: z.string().min(1, "Speaker cannot be empty"),
  kanji: z.string().min(1).describe("The Japanese text. Must contain complete thoughts, do not over-split."),
  romaji: z.string().min(1).describe("Must perfectly match the kanji field conceptually. Start with a capital letter."),
  english: z.string().min(1).describe("The exact translation of the kanji field in this specific object."),
});

const VocabularyItemSchema = z.object({
  word:           z.string().min(1),
  reading:        z.string().min(1),
  meaning:        z.string().min(1),
  example_jp:     z.string().min(1),
  example_romaji: z.string().min(1),
  example_en:     z.string().min(1),
});

const GrammarPointSchema = z.object({
  pattern:        z.string().min(1),
  explanation:    z.string().min(1),
  example_jp:     z.string().min(1),
  example_romaji: z.string().min(1),
  example_en:     z.string().min(1),
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
  title:            z.string().min(1),
  background_tag:   BackgroundTagSchema,
  character_voices: z.record(z.string(), z.number().int().nonnegative()).optional(),
  dialogue:         z.array(DialogueLineSchema).min(4).max(12),
  vocabulary:       z.array(VocabularyItemSchema).min(3).max(8),
  grammar_points:   z.array(GrammarPointSchema).min(1),
});

type LessonPayload = z.infer<typeof LessonPayloadSchema>;

// ============================================================
// SECTION 2: SYSTEM PROMPT BUILDER
// ============================================================

const BACKGROUND_TAGS = BackgroundTagSchema.options.join(" | ");

function buildSystemPrompt(
  availableVoices: Array<{ id: number; label: string; sublabel: string }> = []
): string {
  const schemaVoiceLine = availableVoices.length > 0
    ? `\n  "character_voices": {\n    "<character name>": <integer VoiceVox speaker ID>,\n    "<character name>": <integer VoiceVox speaker ID>\n  },`
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
    `  "dialogue": [{ "speaker": "string", "kanji": "string", "romaji": "string", "english": "string" }],`,
    `  "vocabulary": [{ "word": "string", "reading": "string", "meaning": "string", "example_jp": "string", "example_romaji": "string", "example_en": "string" }],`,
    `  "grammar_points": [{ "pattern": "string", "explanation": "string", "example_jp": "string", "example_romaji": "string", "example_en": "string" }]`,
    `}`,
    "",
    "CONTENT RULES:",
    "- Dialogue must feel natural, like a real anime scene, not a textbook.",
    "- Vocabulary must come from words actually used in the dialogue. Aim for 5–8 words.",
    "- Grammar points must be appropriate for the specified JLPT level.",
    "- Do NOT include any sound effects, stage directions, or special tags in text fields.",
  ].filter(l => l !== undefined).join("\n");

  if (availableVoices.length === 0) return basePrompt;

  const voiceList = availableVoices
    .map(v => `  - id: ${v.id}  |  character: "${v.label}"  |  style: "${v.sublabel}"`)
    .join("\n");

  const castingBlock = [
    "",
    "",
    "VOICE CASTING (REQUIRED — character_voices must be present in your response):",
    "Assign a unique VoiceVox voice to each character from the AVAILABLE VOICES list.",
    "RULES:",
    "- Include every unique speaker name in character_voices.",
    "- Use integer IDs from the AVAILABLE VOICES list only — do NOT invent ids.",
    "- CRITICAL: Assign DIFFERENT voices to DIFFERENT characters. NO two characters may share the same ID.",
    "- If there are 2 speakers, pick 2 different IDs. If 3 speakers, pick 3 different IDs.",
    "- The first speaker should get the first available ID, the second speaker a DIFFERENT ID.",
    "",
    "AVAILABLE VOICES:",
    voiceList,
  ].join("\n");

  return basePrompt + castingBlock;
}

const MAX_RETRIES = 2;

// ============================================================
// SECTION 3: HELPERS
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
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
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("Gemini API timed out after 25 s. The model may be overloaded — try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

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
      const rawOutput  = await callGemini(messages);
      const sanitized  = sanitizeLLMOutput(rawOutput);

      let parsed: unknown;
      try {
        parsed = JSON.parse(sanitized);
      } catch (parseError) {
        throw new Error(`JSON.parse failed: ${(parseError as Error).message}`);
      }

      const validated = LessonPayloadSchema.parse(parsed);
      return validated;

    } catch (error) {
      lastError = error as Error;
      const isZodError = error instanceof ZodError;
      const errorSummary = isZodError
        ? `Zod validation failed:\n${((error as any).errors ?? []).map((e: any) => `  - ${(e.path ?? []).join(".")}: ${e.message}`).join("\n")}`
        : `Error: ${lastError?.message || "Unknown error"}`;

      console.error(`[generate] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed.\n${errorSummary}`);

      if (attempt < MAX_RETRIES) {
        messages.push(
          { role: "assistant", content: "I made an error in my previous response." },
          { role: "user",      content: `Your previous response had errors. Fix ALL issues and respond with ONLY the corrected JSON:\n\n${errorSummary}` }
        );
      }
    }
  }

  throw lastError;
}

// ============================================================
// SECTION 3b: GHIBLI BACKGROUND IMAGE GENERATION
// ============================================================

const IMAGE_STYLE_PREFIX =
  "Studio Ghibli style, " +
  "ABSOLUTELY NO DIALOG SUBTITLES, " +
  "ABSOLUTELY NO SPEECH BUBBLES, " +
  "NO SUBTITLES,";

const BACKGROUNDS_BUCKET = "backgrounds";

function backgroundFilename(lessonId: string, tag: string): string {
  return `${tag}_${lessonId}.png`;
}

async function generateAndSaveBackground(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  lessonId: string,
  backgroundTag: string,
  scenarioDescription: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[bg] GEMINI_API_KEY not set — skipping image generation");
    return null;
  }

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

  const prompt =
    IMAGE_STYLE_PREFIX +
    `The scene is: "${backgroundTag.replace(/_/g, " ")}" — ` +
    `Scenario context: "${scenarioDescription.slice(0, 200)}"`;

  console.log(`[bg] Generating image for lesson ${lessonId} (${backgroundTag})...`);

  const IMAGE_MAX_ATTEMPTS = 3;
  const IMAGE_RETRY_DELAY_MS = 2_000;

  let imageBuffer: Buffer | null = null;

  for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }),
          signal: AbortSignal.timeout(45_000),
        }
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        console.warn(`[bg] Attempt ${attempt}/${IMAGE_MAX_ATTEMPTS}: Gemini image gen ${res.status}: ${errText}`);
        if (attempt < IMAGE_MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, IMAGE_RETRY_DELAY_MS));
          continue;
        }
        break;
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
        console.warn(
          `[bg] Attempt ${attempt}/${IMAGE_MAX_ATTEMPTS}: Gemini returned no image part.`,
          `Parts: ${JSON.stringify(parts).slice(0, 300)}`
        );
        if (attempt < IMAGE_MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, IMAGE_RETRY_DELAY_MS));
          continue;
        }
        break;
      }

      imageBuffer = Buffer.from(b64, "base64");
      console.log(`[bg] Attempt ${attempt}: Gemini image OK — ${imageBuffer.byteLength} bytes`);
      break;
    } catch (e) {
      console.warn(
        `[bg] Attempt ${attempt}/${IMAGE_MAX_ATTEMPTS}: Gemini image fetch threw:`,
        e instanceof Error ? e.message : e
      );
      if (attempt < IMAGE_MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, IMAGE_RETRY_DELAY_MS));
      }
    }
  }

  if (!imageBuffer) {
    console.warn(`[bg] Image generation failed after ${IMAGE_MAX_ATTEMPTS} attempts — lesson will have no background image.`);
    return null;
  }

  const filename = backgroundFilename(lessonId, backgroundTag);
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BACKGROUNDS_BUCKET)
    .upload(filename, imageBuffer, { contentType: "image/png", upsert: true });

  if (uploadError) {
    console.warn(`[bg] Storage upload failed: ${uploadError.message}`);
    return null;
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(BACKGROUNDS_BUCKET)
    .getPublicUrl(filename);

  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) {
    console.warn("[bg] getPublicUrl returned no URL after upload");
    return null;
  }

  const { error: updateError } = await (supabaseAdmin as any)
    .from("lessons")
    .update({ background_image_url: publicUrl })
    .eq("id", lessonId);

  if (updateError) {
    console.warn(`[bg] DB update failed: ${updateError.message}`);
  }

  console.log(`[bg] Image saved → ${publicUrl}`);
  return publicUrl;
}

// ============================================================
// SECTION 4: ROUTE HANDLER — POST
// ============================================================

export async function POST(request: NextRequest) {
  // ── Auth check ────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized. Invalid or expired session." }, { status: 401 });
  }

  const supabaseAdmin = createSupabaseAdmin(
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

  // ── Deduplication cache check ──────────────────────────────
  const { data: existingLesson, error: lookupError } = await supabase
    .from("lessons")
    .select("id, status")
    .eq("scenario_hash", scenarioHash)
    .eq("status", "ready")
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Database error during deduplication check." }, { status: 500 });
  }

  if (existingLesson) {
    const { count: lineCount, error: lineCountError } = await supabaseAdmin
      .from("lesson_lines")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", existingLesson.id);

    const linesExist = !lineCountError && typeof lineCount === "number" && lineCount > 0;

    if (linesExist) {
      return NextResponse.json(
        { lesson_id: existingLesson.id, cached: true, status: existingLesson.status },
        { status: 200 }
      );
    }

    console.warn(`[generate] Lesson ${existingLesson.id} is stale (no lines). Invalidating.`);
    await supabaseAdmin.from("lessons").delete().eq("id", existingLesson.id);
  }

  // ── Insert new lesson row ──────────────────────────────────
  const { data: newLesson, error: insertError } = await supabaseAdmin
    .from("lessons")
    .insert({
      scenario:      scenario.trim(),
      scenario_hash: scenarioHash,
      level:         level.trim(),
      status:        "queued",
      voice_id:      null,
    })
    .select("id")
    .single();

  if (insertError || !newLesson) {
    return NextResponse.json({ error: "Failed to initialize lesson." }, { status: 500 });
  }

  const lessonId = newLesson.id;

  // ── Generate script (Gemini, with 25 s timeout) ───────────
  let lessonPayload: LessonPayload;
  try {
    lessonPayload = await generateAndValidateLesson(scenario, level, availableVoices);
  } catch (generationError) {
    const errorMessage = generationError instanceof Error ? generationError.message : "Unknown error";
    await supabaseAdmin.from("lessons").update({ status: "failed", error_message: errorMessage.substring(0, 500) }).eq("id", lessonId);
    return NextResponse.json({ error: "AI generation failed.", lesson_id: lessonId }, { status: 500 });
  }

  // ── Ensure distinct speaker voices (server-side safety net) ──
  const uniqueSpeakers = [...new Set(lessonPayload.dialogue.map(l => l.speaker))];
  const existingCast   = lessonPayload.character_voices ?? {};

  const castedIds     = uniqueSpeakers.map(s => existingCast[s]).filter(id => typeof id === "number");
  const allPresent    = uniqueSpeakers.every(s => typeof existingCast[s] === "number");
  const allDistinct   = new Set(castedIds).size === castedIds.length;

  if (!allPresent || !allDistinct || castedIds.length === 0) {
    const FALLBACK_VOICE_IDS = [3, 1, 8, 14, 2, 10, 11, 13];
    const voicePool = availableVoices.length >= uniqueSpeakers.length
      ? availableVoices.map(v => v.id)
      : FALLBACK_VOICE_IDS;

    const fallbackCast: Record<string, number> = {};
    uniqueSpeakers.forEach((speaker, idx) => {
      fallbackCast[speaker] = voicePool[idx % voicePool.length];
    });

    console.warn(
      `[generate] character_voices was ${!allPresent ? "incomplete" : "had duplicates"} — applying fallback cast:`,
      fallbackCast
    );
    const mergedCast: Record<string, number> = { ...fallbackCast };
    for (const speaker of uniqueSpeakers) {
      if (typeof existingCast[speaker] === "number") {
        const proposedId = existingCast[speaker];
        const alreadyUsed = Object.entries(mergedCast).some(
          ([s, id]) => s !== speaker && id === proposedId
        );
        if (!alreadyUsed) mergedCast[speaker] = proposedId;
      }
    }
    lessonPayload.character_voices = mergedCast;
  }

  // ── Insert lesson_lines ───────────────────────────────────
  const lineRows = lessonPayload.dialogue.map((line, index) => ({
    lesson_id:   lessonId,
    order_index: index,
    speaker:     line.speaker,
    kanji:       line.kanji,
    romaji:      line.romaji,
    english:     line.english,
    highlights:  [],
    audio_url:   null,
  }));

  const { error: linesInsertError } = await supabaseAdmin.from("lesson_lines").insert(lineRows);
  if (linesInsertError) {
    await supabaseAdmin.from("lessons").update({ status: "failed", error_message: "Failed to save lines." }).eq("id", lessonId);
    return NextResponse.json({ error: "Failed to save lesson content.", lesson_id: lessonId }, { status: 500 });
  }

  // ── Update status to "generating_audio" — triggers the worker ──
  const { error: finalizeError } = await supabaseAdmin
    .from("lessons")
    .update({
      status:             "generating_audio",
      background_tag:     lessonPayload.background_tag,
      structured_content: lessonPayload,
    })
    .eq("id", lessonId);

  if (finalizeError) {
    return NextResponse.json({ error: "Lesson saved but audio failed to queue." }, { status: 500 });
  }

  after(async () => {
    console.log(`[bg] Starting background image gen for lesson ${lessonId} (post-response)`);
    await generateAndSaveBackground(
      supabaseAdmin,
      lessonId,
      lessonPayload.background_tag,
      scenario
    ).catch(e => console.warn("[bg] Post-response background gen failed:", e instanceof Error ? e.message : e));
  });

  return NextResponse.json(
    {
      lesson_id:      lessonId,
      cached:         false,
      status:         "generating_audio",
      background_tag: lessonPayload.background_tag,
      title:          lessonPayload.title,
      line_count:     lessonPayload.dialogue.length,
    },
    { status: 202 }
  );
}

// ============================================================
// SECTION 5: GET — ON-DEMAND BACKGROUND REGENERATION
// ============================================================

export async function GET(request: NextRequest) {
  // ── Auth check ────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lessonId = request.nextUrl.searchParams.get("lesson_id");
  if (!lessonId) {
    return NextResponse.json({ error: "lesson_id query param required." }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: lesson, error } = await supabaseAdmin
    .from("lessons")
    .select("background_tag, scenario, background_image_url")
    .eq("id", lessonId)
    .maybeSingle();

  if (error || !lesson) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  if (lesson.background_image_url) {
    try {
      const headRes = await fetch(lesson.background_image_url as string, {
        method: "HEAD",
        signal: AbortSignal.timeout(5_000),
      });
      if (headRes.ok) {
        return NextResponse.json({ imageUrl: lesson.background_image_url });
      }
      console.log(`[bg] Storage file gone for lesson ${lessonId} — regenerating`);
      await supabaseAdmin.from("lessons").update({ background_image_url: null }).eq("id", lessonId);
    } catch {
      console.log(`[bg] HEAD check timed out for lesson ${lessonId} — regenerating`);
    }
  }

  const imageUrl = await generateAndSaveBackground(
    supabaseAdmin,
    lessonId,
    lesson.background_tag as string,
    lesson.scenario as string
  ).catch(e => {
    console.warn("[bg] On-demand generation failed:", e instanceof Error ? e.message : e);
    return null;
  });

  return NextResponse.json({ imageUrl });
}

// ============================================================
// SECTION 6: DELETE — FULL LESSON CLEANUP
// ============================================================

export async function DELETE(request: NextRequest) {
  // ── Auth check ────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const lessonId = request.nextUrl.searchParams.get("lesson_id");
  if (!lessonId) {
    return NextResponse.json({ error: "lesson_id query param required." }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: lesson } = await supabaseAdmin
    .from("lessons")
    .select("background_tag")
    .eq("id", lessonId)
    .maybeSingle();

  // Delete audio files
  const { data: audioFiles } = await supabaseAdmin.storage.from("audio").list(lessonId);
  if (audioFiles && audioFiles.length > 0) {
    const audioPaths = audioFiles.map((f: { name: string }) => `${lessonId}/${f.name}`);
    await supabaseAdmin.storage.from("audio").remove(audioPaths);
  }

  // Delete background image
  if (lesson?.background_tag) {
    const bgFilename = backgroundFilename(lessonId, lesson.background_tag);
    await supabaseAdmin.storage.from(BACKGROUNDS_BUCKET).remove([bgFilename]);
  }

  // Delete rows
  await supabaseAdmin.from("lesson_lines").delete().eq("lesson_id", lessonId);
  const { error: lessonDeleteError } = await supabaseAdmin.from("lessons").delete().eq("id", lessonId);

  if (lessonDeleteError) {
    return NextResponse.json({ error: "Failed to delete lesson." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
