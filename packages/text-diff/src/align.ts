import { diffArrays } from "diff";
import type { Token } from "./tokenize.js";

export const MAX_COMPARISON_TOKENS = 256;

export type Pair = [number, number];

// Large inputs retain unique, ordered anchors before the bounded fine comparison.
export function align(
  before: Token[],
  after: Token[],
  budget: { remaining: number },
): Pair[] {
  const matches: Pair[] = [];
  function region(
    oldStart: number,
    oldEnd: number,
    newStart: number,
    newEnd: number,
  ) {
    while (
      oldStart < oldEnd &&
      newStart < newEnd &&
      before[oldStart].text === after[newStart].text
    )
      matches.push([oldStart++, newStart++]);
    const suffix: Pair[] = [];
    while (
      oldStart < oldEnd &&
      newStart < newEnd &&
      before[oldEnd - 1].text === after[newEnd - 1].text
    )
      suffix.unshift([--oldEnd, --newEnd]);
    const count = oldEnd - oldStart + newEnd - newStart;
    if (oldStart < oldEnd && newStart < newEnd) {
      if (count <= MAX_COMPARISON_TOKENS && count * count <= budget.remaining) {
        budget.remaining -= count * count;
        let i = oldStart,
          j = newStart;
        for (const part of diffArrays(
          before.slice(oldStart, oldEnd).map((token) => token.text),
          after.slice(newStart, newEnd).map((token) => token.text),
        )) {
          if (part.removed) i += part.value.length;
          else if (part.added) j += part.value.length;
          else
            for (let k = 0; k < part.value.length; k++)
              matches.push([i++, j++]);
        }
      } else {
        const occurrences = (tokens: Token[], start: number, end: number) => {
          const result = new Map<string, number>();
          for (let i = start; i < end; i++)
            result.set(tokens[i].text, result.has(tokens[i].text) ? -1 : i);
          return result;
        };
        const old = occurrences(before, oldStart, oldEnd);
        const next = occurrences(after, newStart, newEnd);
        // A monotonic subset is safe even when it is not the longest subset.
        const anchors: Pair[] = [];
        let last = newStart - 1;
        for (const [text, i] of old) {
          const j = next.get(text);
          if (i >= 0 && j !== undefined && j > last) {
            anchors.push([i, j]);
            last = j;
          }
        }
        if (!anchors.length && oldEnd - oldStart === newEnd - newStart) {
          for (let offset = 0; offset < oldEnd - oldStart; offset++)
            if (
              before[oldStart + offset].text === after[newStart + offset].text
            )
              anchors.push([oldStart + offset, newStart + offset]);
        }
        for (const [i, j] of anchors) {
          region(oldStart, i, newStart, j);
          matches.push([i, j]);
          oldStart = i + 1;
          newStart = j + 1;
        }
        if (anchors.length) region(oldStart, oldEnd, newStart, newEnd);
      }
    }
    matches.push(...suffix);
  }
  region(0, before.length, 0, after.length);
  return matches;
}
