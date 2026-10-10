"use client";

/**
 * hooks/useTheme.ts
 * ─────────────────────────────────────────────────────────────
 * Accent and ground are two independent saved choices:
 *   accent  → localStorage "anigo-theme"   → <html data-accent="gold|sakura|cyber|crimson|spirit">
 *   ground  → localStorage "anigo-ground"  → <html data-ground="graphite|slate|charcoal">
 * Setting one never touches the other.
 *
 * The <html> attributes are the live source of truth. A tiny inline script in
 * app/layout.tsx sets them before first paint from localStorage; this hook
 * reads them through useSyncExternalStore (server snapshot = defaults, so
 * hydration is identical) and every mounted hook instance, in this tab or
 * another, updates when either choice changes.
 */

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_GROUND_NAME,
  DEFAULT_THEME_NAME,
  GROUNDS,
  GROUND_STORAGE_KEY,
  THEMES,
  THEME_STORAGE_KEY,
  type Ground,
  type Theme,
} from "@/lib/themes";

const CHANGE_EVENT = "anigo:appearance-change";

interface UseThemeReturn {
  theme: Theme;
  setTheme: (t: Theme | string) => void;
  ground: Ground;
  setGround: (g: Ground | string) => void;
}

function readAttribute(attribute: "data-accent" | "data-ground", valid: readonly string[], fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = document.documentElement.getAttribute(attribute);
  return value && valid.includes(value) ? value : fallback;
}

const THEME_NAMES = THEMES.map(t => t.name);
const GROUND_NAMES = GROUNDS.map(g => g.name);

function getAccentSnapshot() {
  return readAttribute("data-accent", THEME_NAMES, DEFAULT_THEME_NAME);
}
function getGroundSnapshot() {
  return readAttribute("data-ground", GROUND_NAMES, DEFAULT_GROUND_NAME);
}
const getServerAccent = () => DEFAULT_THEME_NAME;
const getServerGround = () => DEFAULT_GROUND_NAME;

function subscribe(notify: () => void) {
  // Another tab saved a choice: mirror it onto this document, then notify.
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY && event.newValue && THEME_NAMES.includes(event.newValue)) {
      document.documentElement.setAttribute("data-accent", event.newValue);
    } else if (event.key === GROUND_STORAGE_KEY && event.newValue && GROUND_NAMES.includes(event.newValue)) {
      document.documentElement.setAttribute("data-ground", event.newValue);
    } else if (event.key !== null) {
      return;
    }
    notify();
  };
  window.addEventListener(CHANGE_EVENT, notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, notify);
    window.removeEventListener("storage", onStorage);
  };
}

function persist(attribute: "data-accent" | "data-ground", key: string, name: string) {
  document.documentElement.setAttribute(attribute, name);
  try {
    localStorage.setItem(key, name);
  } catch {
    // Storage unavailable (private mode): the choice still applies for this visit.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useTheme(): UseThemeReturn {
  const accentName = useSyncExternalStore(subscribe, getAccentSnapshot, getServerAccent);
  const groundName = useSyncExternalStore(subscribe, getGroundSnapshot, getServerGround);

  const setTheme = useCallback((t: Theme | string) => {
    const name = typeof t === "string" ? t : t.name;
    if (THEME_NAMES.includes(name)) persist("data-accent", THEME_STORAGE_KEY, name);
  }, []);

  const setGround = useCallback((g: Ground | string) => {
    const name = typeof g === "string" ? g : g.name;
    if (GROUND_NAMES.includes(name)) persist("data-ground", GROUND_STORAGE_KEY, name);
  }, []);

  return {
    theme: THEMES.find(t => t.name === accentName) ?? THEMES[0],
    setTheme,
    ground: GROUNDS.find(g => g.name === groundName) ?? GROUNDS[0],
    setGround,
  };
}
