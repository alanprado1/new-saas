/**
 * lib/lesson.ts
 * ─────────────────────────────────────────────────────────────
 * Canonical types for lessons + the shared fetchLessonData helper
 * used by both the Dashboard (generate flow) and the /lesson/[id] page.
 *
 * Re-exports the ScenePlayer prop types so the lesson page doesn't
 * need to import from the component directly.
 */

import { supabase } from "@/lib/supabase";
import type { LessonLine, StructuredContent } from "@/components/ScenePlayer";
import { resolveLearningDirection, type LearningDirection } from "@/lib/language";
export type { LessonLine, StructuredContent };

const DEV_USER_EMAIL = process.env.NEXT_PUBLIC_DEV_USER_EMAIL ?? "dev@test.com";
type LessonTables = {
  learningDirection: LearningDirection;
  lessons: "lessons" | "english_lessons";
  lines: "lesson_lines" | "english_lesson_lines";
};

const LESSON_TABLES: LessonTables[] = [
  { learningDirection: "ja-en", lessons: "lessons", lines: "lesson_lines" },
  { learningDirection: "en-ja", lessons: "english_lessons", lines: "english_lesson_lines" },
];

export function isDevEmail(email?: string | null): boolean {
  return email?.toLowerCase() === DEV_USER_EMAIL.toLowerCase();
}

// ── Full lesson payload (populated, ready to pass to ScenePlayer) ─
export interface ActiveLesson {
  id: string;
  voice_id: number | null;
  user_id: string | null;
  visibility: string;
  structured_content: StructuredContent;
  learning_direction: LearningDirection;
  background_image_url: string | null;
  lesson_lines: LessonLine[];
}

// ── Library card entry (lightweight, fetched for the dashboard grid) ─
export interface LibraryLesson {
  id: string;
  created_at: string;
  user_id: string | null;
  visibility: string;
  level: string;
  structured_content: StructuredContent;
  learning_direction: LearningDirection;
  background_image_url: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEnvelope<T> = {
  savedAt: number;
  value: T;
};

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CacheEnvelope<T>;
    if (!cached?.savedAt || Date.now() - cached.savedAt > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return cached.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Storage can be unavailable in private browsing; the app still works.
  }
}

export function getCachedLessonData(lessonId: string): ActiveLesson | null {
  return readCache<ActiveLesson>(`lesson:${lessonId}`);
}

export function cacheLessonData(lesson: ActiveLesson): void {
  writeCache(`lesson:${lesson.id}`, lesson);
}

export function getCachedLibrary(): LibraryLesson[] | null {
  return readCache<LibraryLesson[]>("dashboard:library");
}

export function cacheLibrary(library: LibraryLesson[]): void {
  writeCache("dashboard:library", library);
}

/**
 * fetchLessonData
 * ─────────────────────────────────────────────────────────────
 * Fetches lesson metadata, verifies access, then loads dialogue lines.
 * Throws on any DB error or missing data so the caller can catch + render an error state.
 */
export async function fetchLessonData(lessonId: string): Promise<ActiveLesson> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to view lessons.");

  let lesson: Record<string, unknown> | null = null;
  let activeTables: LessonTables | null = null;

  for (const tables of LESSON_TABLES) {
    const { data, error } = await supabase
      .from(tables.lessons)
      .select("user_id, visibility, voice_id, structured_content, learning_direction, background_image_url")
      .eq("id", lessonId)
      .maybeSingle();

    if (!error && data) {
      lesson = data;
      activeTables = tables;
      break;
    }
  }

  if (!lesson?.structured_content) throw new Error("Lesson has no structured content.");
  if (lesson.visibility !== "dev" && lesson.user_id !== user.id && !isDevEmail(user.email)) {
    throw new Error("Lesson not found or access denied.");
  }

  const { data: lines, error: linesError } = await supabase
    .from(activeTables?.lines ?? "lesson_lines")
    .select("id, order_index, speaker, kanji, romaji, english, audio_url, highlights")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true });

  if (linesError) throw new Error(`Failed to fetch lines: ${linesError.message}`);
  if (!lines || lines.length === 0) throw new Error("Lesson has no dialogue lines.");

  const activeLesson = {
    id: lessonId,
    voice_id: (lesson.voice_id as number | null) ?? null,
    user_id: (lesson.user_id as string | null) ?? null,
    visibility: (lesson.visibility as string | null) ?? "private",
    structured_content: lesson.structured_content as StructuredContent,
    learning_direction: activeTables?.learningDirection ?? resolveLearningDirection(lesson.learning_direction as string | null),
    background_image_url: (lesson.background_image_url as string | null) ?? null,
    lesson_lines: lines as LessonLine[],
  };

  cacheLessonData(activeLesson);
  return activeLesson;
}

/**
 * fetchLibrary
 * ─────────────────────────────────────────────────────────────
 * Fetches all ready lessons for the dashboard grid, newest first.
 */
export async function fetchLibrary(options: { includeAll?: boolean } = {}): Promise<LibraryLesson[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const rows: LibraryLesson[] = [];

  for (const tables of LESSON_TABLES) {
    let query = supabase
      .from(tables.lessons)
      .select("id, created_at, user_id, visibility, level, structured_content, learning_direction, background_image_url")
      .eq("status", "ready");

    if (!options.includeAll || !isDevEmail(user.email)) {
      query = query.or(`user_id.eq.${user.id},visibility.eq.dev`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to fetch ${tables.lessons}: ${error.message}`);

    rows.push(...((data ?? []).map((lesson) => ({
      ...lesson,
      learning_direction: resolveLearningDirection((lesson as { learning_direction?: string | null }).learning_direction ?? tables.learningDirection),
    })) as LibraryLesson[]));
  }

  const library = rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  cacheLibrary(library);
  return library;
}

/**
 * deleteLesson
 * ─────────────────────────────────────────────────────────────
 * Calls DELETE /api/generate?lesson_id=... which handles storage cleanup
 * server-side using the service role key.
 */
export async function deleteLesson(lessonId: string, accessToken: string): Promise<void> {
  const res = await fetch(`/api/generate?lesson_id=${lessonId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(await res.text());
}
