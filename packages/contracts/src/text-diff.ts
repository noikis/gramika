import type { ExplanationInput } from "./explanation.js";
import type { ChangeGroup } from "@gramota/text-diff";

export {
  diffText,
  isWhitespaceOnlyChange,
  resolveWordMoves,
} from "@gramota/text-diff";
export type {
  ChangeGroup,
  ChangeKind,
  ChangeMarker,
  TextDiff,
  TextRange,
  TextRun,
} from "@gramota/text-diff";

export function explanationSelection(
  requestId: string,
  group: ChangeGroup,
): ExplanationInput {
  return {
    version: 2,
    requestId,
    kind: group.kind,
    originalSpans: group.originalSpans,
    correctedSpans: group.correctedSpans,
    originalRange: group.originalRange,
    correctedRange: group.correctedRange,
  };
}
