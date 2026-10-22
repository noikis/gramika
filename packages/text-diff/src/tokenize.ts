import type { TextRange } from "./diff-types.js";

const words = new Intl.Segmenter("ru", { granularity: "word" });
export const graphemes = new Intl.Segmenter("ru", { granularity: "grapheme" });
const sentences = new Intl.Segmenter("ru", { granularity: "sentence" });

export type Token = {
  text: string;
  range: TextRange;
  gap: TextRange;
  isWord: boolean;
};

export function tokenize(text: string): Token[] {
  const boundaries = new Set([
    text.length,
    ...Array.from(graphemes.segment(text), (part) => part.index),
  ]);
  const pieces: { start: number; end: number; isWord: boolean }[] = [];
  for (const part of words.segment(text)) {
    if (pieces.length && !boundaries.has(part.index)) {
      pieces[pieces.length - 1].end = part.index + part.segment.length;
      continue;
    }
    if (part.isWordLike || /^\s+$/u.test(part.segment))
      pieces.push({
        start: part.index,
        end: part.index + part.segment.length,
        isWord: Boolean(part.isWordLike),
      });
    else
      for (const grapheme of graphemes.segment(part.segment))
        pieces.push({
          start: part.index + grapheme.index,
          end: part.index + grapheme.index + grapheme.segment.length,
          isWord: false,
        });
  }
  const tokens: Token[] = [];
  let end = 0;
  for (const piece of pieces) {
    const value = text.slice(piece.start, piece.end);
    if (/^\s+$/u.test(value)) continue;
    tokens.push({
      text: value,
      range: { start: piece.start, end: piece.end },
      gap: { start: end, end: piece.start },
      isWord: piece.isWord,
    });
    end = piece.end;
  }
  return tokens;
}

export function sentenceRanges(text: string) {
  const result: TextRange[] = [];
  for (const line of text.matchAll(/[^\r\n\u2028\u2029]+/gu))
    for (const part of sentences.segment(line[0]))
      result.push({
        start: line.index + part.index,
        end: line.index + part.index + part.segment.length,
      });
  return result;
}
