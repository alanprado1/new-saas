"use client";

/**
 * hooks/useTheme.ts
 * ─────────────────────────────────────────────────────────────
 * Provides the active theme and a setter that persists to localStorage.
 *
 * Always initialises to THEMES[0] so SSR and client render identically
 * (avoiding the Next.js hydration-mismatch warning). The saved theme is
 * applied in a useEffect that runs only on the client after hydration.
 */

import { useState, useEffect, useCallback } from "react";
import { type Theme, THEMES } from "@/lib/themes";

interface UseThemeReturn {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export function useTheme(): UseThemeReturn {
  // Start with THEMES[0] — identical on server and client
  const [theme, setThemeState] = useState<Theme>(THEMES[0]);

  // Apply persisted choice after hydration (client-only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("anigo-theme");
      const found = THEMES.find(t => t.name === saved);
      if (found) setThemeState(found);
    } catch {
      // localStorage unavailable (SSR / private mode) — keep default
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("anigo-theme", t.name);
    } catch {
      // Silently ignore storage errors
    }
  }, []);

  return { theme, setTheme };
}
