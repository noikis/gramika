// This pass deliberately has no dependency on the initial sequence alignment.
// Enumerate optimal retained subsequences, then compare movement interpretations.
export const MAX_MOVE_WORDS = 64;
export const MAX_MOVE_STATES = 4096;
export type WordMove = { original: number[]; corrected: number[] };

export function resolveWordMoves(
  before: string[],
  after: string[],
  budget = { remaining: MAX_MOVE_STATES },
): WordMove[] {
  const size = before.length;
  if (!size || size !== after.length || size > MAX_MOVE_WORDS) return [];
  if ([...before].sort().join("\0") !== [...after].sort().join("\0")) return [];
  if (before.every((word, index) => word === after[index])) return [];
  const lengths = Array.from(
    { length: size + 1 },
    () => new Uint16Array(size + 1),
  );
  for (let i = size - 1; i >= 0; i--)
    for (let j = size - 1; j >= 0; j--)
      lengths[i][j] =
        before[i] === after[j]
          ? 1 + lengths[i + 1][j + 1]
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);

  const interpretations = new Map<string, WordMove[]>();
  const seen = new Set<string>();
  let isExhausted = false;
  let isUnresolved = false;
  function interpret(pairs: [number, number][]) {
    const signature = JSON.stringify(pairs);
    if (seen.has(signature)) return;
    seen.add(signature);
    const oldKept = new Set(pairs.map(([i]) => i));
    const newKept = new Set(pairs.map(([, j]) => j));
    const used = new Set<number>();
    const moves: WordMove[] = [];
    for (let i = 0; i < size;) {
      if (oldKept.has(i)) {
        i++;
        continue;
      }
      let runEnd = i + 1;
      while (runEnd < size && !oldKept.has(runEnd)) runEnd++;
      let found = false;
      for (let count = runEnd - i; count > 0 && !found; count--) {
        const value = before.slice(i, i + count);
        const occurrences = (words: string[]) => {
          const indices: number[] = [];
          for (let start = 0; start + count <= size; start++)
            if (value.every((word, offset) => word === words[start + offset]))
              indices.push(start);
          return indices;
        };
        const oldOccurrences = occurrences(before);
        const newOccurrences = occurrences(after);
        if (oldOccurrences.length !== 1 || newOccurrences.length !== 1)
          continue;
        const j = newOccurrences[0];
        const indices = Array.from(
          { length: count },
          (_, offset) => j + offset,
        );
        if (indices.some((index) => newKept.has(index) || used.has(index)))
          continue;
        // Offsets alone are insufficient: the phrase must cross retained words.
        if (!pairs.some(([old, next]) => old < i !== next < j)) continue;
        indices.forEach((index) => used.add(index));
        moves.push({
          original: value.map((_, offset) => i + offset),
          corrected: indices,
        });
        i += count;
        found = true;
      }
      if (!found) {
        isUnresolved = true;
        return;
      }
    }
    const moved = size - pairs.length;
    if (used.size !== moved) {
      isUnresolved = true;
      return;
    }
    interpretations.set(JSON.stringify(moves), moves);
  }
  function visit(i: number, j: number, pairs: [number, number][]) {
    if (--budget.remaining < 0) {
      isExhausted = true;
      return;
    }
    if (!lengths[i][j]) {
      interpret(pairs);
      return;
    }
    if (before[i] === after[j] && lengths[i][j] === 1 + lengths[i + 1][j + 1])
      visit(i + 1, j + 1, [...pairs, [i, j]]);
    if (isExhausted) return;
    if (lengths[i + 1][j] === lengths[i][j]) visit(i + 1, j, pairs);
    if (isExhausted) return;
    if (lengths[i][j + 1] === lengths[i][j]) visit(i, j + 1, pairs);
  }
  visit(0, 0, []);
  if (isExhausted || isUnresolved || !interpretations.size) return [];
  const values = [...interpretations.values()];
  const minimum = Math.min(...values.map((moves) => moves.length));
  const best = values.filter((moves) => moves.length === minimum);
  // Retain only movements common to every optimal interpretation.
  return best[0].filter((move) =>
    best.every((moves) =>
      moves.some(
        (candidate) => JSON.stringify(candidate) === JSON.stringify(move),
      ),
    ),
  );
}
