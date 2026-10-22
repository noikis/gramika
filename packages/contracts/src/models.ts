import { z } from "zod";

export const DEFAULT_MODEL_ID = "google/gemma-4-26b-a4b-it";

export const DEFAULT_MODEL_NAME = "Gemma 4 26B A4B";

export const MODELS = [
  { id: DEFAULT_MODEL_ID, name: DEFAULT_MODEL_NAME },
  { id: "google/gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite" },
] as const;

export const ModelId = z.enum(MODELS.map((model) => model.id));
export type ModelId = z.infer<typeof ModelId>;

export const ModelPreference = z.strictObject({ modelId: ModelId });
