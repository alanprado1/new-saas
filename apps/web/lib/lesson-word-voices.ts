const FALLBACK_VOICES = [3, 1, 8, 14, 2, 10, 11, 13];

export function resolveJapaneseCharacterVoices(
  speakers: string[],
  cast: Record<string, number | string> = {},
  override: number | null = null,
): Record<string, number> {
  const uniqueSpeakers = [...new Set(speakers)];
  if (override !== null) {
    return Object.fromEntries(uniqueSpeakers.map(speaker => [speaker, override]));
  }
  const voices: Record<string, number> = {};
  const used = new Set<number>();
  for (const speaker of uniqueSpeakers) {
    const id = cast[speaker];
    if (typeof id === "number" && Number.isInteger(id) && !used.has(id)) {
      voices[speaker] = id;
      used.add(id);
    }
  }
  let poolIndex = 0;
  for (const speaker of uniqueSpeakers) {
    if (voices[speaker] !== undefined) continue;
    while (poolIndex < FALLBACK_VOICES.length && used.has(FALLBACK_VOICES[poolIndex])) poolIndex++;
    const id = FALLBACK_VOICES[poolIndex % FALLBACK_VOICES.length];
    voices[speaker] = id;
    used.add(id);
    poolIndex++;
  }
  return voices;
}
