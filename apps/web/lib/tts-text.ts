// Edge benefits from explicit readings. VoiceVox needs the kanji context to
// keep natural phrase boundaries and recognize particles such as は (wa).
export function furiganaToSpeechText(text: string, mode: "phonetic" | "surface" = "phonetic"): string {
  return text.replace(/\[(.*?)\]\((.*?)\)/g, (_, surface: string, reading: string) => {
    if (mode === "surface") return surface;
    return reading.replace(/[^\u3040-\u309F\u30A0-\u30FF]/g, "").trim()
      .replace(/[\u3041-\u3096]/g, char => String.fromCharCode(char.charCodeAt(0) + 0x60));
  });
}
