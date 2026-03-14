"use client";

/**
 * app/page.tsx  ─  Dashboard / Library grid
 * ─────────────────────────────────────────────────────────────
 * Renders ONLY the lesson library grid and the generate modal.
 * Lesson reading → /lesson/[id]     (ScenePlayer unmounts cleanly)
 * Voice chat     → /voicechat       (AvatarChat unmounts cleanly)
 *
 * Moving to separate routes eliminates the audio-echo bug that occurred
 * when ScenePlayer and AvatarChat were conditionally rendered in a single
 * component tree — both mounted Howl/AudioContext instances that persisted
 * while other views were visible.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, ensureSession } from "@/lib/supabase";
import { useTheme } from "@/hooks/useTheme";
import {
  THEMES,
  TAG_GRADIENTS,
  TAG_EMOJI,
  LEVELS,
  EXAMPLE_SCENARIOS,
  type Level,
  type LevelFilter,
} from "@/lib/themes";
import { fetchLibrary, type LibraryLesson } from "@/lib/lesson";
import type { VoiceEntry } from "@/components/ScenePlayer";

// ============================================================
// TYPES
// ============================================================

type GenerationState =
  | "idle"
  | "calling_api"
  | "waiting_for_audio"
  | "ready"
  | "error";

// ============================================================
// HELPERS
// ============================================================

async function fetchLessonDataForNav(lessonId: string) {
  // Simple wrapper — actual data loading happens on the lesson page
  return lessonId;
}

// ============================================================
// PAGE
// ============================================================

export default function DashboardPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // ── Generation form ─────────────────────────────────────
  const [scenario, setScenario]               = useState("");
  const [level, setLevel]                     = useState<Level>("Beginner");
  const [generationState, setGenerationState] = useState<GenerationState>("idle");
  const [errorMessage, setErrorMessage]       = useState("");
  const [pendingLessonId, setPendingLessonId] = useState<string | null>(null);

  // ── Library ─────────────────────────────────────────────
  const [library, setLibrary]               = useState<LibraryLesson[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [levelFilter, setLevelFilter]       = useState<LevelFilter>("All");

  // ── UI ───────────────────────────────────────────────────
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen]         = useState(false);
  const [cardLoadingId, setCardLoadingId]             = useState<string | null>(null);
  const [availableVoices, setAvailableVoices]         = useState<VoiceEntry[]>([]);

  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // ── Bootstrap auth + data ─────────────────────────────
  const refreshLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const data = await fetchLibrary();
      setLibrary(data);
    } catch { /* silent */ }
    setLibraryLoading(false);
  }, []);

  useEffect(() => {
    async function bootstrap() {
      try {
        // Race ensureSession against a 4 s timeout so a slow/failed
        // network call on mobile never leaves the skeleton spinning forever.
        await Promise.race([
          ensureSession(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("session timeout")), 4000)
          ),
        ]);
      } catch (error) {
        // Non-fatal — anonymous / public content still loads fine.
        console.warn("[bootstrap] ensureSession skipped:", error instanceof Error ? error.message : error);
      } finally {
        // ALWAYS run refreshLibrary so the skeleton clears,
        // even if ensureSession timed out or threw.
        await refreshLibrary();
      }
    }
    bootstrap();
  }, [refreshLibrary]);

  // ── Fetch voices ────────────────────────────────────────
  useEffect(() => {
    fetch("/api/voices")
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data: VoiceEntry[]) => { if (Array.isArray(data)) setAvailableVoices(data); })
      .catch(() => {});
  }, []);

  // ── Theme menu outside-click close ──────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node))
        setIsThemeMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Realtime cleanup ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // ── Realtime + polling for lesson-ready ─────────────────
  useEffect(() => {
    if (!pendingLessonId || generationState !== "waiting_for_audio") return;

    let settled = false;

    const settle = async (id: string) => {
      if (settled) return;
      settled = true;
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      setGenerationState("ready");
      setPendingLessonId(null);
      setIsGenerateModalOpen(false);
      await refreshLibrary();
      // Navigate directly to the new lesson
      router.push(`/lesson/${id}`);
    };

    const settleError = (msg: string) => {
      if (settled) return;
      settled = true;
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      setErrorMessage(msg);
      setGenerationState("error");
      setPendingLessonId(null);
    };

    // Realtime channel
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`lesson-${pendingLessonId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lessons", filter: `id=eq.${pendingLessonId}` },
        (payload) => {
          const updated = payload.new as { status: string; id: string };
          if (updated.status === "ready")  settle(pendingLessonId);
          if (updated.status === "failed") settleError("Audio generation failed on the worker. Please try again.");
        }
      )
      .subscribe();
    channelRef.current = channel;

    // Polling fallback every 2 s
    const poll = setInterval(async () => {
      if (settled) { clearInterval(poll); return; }
      try {
        const { data } = await supabase
          .from("lessons")
          .select("status")
          .eq("id", pendingLessonId)
          .single();
        if (data?.status === "ready")  { clearInterval(poll); settle(pendingLessonId); }
        if (data?.status === "failed") { clearInterval(poll); settleError("Audio generation failed on the worker. Please try again."); }
      } catch { /* network hiccup */ }
    }, 2000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [pendingLessonId, generationState, refreshLibrary, router]);

  // ── handleSubmit ─────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!scenario.trim()) return;
    setGenerationState("calling_api");
    setErrorMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("You must be signed in to generate a lesson.");

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ scenario: scenario.trim(), level, available_voices: availableVoices }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `API returned ${res.status}`);

      if (res.status === 200 && json.cached) {
        // Cached lesson — navigate straight there
        setGenerationState("ready");
        setIsGenerateModalOpen(false);
        router.push(`/lesson/${json.lesson_id}`);
        return;
      }

      if (res.status === 202) {
        setPendingLessonId(json.lesson_id);
        setGenerationState("waiting_for_audio");
        return;
      }

      throw new Error("Unexpected API response status.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setGenerationState("error");
    }
  }, [scenario, level, availableVoices, router]);

  // ── handleCardClick ──────────────────────────────────────
  const handleCardClick = useCallback((lessonId: string) => {
    setCardLoadingId(lessonId);
    router.push(`/lesson/${lessonId}`);
  }, [router]);

  // ── handleDelete ─────────────────────────────────────────
  const handleDelete = useCallback(async (lessonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLibrary(prev => prev.filter(l => l.id !== lessonId));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/generate?lesson_id=${lessonId}`, {
        method: "DELETE",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) refreshLibrary();
    } catch { refreshLibrary(); }
  }, [refreshLibrary]);

  const openGenerateModal = useCallback(() => {
    if (generationState !== "calling_api" && generationState !== "waiting_for_audio") {
      setGenerationState("idle");
      setErrorMessage("");
      setScenario("");
    }
    setIsGenerateModalOpen(true);
  }, [generationState]);

  const isLoading = generationState === "calling_api" || generationState === "waiting_for_audio";

  const filteredLibrary = levelFilter === "All"
    ? library
    : library.filter(l => l.level === levelFilter);

  // ============================================================
  // RENDER
  // ============================================================

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
      {/* Grain overlay — zIndex -1 keeps it under ALL content.
           pointer-events:none + aria-hidden prevent any touch interference
           on mobile WebKit where fixed overlays can absorb taps. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-25"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          backgroundSize: "128px",
          mixBlendMode: "overlay",
          zIndex: -1,
        }}
      />

      {/* ══════════════════════════════════════════════════════
          STICKY NAVBAR
      ══════════════════════════════════════════════════════ */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          // paddingTop respects the Dynamic Island / notch / status bar on iOS.
          // env(safe-area-inset-top) is 0 on desktop and ~47-59px on notched iPhones.
          // The extra 10px keeps buttons from pressing right against the safe-area edge.
          paddingTop: "calc(env(safe-area-inset-top) + 10px)",
          paddingBottom: "10px",
          paddingLeft: "0.75rem",
          paddingRight: "0.75rem",
          minWidth: 0,
          maxWidth: "100vw",
          /* overflow: "hidden" WAS REMOVED FROM HERE! */
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(2px)",
          background: "rgba(7,7,15,0.88)",
        }}
      >
        {/* ── Left: logo ───────────────────────────────────── */}
        <a
          href="/"
          style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", flexShrink: 0 }}
        >
          <span style={{ fontSize: "1.2rem", filter: `drop-shadow(0 0 7px ${theme.accentGlow})` }}>⛩</span>
          <span style={{ fontFamily: "'Noto Serif JP', serif", fontWeight: 600, color: "#fff", fontSize: "1.05rem", letterSpacing: "-0.01em" }}>
            ani<span style={{ color: theme.accent }}>語</span>
          </span>
        </a>

        {/* ── Centre: level filter (md+) ───────────────────── */}
        <div className="hidden md:flex" style={{ alignItems: "center", gap: "4px" }}>
          {(["All", ...LEVELS] as LevelFilter[]).map(lf => (
            <button
              key={lf}
              onClick={() => setLevelFilter(lf)}
              style={{
                padding: "5px 14px", borderRadius: "999px",
                fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.03em",
                background: levelFilter === lf ? theme.accentMid : "transparent",
                border: levelFilter === lf ? `1px solid ${theme.cardBorder}` : "1px solid transparent",
                color: levelFilter === lf ? theme.accent : "#6b7a8d",
                cursor: "pointer", transition: "all 0.15s ease",
              }}
            >
              {lf}
            </button>
          ))}
        </div>

        {/* ── Right: actions ───────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, minWidth: 0 }}>
          {/* Generate Scene */}
          <button
            onClick={openGenerateModal}
            style={{
              display: "flex", alignItems: "center", gap: "7px",
              padding: "7px 12px", borderRadius: "9px",
              background: theme.accentMid,
              border: `1px solid ${theme.cardBorder}`,
              color: theme.accent,
              fontSize: "0.82rem", fontWeight: 600,
              letterSpacing: "0.04em",
              boxShadow: `0 0 20px ${theme.accentLow}`,
              cursor: "pointer", transition: "all 0.18s ease",
              whiteSpace: "nowrap",
            }}
          >
            <span className="hidden md:inline">✦ Generate Scene</span>
            <span className="md:hidden">✦</span>
          </button>

          {/* Voice Chat button */}
          <button
            onClick={() => router.push("/voicechat")}
            title="Chat with AI tutor"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 10px", borderRadius: "9px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#6b7a8d", fontSize: "0.82rem", fontWeight: 500,
              cursor: "pointer", transition: "all 0.18s ease",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8.5a1.5 1.5 0 01-1.5 1.5H4L1 13V2.5A1.5 1.5 0 012.5 1h8A1.5 1.5 0 0112 2.5v6z" />
            </svg>
            <span className="hidden md:inline">Chat</span>
          </button>

          {/* ── NEW STUDY BUTTON ─────────────────────────────── */}
          <button
            onClick={() => router.push("/study")}
            title="Study Flashcards"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 10px", borderRadius: "9px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#6b7a8d", fontSize: "0.82rem", fontWeight: 500,
              cursor: "pointer", transition: "all 0.18s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
              (e.currentTarget as HTMLElement).style.color = theme.accent;
              (e.currentTarget as HTMLElement).style.borderColor = theme.cardBorder;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.color = "#6b7a8d";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)";
            }}
          >
            {/* Layers / Stack of Cards icon */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            <span className="hidden md:inline">Study</span>
          </button>
          {/* ─────────────────────────────────────────────────── */}

          {/* Theme picker (ELEVATED Z-INDEX HERE) */}
          <div ref={themeMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setIsThemeMenuOpen(v => !v)}
              title="Change theme"
              style={{
                width: "34px", height: "34px",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "9px",
                background: isThemeMenuOpen ? theme.accentLow : "rgba(255,255,255,0.04)",
                border: `1px solid ${isThemeMenuOpen ? theme.cardBorder : "rgba(255,255,255,0.09)"}`,
                color: isThemeMenuOpen ? theme.accent : "#6b7a8d",
                cursor: "pointer", transition: "all 0.15s ease",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="8.5" cy="7" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="6.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2v-.5c0-.55.45-1 1-1h1c2.76 0 5-2.24 5-5C21 6.48 16.52 2 12 2z" />
              </svg>
            </button>

            {isThemeMenuOpen && (
              <div
                style={{
                  position: "absolute", right: 0, top: "calc(100% + 8px)",
                  background: "rgba(10,10,22,0.97)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "14px",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.65)",
                  minWidth: "148px",
                  overflow: "hidden",
                  zIndex: 100,
                  animation: "fadeSlideDown 0.14s ease both",
                }}
              >
                {THEMES.map(t => (
                  <button
                    key={t.name}
                    onClick={() => { setTheme(t); setIsThemeMenuOpen(false); }}
                    style={{
                      width: "100%",
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "9px 14px",
                      fontSize: "0.8rem",
                      background: theme.name === t.name ? "rgba(255,255,255,0.07)" : "transparent",
                      border: "none",
                      borderLeft: `2px solid ${theme.name === t.name ? t.accent : "transparent"}`,
                      color: theme.name === t.name ? "#fff" : "#6b7a8d",
                      cursor: "pointer", textAlign: "left",
                      transition: "all 0.12s ease",
                    }}
                  >
                    <span style={{
                      width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
                      background: t.accent, boxShadow: `0 0 7px ${t.accentGlow}`,
                    }} />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          LIBRARY GRID
      ══════════════════════════════════════════════════════ */}
      <div style={{ position: "relative", zIndex: 10, flex: 1, padding: "2rem 1rem" }}>

        {/* Hero heading */}
        <div style={{ textAlign: "center", marginBottom: "0.8rem", paddingTop: "0.1rem" }}>
          <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.18em", color: "#2a2a3a", margin: "0 0 0.75rem", fontFamily: "'Noto Sans JP', sans-serif" }}>
            あなたのシーン
          </p>
          <h1 style={{
            fontFamily: "'Noto Serif JP', serif",
            fontSize: "clamp(1.7rem, 3.5vw, 2.6rem)",
            fontWeight: 700, color: "#fff",
            letterSpacing: "-0.025em", margin: "0 0 0.8rem",
            textShadow: `0 0 80px rgba(${theme.accentRgb},0.22)`,
          }}>
            Your Scene Library
          </h1>
          <div style={{ width: "48px", height: "2px", background: `linear-gradient(to right, transparent, ${theme.accent}, transparent)`, margin: "0 auto" }} />
        </div>

        {/* Sub-header row */}
        <div className="w-[98%] md:w-[76%]" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 auto 1.5rem" }}>
          <div>
            <h2 style={{ fontFamily: "'Noto Serif JP', serif", fontSize: "1rem", fontWeight: 600, color: "#fff", letterSpacing: "-0.01em", margin: 0 }}>
              {levelFilter === "All" ? "All Scenes" : `${levelFilter} Scenes`}
            </h2>
            <p style={{ color: "#2a2a3a", fontSize: "0.7rem", margin: "3px 0 0" }}>
              {libraryLoading ? "Loading…" : `${filteredLibrary.length} ${filteredLibrary.length === 1 ? "scene" : "scenes"}`}
            </p>
          </div>
          <button
            onClick={openGenerateModal}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 15px", borderRadius: "9px",
              background: theme.accentMid, border: `1px solid ${theme.cardBorder}`,
              color: theme.accent, fontSize: "0.78rem", fontWeight: 600,
              letterSpacing: "0.04em", cursor: "pointer",
              boxShadow: `0 0 16px ${theme.accentLow}`, transition: "all 0.18s ease",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 1v10M1 6h10" />
            </svg>
            New Scene
          </button>
        </div>

        {/* Loading skeletons */}
        {libraryLoading && (
          <div className="w-[98%] md:w-[76%]" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "18px", margin: "0 auto" }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                height: "210px", borderRadius: "20px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
                animation: `pulse-slow 1.8s ease-in-out ${i * 0.1}s infinite`,
              }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!libraryLoading && filteredLibrary.length === 0 && (
          <div className="w-[98%] md:w-[76%]" style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "7rem 2rem", gap: "16px", borderRadius: "24px",
            border: "1px dashed rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.012)",
            margin: "0 auto",
          }}>
            <span style={{ fontSize: "3rem", opacity: 0.15 }}>⛩</span>
            <p style={{ color: "#3a3a52", fontSize: "0.9rem", margin: 0, fontFamily: "'Noto Serif JP', serif" }}>
              {levelFilter === "All" ? "No scenes yet — generate your first one." : `No ${levelFilter} scenes yet.`}
            </p>
            <button
              onClick={openGenerateModal}
              style={{
                marginTop: "4px", padding: "8px 22px", borderRadius: "10px",
                fontSize: "0.8rem", fontWeight: 600,
                background: theme.accentLow, border: `1px solid ${theme.cardBorder}`,
                color: theme.accent, cursor: "pointer",
              }}
            >
              ✦ Generate Scene
            </button>
          </div>
        )}

        {/* Card grid */}
        {!libraryLoading && filteredLibrary.length > 0 && (
          <div
            className="w-[98%] md:w-[76%]"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))", gap: "16px", margin: "0 auto" }}
          >
            {filteredLibrary.map((lesson, idx) => {
              const tag     = lesson.structured_content?.background_tag ?? "shrine";
              const grad    = TAG_GRADIENTS[tag] ?? TAG_GRADIENTS["shrine"];
              const emoji   = TAG_EMOJI[tag] ?? "⛩";
              const title   = lesson.structured_content?.title ?? "Untitled Scene";
              const loading = cardLoadingId === lesson.id;

              return (
                <div
                  key={lesson.id}
                  className="card-wrap"
                  style={{
                    position: "relative",
                    borderRadius: "20px",
                    animation: `fadeSlideUp 0.38s cubic-bezier(0.22,1,0.36,1) ${idx * 0.025}s both`,
                  }}
                >
                  <button
                    onClick={() => handleCardClick(lesson.id)}
                    disabled={loading}
                    style={{
                      width: "100%",
                      background: grad,
                      backgroundImage: `${grad}, linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%)`,
                      border: "1px solid rgba(255,255,255,0.09)",
                      borderRadius: "20px",
                      height: "210px",
                      padding: "1.2rem 1.3rem",
                      display: "flex", flexDirection: "column", justifyContent: "space-between",
                      textAlign: "left", cursor: loading ? "wait" : "pointer",
                      position: "relative", overflow: "hidden",
                      transition: "transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease",
                      boxShadow: "0 2px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
                    }}
                    onMouseEnter={e => {
                      if (!loading) {
                        const el = e.currentTarget as HTMLElement;
                        el.style.transform = "translateY(-5px)";
                        el.style.borderColor = theme.cardBorder;
                        el.style.boxShadow = `0 22px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(${theme.accentRgb},0.15), inset 0 1px 0 rgba(255,255,255,0.1)`;
                        const glow = el.querySelector(".card-glow") as HTMLElement | null;
                        if (glow) glow.style.opacity = "1";
                      }
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform = "translateY(0)";
                      el.style.borderColor = "rgba(255,255,255,0.09)";
                      el.style.boxShadow = "0 2px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)";
                      const glow = el.querySelector(".card-glow") as HTMLElement | null;
                      if (glow) glow.style.opacity = "0";
                    }}
                  >
                    {/* Background thumbnail */}
                    {lesson.background_image_url && (
                      <div style={{
                        position: "absolute", inset: 0, pointerEvents: "none",
                        backgroundImage: `url(${lesson.background_image_url})`,
                        backgroundSize: "cover", backgroundPosition: "center",
                        opacity: 0.28, filter: "saturate(1.1) brightness(0.6)",
                        borderRadius: "inherit",
                      }} />
                    )}
                    {/* Glow on hover */}
                    <div className="card-glow" style={{
                      position: "absolute", inset: 0, pointerEvents: "none",
                      background: `radial-gradient(ellipse 75% 50% at 50% 0%, rgba(${theme.accentRgb},0.13), transparent)`,
                      opacity: 0, transition: "opacity 0.25s ease",
                    }} />
                    {/* Top highlight line */}
                    <div style={{
                      position: "absolute", top: 0, left: "12%", right: "12%", height: "1px", pointerEvents: "none",
                      background: "linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)",
                    }} />

                    {/* Top: emoji + level badge */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
                      <span style={{ fontSize: "1.9rem", lineHeight: 1, filter: "drop-shadow(0 3px 12px rgba(0,0,0,0.9))" }}>
                        {emoji}
                      </span>
                      <span style={{
                        fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.07em",
                        padding: "3px 9px", borderRadius: "999px",
                        background: `rgba(${theme.accentRgb},0.12)`,
                        border: `1px solid rgba(${theme.accentRgb},0.3)`,
                        color: theme.accent, backdropFilter: "blur(8px)", textTransform: "uppercase",
                      }}>
                        {lesson.level}
                      </span>
                    </div>

                    {/* Bottom: title + date */}
                    <div style={{ position: "relative", zIndex: 1 }}>
                      {loading ? (
                        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                          {[0, 1, 2].map(i => (
                            <div key={i} style={{
                              width: "6px", height: "6px", borderRadius: "50%",
                              background: theme.accent,
                              animation: `pulse-slow 1s ease-in-out ${i * 0.14}s infinite`,
                            }} />
                          ))}
                        </div>
                      ) : (
                        <>
                          <p style={{ fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", margin: "0 0 4px" }}>
                            {tag.replace(/_/g, " ")}
                          </p>
                          <p style={{
                            fontFamily: "'Noto Serif JP', serif",
                            fontSize: "0.94rem", fontWeight: 700, color: "#fff",
                            margin: 0, lineHeight: 1.35,
                            textShadow: "0 1px 16px rgba(0,0,0,0.95)",
                            display: "-webkit-box",
                            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                          }}>
                            {title}
                          </p>
                          <p style={{ color: "rgba(255,255,255,0.22)", fontSize: "0.66rem", margin: "6px 0 0", letterSpacing: "0.03em" }}>
                            {new Date(lesson.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </>
                      )}
                    </div>
                  </button>

                  {/* ✕ Delete */}
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDelete(lesson.id, e)}
                    title="Delete scene"
                    style={{
                      position: "absolute", top: "10px", right: "10px", zIndex: 10,
                      width: "22px", height: "22px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "6px", background: "rgba(8,6,20,0.7)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.4)",
                      cursor: "pointer", opacity: 0,
                      transition: "all 0.15s ease",
                      backdropFilter: "blur(2px)",
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "rgba(220,38,38,0.8)";
                      el.style.borderColor = "rgba(248,113,113,0.5)";
                      el.style.color = "#fff";
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "rgba(8,6,20,0.7)";
                      el.style.borderColor = "rgba(255,255,255,0.12)";
                      el.style.color = "rgba(255,255,255,0.4)";
                    }}
                  >
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M1 1l8 8M9 1L1 9" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          GENERATE MODAL
      ══════════════════════════════════════════════════════ */}
      {isGenerateModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 60,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "2rem",
            background: "rgba(4,4,14,0.85)",
            backdropFilter: "blur(12px)",
          }}
          onClick={e => { if (e.target === e.currentTarget && !isLoading) setIsGenerateModalOpen(false); }}
        >
          <div style={{
            width: "100%", maxWidth: "700px",
            background: "rgba(9,9,20,0.98)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "24px",
            boxShadow: `0 48px 100px rgba(0,0,0,0.75), 0 0 70px ${theme.accentLow}`,
            animation: "modalIn 0.1s cubic-bezier(0.22,1,0.36,1) both",
            maxHeight: "90vh",
            overflowY: "auto",
          }}>
            {/* Accent top line */}
            <div style={{ height: "3px", background: `linear-gradient(to right, transparent 0%, ${theme.accent} 50%, transparent 100%)` }} />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "1.8rem 2.2rem 0" }}>
              <div>
                <h2 style={{ fontFamily: "'Noto Serif JP', serif", fontSize: "1.4rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                  Create a New Scene
                </h2>
                <p style={{ color: "#6b7a8d", fontSize: "0.9rem", margin: "4px 0 0" }}>
                  Describe a scenario — AI writes and voices the scene.
                </p>
              </div>
              {!isLoading && (
                <button
                  onClick={() => setIsGenerateModalOpen(false)}
                  style={{
                    width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "none", color: "#6b7a8d", cursor: "pointer",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M1 1l10 10M11 1L1 11" />
                  </svg>
                </button>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: "1.5rem 2.2rem 2.2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

              {/* Textarea */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7a8d" }}>
                  Scenario
                </label>
                <textarea
                  rows={5}
                  placeholder="e.g. Ordering ramen for the first time and asking the chef what the special is..."
                  value={scenario}
                  onChange={e => setScenario(e.target.value)}
                  disabled={isLoading}
                  style={{
                    width: "100%", padding: "14px 18px", borderRadius: "16px", fontSize: "0.95rem",
                    resize: "none", outline: "none", background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaf0", lineHeight: 1.6,
                    fontFamily: "'Noto Sans JP', sans-serif", transition: "all 0.08s ease",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.border = `1px solid ${theme.cardBorder}`;
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.accentLow}`;
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  }}
                />
              </div>

              {/* Level */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7a8d" }}>
                  JLPT Level
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {LEVELS.map(l => (
                    <button
                      key={l}
                      onClick={() => setLevel(l)}
                      disabled={isLoading}
                      style={{
                        flex: 1, padding: "12px", borderRadius: "14px", fontSize: "0.9rem", fontWeight: 500,
                        background: level === l ? theme.accentMid : "rgba(255,255,255,0.03)",
                        border: level === l ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.08)",
                        color: level === l ? theme.accent : "#6b7a8d",
                        cursor: "pointer", transition: "all 0.08s ease",
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {generationState === "error" && errorMessage && (
                <div style={{ padding: "12px 16px", borderRadius: "14px", fontSize: "0.85rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                  {errorMessage}
                </div>
              )}

              {/* Submit / loading */}
              <div style={{ marginTop: "0.25rem" }}>
                {!isLoading ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!scenario.trim()}
                    style={{
                      width: "100%", padding: "14px", borderRadius: "14px", fontSize: "0.95rem", fontWeight: 600,
                      background: scenario.trim() ? theme.accentMid : "rgba(255,255,255,0.03)",
                      border: scenario.trim() ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.06)",
                      color: scenario.trim() ? theme.accent : "#3a3a52",
                      boxShadow: scenario.trim() ? `0 0 36px ${theme.accentLow}` : "none",
                      cursor: scenario.trim() ? "pointer" : "not-allowed", transition: "all 0.08s ease",
                    }}
                  >
                    ✦ Generate Scene
                  </button>
                ) : (
                  <GenerationProgress state={generationState} accent={theme.accent} />
                )}
              </div>

              {/* Example pills */}
              {(generationState === "idle" || generationState === "error") && (
                <div style={{ marginTop: "0.5rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7a8d", textAlign: "center", marginBottom: "12px" }}>
                    Try one of these
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
                    {EXAMPLE_SCENARIOS.map(ex => (
                      <button
                        key={ex.scenario}
                        onClick={() => { setScenario(ex.scenario); setLevel(ex.level as Level); }}
                        style={{
                          fontSize: "0.8rem", padding: "7px 14px", borderRadius: "999px",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          color: "#a8b4c8", cursor: "pointer",
                        }}
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Global styles ──────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600&family=Noto+Serif+JP:wght@400;600;700&display=swap');

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .card-wrap:hover .delete-btn { opacity: 1 !important; }
        .card-wrap:hover .card-glow  { opacity: 1 !important; }

        * { box-sizing: border-box; }
        ::placeholder { color: #2a2a3a; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.09); border-radius: 2px; }
      `}</style>
    </main>
  );
}

// ── Generation progress widget ──────────────────────────────
function GenerationProgress({ state, accent }: { state: GenerationState; accent: string }) {
  const isCalling = state === "calling_api";
  const isWaiting = state === "waiting_for_audio";

  return (
    <div style={{
      width: "100%", padding: "18px", borderRadius: "12px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: accent,
            animation: `pulse-slow 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <p style={{ color: accent, fontSize: "0.84rem", fontWeight: 500, margin: 0 }}>
        {isCalling && "AI is writing the script…"}
        {isWaiting && "Worker is rendering voicelines…"}
      </p>
      <p style={{ color: "#2a2a3a", fontSize: "0.72rem", margin: 0 }}>
        {isCalling && "Generating dialogue, vocabulary & grammar"}
        {isWaiting && "This can take 30–90 s depending on scene length"}
      </p>
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
        <StepDot label="Script" done={!isCalling} active={isCalling}  accent={accent} />
        <div style={{ width: "24px", height: "1px", background: "rgba(255,255,255,0.08)" }} />
        <StepDot label="Audio"  done={false}      active={isWaiting}  accent={accent} />
        <div style={{ width: "24px", height: "1px", background: "rgba(255,255,255,0.08)" }} />
        <StepDot label="Ready"  done={false}      active={false}      accent={accent} />
      </div>
    </div>
  );
}

function StepDot({ label, done, active, accent }: { label: string; done: boolean; active: boolean; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      <div style={{
        width: "8px", height: "8px", borderRadius: "50%",
        background: done ? accent : active ? accent + "70" : "rgba(255,255,255,0.1)",
        boxShadow: active ? `0 0 8px ${accent}70` : "none",
        animation: active ? "pulse-slow 1.2s ease-in-out infinite" : "none",
        transition: "all 0.4s ease",
      }} />
      <span style={{ fontSize: "0.65rem", color: done || active ? "#6b7a8d" : "#1e1e2e" }}>{label}</span>
    </div>
  );
}