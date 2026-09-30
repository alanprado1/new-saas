"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createClient } from "@/utils/supabase/client";
import { getStudySnapshot } from "@/app/actions/study";
import { SessionDataCache } from "@/lib/session-data-cache";
import { dateKeyAtOffset } from "@/lib/study-dates";
import { updateStudyProgress, type StudySnapshot } from "@/lib/study-data";
import type { LearningDirection } from "@/lib/language";
import type { SM2State } from "@/lib/sm2";

const studyCache = new SessionDataCache<StudySnapshot>(() => window.sessionStorage);
const StudyUser = createContext<string | null | undefined>(undefined);
const CHANNEL = "study-progress-updates";
const TAB_ID = crypto.randomUUID();

export default function StudyCacheProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>();
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user.id ?? null;
      if (previousUser.current !== undefined && previousUser.current !== nextUser) studyCache.clear();
      previousUser.current = nextUser;
      setUserId(nextUser);
    });
    return () => subscription.unsubscribe();
  }, []);
  return <StudyUser.Provider value={userId}>{children}</StudyUser.Provider>;
}

export function useStudySnapshot(direction: LearningDirection) {
  const userId = useContext(StudyUser);
  const [clock, setClock] = useState(() => new Date());
  const offset = clock.getTimezoneOffset();
  const today = dateKeyAtOffset(clock, offset);
  const key = userId ? `${userId}:${direction}:${today}:${offset}` : "";
  const snapshot = useSyncExternalStore(studyCache.subscribe, () => key ? studyCache.get(key) : null, () => null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key || !userId) return;
    let cancelled = false;
    const load = async (force = false) => {
      try {
        await studyCache.load(key, async () => {
          const result = await getStudySnapshot(direction, offset);
          if (result.userId !== userId) throw new Error("Your account changed. Reopen Study to continue.");
          return result;
        }, force);
        if (!cancelled) setError("");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load your study progress.");
      }
    };
    void load(attempt > 0);
    const onFocus = () => {
      const now = new Date();
      setClock(now);
      if (dateKeyAtOffset(now, now.getTimezoneOffset()) === today && now.getTimezoneOffset() === offset) void load();
    };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
    if (channel) channel.onmessage = event => {
      if (event.data?.key === key && event.data?.source !== TAB_ID) { studyCache.markStale(key); void load(true); }
    };
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; window.removeEventListener("focus", onFocus); channel?.close(); };
  }, [key, userId, direction, offset, today, attempt]);

  return { snapshot, cacheKey: key, isFresh: Boolean(key && studyCache.isFresh(key)), error: userId === null ? "Sign in to view your progress." : error,
    retry: () => setAttempt(value => value + 1) };
}

export function cacheSavedStudyProgress(key: string, cardId: string, state: SM2State) {
  const snapshot = studyCache.get(key);
  if (!snapshot) return;
  // The review date follows the date at save time, including sessions spanning midnight.
  const now = new Date();
  studyCache.set(key, updateStudyProgress({ ...snapshot, today: dateKeyAtOffset(now, now.getTimezoneOffset()) }, cardId, state));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ key, source: TAB_ID });
    channel.close();
  }
}
