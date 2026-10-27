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
    if (part.isWordLike) {
      // Intl.Segmenter keeps adjacent words joined when punctuation has no
      // surrounding whitespace (for example `готов.Проверьте`). Split only
      // unambiguous punctuation between letters; keep URL/email-like tokens,
      // decimals, abbreviations and ellipses intact.
      const segments = Array.from(graphemes.segment(part.segment));
      const protectedToken = /[:/@]/u.test(part.segment);
      const abbreviation = /^(?:\p{L}\.)+\p{L}?$/u.test(part.segment);
      const domainLike =
        /^[\p{L}\p{N}]+(?:\.[\p{L}\p{N}-]+)+$/u.test(part.segment) &&
        part.segment === part.segment.toLocaleLowerCase("ru");
      const splitAt = new Set<number>();
      if (!protectedToken && !abbreviation && !domainLike) {
        for (let index = 1; index < segments.length - 1; index++) {
          const current = segments[index].segment;
          const previous = segments[index - 1].segment;
          const next = segments[index + 1].segment;
          if (
            !/^[.,!?;:]$/u.test(current) ||
            !/^\p{L}$/u.test(previous) ||
            !/^\p{L}$/u.test(next)
          )
            continue;
          splitAt.add(index);
        }
      }
      let start = 0;
      for (let index = 0; index < segments.length; index++) {
        if (!splitAt.has(index)) continue;
        const first = segments[start], previous = segments[index - 1];
        if (first && previous)
          pieces.push({
            start: part.index + first.index,
            end: part.index + previous.index + previous.segment.length,
            isWord: true,
          });
        const punctuation = segments[index];
        pieces.push({
          start: part.index + punctuation.index,
          end: part.index + punctuation.index + punctuation.segment.length,
          isWord: false,
        });
        start = index + 1;
      }
      const first = segments[start], last = segments.at(-1);
      if (first && last)
        pieces.push({
          start: part.index + first.index,
          end: part.index + last.index + last.segment.length,
          isWord: true,
        });
    } else if (/^\s+$/u.test(part.segment))
      pieces.push({
        start: part.index,
        end: part.index + part.segment.length,
        isWord: false,
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
