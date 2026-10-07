export type CourseLevelId = 'A1' | 'A2' | 'B1' | 'B2';
export type EvidenceRef = {
  sourceId: string; packagedPath: string; sourceHash: string;
  jsonPointerOrHeading: string; classification: 'O' | 'M' | 'I' | 'P' | 'U';
};
export type ContentField<T> = {
  value: T | null;
  availability: 'available' | 'partial' | 'missing' | 'unknown' | 'inapplicable';
  origin: 'source_observation' | 'map_paraphrase' | 'app_authored' | 'test_fixture' | 'unknown';
  evidence: EvidenceRef[];
};
export type CourseEntry = {
  id: string; kind: 'teaching_review_card' | 'checkpoint' | 'certificate_entry';
  cardOrder: number | null; afterCardOrder: number | null;
  recordedSourceLabel: string | null;
  sourceLabel: ContentField<string>; mappedObjective: ContentField<string>;
  evidenceDepth: string; evidence: EvidenceRef[];
};
export type CourseChapter = { id: string; number: number; label: string; entries: CourseEntry[] };
export type CourseLevel = { id: CourseLevelId; name: string; chapters: CourseChapter[] };
export type CourseInventory = { version: string; courseId: string; title: string; levels: CourseLevel[] };
export type ActivitySpec = {
  activityId: string; ordinal: number; sourceActivityIds: string[];
  baseScreenCount: number | null; screenIds: string[];
};
export type AnswerSpec =
  | { kind: 'multi_choice'; options: { id: string; text: string; secondary?: string }[]; acceptedOptionIds: string[]; requiredCount: number; grading: 'exact_set' }
  | { kind: 'typed'; acceptedForms: string[]; normalization: 'nfkc_trim' }
  | { kind: 'choice'; options: { id: string; text: string; secondary?: string }[]; acceptedOptionIds: string[] }
  | { kind: 'truth'; accepted: boolean }
  | { kind: 'ordered_slots'; slots: { id: string; acceptedTokenIds: string[] }[]; tokens: { id: string; text: string }[] }
  | { kind: 'pairs'; pairs: { id: string; leftId: string; rightId: string }[] }
  | { kind: 'ordered_tokens'; tokens: { id: string; text: string }[]; acceptedOrders: string[][] };
export type ScreenSpec = {
  screenId: string; baseOrdinal: number; activityOrdinal: number; ordinalInActivity: number;
  sourceScreenId: string | null; sourceExerciseNumber: number | null; sourceActivityId: string | null;
  rendererId: string | null; sourceRendererId: string | null; rawRenderer: string | null; purpose: string | null;
  sourceReference: Record<string, unknown> | null;
  rawSupport: Record<string, unknown>; rawResponseSlotCount: number | null;
  responseSlotCountState: string; rawMedia: unknown; rawMediaStructure: unknown;
  rawGradingObserved: unknown; rawFeedbackParaphrase: string | null;
  prompt: ContentField<string>; modelOrScaffold: ContentField<unknown>;
  answerSpec: ContentField<AnswerSpec>; feedback: ContentField<unknown>;
  submission: ContentField<string>; evidence: EvidenceRef[];
  baselineAudit: {
    readiness: { blocking_requirements: string[] }; [field: string]: unknown;
  } | null;
  liveObservation: {
    media: { observed_modality: string; usable_media_location: string | null; [field: string]: unknown };
    [field: string]: unknown;
  } | null;
};
export type LessonSpec = {
  contentPack?: LessonContentPack;
  recordId: string; contentVersion: string; baseScreenCount: number | null;
  sequenceState: string; evidenceDepth: string; evidence: EvidenceRef[];
  activities: ActivitySpec[]; screens: ScreenSpec[];
  curriculum: {
    objective: string | null; grammarTargets: string[]; vocabularyCategories: string[];
    newConceptIds: string[]; priorConceptIds: string[];
  };
  dependencies: { recordId: string; conceptId: string; classification: string; sourceEnforced: boolean | null; note: string }[];
  optionalProduction: { endpointOptional: boolean; coreTeachingScreenCount: number } | null;
};
export type ReadinessGap = { screenId: string | null; field: string; reason: string };
export type ReadinessReport = {
  structure: { navigationReady: boolean; lessonSequenceComplete: boolean; knownScreenRows: number; expectedBaseScreens: number | null; authoredScreenRows?: number };
  textAnswers: { complete: boolean; gaps: ReadinessGap[] };
  media: { ready: boolean; visualsDeferred: true; gaps: ReadinessGap[]; replacementPolicy: string };
  audio: { ready: boolean; requiredScreens: number; gaps: ReadinessGap[]; delivery: string };
  runnerAvailable: boolean; scoredLaunchReady: boolean; previewAvailable: boolean;
};

export type SupportBlock = { kind: 'japanese' | 'translation' | 'explanation'; text: string; secondary?: string };
export type PairItem = { id: string; text: string; secondary?: string };
export type LessonContentScreen = {
  screenId: string;
  renderer: 'model' | 'kanji' | 'table' | 'dialogue' | 'truth' | 'pairs' | 'gaps' | 'choice' | 'multi_choice' | 'ordering' | 'typed';
  prompt: string | null;
  truthMode?: 'supported' | 'audio_only';
  fixedPrefix?: string;
  typed?: { label: string; before: string; after: string };
  kanji?: { character: string; shapeNote: string; meaning: string;
    readings: { text: string; note: string }[];
    examples: { word: string; reading: string; meaning: string; sentence: string; sentenceReading: string; translation: string }[] };
  statement?: string | null;
  scaffold?: string[];
  left?: PairItem[]; right?: PairItem[];
  table?: { caption: string | null; columns: string[]; rows: { id: string; cells: (string | null)[] }[] };
  hint?: { text: string | null };
  dialogue?: { kind?: 'single_speaker'; japaneseVisible: boolean; translationVisible?: boolean; context?: string;
    glosses?: { japanese: string; reading: string; english: string }[];
    speakerLabels?: { guest: string; staff: string }; speakers: ('guest' | 'staff')[]; turns: DialogueTurn[];
    facts?: { id: string; turnId: string; text: string }[] };
  sceneContext?: { recordId: string; contentVersion: string; screenId: string; factId: string;
    expectedText: string; answerOptionId: string; access: 'review_before_launch' };
  sourceContract?: {
    purpose: string; sourceRenderer: string | null; sourceRendererId: string | null; sourceActivityId: string | null;
    sourceScreenId?: string | null;
    sourceExerciseNumber?: number | null;
    responseSlotCount: number | null; responseSlotCountState: string;
    transcriptBeforeAnswer: boolean | null; translationBeforeAnswer: boolean | null; parallelReadingBeforeAnswer?: boolean; hintBeforeAnswer: boolean;
    recordedSupport: Record<string, unknown>; feedbackCategories: string[]; targetConceptIds: string[]; priorConceptIds: string[];
    sceneReuse?: string;
    transcriptAccess?: 'scene_recap';
    feedbackTranscript?: 'omitted';
    recordedSpeakerCount?: number | null;
    feedbackTranscriptResolution?: {
      version: '1.0'; kind: 'retained_prose'; field: 'rawFeedbackParaphrase';
      quote: string; evidence: EvidenceRef;
    };
  };
  answer: AnswerSpec | null;
  support: { before: SupportBlock[]; after: SupportBlock[] };
  praise: string | null;
  audio: { required: boolean; text: string | null; feedbackText?: string; reading?: string; beforeAnswer?: boolean };
  visual: 'video' | 'image' | 'none';
  evidence: EvidenceRef[];
  unresolved: ReadinessGap[];
};
export type DialogueTurn = { id: string; speaker: 'guest' | 'staff'; japanese: string | null; english: string | null; reading?: string };
export type OptionalProductionSurface = {
  screenId: string; sourceExerciseNumber: number | null; sourceActivityId: string | null;
  purpose: string; prompt: string; hint: string; modes: ('write')[];
  provenance: { origin: 'app_authored'; note: string };
};
export type LessonContentPack = {
  schemaVersion: '1.0' | '1.1'; contentVersion: string; recordId: string;
  status: 'reviewed' | 'development_preview'; baseScreenCount: number;
  screens: LessonContentScreen[];
  completion?: { contractVersion: '1.0'; requiredScreenIds: string[]; optionalSurfaces: OptionalProductionSurface[] };
  passPolicy?: { kind: 'none' } | { kind: 'accuracy_threshold'; minimumPercent: number };
  retryPolicy?: { kind: 'end_once' | 'after_activity_once'; screenIds: string[] };
  structuralContract?: {
    version: '1.0'; kind: 'summary_authored'; origin: 'app_authored';
    review: { status: 'reviewed'; note: string };
    activities: ActivitySpec[];
    tasks: { screenId: string; responseCount: number }[];
  };
  provenance: { origin: 'source_observation' | 'app_authored'; note: string };
  policies: { assessment: string; incorrectResponses: string; audio: string; visuals: string };
  unresolvedSourceFacts: string[];
};
