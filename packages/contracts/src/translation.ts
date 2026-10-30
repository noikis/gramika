import { z } from "zod";
import { OriginalText } from "./correction.js";

export const TranslationTarget = z.enum(["en", "fr", "ru"]);
export type TranslationTarget = z.infer<typeof TranslationTarget>;

export const TranslationSource = z.enum(["en", "fr", "ru"]);
export type TranslationSource = z.infer<typeof TranslationSource>;

export const TranslationScope = z.enum(["original", "result", "explanation"]);
export type TranslationScope = z.infer<typeof TranslationScope>;

export const TranslationInput = z.strictObject({
  text: OriginalText,
  source: TranslationSource,
  target: TranslationTarget,
  scope: TranslationScope,
});
export type TranslationRequest = z.infer<typeof TranslationInput>;

export const TranslationSuccess = z.strictObject({
  text: z.string().refine((value) => value.trim().length > 0),
  source: TranslationSource,
  target: TranslationTarget,
  scope: TranslationScope,
});
export type TranslationResult = z.infer<typeof TranslationSuccess>;

export const TranslationErrorCode = z.enum([
  "INVALID_INPUT",
  "NOT_CONFIGURED",
  "UPSTREAM_ERROR",
  "INVALID_RESPONSE",
  "TIMEOUT",
]);
export type TranslationErrorCode = z.infer<typeof TranslationErrorCode>;

export const TranslationFailure = z.strictObject({
  error: z.strictObject({ code: TranslationErrorCode }),
});
