import { z } from "zod";

import { RussianWord } from "./word.js";

export const DictionaryInput = z.strictObject({ word: RussianWord });
export type DictionaryRequest = z.infer<typeof DictionaryInput>;

export const DictionaryMatchSource = z.enum([
  "headword",
  "inflection",
  "form-of",
]);
export type DictionaryMatchSource = z.infer<typeof DictionaryMatchSource>;

export const DictionaryExampleSource = z.enum(["wiktionary", "generated"]);
export type DictionaryExampleSource = z.infer<typeof DictionaryExampleSource>;

export const DictionaryCase = z.enum([
  "nominative",
  "genitive",
  "dative",
  "accusative",
  "instrumental",
  "prepositional",
]);
export type DictionaryCase = z.infer<typeof DictionaryCase>;

export const DictionaryNumber = z.enum(["singular", "plural"]);
export type DictionaryNumber = z.infer<typeof DictionaryNumber>;

export const DictionaryGender = z.enum(["masculine", "feminine", "neuter"]);
export type DictionaryGender = z.infer<typeof DictionaryGender>;

export const DictionaryAnimacy = z.enum(["animate", "inanimate"]);
export type DictionaryAnimacy = z.infer<typeof DictionaryAnimacy>;

export const DictionaryTense = z.enum(["present", "past", "future"]);
export type DictionaryTense = z.infer<typeof DictionaryTense>;

export const DictionaryPerson = z.enum([
  "first-person",
  "second-person",
  "third-person",
]);
export type DictionaryPerson = z.infer<typeof DictionaryPerson>;

export const DictionaryMood = z.enum([
  "indicative",
  "imperative",
  "conditional",
  "subjunctive",
]);
export type DictionaryMood = z.infer<typeof DictionaryMood>;

export const DictionaryVoice = z.enum(["active", "passive"]);
export type DictionaryVoice = z.infer<typeof DictionaryVoice>;

export const DictionaryDegree = z.enum([
  "positive",
  "comparative",
  "superlative",
]);
export type DictionaryDegree = z.infer<typeof DictionaryDegree>;

export const DictionaryAspect = z.enum(["perfective", "imperfective"]);
export type DictionaryAspect = z.infer<typeof DictionaryAspect>;

export const DictionaryVerbForm = z.enum([
  "infinitive",
  "participle",
  "adverbial",
]);
export type DictionaryVerbForm = z.infer<typeof DictionaryVerbForm>;

export const DictionaryGrammar = z.object({
  cases: z.array(DictionaryCase).optional(),
  numbers: z.array(DictionaryNumber).optional(),
  genders: z.array(DictionaryGender).optional(),
  animacies: z.array(DictionaryAnimacy).optional(),
  tenses: z.array(DictionaryTense).optional(),
  persons: z.array(DictionaryPerson).optional(),
  moods: z.array(DictionaryMood).optional(),
  voices: z.array(DictionaryVoice).optional(),
  degrees: z.array(DictionaryDegree).optional(),
  aspects: z.array(DictionaryAspect).optional(),
  verbForms: z.array(DictionaryVerbForm).optional(),
  shortForm: z.literal(true).optional(),
  stressed: z.literal(true).optional(),
});
export type DictionaryGrammar = z.infer<typeof DictionaryGrammar>;

export const DictionaryMatch = z.object({
  partOfSpeech: z.string().nullable(),
  form: z.string(),
  grammar: DictionaryGrammar,
  unmappedTags: z.array(z.string()),
  sources: z.array(DictionaryMatchSource),
});
export type DictionaryMatch = z.infer<typeof DictionaryMatch>;

export const DictionaryExample = z.object({
  text: z.string(),
  source: DictionaryExampleSource,
});
export type DictionaryExample = z.infer<typeof DictionaryExample>;

export const DictionarySense = z.object({
  glosses: z.array(z.string()),
  tags: z.array(z.string()),
  examples: z.array(DictionaryExample),
});
export type DictionarySense = z.infer<typeof DictionarySense>;

export const DictionaryDefinition = z.object({
  pos: z.string().nullable(),
  language: z.string(),
  senses: z.array(DictionarySense),
});
export type DictionaryDefinition = z.infer<typeof DictionaryDefinition>;

export const DictionaryResult = z.object({
  word: z.string(),
  edition: z.string(),
  matches: z.array(DictionaryMatch),
  definitions: z.array(DictionaryDefinition),
});
export type DictionaryResult = z.infer<typeof DictionaryResult>;

export const DictionaryResponse = z.object({
  query: z.string(),
  results: z.array(DictionaryResult),
});
export type DictionaryResponse = z.infer<typeof DictionaryResponse>;

export const DictionaryErrorCode = z.enum([
  "INVALID_INPUT",
  "DICTIONARY_UNAVAILABLE",
  "DICTIONARY_TIMEOUT",
  "DICTIONARY_FAILED",
]);
export type DictionaryErrorCode = z.infer<typeof DictionaryErrorCode>;

export const DictionaryFailureError = z.strictObject({
  code: DictionaryErrorCode,
});
export type DictionaryFailureError = z.infer<typeof DictionaryFailureError>;

export const DictionaryFailure = z.strictObject({
  error: DictionaryFailureError,
});
