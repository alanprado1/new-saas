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
export type { LessonLine, StructuredContent };

const DEV_USER_EMAIL = process.env.NEXT_PUBLIC_DEV_USER_EMAIL ?? "dev@test.com";

export function isDevEmail(email?: string | null): boolean {
  return email?.toLowerCase() === DEV_USER_EMAIL.toLowerCase();
}

// ── Full lesson payload (populated, ready to pass to ScenePlayer) ─
export interface ActiveLesson {
  id: string;
  user_id: string | null;
  visibility: string;
  structured_content: StructuredContent;
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
  background_image_url: string | null;
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

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("user_id, visibility, structured_content, background_image_url")
    .eq("id", lessonId)
    .single();

  if (lessonError) throw new Error(`Failed to fetch lesson: ${lessonError.message}`);
  if (!lesson?.structured_content) throw new Error("Lesson has no structured content.");
  if (lesson.visibility !== "dev" && lesson.user_id !== user.id && !isDevEmail(user.email)) {
    throw new Error("Lesson not found or access denied.");
  }

  const { data: lines, error: linesError } = await supabase
    .from("lesson_lines")
    .select("id, order_index, speaker, kanji, romaji, english, audio_url, highlights")
    .eq("lesson_id", lessonId)
    .order("order_index", { ascending: true });

  if (linesError) throw new Error(`Failed to fetch lines: ${linesError.message}`);
  if (!lines || lines.length === 0) throw new Error("Lesson has no dialogue lines.");

  return {
    id: lessonId,
    user_id: (lesson.user_id as string | null) ?? null,
    visibility: (lesson.visibility as string | null) ?? "private",
    structured_content: lesson.structured_content as StructuredContent,
    background_image_url: (lesson.background_image_url as string | null) ?? null,
    lesson_lines: lines as LessonLine[],
  };
}

/**
 * fetchLibrary
 * ─────────────────────────────────────────────────────────────
 * Fetches all ready lessons for the dashboard grid, newest first.
 */
export async function fetchLibrary(options: { includeAll?: boolean } = {}): Promise<LibraryLesson[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("lessons")
    .select("id, created_at, user_id, visibility, level, structured_content, background_image_url")
    .eq("status", "ready");

  if (!options.includeAll || !isDevEmail(user.email)) {
    query = query.or(`user_id.eq.${user.id},visibility.eq.dev`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch library: ${error.message}`);
  return (data ?? []) as LibraryLesson[];
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
