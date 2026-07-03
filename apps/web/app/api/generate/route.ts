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
import {
  DEFAULT_LEARNING_DIRECTION,
  getLanguageDirectionConfig,
  resolveLearningDirection,
  type GenerationProvider,
  type LearningDirection,
} from "@/lib/language";

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
  character_voices: z.record(z.string(), z.union([z.number().int().nonnegative(), z.string().min(1)])).optional(),
  dialogue:         z.array(DialogueLineSchema).min(4).max(28),
  vocabulary:       z.array(VocabularyItemSchema).min(3).max(14),
  grammar_points:   z.array(GrammarPointSchema).min(1),
});

type LessonPayload = z.infer<typeof LessonPayloadSchema>;
type LessonPayloadWithLanguage = LessonPayload & {
  learning_direction: LearningDirection;
  target_language: string;
  support_language: string;
  generation_provider: string;
  tts_provider: string;
};
type AuthUser = {
  id: string;
  email?: string | null;
};
type LessonTablePair = {
  lessons: "lessons" | "english_lessons";
  lines: "lesson_lines" | "english_lesson_lines";
};

const DEV_USER_EMAIL = process.env.DEV_USER_EMAIL ?? "dev@test.com";
const DEFAULT_POLLINATIONS_MODEL = process.env.DEFAULT_POLLINATIONS_MODEL ?? "klein";
const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const KOKORO_VOICE_POOL = ["af_heart", "af_bella", "af_sarah", "af_sky", "am_adam", "am_michael"] as const;
const GROQ_MAX_COMPLETION_TOKENS = Number.parseInt(process.env.GROQ_MAX_COMPLETION_TOKENS ?? "6500", 10);

class ProviderRateLimitError extends Error {
  retryAfterSeconds: number | null;
  provider: string;

  constructor(provider: string, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ProviderRateLimitError";
    this.provider = provider;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getLessonTables(learningDirection: LearningDirection): LessonTablePair {
  return learningDirection === "en-ja"
    ? { lessons: "english_lessons", lines: "english_lesson_lines" }
    : { lessons: "lessons", lines: "lesson_lines" };
}

async function findLessonById(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  lessonId: string,
  select: string,
): Promise<{ lesson: any | null; tables: LessonTablePair }> {
  for (const learningDirection of ["ja-en", "en-ja"] as const) {
    const tables = getLessonTables(learningDirection);
    const { data, error } = await supabaseAdmin
      .from(tables.lessons)
      .select(select)
      .eq("id", lessonId)
      .maybeSingle();

    if (!error && data) return { lesson: data, tables };
  }

  return { lesson: null, tables: getLessonTables(DEFAULT_LEARNING_DIRECTION) };
}

function imageDimensionFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 512), 2048);
}

const IMAGE_WIDTH = imageDimensionFromEnv("POLLINATIONS_IMAGE_WIDTH", 1536);
const IMAGE_HEIGHT = imageDimensionFromEnv("POLLINATIONS_IMAGE_HEIGHT", 1536);

function getPollinationsApiKey(): string | null {
  const raw =
    process.env.POLLINATIONS_API_KEY ??
    process.env.POLLINATIONS_KEY ??
    process.env.POLLINATIONS_TOKEN ??
    "";
  const trimmed = raw.trim().replace(/^Bearer\s+/i, "");
  return trimmed.length > 0 ? trimmed : null;
}

type ImageProvider = "pollinations" | "gemini";
type ImageOptions = {
  provider: ImageProvider;
  model: string;
};

function isDevUser(user: AuthUser): boolean {
  return user.email?.toLowerCase() === DEV_USER_EMAIL.toLowerCase();
}

function getLessonVisibilityForUser(user: AuthUser): "private" | "dev" {
  return isDevUser(user) ? "dev" : "private";
}

function canAccessLesson(
  user: AuthUser,
  lesson: { user_id?: string | null; visibility?: string | null } | null
): boolean {
  if (!lesson) return false;
  return lesson.visibility === "dev" || lesson.user_id === user.id || isDevUser(user);
}

function sanitizeImageModel(model: unknown): string {
  if (typeof model !== "string") return DEFAULT_POLLINATIONS_MODEL;
  const trimmed = model.trim();
  if (!/^[a-zA-Z0-9._:-]{1,80}$/.test(trimmed)) return DEFAULT_POLLINATIONS_MODEL;
  return trimmed;
}

function getImageOptionsForRequest(
  user: AuthUser,
  body: unknown,
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
): ImageOptions {
  const requestBody = body as { image_provider?: unknown; image_model?: unknown } | null;

  if (learningDirection === "en-ja") {
    return {
      provider: "pollinations",
      model: DEFAULT_POLLINATIONS_MODEL,
    };
  }

  if (isDevUser(user) && requestBody?.image_provider === "gemini") {
    return { provider: "gemini", model: GEMINI_IMAGE_MODEL };
  }

  return {
    provider: "pollinations",
    model: isDevUser(user) ? sanitizeImageModel(requestBody?.image_model) : DEFAULT_POLLINATIONS_MODEL,
  };
}

// ============================================================
// SECTION 2: SYSTEM PROMPT BUILDER
// ============================================================

const BACKGROUND_TAGS = BackgroundTagSchema.options.join(" | ");

function buildSystemPrompt(
  availableVoices: Array<{ id: number; label: string; sublabel: string }> = [],
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
): string {
  const isEnglishTarget = learningDirection === "en-ja";
  const schemaVoiceLine = !isEnglishTarget && availableVoices.length > 0
    ? `\n  "character_voices": {\n    "<character name>": <integer VoiceVox speaker ID>,\n    "<character name>": <integer VoiceVox speaker ID>\n  },`
    : isEnglishTarget
      ? `\n  "character_voices": {\n    "<character name>": "Kokoro voice name",\n    "<character name>": "different Kokoro voice name"\n  },`
    : "";

  const basePrompt = [
    isEnglishTarget
      ? "You are an expert English language teacher for Japanese-speaking learners and an anime screenwriter."
      : "You are an expert Japanese language teacher and anime screenwriter.",
    isEnglishTarget
      ? "Your task is to generate an immersive, cinematic English language lesson in JSON format."
      : "Your task is to generate an immersive, cinematic Japanese language lesson in JSON format.",
    "",
    isEnglishTarget
      ? "The user will provide a scenario and a broad difficulty level. You must generate a complete lesson."
      : "The user will provide a scenario and a JLPT level. You must generate a complete lesson.",
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
    isEnglishTarget
      ? "- Dialogue length must scale with difficulty: beginner 10-12 lines, elementary 12-16 lines, intermediate 16-20 lines, advanced 20-24 lines, expert/native 24-28 lines."
      : "- Dialogue should be 4-12 lines unless the scenario clearly needs more.",
    "- Vocabulary must come from words actually used in the dialogue.",
    isEnglishTarget
      ? "- For English lessons, include 8-14 vocabulary items, with more items at harder levels."
      : "- Aim for 5-8 vocabulary items.",
    isEnglishTarget
      ? "- Grammar points must be appropriate for the specified English difficulty level."
      : "- Grammar points must be appropriate for the specified JLPT level.",
    "- Do NOT include any sound effects, stage directions, or special tags in text fields.",
  ].filter(l => l !== undefined).join("\n");

  if (isEnglishTarget) {
    return [
      "DIRECTION OVERRIDE: Build an English->Japanese lesson.",
      "You are teaching natural English to Japanese-speaking learners.",
      "Keep the legacy JSON field names exactly as written in the schema.",
      "Use dialogue[].english for the TARGET English line learners should hear and study.",
      "Use dialogue[].kanji for the Japanese support translation of that English line.",
      "Use dialogue[].romaji for the romaji reading of dialogue[].kanji.",
      "Use vocabulary[].word for an English target word or phrase from the dialogue.",
      "Use vocabulary[].reading for a simple English pronunciation hint for vocabulary[].word. It must be non-empty.",
      "Use vocabulary[].meaning for the Japanese meaning or explanation.",
      "Use vocabulary[].example_en for the English target example sentence.",
      "Use vocabulary[].example_jp for the Japanese support translation of vocabulary[].example_en. It must be Japanese, not English, and must be the sentence translation, not only the vocabulary meaning.",
      "Use vocabulary[].example_romaji for the romaji reading of vocabulary[].example_jp. It must be non-empty.",
      "Use grammar_points[].pattern for a compact English grammar pattern, phrase frame, tense, modal, or structure. Do not put a whole story line in pattern.",
      "Use grammar_points[].explanation for a concise Japanese explanation only. Do not include romaji in explanation.",
      "Use grammar_points[].example_en for a short English example sentence that demonstrates the grammar point. It may be inspired by the scene, but do not copy an entire dialogue line unless it is genuinely the clearest short example.",
      "Use grammar_points[].example_jp for the Japanese support translation of grammar_points[].example_en. It must be Japanese, not English, and must be the sentence translation, not only the grammar pattern or explanation.",
      "Use grammar_points[].example_romaji for the romaji reading of grammar_points[].example_jp. It must be non-empty.",
      `Use character_voices to assign one distinct Kokoro voice per speaker. Allowed voices: ${KOKORO_VOICE_POOL.join(", ")}.`,
      "Grammar points should be useful for Japanese speakers learning natural English.",
      "Every schema field is required. Do not omit reading, romaji, example_romaji, vocabulary, or grammar fields.",
      "",
      basePrompt,
    ].join("\n");
  }

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

function buildLessonLineRows(lessonId: string, lessonPayload: LessonPayload) {
  return lessonPayload.dialogue.map((line, index) => ({
    lesson_id:   lessonId,
    order_index: index,
    speaker:     line.speaker,
    kanji:       line.kanji,
    romaji:      line.romaji,
    english:     line.english,
    highlights:  [],
    audio_url:   null,
  }));
}

function generateScenarioHash(
  scenario: string,
  level: string,
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
): string {
  const directionConfig = getLanguageDirectionConfig(learningDirection);

  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      scenario: scenario.trim().toLowerCase(),
      level: level.trim().toLowerCase(),
      learning_direction: learningDirection,
      generation_provider: directionConfig.generationProvider,
    }))
    .digest("hex");
}

function sanitizeLLMOutput(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function textFromRecord(
  record: Record<string, unknown>,
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function firstJapaneseText(...values: string[]): string {
  return values.find(value => hasJapaneseText(value)) ?? "";
}

function hasJapaneseText(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function retryAfterSecondsFromMessage(message: string): number | null {
  const match = message.match(/try again in\s+([0-9.]+)s/i);
  if (!match) return null;

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? Math.ceil(parsed) : null;
}

function validateEnglishLessonContent(payload: LessonPayload): void {
  const issues: string[] = [];

  payload.dialogue.forEach((line, index) => {
    if (!hasJapaneseText(line.kanji)) issues.push(`dialogue.${index}.kanji must be Japanese support text`);
  });

  payload.vocabulary.forEach((item, index) => {
    if (!hasJapaneseText(item.meaning)) issues.push(`vocabulary.${index}.meaning must be Japanese`);
    if (!hasJapaneseText(item.example_jp)) issues.push(`vocabulary.${index}.example_jp must be a Japanese sentence translation`);
  });

  payload.grammar_points.forEach((item, index) => {
    if (!hasJapaneseText(item.explanation)) issues.push(`grammar_points.${index}.explanation must be Japanese text, not romaji or English`);
    if (!hasJapaneseText(item.example_jp)) issues.push(`grammar_points.${index}.example_jp must be a Japanese sentence translation`);
    if (wordCount(item.pattern) > 10 || item.pattern.length > 90) {
      issues.push(`grammar_points.${index}.pattern must be a compact grammar point, not a full story line`);
    }
  });

  if (issues.length > 0) {
    throw new Error(`English lesson content validation failed:\n${issues.map(issue => `  - ${issue}`).join("\n")}`);
  }
}

function normalizeEnglishLessonPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;

  const payload = parsed as Record<string, unknown>;
  const dialogue = Array.isArray(payload.dialogue)
    ? payload.dialogue.map(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        const line = item as Record<string, unknown>;
        const english = textFromRecord(line, ["english", "targetText", "target_text", "target", "line", "text"]);
        const japanese = textFromRecord(
          line,
          ["kanji", "supportText", "support_text", "support", "japanese", "translation_ja", "japanese_translation", "translation"],
          english,
        );
        const romaji = textFromRecord(line, ["romaji", "supportReading", "support_reading", "reading"], japanese);

        return {
          ...line,
          english,
          kanji: japanese,
          romaji,
        };
      })
    : payload.dialogue;

  const dialogueTranslations = Array.isArray(dialogue)
    ? dialogue
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
        .map(line => ({
          english: typeof line.english === "string" ? line.english.trim() : "",
          japanese: typeof line.kanji === "string" ? line.kanji.trim() : "",
          romaji: typeof line.romaji === "string" ? line.romaji.trim() : "",
        }))
        .filter(line => line.english && hasJapaneseText(line.japanese))
    : [];

  const findJapaneseExampleFromDialogue = (englishExample: string): string => {
    const normalizedExample = englishExample.trim().toLowerCase();
    if (!normalizedExample) return "";

    const exactMatch = dialogueTranslations.find(line => line.english.toLowerCase() === normalizedExample);
    if (exactMatch) return exactMatch.japanese;

    const partialMatch = dialogueTranslations.find(line => {
      const dialogueEnglish = line.english.toLowerCase();
      return dialogueEnglish.includes(normalizedExample) || normalizedExample.includes(dialogueEnglish);
    });

    return partialMatch?.japanese ?? "";
  };

  const findRomajiExampleFromDialogue = (japaneseExample: string): string => {
    const match = dialogueTranslations.find(line => line.japanese === japaneseExample);
    return match?.romaji ?? "";
  };

  const vocabulary = Array.isArray(payload.vocabulary)
    ? payload.vocabulary.map(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        const vocab = item as Record<string, unknown>;
        const word = textFromRecord(vocab, ["word", "targetText", "target_text", "target", "english"]);
        const meaning = textFromRecord(
          vocab,
          ["meaning", "supportText", "support_text", "support", "japanese", "translation_ja", "japanese_translation", "translation"],
          word,
        );
        const exampleEn = textFromRecord(vocab, ["example_en", "exampleTarget", "example_target", "english_example", "target_example", "example"], word);
        const exampleJp = textFromRecord(
          vocab,
          [
            "example_jp",
            "exampleSupport",
            "example_support",
            "japanese_example",
            "support_example",
            "translation_example",
            "example_translation",
            "exampleTranslation",
            "translation_ja_example",
            "translation_jp",
            "japaneseTranslation",
            "supportTranslation",
          ],
          "",
        );
        const recoveredExampleJp = firstJapaneseText(
          exampleJp,
          findJapaneseExampleFromDialogue(exampleEn),
          meaning,
        );
        const exampleRomaji = textFromRecord(
          vocab,
          ["example_romaji", "exampleSupportReading", "example_support_reading"],
          findRomajiExampleFromDialogue(recoveredExampleJp) || recoveredExampleJp,
        );

        return {
          ...vocab,
          word,
          reading: textFromRecord(vocab, ["reading", "pronunciation", "targetReading", "target_reading"], word),
          meaning,
          example_en: exampleEn,
          example_jp: recoveredExampleJp,
          example_romaji: exampleRomaji,
        };
      })
    : payload.vocabulary;

  const grammarPoints = Array.isArray(payload.grammar_points)
    ? payload.grammar_points.map(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        const grammar = item as Record<string, unknown>;
        const pattern = textFromRecord(grammar, ["pattern", "targetPattern", "target_pattern", "grammar"], "English pattern");
        const explanation = textFromRecord(
          grammar,
          ["explanation", "supportText", "support_text", "japanese_explanation", "meaning"],
          pattern,
        );
        const exampleEn = textFromRecord(grammar, ["example_en", "exampleTarget", "example_target", "english_example", "target_example", "example"], pattern);
        const exampleJp = textFromRecord(
          grammar,
          [
            "example_jp",
            "exampleSupport",
            "example_support",
            "japanese_example",
            "support_example",
            "translation_example",
            "example_translation",
            "exampleTranslation",
            "translation_ja_example",
            "translation_jp",
            "japaneseTranslation",
            "supportTranslation",
          ],
          "",
        );
        const recoveredExampleJp = firstJapaneseText(
          exampleJp,
          findJapaneseExampleFromDialogue(exampleEn),
          explanation,
        );
        const exampleRomaji = textFromRecord(
          grammar,
          ["example_romaji", "exampleSupportReading", "example_support_reading"],
          findRomajiExampleFromDialogue(recoveredExampleJp) || recoveredExampleJp,
        );

        return {
          ...grammar,
          pattern,
          explanation,
          example_en: exampleEn,
          example_jp: recoveredExampleJp,
          example_romaji: exampleRomaji,
        };
      })
    : payload.grammar_points;

  return {
    ...payload,
    dialogue,
    vocabulary,
    grammar_points: grammarPoints,
  };
}

function normalizeLessonPayloadForDirection(
  parsed: unknown,
  learningDirection: LearningDirection,
): unknown {
  return learningDirection === "en-ja"
    ? normalizeEnglishLessonPayload(parsed)
    : parsed;
}

function shuffledKokoroVoices(): string[] {
  const voices = [...KOKORO_VOICE_POOL];
  for (let i = voices.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [voices[i], voices[j]] = [voices[j], voices[i]];
  }
  return voices;
}

function assignDistinctCharacterVoices(
  speakers: string[],
  existingCast: Record<string, string | number> = {},
  learningDirection: LearningDirection,
  availableVoices: Array<{ id: number; label: string; sublabel: string }> = [],
): Record<string, string | number> {
  const isEnglishTarget = learningDirection === "en-ja";
  const voicePool = isEnglishTarget
    ? shuffledKokoroVoices()
    : (availableVoices.length >= speakers.length
        ? availableVoices.map(v => v.id)
        : [3, 1, 8, 14, 2, 10, 11, 13]);
  const cast: Record<string, string | number> = {};
  const used = new Set<string | number>();

  for (const speaker of speakers) {
    const existing = existingCast[speaker];
    const usableExisting = isEnglishTarget
      ? typeof existing === "string" && KOKORO_VOICE_POOL.includes(existing as (typeof KOKORO_VOICE_POOL)[number])
      : typeof existing === "number";

    if (usableExisting && !used.has(existing)) {
      cast[speaker] = existing;
      used.add(existing);
    }
  }

  let poolIndex = 0;
  for (const speaker of speakers) {
    if (cast[speaker] !== undefined) continue;

    while (poolIndex < voicePool.length && used.has(voicePool[poolIndex])) {
      poolIndex++;
    }

    const fallbackVoice = voicePool[poolIndex % voicePool.length];
    cast[speaker] = fallbackVoice;
    used.add(fallbackVoice);
    poolIndex++;
  }

  return cast;
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

async function callGroq(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY in environment variables.");

  const model = process.env.GROQ_TEXT_MODEL ?? "llama-3.3-70b-versatile";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_completion_tokens: Number.isFinite(GROQ_MAX_COMPLETION_TOKENS)
          ? GROQ_MAX_COMPLETION_TOKENS
          : 6500,
        response_format: { type: "json_object" },
      }),
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("Groq API timed out after 25 s. The model may be overloaded — try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader
        ? Number.parseInt(retryAfterHeader, 10)
        : retryAfterSecondsFromMessage(errorBody);
      throw new ProviderRateLimitError("Groq", `Groq API Error 429: ${errorBody}`, retryAfterSeconds);
    }
    throw new Error(`Groq API Error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty or malformed response body.");
  }

  return content;
}

async function callLessonGenerator(
  provider: GenerationProvider,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  return provider === "groq" ? callGroq(messages) : callGemini(messages);
}

async function generateAndValidateLesson(
  scenario: string,
  level: string,
  availableVoices: Array<{ id: number; label: string; sublabel: string }> = [],
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
): Promise<LessonPayload> {
  const generationProvider = getLanguageDirectionConfig(learningDirection).generationProvider;
  const directionLabel = learningDirection === "en-ja"
    ? "English -> Japanese"
    : "Japanese -> English";
  const englishLengthInstruction = learningDirection === "en-ja"
    ? "\nLength requirement: make this English lesson at least twice as substantial as the short baseline. Use the difficulty level to decide the dialogue length: beginner 10-12 lines, elementary 12-16, intermediate 16-20, advanced 20-24, expert/native 24-28. Include Japanese translations for every line, vocabulary example, and grammar example."
    : "";
  const userPrompt = `Generate a ${directionLabel} language lesson for the following:\nScenario: ${scenario}\nLevel: ${level}${englishLengthInstruction}`;

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: buildSystemPrompt(availableVoices, learningDirection) },
    { role: "user", content: userPrompt },
  ];

  let lastError: Error = new Error("Generation failed before first attempt.");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let sanitized = "";

    try {
      const rawOutput  = await callLessonGenerator(generationProvider, messages);
      sanitized  = sanitizeLLMOutput(rawOutput);

      let parsed: unknown;
      try {
        parsed = JSON.parse(sanitized);
      } catch (parseError) {
        throw new Error(`JSON.parse failed: ${(parseError as Error).message}`);
      }

      const normalized = normalizeLessonPayloadForDirection(parsed, learningDirection);
      const validated = LessonPayloadSchema.parse(normalized);
      if (learningDirection === "en-ja") validateEnglishLessonContent(validated);
      return validated;

    } catch (error) {
      lastError = error as Error;
      if (error instanceof ProviderRateLimitError) {
        console.error(`[generate] Provider rate limited by ${error.provider}: ${error.message}`);
        throw error;
      }

      const isZodError = error instanceof ZodError;
      const zodIssues = isZodError ? ((error as ZodError).issues ?? []) : [];
      const errorSummary = isZodError
        ? `Zod validation failed:\n${zodIssues.map((e) => `  - ${e.path.join(".") || "<root>"}: ${e.message}`).join("\n")}`
        : `Error: ${lastError?.message || "Unknown error"}`;

      console.error(`[generate] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed.\n${errorSummary}`);

      if (attempt < MAX_RETRIES) {
        const previousJsonBlock = sanitized
          ? `\n\nPrevious JSON to repair:\n${sanitized.slice(0, 12000)}`
          : "";
        messages.push(
          { role: "assistant", content: sanitized || "I made an error in my previous response." },
          {
            role: "user",
            content: [
              "Your previous response had errors.",
              "Fix ALL issues and respond with ONLY the complete corrected JSON object.",
              "For English lessons, every example_jp must be a non-empty Japanese translation and every example_romaji must be non-empty.",
              "",
              errorSummary,
              previousJsonBlock,
            ].join("\n"),
          }
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
  scenarioDescription: string,
  imageOptions: ImageOptions,
  lessonTable: LessonTablePair["lessons"] = "lessons",
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (imageOptions.provider === "gemini" && !apiKey) {
    console.warn("[bg] GEMINI_API_KEY not set — skipping image generation");
    return null;
  }

  const { data: row } = await supabaseAdmin
    .from(lessonTable)
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

  if (imageOptions.provider === "gemini") {
  for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`,
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

  } else {
    const params = new URLSearchParams({
      model: imageOptions.model,
      width: String(IMAGE_WIDTH),
      height: String(IMAGE_HEIGHT),
      seed: "0",
    });

    const pollinationsKey = getPollinationsApiKey();
    if (!pollinationsKey) {
      console.warn("[bg] POLLINATIONS_API_KEY is not set - skipping Pollinations image generation.");
      return null;
    }

    params.set("key", pollinationsKey);

    const pollinationsUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${params.toString()}`;

    for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(pollinationsUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${pollinationsKey}` },
          signal: AbortSignal.timeout(60_000),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          console.warn(`[bg] Attempt ${attempt}/${IMAGE_MAX_ATTEMPTS}: Pollinations image gen ${res.status}: ${errText}`);
          if (attempt < IMAGE_MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, IMAGE_RETRY_DELAY_MS));
            continue;
          }
          break;
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.startsWith("image/")) {
          const body = await res.text().catch(() => "");
          console.warn(`[bg] Attempt ${attempt}/${IMAGE_MAX_ATTEMPTS}: Pollinations returned ${contentType || "unknown content"}: ${body.slice(0, 200)}`);
          if (attempt < IMAGE_MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, IMAGE_RETRY_DELAY_MS));
            continue;
          }
          break;
        }

        imageBuffer = Buffer.from(await res.arrayBuffer());
        console.log(`[bg] Attempt ${attempt}: Pollinations image OK (${imageOptions.model}) - ${imageBuffer.byteLength} bytes`);
        break;
      } catch (e) {
        console.warn(
          `[bg] Attempt ${attempt}/${IMAGE_MAX_ATTEMPTS}: Pollinations image fetch threw:`,
          e instanceof Error ? e.message : e
        );
        if (attempt < IMAGE_MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, IMAGE_RETRY_DELAY_MS));
        }
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
    .from(lessonTable)
    .update({
      background_image_url: publicUrl,
      image_provider: imageOptions.provider,
      image_model: imageOptions.model,
    })
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
  let learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION;
  let availableVoices: Array<{ id: number; label: string; sublabel: string }> = [];
  let imageOptions: ImageOptions = { provider: "pollinations", model: DEFAULT_POLLINATIONS_MODEL };

  try {
    const body = await request.json();
    scenario = body?.scenario;
    level    = body?.level;
    learningDirection = resolveLearningDirection(body?.learning_direction ?? body?.direction);
    imageOptions = getImageOptionsForRequest(user, body, learningDirection);

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

  const directionConfig = getLanguageDirectionConfig(learningDirection);
  const lessonTables = getLessonTables(learningDirection);
  const scenarioHash = generateScenarioHash(scenario, level, learningDirection);
  const lessonVisibility = getLessonVisibilityForUser(user);

  // Deduplication / recovery cache check.
  // Reuse failed-but-saved lessons instead of paying for text/image again.
  const { data: existingLesson, error: lookupError } = await supabase
    .from(lessonTables.lessons)
    .select("id, status, structured_content, learning_direction")
    .eq("scenario_hash", scenarioHash)
    .or(`user_id.eq.${user.id},visibility.eq.dev`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Database error during deduplication check." }, { status: 500 });
  }

  if (existingLesson) {
    const existingLessonId = existingLesson.id as string;
    const parsedExistingPayload = LessonPayloadSchema.safeParse(existingLesson.structured_content);

    const { count: lineCount, error: lineCountError } = await supabaseAdmin
      .from(lessonTables.lines)
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", existingLessonId);

    let linesExist = !lineCountError && typeof lineCount === "number" && lineCount > 0;

    if (!linesExist && parsedExistingPayload.success) {
      console.warn(`[generate] Recovering lesson ${existingLessonId}: rebuilding missing lesson_lines from structured_content.`);
      const { error: recoverLinesError } = await supabaseAdmin
        .from(lessonTables.lines)
        .insert(buildLessonLineRows(existingLessonId, parsedExistingPayload.data));
      linesExist = !recoverLinesError;
      if (recoverLinesError) {
        console.warn(`[generate] Failed to rebuild lines for ${existingLessonId}: ${recoverLinesError.message}`);
      }
    }

    if (linesExist) {
      if (existingLesson.status === "ready") {
        return NextResponse.json(
          { lesson_id: existingLessonId, cached: true, status: existingLesson.status },
          { status: 200 }
        );
      }

      if (existingLesson.status === "queued" || existingLesson.status === "generating_audio") {
        return NextResponse.json(
          { lesson_id: existingLessonId, cached: true, recovered: false, status: existingLesson.status },
          { status: 202 }
        );
      }

      const { error: requeueError } = await supabaseAdmin
        .from(lessonTables.lessons)
        .update({ status: "generating_audio", error_message: null })
        .eq("id", existingLessonId);

      if (requeueError) {
        return NextResponse.json({ error: "Existing lesson found, but audio recovery failed to queue." }, { status: 500 });
      }

      console.warn(`[generate] Requeued existing failed lesson ${existingLessonId} instead of regenerating.`);
      return NextResponse.json(
        { lesson_id: existingLessonId, cached: true, recovered: true, status: "generating_audio" },
        { status: 202 }
      );
    }

    console.warn(`[generate] Lesson ${existingLessonId} is stale (no recoverable lines). Invalidating.`);
    await supabaseAdmin.from(lessonTables.lessons).delete().eq("id", existingLessonId);
  }

  // ── Insert new lesson row ──────────────────────────────────
  const { data: newLesson, error: insertError } = await supabaseAdmin
    .from(lessonTables.lessons)
    .insert({
      scenario:      scenario.trim(),
      scenario_hash: scenarioHash,
      level:         level.trim(),
      status:        "queued",
      voice_id:      null,
      user_id:       user.id,
      visibility:    lessonVisibility,
      learning_direction: learningDirection,
      target_language: directionConfig.targetLanguage,
      support_language: directionConfig.supportLanguage,
      generation_provider: directionConfig.generationProvider,
      tts_provider: directionConfig.ttsProvider,
      image_provider: imageOptions.provider,
      image_model:    imageOptions.model,
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
    lessonPayload = await generateAndValidateLesson(scenario, level, availableVoices, learningDirection);
    const languagePayload = lessonPayload as LessonPayloadWithLanguage;
    languagePayload.learning_direction = learningDirection;
    languagePayload.target_language = directionConfig.targetLanguage;
    languagePayload.support_language = directionConfig.supportLanguage;
    languagePayload.generation_provider = directionConfig.generationProvider;
    languagePayload.tts_provider = directionConfig.ttsProvider;
  } catch (generationError) {
    const errorMessage = generationError instanceof Error ? generationError.message : "Unknown error";
    await supabaseAdmin.from(lessonTables.lessons).update({ status: "failed", error_message: errorMessage.substring(0, 500) }).eq("id", lessonId);
    if (generationError instanceof ProviderRateLimitError) {
      return NextResponse.json(
        {
          error: "AI generation is temporarily rate limited. Please retry shortly.",
          lesson_id: lessonId,
          retry_after_seconds: generationError.retryAfterSeconds,
        },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "AI generation failed.", lesson_id: lessonId }, { status: 500 });
  }

  // ── Ensure distinct speaker voices (server-side safety net) ──
  const uniqueSpeakers = [...new Set(lessonPayload.dialogue.map(l => l.speaker))];
  const existingCast = lessonPayload.character_voices ?? {};
  const isEnglishTarget = learningDirection === "en-ja";
  const validCastValues = uniqueSpeakers
    .map(speaker => existingCast[speaker])
    .filter(value => isEnglishTarget
      ? typeof value === "string" && KOKORO_VOICE_POOL.includes(value as (typeof KOKORO_VOICE_POOL)[number])
      : typeof value === "number");
  const allPresent = validCastValues.length === uniqueSpeakers.length;
  const allDistinct = new Set(validCastValues).size === validCastValues.length;

  if (!allPresent || !allDistinct || validCastValues.length === 0) {
    const fallbackCast = assignDistinctCharacterVoices(
      uniqueSpeakers,
      existingCast,
      learningDirection,
      availableVoices,
    );

    console.warn(
      `[generate] character_voices was ${!allPresent ? "incomplete" : "had duplicates"} — applying ${isEnglishTarget ? "Kokoro" : "VoiceVox"} cast:`,
      fallbackCast
    );
    lessonPayload.character_voices = fallbackCast;
  }

  // ── Insert lesson_lines ───────────────────────────────────
  const lineRows = buildLessonLineRows(lessonId, lessonPayload);

  const { error: linesInsertError } = await supabaseAdmin.from(lessonTables.lines).insert(lineRows);
  if (linesInsertError) {
    await supabaseAdmin.from(lessonTables.lessons).update({ status: "failed", error_message: "Failed to save lines." }).eq("id", lessonId);
    return NextResponse.json({ error: "Failed to save lesson content.", lesson_id: lessonId }, { status: 500 });
  }

  // ── Update status to "generating_audio" — triggers the worker ──
  const { error: finalizeError } = await supabaseAdmin
    .from(lessonTables.lessons)
    .update({
      status:             "generating_audio",
      background_tag:     lessonPayload.background_tag,
      structured_content: lessonPayload,
      learning_direction: learningDirection,
      target_language: directionConfig.targetLanguage,
      support_language: directionConfig.supportLanguage,
      generation_provider: directionConfig.generationProvider,
      tts_provider: directionConfig.ttsProvider,
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
      scenario,
      imageOptions,
      lessonTables.lessons,
    ).catch(e => console.warn("[bg] Post-response background gen failed:", e instanceof Error ? e.message : e));
  });

  return NextResponse.json(
    {
      lesson_id:      lessonId,
      cached:         false,
      status:         "generating_audio",
      learning_direction: learningDirection,
      target_language: directionConfig.targetLanguage,
      support_language: directionConfig.supportLanguage,
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

  const { lesson, tables } = await findLessonById(
    supabaseAdmin,
    lessonId,
    "user_id, visibility, background_tag, scenario, background_image_url, image_provider, image_model",
  );

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  if (!canAccessLesson(user, lesson)) {
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
      await supabaseAdmin.from(tables.lessons).update({ background_image_url: null }).eq("id", lessonId);
    } catch {
      console.log(`[bg] HEAD check timed out for lesson ${lessonId} — regenerating`);
    }
  }

  const imageUrl = await generateAndSaveBackground(
    supabaseAdmin,
    lessonId,
    lesson.background_tag as string,
    lesson.scenario as string,
    {
      provider: lesson.image_provider === "gemini" && isDevUser(user) ? "gemini" : "pollinations",
      model: lesson.image_provider === "gemini" && isDevUser(user)
        ? GEMINI_IMAGE_MODEL
        : sanitizeImageModel(lesson.image_model),
    },
    tables.lessons,
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

  const { lesson, tables } = await findLessonById(
    supabaseAdmin,
    lessonId,
    "user_id, visibility, background_tag",
  );

  if (!canAccessLesson(user, lesson)) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  if (lesson?.user_id !== user.id) {
    return NextResponse.json({ error: "Lessons cannot be deleted by other users." }, { status: 403 });
  }

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
  await supabaseAdmin.from(tables.lines).delete().eq("lesson_id", lessonId);
  const { error: lessonDeleteError } = await supabaseAdmin.from(tables.lessons).delete().eq("id", lessonId);

  if (lessonDeleteError) {
    return NextResponse.json({ error: "Failed to delete lesson." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
