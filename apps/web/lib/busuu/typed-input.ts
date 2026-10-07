// Explicit reviewed alternatives only: no kana folding, romaji conversion or internal-space removal.
export const normalizeTyped = (text: string) => text.normalize('NFKC').trim();
export const validTypedDraft = (text: unknown): text is string => typeof text === 'string' && text.length <= 100 &&
  !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(text);
export const canCheckTyped = (text: string, composing: boolean) => !composing && validTypedDraft(text) && normalizeTyped(text).length > 0;
export const isTypedCheckKey = (event: { key: string; isComposing?: boolean; keyCode?: number }, composing: boolean) =>
  event.key === 'Enter' && !composing && !event.isComposing && event.keyCode !== 229;
