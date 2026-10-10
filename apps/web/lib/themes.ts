/**
 * lib/themes.ts
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for the accent palette and ground palette.
 * The CSS tokens in app/globals.css carry the same values; the JS objects
 * exist for components that still read `theme.accent` and for the theme control.
 * Components should prefer CSS variables (var(--acc), rgba(var(--acc-rgb), x))
 * so a change in the dock re-themes the whole page without prop drilling.
 * No side effects, so it can be imported anywhere.
 */

export interface Theme {
  name: string;
  label: string;
  accent: string;
  accentRgb: string;
  accentMid: string;
  accentLow: string;
  accentGlow: string;
  cardBorder: string;
  gradient: string;
}

function accentTheme(name: string, label: string, accent: string, rgb: string): Theme {
  return {
    name,
    label,
    accent,
    accentRgb: rgb,
    accentMid: `rgba(${rgb},0.16)`,
    accentLow: `rgba(${rgb},0.07)`,
    accentGlow: `rgba(${rgb},0.22)`,
    cardBorder: `rgba(${rgb},0.42)`,
    gradient: "none",
  };
}

export const THEMES: Theme[] = [
  accentTheme("gold", "Gold", "#e2b752", "226,183,82"),
  accentTheme("sakura", "Sakura", "#e595b6", "229,149,182"),
  accentTheme("cyber", "Cyber", "#4dbfb1", "77,191,177"),
  accentTheme("crimson", "Crimson", "#df7357", "223,115,87"),
  accentTheme("spirit", "Spirit", "#a490ee", "164,144,238"),
];

// ── Ground (page and surface colours) ───────────────────────
export interface Ground {
  name: string;
  label: string;
  /** Page colour; used for the small swatch and the browser theme colour. */
  page: string;
  /** Control/track colour; used for the swatch in the ground list. */
  swatch: string;
}

export const GROUNDS: Ground[] = [
  { name: "graphite", label: "Graphite", page: "#1b1c1f", swatch: "#34363b" },
  { name: "slate", label: "Slate", page: "#17171d", swatch: "#30313b" },
  { name: "charcoal", label: "Charcoal", page: "#121315", swatch: "#2a2c30" },
];

export const DEFAULT_THEME_NAME = "gold";
export const DEFAULT_GROUND_NAME = "graphite";
export const THEME_STORAGE_KEY = "anigo-theme";
export const GROUND_STORAGE_KEY = "anigo-ground";

// ── Level → meaning colour (CSS variables, fixed across themes) ─
export const LEVEL_COLOURS: Record<string, string> = {
  Beginner: "var(--ok)",
  Intermediate: "var(--medal)",
  Advanced: "var(--bad)",
};

// ── Available levels ────────────────────────────────────────
export const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
export type Level = (typeof LEVELS)[number];
export type LevelFilter = "All" | Level;

// ── Example scenario pills for the generate modal ───────────
export const EXAMPLE_SCENARIOS = [
  {
    label: "Café order",
    scenario: "A shy student orders their first coffee at a Tokyo café and nervously asks the barista for a recommendation.",
    level: "Beginner",
  },
  {
    label: "Lost on the train",
    scenario: "A tourist realizes they boarded the wrong train and asks a salaryman for help finding the correct platform.",
    level: "Intermediate",
  },
  {
    label: "Summer festival",
    scenario: "Two old friends reunite at a summer festival and reminisce about their school days while watching the fireworks.",
    level: "Advanced",
  },
  {
    label: "Arcade rivals",
    scenario: "Two competitive gamers meet at an arcade and challenge each other to a fighting game match.",
    level: "Intermediate",
  },
] as const;
