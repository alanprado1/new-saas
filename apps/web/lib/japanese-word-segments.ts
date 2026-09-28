export interface JapaneseWordToken {
  surface_form: string;
  reading?: string;
  pos: string;
  pos_detail_1?: string;
  conjugated_form?: string;
}

export interface JapaneseWordSegment {
  surface: string;
  speech: string;
  clickable: boolean;
  tokens: JapaneseWordToken[];
}

export interface JapaneseWordTokenizer {
  tokenize(text: string): JapaneseWordToken[];
}

function hiragana(reading: string): string {
  return reading.replace(/[\u30a1-\u30f6]/g, character =>
    String.fromCharCode(character.charCodeAt(0) - 0x60));
}

function spokenToken(token: JapaneseWordToken): string {
  if (token.pos === "助詞") {
    if (token.surface_form === "は") return "わ";
    if (token.surface_form === "へ") return "え";
    if (token.surface_form === "を") return "お";
  }
  return token.reading && token.reading !== "*"
    ? hiragana(token.reading)
    : token.surface_form;
}

function isPunctuation(token: JapaneseWordToken): boolean {
  return token.pos === "記号" || /^[\p{P}\p{S}\s]+$/u.test(token.surface_form);
}

function joinsInflection(previous: JapaneseWordToken[], token: JapaneseWordToken): boolean {
  const last = previous[previous.length - 1];
  if (!last) return false;
  const hasPredicate = previous.some(part =>
    part.pos === "動詞" || part.pos === "形容詞" || part.pos_detail_1 === "形容動詞語幹");
  if (token.pos === "助動詞") return hasPredicate || last.pos === "助動詞";
  if (token.pos === "動詞" && token.pos_detail_1 === "非自立") return hasPredicate;
  if (token.pos_detail_1 === "接尾" && hasPredicate) return true;
  if (token.pos === "助詞" && (token.surface_form === "て" || token.surface_form === "で")) {
    return hasPredicate && (last.conjugated_form === "連用タ接続" || last.pos === "動詞" || last.pos === "形容詞");
  }
  return false;
}

export function segmentJapaneseWords(text: string, tokenizer: JapaneseWordTokenizer): JapaneseWordSegment[] {
  const segments: JapaneseWordSegment[] = [];
  for (const token of tokenizer.tokenize(text)) {
    if (isPunctuation(token)) {
      segments.push({ surface: token.surface_form, speech: "", clickable: false, tokens: [token] });
      continue;
    }
    const previous = segments[segments.length - 1];
    if (previous?.clickable && joinsInflection(previous.tokens, token)) {
      previous.tokens.push(token);
      previous.surface += token.surface_form;
      previous.speech += spokenToken(token);
      continue;
    }
    segments.push({
      surface: token.surface_form,
      speech: spokenToken(token),
      clickable: true,
      tokens: [token],
    });
  }
  return segments;
}
