export type LanguageCode = "ja" | "en";
export type LearningDirection = "ja-en" | "en-ja";
export type GenerationProvider = "gemini" | "groq";
export type TTSProvider = "voicevox" | "edge" | "kokoro" | "none";

export interface LanguageDirectionConfig {
  learningDirection: LearningDirection;
  targetLanguage: LanguageCode;
  supportLanguage: LanguageCode;
  generationProvider: GenerationProvider;
  ttsProvider: TTSProvider;
}

export interface LegacyStudyCardFields {
  kanji: string;
  reading?: string | null;
  meaning: string;
  example_jp: string;
  example_en: string;
}

export interface NeutralStudyCardFields {
  learningDirection: LearningDirection;
  targetLanguage: LanguageCode;
  supportLanguage: LanguageCode;
  targetText: string;
  targetReading?: string;
  supportText: string;
  exampleTarget: string;
  exampleSupport: string;
}

export interface LegacyLessonLineFields {
  kanji: string;
  romaji?: string | null;
  english: string;
}

export interface NeutralLessonLineFields {
  learningDirection: LearningDirection;
  targetLanguage: LanguageCode;
  supportLanguage: LanguageCode;
  targetText: string;
  targetReading?: string;
  supportText: string;
}

export interface LegacyExampleFields {
  example_jp: string;
  example_romaji?: string | null;
  example_en: string;
}

export interface NeutralExampleFields {
  learningDirection: LearningDirection;
  targetLanguage: LanguageCode;
  supportLanguage: LanguageCode;
  exampleTarget: string;
  exampleTargetReading?: string;
  exampleSupport: string;
}

export const DEFAULT_LEARNING_DIRECTION: LearningDirection = "ja-en";
export const LEARNING_DIRECTION_STORAGE_KEY = "learning_direction";

export const LEARNING_DIRECTION_CHOICES: {
  value: LearningDirection;
  label: string;
  shortLabel: string;
  flag: string;
}[] = [
  { value: "ja-en", label: "Japanese", shortLabel: "JP", flag: "🇯🇵" },
  { value: "en-ja", label: "English", shortLabel: "EN", flag: "🇺🇸" },
];

export const LANGUAGE_DIRECTIONS: Record<LearningDirection, LanguageDirectionConfig> = {
  "ja-en": {
    learningDirection: "ja-en",
    targetLanguage: "ja",
    supportLanguage: "en",
    generationProvider: "gemini",
    ttsProvider: "voicevox",
  },
  "en-ja": {
    learningDirection: "en-ja",
    targetLanguage: "en",
    supportLanguage: "ja",
    generationProvider: "groq",
    ttsProvider: "kokoro",
  },
};

export function resolveLearningDirection(
  value?: string | null,
): LearningDirection {
  return value === "en-ja" ? "en-ja" : DEFAULT_LEARNING_DIRECTION;
}

export function getLanguageDirectionConfig(
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
): LanguageDirectionConfig {
  return LANGUAGE_DIRECTIONS[learningDirection];
}

export function getStoredLearningDirection(): LearningDirection {
  if (typeof window === "undefined") return DEFAULT_LEARNING_DIRECTION;
  return resolveLearningDirection(window.localStorage.getItem(LEARNING_DIRECTION_STORAGE_KEY));
}

export function storeLearningDirection(learningDirection: LearningDirection): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LEARNING_DIRECTION_STORAGE_KEY, learningDirection);
}

export function buildDirectionProgressKey(
  cardId: string,
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
): string {
  return `${learningDirection}:${cardId}`;
}

export function legacyProgressKeyFromDirectionKey(
  cardId: string,
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
): string | null {
  return learningDirection === DEFAULT_LEARNING_DIRECTION ? cardId : null;
}

export function adaptStudyCardForDirection<T extends LegacyStudyCardFields>(
  card: T,
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
): T & NeutralStudyCardFields {
  const config = getLanguageDirectionConfig(learningDirection);

  if (learningDirection === "en-ja") {
    const targetSentence = card.example_en || card.meaning;
    const supportSentence = card.example_jp || card.kanji;

    return {
      ...card,
      learningDirection,
      targetLanguage: config.targetLanguage,
      supportLanguage: config.supportLanguage,
      targetText: targetSentence,
      targetReading: undefined,
      supportText: supportSentence,
      exampleTarget: targetSentence,
      exampleSupport: supportSentence,
    };
  }

  return {
    ...card,
    learningDirection,
    targetLanguage: config.targetLanguage,
    supportLanguage: config.supportLanguage,
    targetText: card.kanji,
    targetReading: card.reading ?? undefined,
    supportText: card.meaning,
    exampleTarget: card.example_jp,
    exampleSupport: card.example_en,
  };
}

export function adaptLessonLineForDirection<T extends LegacyLessonLineFields>(
  line: T,
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
): T & NeutralLessonLineFields {
  const config = getLanguageDirectionConfig(learningDirection);

  if (learningDirection === "en-ja") {
    return {
      ...line,
      learningDirection,
      targetLanguage: config.targetLanguage,
      supportLanguage: config.supportLanguage,
      targetText: line.english,
      targetReading: undefined,
      supportText: line.kanji,
    };
  }

  return {
    ...line,
    learningDirection,
    targetLanguage: config.targetLanguage,
    supportLanguage: config.supportLanguage,
    targetText: line.kanji,
    targetReading: line.romaji ?? undefined,
    supportText: line.english,
  };
}

export function adaptExampleForDirection<T extends LegacyExampleFields>(
  example: T,
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
): T & NeutralExampleFields {
  const config = getLanguageDirectionConfig(learningDirection);

  if (learningDirection === "en-ja") {
    return {
      ...example,
      learningDirection,
      targetLanguage: config.targetLanguage,
      supportLanguage: config.supportLanguage,
      exampleTarget: example.example_en,
      exampleTargetReading: undefined,
      exampleSupport: example.example_jp,
    };
  }

  return {
    ...example,
    learningDirection,
    targetLanguage: config.targetLanguage,
    supportLanguage: config.supportLanguage,
    exampleTarget: example.example_jp,
    exampleTargetReading: example.example_romaji ?? undefined,
    exampleSupport: example.example_en,
  };
}

export const LANGUAGE_PROVIDER_REGISTRY = {
  generation: {
    ja: "gemini",
    en: "groq",
  },
  tts: {
    ja: "voicevox",
    en: "kokoro",
  },
} as const satisfies {
  generation: Record<LanguageCode, GenerationProvider>;
  tts: Record<LanguageCode, TTSProvider>;
};
