import { z } from "zod";

export const SURROUNDING_PUNCTUATION_PATTERN = /^[\s\p{P}]+|[\s\p{P}]+$/gu;
export const RUSSIAN_WORD_PATTERN =
  /^(?:[а-яё]\u0301?)+(?:-(?:[а-яё]\u0301?)+)*$/iu;

export const RussianWord = z
  .string()
  .transform((word) => word.replace(SURROUNDING_PUNCTUATION_PATTERN, ""))
  .refine((word) => RUSSIAN_WORD_PATTERN.test(word));
