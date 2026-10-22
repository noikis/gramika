import { diffArrays } from "diff";
import type {
  ChangeGroup,
  ChangeMarker,
  TextDiff,
  TextRange,
  TextRun,
} from "./diff-types.js";
import {
  MAX_MOVE_STATES,
  MAX_MOVE_WORDS,
  resolveWordMoves,
} from "./word-moves.js";
import { tokenize, sentenceRanges, graphemes, type Token } from "./tokenize.js";
import { align, MAX_COMPARISON_TOKENS, type Pair } from "./align.js";
export * from "./diff-types.js";
export { resolveWordMoves } from "./word-moves.js";

const COMPARISON_BUDGET = 65536;

type Draft = ChangeGroup & { anchor: number; sourceAnchor?: number };

export function isWhitespaceOnlyChange(original: string, corrected: string) {
  return (
    original !== corrected &&
    original.replace(/\s+/gu, " ").trim() ===
      corrected.replace(/\s+/gu, " ").trim()
  );
}

export function diffText(original: string, corrected: string): TextDiff {
  if (original === corrected) {
    const runs = original
      ? [{ range: { start: 0, end: original.length }, groupId: null }]
      : [];
    return { groups: [], originalRuns: runs, correctedRuns: runs, markers: [] };
  }
  const before = tokenize(original),
    after = tokenize(corrected);
  const drafts: Draft[] = [];
  const movedOld = new Set<Token>(),
    movedNew = new Set<Token>();
  const gapsOld = new Set<Token>(),
    gapsNew = new Set<Token>();
  const budget = { remaining: MAX_MOVE_STATES };
  function add(
    old: TextRange[],
    next: TextRange[],
    oldContext: TextRange,
    newContext: TextRange,
    kind?: ChangeGroup["kind"],
  ) {
    const draft: Draft = {
      id: "",
      kind:
        kind ?? (!old.length ? "insert" : !next.length ? "delete" : "replace"),
      originalSpans: old
        .filter((range) => range.end > range.start)
        .map((range) => ({ ...range })),
      correctedSpans: next
        .filter((range) => range.end > range.start)
        .map((range) => ({ ...range })),
      originalRange: { ...oldContext },
      correctedRange: { ...newContext },
      anchor: newContext.start,
    };
    if (draft.originalSpans.length || draft.correctedSpans.length)
      drafts.push(draft);
    return draft;
  }
  const oldSentences = sentenceRanges(original),
    newSentences = sentenceRanges(corrected);
  if (oldSentences.length === newSentences.length)
    oldSentences.forEach((range, sentenceIndex) => {
      const nextRange = newSentences[sentenceIndex];
      const oldWords = before.filter(
        (token) =>
          token.isWord &&
          token.range.start >= range.start &&
          token.range.end <= range.end,
      );
      const newWords = after.filter(
        (token) =>
          token.isWord &&
          token.range.start >= nextRange.start &&
          token.range.end <= nextRange.end,
      );
      if (oldWords.length !== newWords.length) return;
      // Isolate balanced local reorder windows; unrelated substitutions stay outside.
      for (let start = 0; start < oldWords.length; start++) {
        if (oldWords[start].text === newWords[start].text) continue;
        for (
          let end = start + 2;
          end <= Math.min(oldWords.length, start + MAX_MOVE_WORDS);
          end++
        ) {
          const old = oldWords.slice(start, end),
            next = newWords.slice(start, end);
          if (
            old
              .map((token) => token.text)
              .sort()
              .join("\0") !==
            next
              .map((token) => token.text)
              .sort()
              .join("\0")
          )
            continue;
          const moves = resolveWordMoves(
            old.map((token) => token.text),
            next.map((token) => token.text),
            budget,
          );
          if (!moves.length) break;
          for (const move of moves) {
            const oldTokens = move.original.map((index) => old[index]);
            const newTokens = move.corrected.map((index) => next[index]);
            const group = add(
              oldTokens.map((token) => token.range),
              newTokens.map((token) => token.range),
              { start: old[0].range.start, end: old.at(-1)!.range.end },
              { start: next[0].range.start, end: next.at(-1)!.range.end },
              "move",
            );
            group.sourceAnchor = oldTokens[0].range.start;
            oldTokens.forEach((token) => movedOld.add(token));
            newTokens.forEach((token) => movedNew.add(token));
          }
          // Identical separators in reordered slots are unchanged, not word edits.
          if (
            old.every(
              (token, index) =>
                original.slice(token.gap.start, token.gap.end) ===
                corrected.slice(next[index].gap.start, next[index].gap.end),
            )
          ) {
            old.forEach((token) => gapsOld.add(token));
            next.forEach((token) => gapsNew.add(token));
          }
          start = end - 1;
          break;
        }
      }
    });
  const old = before.filter((token) => !movedOld.has(token));
  const next = after.filter((token) => !movedNew.has(token));
  const matches = align(old, next, { remaining: COMPARISON_BUDGET });
  const stable = matches.map(([i, j]) => [old[i], next[j]] as const);
  function context(tokens: Token[], fallback: number): TextRange {
    return {
      start: tokens[0]?.range.start ?? fallback,
      end: tokens.at(-1)?.range.end ?? fallback,
    };
  }
  function spacing(oldTokens: Token[], newTokens: Token[], owner?: Draft) {
    const a = oldTokens
      .filter((token) => !gapsOld.has(token))
      .map((token) => token.gap)
      .filter((range) => range.end > range.start);
    const b = newTokens
      .filter((token) => !gapsNew.has(token))
      .map((token) => token.gap)
      .filter((range) => range.end > range.start);
    oldTokens.forEach((token) => gapsOld.add(token));
    newTokens.forEach((token) => gapsNew.add(token));
    function emit(oldSpans: TextRange[], newSpans: TextRange[]) {
      if (!oldSpans.length && !newSpans.length) return;
      if (owner) {
        owner.originalSpans.push(...oldSpans);
        owner.correctedSpans.push(...newSpans);
        owner.originalRange.start = Math.min(
          owner.originalRange.start,
          ...oldSpans.map((range) => range.start),
        );
        owner.correctedRange.start = Math.min(
          owner.correctedRange.start,
          ...newSpans.map((range) => range.start),
        );
      } else {
        // Visible neighboring tokens are comparison context only.
        const oldContext = context(oldTokens, oldSpans[0]?.start ?? 0);
        const newContext = context(newTokens, newSpans[0]?.start ?? 0);
        oldContext.start = Math.min(
          oldContext.start,
          ...oldSpans.map((range) => range.start),
        );
        newContext.start = Math.min(
          newContext.start,
          ...newSpans.map((range) => range.start),
        );
        add(oldSpans, newSpans, oldContext, newContext, "whitespace");
      }
    }
    if (a.length === b.length) {
      a.forEach((range, index) => {
        if (
          original.slice(range.start, range.end) !==
          corrected.slice(b[index].start, b[index].end)
        )
          emit([range], [b[index]]);
      });
    } else {
      let i = 0,
        j = 0;
      let removed: TextRange[] = [],
        added: TextRange[] = [];
      for (const part of diffArrays(
        a.map((range) => original.slice(range.start, range.end)),
        b.map((range) => corrected.slice(range.start, range.end)),
      )) {
        const count = part.value.length;
        if (part.removed) {
          removed.push(...a.slice(i, i + count));
          i += count;
        } else if (part.added) {
          added.push(...b.slice(j, j + count));
          j += count;
        } else {
          emit(removed, added);
          removed = [];
          added = [];
          i += count;
          j += count;
        }
      }
      emit(removed, added);
    }
  }
  function changed(a: Token[], b: Token[], oldAt: number, newAt: number) {
    if (!a.length && !b.length) return;
    const lexical = (tokens: Token[]) =>
      tokens
        .filter((token) => token.isWord)
        .map((token) => token.text)
        .join("");
    const isJoin =
      lexical(a) &&
      lexical(a) === lexical(b) &&
      a.every((token) => token.isWord || /^[-‐‑]$/u.test(token.text)) &&
      b.every((token) => token.isWord || /^[-‐‑]$/u.test(token.text));
    if (
      !isJoin &&
      a.length !== b.length &&
      a.length &&
      b.length &&
      a.length + b.length <= MAX_COMPARISON_TOKENS
    ) {
      // An obvious spelling edit at the edge must not absorb a nearby split/join.
      const similar = (left: Token, right: Token) => {
        if (
          !left.isWord ||
          !right.isWord ||
          /^\p{N}/u.test(left.text + right.text)
        )
          return false;
        const x = Array.from(
          graphemes.segment(left.text),
          (part) => part.segment,
        );
        const y = Array.from(
          graphemes.segment(right.text),
          (part) => part.segment,
        );
        let prefix = 0,
          suffix = 0;
        while (prefix < Math.min(x.length, y.length) && x[prefix] === y[prefix])
          prefix++;
        while (
          suffix < Math.min(x.length, y.length) - prefix &&
          x[x.length - suffix - 1] === y[y.length - suffix - 1]
        )
          suffix++;
        const MIN_SHARED_GRAPHEMES = 2,
          MIN_SHARED_FRACTION = 0.65;
        return (
          prefix + suffix >= MIN_SHARED_GRAPHEMES &&
          (prefix + suffix) / Math.max(x.length, y.length) >=
            MIN_SHARED_FRACTION
        );
      };
      if (similar(a[0], b[0])) {
        changed(a.slice(0, 1), b.slice(0, 1), oldAt, newAt);
        changed(a.slice(1), b.slice(1), oldAt, newAt);
        return;
      }
      if (similar(a.at(-1)!, b.at(-1)!)) {
        changed(a.slice(0, -1), b.slice(0, -1), oldAt, newAt);
        changed(a.slice(-1), b.slice(-1), oldAt, newAt);
        return;
      }
    }
    if (!isJoin && a.length === b.length && a.length <= MAX_COMPARISON_TOKENS) {
      a.forEach((token, index) => {
        if (token.isWord !== b[index].isWord) {
          const removed = add([token.range], [], token.range, {
            start: newAt,
            end: newAt,
          });
          const inserted = add(
            [],
            [b[index].range],
            { start: oldAt, end: oldAt },
            b[index].range,
          );
          spacing([token], [], removed);
          spacing([], [b[index]], inserted);
        } else {
          if (token.text !== b[index].text)
            add([token.range], [b[index].range], token.range, b[index].range);
          spacing([token], [b[index]]);
        }
      });
    } else {
      // Split very large coarse runs; never truncate the public span arrays.
      for (
        let i = 0;
        i < Math.max(a.length, b.length);
        i += MAX_COMPARISON_TOKENS
      ) {
        const aa = a.slice(i, i + MAX_COMPARISON_TOKENS),
          bb = b.slice(i, i + MAX_COMPARISON_TOKENS);
        const group = add(
          aa.map((token) => token.range),
          bb.map((token) => token.range),
          context(aa, oldAt),
          context(bb, newAt),
        );
        spacing(aa, bb, group);
      }
    }
  }
  let i = 0,
    j = 0;
  for (const [oldIndex, newIndex] of [
    ...matches,
    [old.length, next.length] as Pair,
  ]) {
    changed(
      old.slice(i, oldIndex),
      next.slice(j, newIndex),
      old[oldIndex]?.range.start ?? original.length,
      next[newIndex]?.range.start ?? corrected.length,
    );
    if (oldIndex < old.length) spacing([old[oldIndex]], [next[newIndex]]);
    i = oldIndex + 1;
    j = newIndex + 1;
  }
  // Gaps belonging to moved words, then terminal separators (including all-space input).
  for (const group of drafts.filter((draft) => draft.kind === "move")) {
    spacing(
      before.filter((token) =>
        group.originalSpans.some(
          (span) =>
            span.start === token.range.start && span.end === token.range.end,
        ),
      ),
      after.filter((token) =>
        group.correctedSpans.some(
          (span) =>
            span.start === token.range.start && span.end === token.range.end,
        ),
      ),
      group,
    );
  }
  const oldTail = {
    start: before.at(-1)?.range.end ?? 0,
    end: original.length,
  };
  const newTail = {
    start: after.at(-1)?.range.end ?? 0,
    end: corrected.length,
  };
  if (original.slice(oldTail.start) !== corrected.slice(newTail.start)) {
    const oldStart = before.at(-1)?.range.start ?? 0,
      newStart = after.at(-1)?.range.start ?? 0;
    add(
      [oldTail],
      [newTail],
      { start: oldStart, end: original.length },
      { start: newStart, end: corrected.length },
      "whitespace",
    );
  }
  function mappedOffset(offset: number) {
    const following = stable.find(([token]) => token.range.start >= offset);
    return following?.[1].range.start ?? corrected.length;
  }
  for (const group of drafts) {
    function merge(spans: TextRange[]) {
      const result: TextRange[] = [];
      for (const span of spans.sort((a, b) => a.start - b.start)) {
        const previous = result.at(-1);
        if (previous?.end === span.start) previous.end = span.end;
        else result.push({ ...span });
      }
      return result;
    }
    group.originalSpans = merge(group.originalSpans);
    group.correctedSpans = merge(group.correctedSpans);
    if (group.sourceAnchor !== undefined)
      group.sourceAnchor = mappedOffset(group.sourceAnchor);
    group.anchor = Math.min(
      group.correctedSpans[0]?.start ?? corrected.length,
      group.sourceAnchor ??
        (group.correctedSpans.length
          ? corrected.length
          : group.correctedRange.start),
    );
  }
  drafts.sort(
    (a, b) =>
      a.anchor - b.anchor || a.originalRange.start - b.originalRange.start,
  );
  drafts.forEach((group, index) => {
    group.id = `change-${index + 1}`;
  });
  function runs(
    text: string,
    side: "originalSpans" | "correctedSpans",
  ): TextRun[] {
    const spans = drafts
      .flatMap((group) =>
        group[side].map((range) => ({ range, groupId: group.id })),
      )
      .sort((a, b) => a.range.start - b.range.start);
    const result: TextRun[] = [];
    let offset = 0;
    for (const span of spans) {
      if (offset < span.range.start)
        result.push({
          range: { start: offset, end: span.range.start },
          groupId: null,
        });
      result.push(span);
      offset = span.range.end;
    }
    if (offset < text.length)
      result.push({
        range: { start: offset, end: text.length },
        groupId: null,
      });
    return result;
  }
  return {
    groups: drafts.map(
      ({ anchor: _anchor, sourceAnchor: _source, ...group }) => group,
    ),
    originalRuns: runs(original, "originalSpans"),
    correctedRuns: runs(corrected, "correctedSpans"),
    markers: drafts.flatMap<ChangeMarker>((group) =>
      group.kind === "move"
        ? [
            {
              correctedOffset: group.sourceAnchor!,
              groupId: group.id,
              kind: "move-source" as const,
            },
          ]
        : !group.correctedSpans.length
          ? [
              {
                correctedOffset: group.correctedRange.start,
                groupId: group.id,
                kind: "deletion" as const,
              },
            ]
          : [],
    ),
  };
}
