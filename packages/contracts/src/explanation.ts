import { RequestMetrics } from "./request-metrics.js";
import { z } from "zod";
import { ErrorCode } from "./correction.js";
import { ChangeKind, TextRange, MAX_CHANGE_SPANS } from "@gramota/text-diff";

// Half-open UTF-16 offsets match JavaScript strings and the local diff.
export const ExplanationRange = TextRange;

export const HistoricalExplanationSelection = z.strictObject({
  requestId: z.uuid(),
  originalRange: ExplanationRange,
  correctedRange: ExplanationRange,
});
export type HistoricalExplanationSelection = z.infer<
  typeof HistoricalExplanationSelection
>;
export const ExplanationInput = z
  .strictObject({
    version: z.literal(2),
    requestId: z.uuid(),
    kind: ChangeKind,
    originalSpans: z.array(ExplanationRange).max(MAX_CHANGE_SPANS),
    correctedSpans: z.array(ExplanationRange).max(MAX_CHANGE_SPANS),
    originalRange: ExplanationRange,
    correctedRange: ExplanationRange,
  })
  .refine(
    (selection) =>
      selection.originalSpans.length + selection.correctedSpans.length > 0,
  );
export type ExplanationInput = z.infer<typeof ExplanationInput>;

export function explanationSelectionKey(selection: ExplanationInput) {
  const range = (value: { start: number; end: number }) => [
    value.start,
    value.end,
  ];
  return JSON.stringify([
    selection.version,
    selection.kind,
    selection.originalSpans.map(range),
    selection.correctedSpans.map(range),
    range(selection.originalRange),
    range(selection.correctedRange),
  ]);
}
export const RecordedExplanationSelection = z.union([
  ExplanationInput,
  HistoricalExplanationSelection,
]);
export type RecordedExplanationSelection = z.infer<
  typeof RecordedExplanationSelection
>;

export const ExplanationSuccess = z.strictObject({
  selection: ExplanationInput,
  explanation: z.string().refine((text) => text.trim().length > 0),
});
export type ExplanationResult = z.infer<typeof ExplanationSuccess>;
export const ExplanationLookup = z.strictObject({
  result: ExplanationSuccess.nullable(),
});
export const ExplanationFailure = z.strictObject({
  error: z.strictObject({ code: ErrorCode, message: z.string() }),
});
export const EXPLANATION_ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: "This correction is unavailable for explanation.",
  PAYLOAD_TOO_LARGE: "The explanation request is too large.",
  NOT_CONFIGURED: "Explanation generation is not configured.",
  STORAGE_ERROR: "Could not load or save the explanation. Please try again.",
  UPSTREAM_ERROR: "Could not generate an explanation. Please try again.",
  INVALID_RESPONSE: "The model did not return a complete explanation.",
  REASONING_NOT_DISABLED: "The model did not respect the reasoning setting.",
  TIMEOUT: "Explanation timed out. You can try again.",
};

export const ExplanationAttempt = z.strictObject({
  ...RequestMetrics.shape,
  id: z.uuid(),
  selection: RecordedExplanationSelection,
  status: z.enum(["pending", "succeeded", "failed", "interrupted"]),
  errorCode: ErrorCode.nullable(),
});
export type ExplanationAttempt = z.infer<typeof ExplanationAttempt>;

export const ExplanationMetricsInput = z.strictObject({ requestId: z.uuid() });
export const ExplanationMetrics = z.strictObject({
  attempts: z.array(ExplanationAttempt),
  legacySelections: z.array(HistoricalExplanationSelection),
});

export type ExplanationMetrics = z.infer<typeof ExplanationMetrics>;
