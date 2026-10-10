"use client";

/**
 * app/lesson/[id]/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Dedicated route for reading a single lesson / story.
 * Fetches lesson data from Supabase on mount, renders ScenePlayer.
 * Navigates back to the Library via router.push('/library').
 *
 * Audio cleanup is handled inside ScenePlayer's useEffect return,
 * which unloads all Howl instances when the component unmounts
 * (i.e. when navigating away). No lingering audio ghost possible.
 */

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import ScenePlayer from "@/components/ScenePlayer";
import { ensureSession } from "@/lib/supabase";
import { fetchLessonData, getCachedLessonData, type ActiveLesson } from "@/lib/lesson";

// ── Back button (loading / error states; the player has its own in its header) ──
function BackToLibrary({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        height: "36px", padding: "0 14px", borderRadius: "10px", cursor: "pointer",
        background: "transparent", border: "1px solid var(--ln)",
        color: "var(--mut)", fontSize: "0.82rem", fontWeight: 600,
        fontFamily: "var(--f-ui, system-ui, sans-serif)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      Library
    </button>
  );
}

// ── Loading skeleton ────────────────────────────────────────
function LessonSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "24px 28px", animation: "lessonFade 0.4s ease both" }}>
      <div><BackToLibrary onBack={onBack} /></div>
      {/* 16:9 stage skeleton */}
      <div style={{
        width: "100%", maxWidth: "960px", aspectRatio: "16/9", borderRadius: "18px",
        background: "var(--s1)",
        border: "1px solid var(--ln)",
        animation: "pulse-slow 1.8s ease-in-out infinite",
      }} />
      {/* Content skeleton rows */}
      {[70, 85, 60].map((w, i) => (
        <div key={i} style={{
          height: "14px", borderRadius: "8px", width: `${w}%`, maxWidth: "960px",
          background: "var(--s1)",
          animation: `pulse-slow 1.8s ease-in-out ${i * 0.1}s infinite`,
        }} />
      ))}
      {/* Dots */}
      <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: "7px", height: "7px", borderRadius: "50%",
            background: "var(--acc)",
            animation: `pulse-slow 1s ease-in-out ${i * 0.14}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Error state ─────────────────────────────────────────────
function LessonError({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: "16px", padding: "4rem 2rem",
      textAlign: "center",
    }}>
      <p style={{ color: "var(--bad)", fontSize: "0.9rem", margin: 0 }}>{message}</p>
      <BackToLibrary onBack={onBack} />
    </div>
  );
}

// ── Page component ──────────────────────────────────────────
export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const cachedLesson = getCachedLessonData(id);
  const [lesson, setLesson]     = useState<ActiveLesson | null>(cachedLesson);
  const [loading, setLoading]   = useState(!cachedLesson);
  const [error, setError]       = useState<string | null>(null);
  const hasRenderableLessonRef = useRef(Boolean(cachedLesson));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await ensureSession();
        const data = await fetchLessonData(id);
        if (!cancelled) {
          setLesson(data);
          hasRenderableLessonRef.current = true;
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          if (!hasRenderableLessonRef.current) setError(err instanceof Error ? err.message : "Failed to load lesson.");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  const handleBack = () => router.push("/library");

  return (
    <AppShell active="library" collapsed>
      <main
        className="w-full"
        style={{
          background: "var(--g)",
          color: "var(--ink)",
          fontFamily: "var(--f-ui, system-ui, sans-serif)",
          overflowX: "clip", // clip (not hidden): hidden would stop the sticky tab header working
        }}
      >
        {/* ── States ─────────────────────────────────────── */}
        {loading && <LessonSkeleton onBack={handleBack} />}

        {!loading && error && (
          <LessonError message={error} onBack={handleBack} />
        )}

        {/* No entrance transform/animation wrapper here: an ancestor transform would trap
            the iOS CSS-fullscreen simulation (position: fixed) and a stacking context would
            put it under the shell's tab bar. */}
        {!loading && lesson && (
          <ScenePlayer
            lesson_id={lesson.id}
            voice_id={lesson.voice_id}
            structured_content={lesson.structured_content}
            background_image_url={lesson.background_image_url}
            lesson_lines={lesson.lesson_lines}
            learningDirection={lesson.learning_direction}
            onBack={handleBack}
          />
        )}

        {/* ── Global styles ───────────────────────────────── */}
        <style>{`
          @keyframes lessonFade {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes pulse-slow {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          @media (prefers-reduced-motion: reduce) {
            main * { animation: none !important; }
          }
        `}</style>
      </main>
    </AppShell>
  );
}
