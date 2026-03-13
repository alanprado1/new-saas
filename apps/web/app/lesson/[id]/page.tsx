"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import ScenePlayer from "@/components/ScenePlayer";
import { ensureSession } from "@/lib/supabase";
import { fetchLessonData, type ActiveLesson } from "@/lib/lesson";
import { useTheme } from "@/hooks/useTheme";

// ── Loading skeleton ────────────────────────────────────────
function LessonSkeleton({ accent }: { accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", animation: "fadeSlideUp 0.4s ease both" }}>
      <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: "20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", animation: "pulse-slow 1.8s ease-in-out infinite" }} />
      {[70, 85, 60].map((w, i) => (
        <div key={i} style={{ height: "14px", borderRadius: "8px", width: `${w}%`, background: "rgba(255,255,255,0.04)", animation: `pulse-slow 1.8s ease-in-out ${i * 0.1}s infinite` }} />
      ))}
      <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: accent, animation: `pulse-slow 1s ease-in-out ${i * 0.14}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ── Error state ─────────────────────────────────────────────
function LessonError({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "4rem 2rem", textAlign: "center" }}>
      <span style={{ fontSize: "2.5rem", opacity: 0.4 }}>⛩</span>
      <p style={{ color: "#f87171", fontSize: "0.9rem", margin: 0 }}>{message}</p>
      <button onClick={onBack} style={{ padding: "8px 20px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#8a9ab8", fontSize: "0.82rem", cursor: "pointer" }}>
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

  const [lesson, setLesson]     = useState<ActiveLesson | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // 1. STATE FOR THE BUTTON
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // 2. REF FOR THE SWIPE
  const mainRef = useRef<HTMLElement>(null);

  // Load Lesson Data
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

  // ── HYDRATION-SAFE MOBILE CHECK (Kills the Button) ──
  useEffect(() => {
    setIsMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // Check immediately
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ── NON-PASSIVE SWIPE INTERCEPTOR (Kills the Browser Native Swipe) ──
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      // Leave the far left edge alone (for native OS back gestures if they have it)
      if (e.touches[0].clientX < 30) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!startX) return;
      const diffX = e.touches[0].clientX - startX;
      const diffY = Math.abs(e.touches[0].clientY - startY);

      // CRITICAL: If they are swiping horizontally, block the browser from changing tabs!
      if (Math.abs(diffX) > diffY) {
        e.preventDefault(); 
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!startX) return;
      
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      
      const deltaX = endX - startX;
      const deltaY = Math.abs(endY - startY);

      // If swiped right by at least 75px, and mostly horizontal
      if (deltaX > 75 && deltaX > deltaY * 1.5) {
        handleBack();
      }
      
      startX = 0;
      startY = 0;
    };

    // { passive: false } allows us to actually use e.preventDefault()
    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [router]);

  return (
    <main
      ref={mainRef}
      className="min-h-screen w-full flex flex-col"
      style={{
        background: "#07070f",
        backgroundImage: theme.gradient,
        fontFamily: "'Noto Sans JP', sans-serif",
        overflowX: "hidden",
      }}
    >
      <div className="pointer-events-none fixed inset-0 opacity-25" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "128px", mixBlendMode: "overlay", zIndex: 0 }} />

      <div className="w-[98%] md:w-full md:max-w-[896px] mx-auto" style={{ position: "relative", zIndex: 10, flex: 1, padding: "0.5rem 0 1rem" }}>
        
        {/* ← THE BUTTON IS NOW PHYSICALLY UNMOUNTED ON MOBILE */}
        {isMounted && !isMobile && (
          <div style={{ position: "sticky", top: "12px", zIndex: 50, pointerEvents: "none", marginBottom: "-2.2rem", display: "flex", justifyContent: "flex-start" }}>
            <button
              onClick={handleBack}
              style={{
                pointerEvents: "auto", display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "6px 14px", borderRadius: "8px", background: "rgba(10,10,22,0.75)",
                backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)",
                color: "#8a9ab8", fontSize: "0.82rem", cursor: "pointer", transition: "all 0.18s ease",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8 2L3 7l5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Library
            </button>
          </div>
        )}

        {loading && <LessonSkeleton accent={theme.accent} />}
        {!loading && error && <LessonError message={error} onBack={handleBack} />}
        {!loading && lesson && (
          <div style={{ animation: "fadeSlideUp 0.4s cubic-bezier(0.22,1,0.36,1) both" }}>
            <ScenePlayer lesson_id={lesson.id} structured_content={lesson.structured_content} background_image_url={lesson.background_image_url} lesson_lines={lesson.lesson_lines} theme={theme} />
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600&family=Noto+Serif+JP:wght@400;600;700&display=swap');
        
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        * { box-sizing: border-box; }
      `}</style>
    </main>
  );
}