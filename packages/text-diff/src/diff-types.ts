import { z } from "zod";

export const MAX_CHANGE_SPANS = 256;

export const TextRange = z
  .strictObject({
    start: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    end: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .refine((range) => range.end >= range.start);
export type TextRange = z.infer<typeof TextRange>;
export const ChangeKind = z.enum([
  "insert",
  "delete",
  "replace",
  "move",
  "whitespace",
]);
export type ChangeKind = z.infer<typeof ChangeKind>;
export type ChangeGroup = {
  id: string;
  kind: ChangeKind;
  originalSpans: TextRange[];
  correctedSpans: TextRange[];
  originalRange: TextRange;
  correctedRange: TextRange;
};
export type TextRun = { range: TextRange; groupId: string | null };
export type ChangeMarker = {
  correctedOffset: number;
  groupId: string;
  kind: "deletion" | "move-source";
};
export type TextDiff = {
  groups: ChangeGroup[];
  originalRuns: TextRun[];
  correctedRuns: TextRun[];
  markers: ChangeMarker[];
};
