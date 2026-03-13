/**
 * lib/themes.ts
 * ─────────────────────────────────────────────────────────────
 * Single source-of-truth for every visual theme and all
 * tag-to-gradient/emoji mappings.  Import from anywhere —
 * no circular-dependency risk since this file has no side-effects.
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

export const THEMES: Theme[] = [
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

// ── Background-tag → card gradient ─────────────────────────
export const TAG_GRADIENTS: Record<string, string> = {
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

// ── Background-tag → emoji icon ─────────────────────────────
export const TAG_EMOJI: Record<string, string> = {
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

// ── Level → pill colour ─────────────────────────────────────
export const LEVEL_COLOURS: Record<string, string> = {
  Beginner:     "#4ade80",
  Intermediate: "#fb923c",
  Advanced:     "#f87171",
};

// ── Available JLPT levels ───────────────────────────────────
export const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
export type Level = (typeof LEVELS)[number];
export type LevelFilter = "All" | Level;

// ── Example scenario pills for the generate modal ───────────
export const EXAMPLE_SCENARIOS = [
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
] as const;
