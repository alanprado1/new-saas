"use client";

/**
 * app/library/page.tsx  ─  Scene library
 * ─────────────────────────────────────────────────────────────
 * The scene library grid and the generate dialog (moved here from the old
 * dashboard at "/", which is now Home).
 * Lesson reading → /lesson/[id]     (ScenePlayer unmounts cleanly)
 * Voice chat     → /voicechat       (AvatarChat unmounts cleanly)
 *
 * Separate routes keep ScenePlayer and AvatarChat from mounting Howl/AudioContext
 * instances side by side, which caused an audio-echo bug when they shared one tree.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, ensureSession } from "@/lib/supabase";
import { LEVELS, EXAMPLE_SCENARIOS, type Level, type LevelFilter } from "@/lib/themes";
import { cacheLibrary, fetchLibrary, getCachedLibrary, isDevEmail, type LibraryLesson } from "@/lib/lesson";
import {
  DEFAULT_LEARNING_DIRECTION,
  LEARNING_DIRECTION_CHOICES,
  getStoredLearningDirection,
  storeLearningDirection,
  type LearningDirection,
} from "@/lib/language";
import type { VoiceEntry } from "@/components/ScenePlayer";
import AppShell from "@/components/shell/AppShell";
import SceneCard, { SceneDeleteButton } from "@/components/shell/SceneCard";
import { CheckIcon, ChevronDownIcon, CloseIcon, PlusIcon } from "@/components/shell/icons";
import styles from "./library.module.css";

// ============================================================
// TYPES
// ============================================================

type GenerationState =
  | "idle"
  | "calling_api"
  | "waiting_for_audio"
  | "ready"
  | "error";

type ImageProvider = "pollinations" | "gemini";

// ============================================================
// PAGE
// ============================================================

export default function LibraryPage() {
  const router = useRouter();

  // ── Generation form ─────────────────────────────────────
  const [scenario, setScenario]               = useState("");
  const [level, setLevel]                     = useState<Level>("Beginner");
  const [learningDirection, setLearningDirection] = useState<LearningDirection>(DEFAULT_LEARNING_DIRECTION);
  const [generationState, setGenerationState] = useState<GenerationState>("idle");
  const [errorMessage, setErrorMessage]       = useState("");
  const [pendingLessonId, setPendingLessonId] = useState<string | null>(null);
  const [imageProvider, setImageProvider]     = useState<ImageProvider>("pollinations");
  const [imageModel, setImageModel]           = useState("klein");

  // ── Library ─────────────────────────────────────────────
  const [library, setLibrary]               = useState<LibraryLesson[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [levelFilter, setLevelFilter]       = useState<LevelFilter>("All");
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null);
  const [isDevUser, setIsDevUser]           = useState(false);
  const [libraryScope, setLibraryScope]     = useState<"mine" | "all">("mine");

  // ── UI ───────────────────────────────────────────────────
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen]   = useState(false);
  const [cardLoadingId, setCardLoadingId]             = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId]       = useState<string | null>(null);
  const [actionNotice, setActionNotice]               = useState("");
  const [availableVoices, setAvailableVoices]         = useState<VoiceEntry[]>([]);

  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const hasCachedLibraryRef = useRef(false);
  const generationInFlightRef = useRef(false);

  // ── Bootstrap auth + data ─────────────────────────────
  const refreshLibrary = useCallback(async () => {
    if (!hasCachedLibraryRef.current) setLibraryLoading(true);
    try {
      const data = await fetchLibrary({ includeAll: isDevUser && libraryScope === "all" });
      cacheLibrary(data);
      setLibrary(data);
      hasCachedLibraryRef.current = true;
    } catch { /* silent */ }
    setLibraryLoading(false);
  }, [isDevUser, libraryScope]);

  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/study");
    router.prefetch("/voicechat");
  }, [router]);

  useEffect(() => {
    const cachedLibrary = getCachedLibrary();
    if (!cachedLibrary) return;

    setLibrary(cachedLibrary);
    setLibraryLoading(false);
    hasCachedLibraryRef.current = true;
  }, []);

  useEffect(() => {
    const savedY = window.sessionStorage.getItem("dashboard:scrollY");
    if (!savedY) return;
    window.requestAnimationFrame(() => window.scrollTo(0, Number(savedY) || 0));
  }, []);

  useEffect(() => {
    return () => {
      window.sessionStorage.setItem("dashboard:scrollY", String(window.scrollY));
    };
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
        const { data: { user } } = await supabase.auth.getUser();
        const dev = isDevEmail(user?.email);
        setCurrentUserId(user?.id ?? null);
        setIsDevUser(dev);
        if (!dev) setLibraryScope("mine");
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

  useEffect(() => {
    setLearningDirection(getStoredLearningDirection());
  }, []);

  // ── Language menu: outside-click and Escape close ───────
  useEffect(() => {
    if (!isLanguageMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(e.target as Node))
        setIsLanguageMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsLanguageMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isLanguageMenuOpen]);

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

    const pendingLessonTable = learningDirection === "en-ja" ? "english_lessons" : "lessons";

    // Realtime channel
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`lesson-${pendingLessonId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: pendingLessonTable, filter: `id=eq.${pendingLessonId}` },
        (payload) => {
          const updated = payload.new as { status: string; id: string; error_message?: string | null };
          if (updated.status === "ready")  settle(pendingLessonId);
          if (updated.status === "failed") {
            settleError(updated.error_message || "Audio generation failed on the worker. Please try again.");
          }
        }
      )
      .subscribe();
    channelRef.current = channel;

    // Polling fallback every 2 s
    const poll = setInterval(async () => {
      if (settled) { clearInterval(poll); return; }
      try {
        const { data } = await supabase
          .from(pendingLessonTable)
          .select("status, error_message")
          .eq("id", pendingLessonId)
          .single();
        if (data?.status === "ready")  { clearInterval(poll); settle(pendingLessonId); }
        if (data?.status === "failed") {
          clearInterval(poll);
          settleError(data.error_message || "Audio generation failed on the worker. Please try again.");
        }
      } catch { /* network hiccup */ }
    }, 2000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [pendingLessonId, generationState, learningDirection, router]);

  // ── handleSubmit ─────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!scenario.trim() || generationInFlightRef.current) return;
    generationInFlightRef.current = true;
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
        body: JSON.stringify({
          scenario: scenario.trim(),
          level,
          learning_direction: learningDirection,
          available_voices: availableVoices,
          image_provider: learningDirection === "en-ja" ? "pollinations" : imageProvider,
          image_model: learningDirection === "en-ja" ? "klein" : imageModel.trim() || "klein",
        }),
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
    } finally {
      generationInFlightRef.current = false;
    }
  }, [scenario, level, learningDirection, availableVoices, imageProvider, imageModel, router]);

  // ── handleCardClick ──────────────────────────────────────
  const handleCardClick = useCallback((lessonId: string) => {
    setCardLoadingId(lessonId);
    window.sessionStorage.setItem("dashboard:scrollY", String(window.scrollY));
    router.push(`/lesson/${lessonId}`);
  }, [router]);

  // ── handleDelete ─────────────────────────────────────────
  const handleDelete = useCallback(async (lessonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingLessonId || !window.confirm("Delete this scene? This cannot be undone.")) return;
    setDeletingLessonId(lessonId);
    setActionNotice("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/generate?lesson_id=${lessonId}`, {
        method: "DELETE",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error("Could not delete the scene. Please try again.");
      setLibrary(prev => prev.filter(lesson => lesson.id !== lessonId));
      setActionNotice("Scene deleted.");
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "Could not delete the scene. Please try again.");
    } finally {
      setDeletingLessonId(null);
    }
  }, [deletingLessonId]);

  const openGenerateModal = useCallback(() => {
    if (generationState !== "calling_api" && generationState !== "waiting_for_audio") {
      setGenerationState("idle");
      setErrorMessage("");
      setScenario("");
    }
    setIsGenerateModalOpen(true);
  }, [generationState]);

  const isLoading = generationState === "calling_api" || generationState === "waiting_for_audio";

  // "/library?new=1" (a New scene link from elsewhere) opens the generate dialog once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;
    params.delete("new");
    const rest = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
    openGenerateModal();
    // Runs once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes the generate dialog unless a scene is being generated.
  useEffect(() => {
    if (!isGenerateModalOpen || isLoading) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsGenerateModalOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isGenerateModalOpen, isLoading]);

  const filteredLibrary = library.filter(lesson =>
    lesson.learning_direction === learningDirection
    && (levelFilter === "All" || lesson.level === levelFilter)
  );
  const selectedLanguageChoice =
    LEARNING_DIRECTION_CHOICES.find(choice => choice.value === learningDirection)
    ?? LEARNING_DIRECTION_CHOICES[0];
  const countLabel = libraryLoading
    ? "Loading…"
    : [
        `${filteredLibrary.length} ${filteredLibrary.length === 1 ? "scene" : "scenes"}`,
        selectedLanguageChoice.label,
        libraryScope === "all" ? "all users" : null,
      ].filter(Boolean).join(" · ");

  useEffect(() => {
    filteredLibrary.slice(0, 12).forEach(lesson => router.prefetch(`/lesson/${lesson.id}`));
  }, [filteredLibrary, router]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <AppShell active="library">
      <div className={styles.lib}>

        {/* ── Header ─────────────────────────────────────────── */}
        <header className={styles.head}>
          <div className={styles.title}>
            <h1>Scene library</h1>
            <p>{countLabel}</p>
          </div>

          <div className={styles.tools}>
            {isDevUser && (
              <div className={styles.seg} role="group" aria-label="Whose scenes">
                {([
                  ["mine", "Mine + shared"],
                  ["all", "All users"],
                ] as const).map(([scope, label]) => (
                  <button
                    key={scope}
                    type="button"
                    aria-pressed={libraryScope === scope}
                    onClick={() => setLibraryScope(scope)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className={styles.seg} role="group" aria-label="Level">
              {(["All", ...LEVELS] as LevelFilter[]).map(lf => (
                <button
                  key={lf}
                  type="button"
                  aria-pressed={levelFilter === lf}
                  onClick={() => setLevelFilter(lf)}
                >
                  {lf}
                </button>
              ))}
            </div>

            {/* Learning language */}
            <div ref={languageMenuRef} className={styles.menuWrap}>
              <button
                type="button"
                className={styles.langButton}
                onClick={() => setIsLanguageMenuOpen(v => !v)}
                aria-haspopup="true"
                aria-expanded={isLanguageMenuOpen}
                aria-label={`Learning language: ${selectedLanguageChoice.label}`}
                title="Choose learning language"
              >
                <span className={styles.langCode} aria-hidden="true">{selectedLanguageChoice.shortLabel}</span>
                {selectedLanguageChoice.label}
                <ChevronDownIcon />
              </button>

              {isLanguageMenuOpen && (
                <div className={styles.menu} role="group" aria-label="Learning language">
                  {LEARNING_DIRECTION_CHOICES.map(choice => {
                    const active = choice.value === learningDirection;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        className={styles.menuItem}
                        aria-current={active ? "true" : undefined}
                        onClick={() => {
                          setLearningDirection(choice.value);
                          storeLearningDirection(choice.value);
                          setIsLanguageMenuOpen(false);
                        }}
                      >
                        <span className={styles.langCode} aria-hidden="true">{choice.shortLabel}</span>
                        {choice.label}
                        {active && <CheckIcon />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button type="button" onClick={openGenerateModal} className={`${styles.primary} press-feedback`}>
              <PlusIcon />
              New scene
            </button>
          </div>
        </header>

        {actionNotice && (
          <p role="status" className={`${styles.notice} ${actionNotice === "Scene deleted." ? "" : styles.noticeError}`}>
            {actionNotice}
          </p>
        )}

        {/* Loading skeletons */}
        {libraryLoading && (
          <div className={styles.grid} aria-hidden="true">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={styles.skeleton} style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!libraryLoading && filteredLibrary.length === 0 && (
          <div className={styles.empty}>
            <p>
              {levelFilter === "All"
                ? `No ${selectedLanguageChoice.label.toLowerCase()} scenes yet.`
                : `No ${selectedLanguageChoice.label.toLowerCase()} ${levelFilter} scenes yet.`}
            </p>
            <button type="button" onClick={openGenerateModal} className={styles.primary}>
              Generate scene
            </button>
          </div>
        )}

        {/* Card grid */}
        {!libraryLoading && filteredLibrary.length > 0 && (
          <div className={styles.grid}>
            {filteredLibrary.map(lesson => (
              <SceneCard
                key={lesson.id}
                lesson={lesson}
                loading={cardLoadingId === lesson.id}
                onOpen={() => handleCardClick(lesson.id)}
                actions={lesson.user_id === currentUserId ? (
                  <SceneDeleteButton
                    deleting={deletingLessonId === lesson.id}
                    disabled={Boolean(deletingLessonId)}
                    onClick={e => handleDelete(lesson.id, e)}
                  />
                ) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          GENERATE DIALOG
      ══════════════════════════════════════════════════════ */}
      {isGenerateModalOpen && (
        <div
          className={styles.scrim}
          onClick={e => { if (e.target === e.currentTarget && !isLoading) setIsGenerateModalOpen(false); }}
        >
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="generate-title">
            <div className={styles.dialogHead}>
              <div>
                <h2 id="generate-title">Create a new scene</h2>
                <p>Describe a scenario. AI writes and voices the scene.</p>
              </div>
              {!isLoading && (
                <button type="button" className={styles.close} onClick={() => setIsGenerateModalOpen(false)} aria-label="Close">
                  <CloseIcon />
                </button>
              )}
            </div>

            <div className={styles.dialogBody}>

              {/* Textarea */}
              <div className={styles.field}>
                <label htmlFor="scenario" className={styles.label}>Scenario</label>
                <textarea
                  id="scenario"
                  className={styles.textarea}
                  rows={5}
                  placeholder="e.g. Ordering ramen for the first time and asking the chef what the special is..."
                  value={scenario}
                  onChange={e => setScenario(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {/* Level */}
              <div className={styles.field}>
                <span className={styles.label} id="level-label">
                  {learningDirection === "ja-en" ? "JLPT level" : "Level"}
                </span>
                <div className={styles.choices} role="group" aria-labelledby="level-label">
                  {LEVELS.map(l => (
                    <button
                      key={l}
                      type="button"
                      className={styles.choice}
                      aria-pressed={level === l}
                      onClick={() => setLevel(l)}
                      disabled={isLoading}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {isDevUser && learningDirection === "ja-en" && (
                <div className={styles.field}>
                  <span className={styles.label} id="provider-label">Image provider</span>
                  <div className={styles.choices} role="group" aria-labelledby="provider-label">
                    {(["pollinations", "gemini"] as ImageProvider[]).map(provider => (
                      <button
                        key={provider}
                        type="button"
                        className={styles.choice}
                        aria-pressed={imageProvider === provider}
                        onClick={() => setImageProvider(provider)}
                        disabled={isLoading}
                      >
                        {provider === "pollinations" ? "Pollinations" : "Gemini"}
                      </button>
                    ))}
                  </div>
                  {imageProvider === "pollinations" && (
                    <input
                      className={styles.input}
                      value={imageModel}
                      onChange={e => setImageModel(e.target.value)}
                      disabled={isLoading}
                      placeholder="klein"
                      aria-label="Image model"
                      spellCheck={false}
                    />
                  )}
                </div>
              )}

              {/* Error */}
              {generationState === "error" && errorMessage && (
                <div role="alert" className={styles.error}>
                  {errorMessage}
                </div>
              )}

              {/* Submit / loading */}
              {!isLoading ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!scenario.trim()}
                  className={`${styles.primary} ${styles.submit} press-feedback`}
                >
                  Generate scene
                </button>
              ) : (
                <GenerationProgress state={generationState} />
              )}

              {/* Example pills */}
              {(generationState === "idle" || generationState === "error") && (
                <div className={styles.examples}>
                  <p>Try one of these</p>
                  <div className={styles.chips}>
                    {EXAMPLE_SCENARIOS.map(ex => (
                      <button
                        key={ex.scenario}
                        type="button"
                        className={styles.chip}
                        onClick={() => { setScenario(ex.scenario); setLevel(ex.level as Level); }}
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
    </AppShell>
  );
}

// ── Generation progress widget ──────────────────────────────
function GenerationProgress({ state }: { state: GenerationState }) {
  const isCalling = state === "calling_api";
  const isWaiting = state === "waiting_for_audio";

  return (
    <div role="status" aria-live="polite" className={styles.progress}>
      <div className={styles.dots} aria-hidden="true">
        <i /><i /><i />
      </div>
      <strong>
        {isCalling && "AI is writing the script…"}
        {isWaiting && "Worker is rendering voicelines…"}
      </strong>
      <span>
        {isCalling && "Generating dialogue, vocabulary & grammar"}
        {isWaiting && "This can take 30–90 s depending on scene length"}
      </span>
      {/* Step indicator */}
      <div className={styles.steps}>
        <StepDot label="Script" state={!isCalling ? "done" : "active"} />
        <div className={styles.stepLine} />
        <StepDot label="Audio" state={isWaiting ? "active" : "idle"} />
        <div className={styles.stepLine} />
        <StepDot label="Ready" state="idle" />
      </div>
    </div>
  );
}

function StepDot({ label, state }: { label: string; state: "idle" | "active" | "done" }) {
  return (
    <div className={styles.step} data-state={state}>
      <i />
      <small>{label}</small>
    </div>
  );
}
