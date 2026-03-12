"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import ScenePlayer, { type LessonLine, type StructuredContent, type VoiceEntry, type Theme } from "@/components/ScenePlayer";
import AvatarChat from "@/components/AvatarChat";

// ============================================================
// SECTION 1: SUPABASE CLIENT
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,    // saves session to localStorage so PWA has it
      autoRefreshToken: true,  // keeps session alive in standalone mode
      detectSessionInUrl: true,
    },
  }
);

// ============================================================
// SECTION 2: TYPES & CONSTANTS
// ============================================================

type GenerationState =
  | "idle"
  | "calling_api"
  | "waiting_for_audio"
  | "ready"
  | "error";

interface ActiveLesson {
  id: string;
  structured_content: StructuredContent;
  background_image_url: string | null; // Supabase public URL once generated
  lesson_lines: LessonLine[];
}

interface LibraryLesson {
  id: string;
  created_at: string;
  level: string;
  structured_content: StructuredContent;
  background_image_url: string | null; // used for card thumbnail preview
}

const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
type Level = (typeof LEVELS)[number];
type LevelFilter = "All" | Level;

// ── Themes ──────────────────────────────────────────────────

const THEMES: Theme[] = [
  {
    name: "gold",
    label: "⛩ Gold",
    accent: "#f5c842",
    accentRgb: "245,200,66",
    accentMid: "rgba(245,200,66,0.18)",
    accentLow: "rgba(245,200,66,0.07)",
    accentGlow: "rgba(245,200,66,0.35)",
    cardBorder: "rgba(245,200,66,0.4)",
    gradient:
      "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(120,80,255,0.12), transparent), " +
      "radial-gradient(ellipse 60% 40% at 80% 80%, rgba(245,200,66,0.06), transparent)",
  },
  {
    name: "sakura",
    label: "🌸 Sakura",
    accent: "#ff6eb4",
    accentRgb: "255,110,180",
    accentMid: "rgba(255,110,180,0.18)",
    accentLow: "rgba(255,110,180,0.07)",
    accentGlow: "rgba(255,110,180,0.35)",
    cardBorder: "rgba(255,110,180,0.4)",
    gradient:
      "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,110,180,0.13), transparent), " +
      "radial-gradient(ellipse 60% 40% at 80% 80%, rgba(180,60,140,0.07), transparent)",
  },
  {
    name: "cyber",
    label: "⚡ Cyber",
    accent: "#00ffe0",
    accentRgb: "0,255,224",
    accentMid: "rgba(0,255,224,0.15)",
    accentLow: "rgba(0,255,224,0.06)",
    accentGlow: "rgba(0,255,224,0.3)",
    cardBorder: "rgba(0,255,224,0.38)",
    gradient:
      "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,255,224,0.1), transparent), " +
      "radial-gradient(ellipse 60% 40% at 20% 90%, rgba(0,100,255,0.07), transparent)",
  },
  {
    name: "crimson",
    label: "🔥 Crimson",
    accent: "#ff4d4d",
    accentRgb: "255,77,77",
    accentMid: "rgba(255,77,77,0.18)",
    accentLow: "rgba(255,77,77,0.07)",
    accentGlow: "rgba(255,77,77,0.32)",
    cardBorder: "rgba(255,77,77,0.4)",
    gradient:
      "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,60,60,0.12), transparent), " +
      "radial-gradient(ellipse 60% 40% at 80% 80%, rgba(160,20,20,0.08), transparent)",
  },
  {
    name: "spirit",
    label: "👻 Spirit",
    accent: "#b388ff",
    accentRgb: "179,136,255",
    accentMid: "rgba(179,136,255,0.18)",
    accentLow: "rgba(179,136,255,0.07)",
    accentGlow: "rgba(179,136,255,0.32)",
    cardBorder: "rgba(179,136,255,0.4)",
    gradient:
      "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(179,136,255,0.12), transparent), " +
      "radial-gradient(ellipse 60% 40% at 20% 80%, rgba(100,60,200,0.08), transparent)",
  },
];

// ── Card background gradients by background_tag ─────────────
const TAG_GRADIENTS: Record<string, string> = {
  ramen_shop:        "linear-gradient(145deg, #1a0800 0%, #2d1400 60%, #120600 100%)",
  train_station:     "linear-gradient(145deg, #04080f 0%, #080f1e 60%, #040810 100%)",
  convenience_store: "linear-gradient(145deg, #001408 0%, #002410 60%, #001008 100%)",
  school_classroom:  "linear-gradient(145deg, #08081a 0%, #10102a 60%, #08081a 100%)",
  park:              "linear-gradient(145deg, #001608 0%, #002010 60%, #001208 100%)",
  office:            "linear-gradient(145deg, #06060e 0%, #0e0e1c 60%, #06060e 100%)",
  shrine:            "linear-gradient(145deg, #180400 0%, #280c00 60%, #160600 100%)",
  beach:             "linear-gradient(145deg, #000e18 0%, #001828 60%, #000c18 100%)",
  apartment:         "linear-gradient(145deg, #080810 0%, #12121e 60%, #080810 100%)",
  arcade:            "linear-gradient(145deg, #080012 0%, #160028 60%, #0a0016 100%)",
};

const TAG_EMOJI: Record<string, string> = {
  ramen_shop:        "🍜",
  train_station:     "🚃",
  convenience_store: "🏪",
  school_classroom:  "📚",
  park:              "🌸",
  office:            "💼",
  shrine:            "⛩",
  beach:             "🌊",
  apartment:         "🏠",
  arcade:            "🎮",
};

const LEVEL_COLOURS: Record<string, string> = {
  Beginner:     "#4ade80",
  Intermediate: "#fb923c",
  Advanced:     "#f87171",
};

// ============================================================
// SECTION 3: HELPERS
// ============================================================

async function fetchLessonData(lessonId: string): Promise<ActiveLesson> {
  const [{ data: lesson, error: lessonError }, { data: lines, error: linesError }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("structured_content, background_image_url")
        .eq("id", lessonId)
        .single(),
      supabase
        .from("lesson_lines")
        .select("id, order_index, speaker, kanji, romaji, english, audio_url, highlights")
        .eq("lesson_id", lessonId)
        .order("order_index", { ascending: true }),
    ]);

  if (lessonError) throw new Error(`Failed to fetch lesson: ${lessonError.message}`);
  if (linesError)  throw new Error(`Failed to fetch lines: ${linesError.message}`);
  if (!lesson?.structured_content) throw new Error("Lesson has no structured content.");
  if (!lines || lines.length === 0) throw new Error("Lesson has no dialogue lines.");

  return {
    id: lessonId,
    structured_content: lesson.structured_content as StructuredContent,
    background_image_url: (lesson.background_image_url as string | null) ?? null,
    lesson_lines: lines as LessonLine[],
  };
}

// ============================================================
// SECTION 4: PAGE COMPONENT
// ============================================================

export default function HomePage() {

  // ── Generation form ───────────────────────────────────────
  const [scenario, setScenario]               = useState("");
  const [level, setLevel]                     = useState<Level>("Beginner");
  const [generationState, setGenerationState] = useState<GenerationState>("idle");
  const [activeLesson, setActiveLesson]       = useState<ActiveLesson | null>(null);
  const [errorMessage, setErrorMessage]       = useState<string>("");
  const [pendingLessonId, setPendingLessonId] = useState<string | null>(null);

  // ── Library ───────────────────────────────────────────────
  const [library, setLibrary]               = useState<LibraryLesson[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [levelFilter, setLevelFilter]       = useState<LevelFilter>("All");

  // ── UI ────────────────────────────────────────────────────
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen]         = useState(false);
  const [showAvatarChat, setShowAvatarChat]           = useState(false);
  // Always start with THEMES[0] so server and client render identically.
  // The saved theme is applied in a useEffect (client-only) to avoid the
  // SSR/client hydration mismatch that occurs when localStorage is read
  // inside a lazy useState initialiser.
  const [theme, setTheme] = useState<Theme>(THEMES[0]);
  const [cardLoadingId, setCardLoadingId]             = useState<string | null>(null);

  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // ── Available voices ──────────────────────────────────────
  const [availableVoices, setAvailableVoices] = useState<VoiceEntry[]>([]);

  // u2500u2500 Restore saved theme (client-only, after hydration) u2500u2500u2500
  // Must run in useEffect so server and client both start with THEMES[0],
  // eliminating the hydration mismatch warning.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("anigo-theme");
      const found = THEMES.find(t => t.name === saved);
      if (found) setTheme(found);
    } catch { /* localStorage unavailable - keep default */ }
  }, []);

  // ── DEV AUTO-LOGIN ────────────────────────────────────────
  // ── Auth + data bootstrap ────────────────────────────────
  // Sign in first, THEN fetch library. This ensures the PWA (home screen)
  // context has a valid session before trying to read from Supabase.
  const refreshLibrary = useCallback(async () => {
    setLibraryLoading(true);
    const { data, error } = await supabase
      .from("lessons")
      .select("id, created_at, level, structured_content, background_image_url")
      .eq("status", "ready")
      .order("created_at", { ascending: false });

    if (!error && data) setLibrary(data as LibraryLesson[]);
    setLibraryLoading(false);
  }, []);

  useEffect(() => {
    async function bootstrap() {
      // Check if we already have a valid session (e.g. persisted in localStorage)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // No session — sign in with the dev account
        await supabase.auth.signInWithPassword({ email: "dev@test.com", password: "password123" });
      }
      // Now fetch data regardless of which path we took
      await refreshLibrary();
    }
    bootstrap();
  }, [refreshLibrary]);

  // ── Fetch voices ──────────────────────────────────────────
  useEffect(() => {
    fetch("/api/voices")
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data: VoiceEntry[]) => { if (Array.isArray(data)) setAvailableVoices(data); })
      .catch(() => {});
  }, []);

  // ── Close theme menu on outside click ─────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node))
        setIsThemeMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Realtime cleanup ──────────────────────────────────────
  useEffect(() => {
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, []);

  // ── Realtime subscription + polling fallback ──────────────
  // The Realtime channel can miss the UPDATE event if the worker finishes
  // before the WebSocket handshake completes (race condition). The polling
  // loop below checks the DB directly every 4 s so a missed event never
  // leaves the UI stuck on "Local PC is rendering voicelines…".
  useEffect(() => {
    if (!pendingLessonId || generationState !== "waiting_for_audio") return;

    let settled = false; // prevents double-resolution if both fire at once

    const settle = async (id: string) => {
      if (settled) return;
      settled = true;
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      try {
        const lessonData = await fetchLessonData(id);
        setActiveLesson(lessonData);
        setGenerationState("ready");
        setPendingLessonId(null);
        setIsGenerateModalOpen(false);
        refreshLibrary();
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load lesson.");
        setGenerationState("error");
      }
    };

    const settleError = (msg: string) => {
      if (settled) return;
      settled = true;
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      setErrorMessage(msg);
      setGenerationState("error");
      setPendingLessonId(null);
    };

    // ── Realtime channel ──────────────────────────────────
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

    // ── Polling fallback every 4 s ────────────────────────
    const pollInterval = setInterval(async () => {
      if (settled) { clearInterval(pollInterval); return; }
      try {
        const { data } = await supabase
          .from("lessons")
          .select("status")
          .eq("id", pendingLessonId)
          .single();
        if (data?.status === "ready")  { clearInterval(pollInterval); settle(pendingLessonId); }
        if (data?.status === "failed") { clearInterval(pollInterval); settleError("Audio generation failed on the worker. Please try again."); }
      } catch { /* network hiccup — try again next tick */ }
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [pendingLessonId, generationState, refreshLibrary]);

  // ── handleSubmit (logic unchanged) ───────────────────────
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
        const lessonData = await fetchLessonData(json.lesson_id);
        setActiveLesson(lessonData);
        setGenerationState("ready");
        setIsGenerateModalOpen(false);
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
  }, [scenario, level, availableVoices]);

  // ── handleReset — back to library ────────────────────────
  const handleReset = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setActiveLesson(null);
    setPendingLessonId(null);
    setGenerationState("idle");
    setErrorMessage("");
  }, []);

  // ── handleCardClick ───────────────────────────────────────
  const handleCardClick = useCallback(async (lessonId: string) => {
    setCardLoadingId(lessonId);
    try {
      const lessonData = await fetchLessonData(lessonId);
      setActiveLesson(lessonData);
    } catch { /* silent */ }
    finally { setCardLoadingId(null); }
  }, []);

  // ── handleDelete ──────────────────────────────────────────
  const handleDelete = useCallback(async (lessonId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent card click from firing
    // Optimistic removal — feels instant even if the API call takes a moment.
    setLibrary(prev => prev.filter(l => l.id !== lessonId));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/generate?lesson_id=${lessonId}`, {
        method: "DELETE",
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      if (!res.ok) {
        console.error("[handleDelete] Server delete failed:", await res.text());
        refreshLibrary(); // restore card on failure
      }
    } catch (err) {
      console.error("[handleDelete] Network error:", err);
      refreshLibrary();
    }
  }, [refreshLibrary]);

  // ── Open modal (reset form) ───────────────────────────────
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
  // SECTION 5: RENDER
  // ============================================================

  return (
    <main
      className="min-h-screen w-full flex flex-col"
      style={{
        background: "#07070f",
        backgroundImage: theme.gradient,
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      {/* ── Avatar Chat overlay ──────────────────────────────── */}
      {showAvatarChat && (
        <AvatarChat theme={theme} onClose={() => setShowAvatarChat(false)} />
      )}

      {/* ── Grain overlay ────────────────────────────────────── */}
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

      {/* ══════════════════════════════════════════════════════
          STICKY NAV BAR — collapses when player is open
      ══════════════════════════════════════════════════════ */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 0.75rem",
          height: "56px",
          minWidth: 0,         // prevent flex child from overflowing
          transform: activeLesson ? "translateY(-100%)" : "translateY(0)",
          opacity: activeLesson ? 0 : 1,
          overflow: activeLesson ? "hidden" : "visible",
          borderBottom: activeLesson ? "none" : "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(2px)",
          background: "rgba(7,7,15,0.88)",
          transition: "transform 0.25s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.2s ease",
          willChange: "transform",
          pointerEvents: activeLesson ? "none" : "auto",
        }}
      >
        {/* ── Left: logo ───────────────────────────────────── */}
        <button
          onClick={handleReset}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
        >
          <span style={{ fontSize: "1.2rem", filter: `drop-shadow(0 0 7px ${theme.accentGlow})` }}>⛩</span>
          <span style={{ fontFamily: "'Noto Serif JP', serif", fontWeight: 600, color: "#fff", fontSize: "1.05rem", letterSpacing: "-0.01em" }}>
            ani<span style={{ color: theme.accent }}>語</span>
          </span>
        </button>

        {/* ── Centre: level filter — hidden on mobile, visible md+ ── */}
        <div className="hidden md:flex" style={{ alignItems: "center", gap: "4px" }}>
          {(["All", ...LEVELS] as LevelFilter[]).map(lf => (
            <button
              key={lf}
              onClick={() => setLevelFilter(lf)}
              style={{
                padding: "5px 14px",
                borderRadius: "999px",
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.03em",
                background: levelFilter === lf ? theme.accentMid : "transparent",
                border: levelFilter === lf ? `1px solid ${theme.cardBorder}` : "1px solid transparent",
                color: levelFilter === lf ? theme.accent : "#6b7a8d",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { if (levelFilter !== lf) (e.currentTarget as HTMLElement).style.color = "#a8b4c8"; }}
              onMouseLeave={e => { if (levelFilter !== lf) (e.currentTarget as HTMLElement).style.color = "#6b7a8d"; }}
            >
              {lf}
            </button>
          ))}
        </div>

        {/* ── Right: Generate Scene first, then theme picker far-right ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {/* Generate Scene button */}
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
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${theme.accentGlow}`;
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${theme.accentLow}`;
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            {/* On mobile show ✦ only; on md+ show full label */}
            <span className="hidden md:inline">✦ Generate Scene</span>
            <span className="md:hidden">✦</span>
          </button>

          {/* Avatar Chat button */}
          <button
            onClick={() => setShowAvatarChat(true)}
            title="Chat with AI tutor"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 14px", borderRadius: "9px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#6b7a8d", fontSize: "0.82rem", fontWeight: 500,
              letterSpacing: "0.04em", cursor: "pointer", transition: "all 0.18s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = theme.accentLow;
              (e.currentTarget as HTMLElement).style.borderColor = theme.cardBorder;
              (e.currentTarget as HTMLElement).style.color = theme.accent;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)";
              (e.currentTarget as HTMLElement).style.color = "#6b7a8d";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8.5a1.5 1.5 0 01-1.5 1.5H4L1 13V2.5A1.5 1.5 0 012.5 1h8A1.5 1.5 0 0112 2.5v6z" />
            </svg>
            <span className="hidden md:inline">Chat</span>
          </button>

          {/* Theme picker — absolute far right */}
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
              onMouseEnter={e => {
                if (!isThemeMenuOpen) {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)";
                  (e.currentTarget as HTMLElement).style.color = "#c0cad8";
                }
              }}
              onMouseLeave={e => {
                if (!isThemeMenuOpen) {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)";
                  (e.currentTarget as HTMLElement).style.color = "#6b7a8d";
                }
              }}
            >
              {/* Palette icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="8.5" cy="7" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="6.5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2v-.5c0-.55.45-1 1-1h1c2.76 0 5-2.24 5-5C21 6.48 16.52 2 12 2z"/>
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
                    onClick={() => {
                        setTheme(t);
                        localStorage.setItem("anigo-theme", t.name);
                        setIsThemeMenuOpen(false);
                      }}
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
                    onMouseEnter={e => {
                      if (theme.name !== t.name) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                        (e.currentTarget as HTMLElement).style.color = "#c0cad8";
                      }
                    }}
                    onMouseLeave={e => {
                      if (theme.name !== t.name) {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                        (e.currentTarget as HTMLElement).style.color = "#6b7a8d";
                      }
                    }}
                  >
                    <span style={{
                      width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
                      background: t.accent,
                      boxShadow: `0 0 7px ${t.accentGlow}`,
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
          MAIN CONTENT
      ══════════════════════════════════════════════════════ */}
      <div style={{ position: "relative", zIndex: 10, flex: 1, padding: activeLesson ? "1rem 0.5rem" : "2rem 1rem", marginTop: activeLesson ? "-56px" : "0", transition: "padding 0.28s ease" }}>

        {/* ── SCENE PLAYER ───────────────────────────────── */}
        {activeLesson && (
          <div className="w-[95%] md:w-full md:max-w-[896px]" style={{ margin: "0 auto", animation: "fadeSlideUp 0.4s cubic-bezier(0.22,1,0.36,1) both" }}>
            {/* ← Library back button */}
            <button
              onClick={handleReset}
              className="back-btn"
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                marginBottom: "0.85rem",
                padding: "6px 14px", borderRadius: "8px",
                background: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#8a9ab8", fontSize: "0.82rem", cursor: "pointer",
                transition: "all 0.18s ease",
                // Sticky so it stays visible while scrolling through long lessons
                position: "sticky",
                top: "12px",
                zIndex: 50,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#c0cad8"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#8a9ab8"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8 2L3 7l5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Library
            </button>
            <ScenePlayer
              lesson_id={activeLesson.id}
              structured_content={activeLesson.structured_content}
              background_image_url={activeLesson.background_image_url}
              lesson_lines={activeLesson.lesson_lines}
              theme={theme}
            />
          </div>
        )}

        {/* ── LIBRARY ────────────────────────────────────── */}
        {!activeLesson && (
          <div style={{ animation: "fadeSlideUp 0.4s cubic-bezier(0.22,1,0.36,1) both" }}>

            {/* ── Hero heading ── */}
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

            {/* ── Section sub-header row ── */}
            <div className="w-[95%] md:w-[76%]" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 auto 1.5rem" }}>
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
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 26px ${theme.accentGlow}`; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${theme.accentLow}`; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 1v10M1 6h10" />
                </svg>
                New Scene
              </button>
            </div>

            {/* Loading skeletons */}
            {libraryLoading && (
              <div className="w-[95%] md:w-[76%]" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "18px", margin: "0 auto" }}>
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
              <div className="w-[95%] md:w-[76%]" style={{
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

            {/* ── Premium card grid — 95% mobile, 76% desktop ── */}
            {!libraryLoading && filteredLibrary.length > 0 && (
              <div
                className="w-[95%] md:w-[76%]"
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
                      {/* ── Main card button ── */}
                      <button
                        onClick={() => handleCardClick(lesson.id)}
                        disabled={loading}
                        style={{
                          width: "100%",
                          background: grad,
                          /* glass inner layer */
                          backgroundImage: `${grad}, linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%)`,
                          border: "1px solid rgba(255,255,255,0.09)",
                          borderRadius: "20px",
                          height: "210px",
                          padding: "1.2rem 1.3rem",
                          display: "flex", flexDirection: "column", justifyContent: "space-between",
                          textAlign: "left", cursor: loading ? "wait" : "pointer",
                          position: "relative", overflow: "hidden",
                          transition: "transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease",
                          willChange: "transform",
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
                        {/* Ghibli background thumbnail — fades in once URL is available */}
                        {lesson.background_image_url && (
                          <div style={{
                            position: "absolute", inset: 0, pointerEvents: "none",
                            backgroundImage: `url(${lesson.background_image_url})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                            opacity: 0.28,
                            filter: "saturate(1.1) brightness(0.6)",
                            borderRadius: "inherit",
                          }} />
                        )}
                        {/* Accent glow bloom on hover */}
                        <div className="card-glow" style={{
                          position: "absolute", inset: 0, pointerEvents: "none",
                          background: `radial-gradient(ellipse 75% 50% at 50% 0%, rgba(${theme.accentRgb},0.13), transparent)`,
                          opacity: 0, transition: "opacity 0.25s ease",
                        }} />
                        {/* Fine top-edge highlight line */}
                        <div style={{
                          position: "absolute", top: 0, left: "12%", right: "12%", height: "1px", pointerEvents: "none",
                          background: `linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)`,
                        }} />

                        {/* Top row: emoji (no level badge — placed elsewhere) */}
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
                          <span style={{ fontSize: "1.9rem", lineHeight: 1, filter: "drop-shadow(0 3px 12px rgba(0,0,0,0.9))" }}>
                            {emoji}
                          </span>
                          <span style={{
                            fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.07em",
                            padding: "3px 9px", borderRadius: "999px",
                            background: `rgba(${theme.accentRgb},0.12)`,
                            border: `1px solid rgba(${theme.accentRgb},0.3)`,
                            color: theme.accent,
                            backdropFilter: "blur(8px)",
                            textTransform: "uppercase",
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
                              {/* Scene location tag */}
                              <p style={{
                                fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase",
                                color: "rgba(255,255,255,0.3)", margin: "0 0 4px",
                                fontFamily: "'Noto Sans JP', sans-serif",
                              }}>
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

                      {/* ✕ Delete — floats top-right, fades in on card-wrap hover */}
                      <button
                        className="delete-btn"
                        onClick={(e) => handleDelete(lesson.id, e)}
                        title="Delete scene"
                        style={{
                          position: "absolute", top: "10px", right: "10px", zIndex: 10,
                          width: "22px", height: "22px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          borderRadius: "6px",
                          background: "rgba(8,6,20,0.7)",
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
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          GENERATE MODAL
      ══════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════
          GENERATE MODAL (SPACIOUS VERSION)
      ══════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════
          GENERATE MODAL (700px PERFECT PROPORTIONS)
      ══════════════════════════════════════════════════════ */}
      {isGenerateModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "2rem",
            background: "rgba(4,4,14,0.85)",
            backdropFilter: "blur(12px)",
          }}
          onClick={e => { if (e.target === e.currentTarget && !isLoading) setIsGenerateModalOpen(false); }}
        >
          <div style={{
            width: "100%", maxWidth: "700px", /* Scaled to 700px */
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

            {/* Modal header - Scaled padding */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "1.8rem 2.2rem 0" }}>
              <div>
                {/* Scaled Title */}
                <h2 style={{ fontFamily: "'Noto Serif JP', serif", fontSize: "1.4rem", fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
                  Create a New Scene
                </h2>
                {/* Scaled Subtitle */}
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
                    transition: "all 0.08s ease",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#6b7a8d"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                >
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M1 1l10 10M11 1L1 11" />
                  </svg>
                </button>
              )}
            </div>

            {/* Modal body - Scaled padding and main gap */}
            <div style={{ padding: "1.5rem 2.2rem 2.2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

              {/* Textarea - Scaled internal gap */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7a8d" }}>
                  Scenario
                </label>
                <textarea
                  rows={5} /* Dropped back to 5 rows for the narrower width */
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

              {/* Level buttons - Scaled internal gap */}
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

              {/* Submit / Loading */}
              <div style={{ marginTop: "0.25rem" }}>
                {!isLoading ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!scenario.trim()}
                    style={{
                      width: "100%", padding: "14px", borderRadius: "14px", fontSize: "0.95rem", fontWeight: 600, letterSpacing: "0.05em",
                      background: scenario.trim() ? theme.accentMid : "rgba(255,255,255,0.03)",
                      border: scenario.trim() ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.06)",
                      color: scenario.trim() ? theme.accent : "#3a3a52",
                      boxShadow: scenario.trim() ? `0 0 36px ${theme.accentLow}` : "none",
                      cursor: scenario.trim() ? "pointer" : "not-allowed", transition: "all 0.08s ease",
                    }}
                    onMouseEnter={e => {
                      if (!scenario.trim()) return;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 48px ${theme.accentGlow}`;
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={e => {
                      if (!scenario.trim()) return;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 36px ${theme.accentLow}`;
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                    }}
                  >
                    ✦ Generate Scene
                  </button>
                ) : (
                  <LoadingState state={generationState} accent={theme.accent} />
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
                          fontSize: "0.8rem", padding: "7px 14px", borderRadius: "999px", background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.07)", color: "#a8b4c8", cursor: "pointer", transition: "all 0.08s ease",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#a8b4c8"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
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

      {/* ── Global styles ──────────────────────────────────────── */}
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
        .card-wrap:hover .card-glow { opacity: 1 !important; }
        /* Back button: flush on mobile, pulled left on desktop */
        @media (min-width: 768px) {
          .back-btn { transform: translateX(-300px); }
        }
        * { box-sizing: border-box; }
        ::placeholder { color: #2a2a3a; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.09); border-radius: 2px; }
      `}</style>
    </main>
  );
}

// ============================================================
// SECTION 6: SUB-COMPONENTS
// ============================================================

function LoadingState({ state, accent }: { state: GenerationState; accent: string }) {
  const isCalling = state === "calling_api";
  const isWaiting = state === "waiting_for_audio";

  return (
    <div style={{
      width: "100%", padding: "18px",
      borderRadius: "12px",
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
      <p style={{ color: accent, fontSize: "0.84rem", fontWeight: 500, letterSpacing: "0.03em", margin: 0, fontFamily: "'Noto Sans JP', sans-serif" }}>
        {isCalling && "AI is writing the script…"}
        {isWaiting && "Local PC is rendering voicelines…"}
      </p>
      <p style={{ color: "#2a2a3a", fontSize: "0.72rem", margin: 0 }}>
        {isCalling && "Generating dialogue, vocabulary & grammar"}
        {isWaiting && "This can take 30–90 seconds depending on scene length"}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
        <StepDot label="Script" done={!isCalling} active={isCalling} accent={accent} />
        <div style={{ width: "24px", height: "1px", background: "rgba(255,255,255,0.08)" }} />
        <StepDot label="Audio"  done={false}      active={isWaiting} accent={accent} />
        <div style={{ width: "24px", height: "1px", background: "rgba(255,255,255,0.08)" }} />
        <StepDot label="Ready"  done={false}      active={false}     accent={accent} />
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

// ============================================================
// SECTION 7: EXAMPLE SCENARIOS
// ============================================================

const EXAMPLE_SCENARIOS = [
  {
    label: "☕ Café order",
    scenario: "A shy student orders their first coffee at a Tokyo café and nervously asks the barista for a recommendation.",
    level: "Beginner",
  },
  {
    label: "🚃 Lost on the train",
    scenario: "A tourist realizes they boarded the wrong train and asks a salaryman for help finding the correct platform.",
    level: "Intermediate",
  },
  {
    label: "🏮 Summer festival",
    scenario: "Two old friends reunite at a summer festival and reminisce about their school days while watching the fireworks.",
    level: "Advanced",
  },
  {
    label: "🎮 Arcade rivals",
    scenario: "Two competitive gamers meet at an arcade and challenge each other to a fighting game match.",
    level: "Intermediate",
  },
];