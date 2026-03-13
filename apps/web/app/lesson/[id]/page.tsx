"use client";

/**
 * app/lesson/[id]/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Dedicated route for reading a single lesson / story.
 * Fetches lesson data from Supabase on mount, renders ScenePlayer.
 * Navigates back to the dashboard via router.push('/').
 *
 * Audio cleanup is handled inside ScenePlayer's useEffect return,
 * which unloads all Howl instances when the component unmounts
 * (i.e. when navigating away). No lingering audio ghost possible.
 *
 * Mobile enhancements:
 * - Library button fully unmounted from DOM on mobile via isMobile state
 * - Swipe-right-to-go-back via document-level touch listeners
 * - Global overscroll-x lock via body/html CSS to stop browser hijack
 */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import ScenePlayer from "@/components/ScenePlayer";
import { ensureSession } from "@/lib/supabase";
import { fetchLessonData, type ActiveLesson } from "@/lib/lesson";
import { useTheme } from "@/hooks/useTheme";

// ── Loading skeleton ────────────────────────────────────────
function LessonSkeleton({ accent }: { accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", animation: "fadeSlideUp 0.4s ease both" }}>
      {/* 16:9 video skeleton */}
      <div style={{
        width: "100%", aspectRatio: "16/9", borderRadius: "20px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        animation: "pulse-slow 1.8s ease-in-out infinite",
      }} />
      {/* Content skeleton rows */}
      {[70, 85, 60].map((w, i) => (
        <div key={i} style={{
          height: "14px", borderRadius: "8px", width: `${w}%`,
          background: "rgba(255,255,255,0.04)",
          animation: `pulse-slow 1.8s ease-in-out ${i * 0.1}s infinite`,
        }} />
      ))}
      {/* Dots */}
      <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: "7px", height: "7px", borderRadius: "50%",
            background: accent,
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
      <span style={{ fontSize: "2.5rem", opacity: 0.4 }}>⛩</span>
      <p style={{ color: "#f87171", fontSize: "0.9rem", margin: 0 }}>{message}</p>
      <button
        onClick={onBack}
        style={{
          padding: "8px 20px", borderRadius: "10px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "#8a9ab8", fontSize: "0.82rem", cursor: "pointer",
        }}
      >
        ← Back to Library
      </button>
    </div>
  );
}

// ── Page component ──────────────────────────────────────────
export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { theme } = useTheme();

  const [lesson, setLesson]   = useState<ActiveLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // ── Fix 1: React-state mobile detection ────────────────
  // Button is physically removed from the DOM on mobile — no CSS tricks.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); // run immediately on mount
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Data fetching ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await ensureSession();
        const data = await fetchLessonData(id);
        if (!cancelled) {
          setLesson(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load lesson.");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  const handleBack = () => router.push("/");

  // ── Fix 2: Document-level swipe-to-go-back ─────────────
  // Attached to document so it works across the full viewport,
  // including over any child component (e.g. ScenePlayer).
  useEffect(() => {
    let startX = 0;
    let startY = 0;

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }

    function onTouchEnd(e: TouchEvent) {
      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = e.changedTouches[0].clientY - startY;

      // Deliberate rightward horizontal swipe: >75px and 1.5× more horizontal than vertical
      if (deltaX > 75 && deltaX > Math.abs(deltaY) * 1.5) {
        router.push("/");
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend",   onTouchEnd,   { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend",   onTouchEnd);
    };
  }, [router]);

  return (
    <main
      className="min-h-screen w-full flex flex-col"
      style={{
        background: "#07070f",
        backgroundImage: theme.gradient,
        fontFamily: "'Noto Sans JP', sans-serif",
        overflowX: "hidden",
      }}
    >
      {/* ── Grain overlay ──────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 opacity-25"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          backgroundSize: "128px",
          mixBlendMode: "overlay",
          zIndex: 0,
        }}
      />

      {/* ── Content ────────────────────────────────────────── */}
      <div
        className="w-[98%] md:w-full md:max-w-[896px] mx-auto"
        style={{
          position: "relative",
          zIndex: 10,
          flex: 1,
          padding: "0.5rem 0 1rem",
        }}
      >
        {/* ← Back button — only rendered in the DOM on non-mobile.
            isMobile is false on desktop so the button mounts normally.    */}
        {!isMobile && (
          <div
            style={{
              position: "sticky",
              top: "12px",
              zIndex: 50,
              display: "flex",
              justifyContent: "flex-start",
              pointerEvents: "none",
              marginBottom: "-2.2rem",
            }}
          >
            <button
              onClick={handleBack}
              style={{
                pointerEvents: "auto",
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "6px 14px", borderRadius: "8px",
                background: "rgba(10,10,22,0.75)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#8a9ab8", fontSize: "0.82rem", cursor: "pointer",
                transform: "translateX(-150px)",
                transition: "all 0.18s ease",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = "#c0cad8";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.22)";
                (e.currentTarget as HTMLElement).style.background = "rgba(10,10,22,0.92)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = "#8a9ab8";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
                (e.currentTarget as HTMLElement).style.background = "rgba(10,10,22,0.75)";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8 2L3 7l5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Library
            </button>
          </div>
        )}

        {/* ── States ─────────────────────────────────────── */}
        {loading && <LessonSkeleton accent={theme.accent} />}

        {!loading && error && (
          <LessonError message={error} onBack={handleBack} />
        )}

        {!loading && lesson && (
          <div style={{ animation: "fadeSlideUp 0.4s cubic-bezier(0.22,1,0.36,1) both" }}>
            <ScenePlayer
              lesson_id={lesson.id}
              structured_content={lesson.structured_content}
              background_image_url={lesson.background_image_url}
              lesson_lines={lesson.lesson_lines}
              theme={theme}
            />
          </div>
        )}
      </div>

      {/* ── Global styles ───────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600&family=Noto+Serif+JP:wght@400;600;700&display=swap');

        /* Stop the browser from hijacking horizontal swipe gestures globally */
        body, html { overscroll-behavior-x: none !important; }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        * { box-sizing: border-box; }
      `}</style>
    </main>
  );
}
