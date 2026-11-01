import { z } from 'zod'
import {
  DictionaryDefinition,
  DictionaryExampleSource,
  DictionaryMatch,
  DictionaryForm,
  DictionaryAudioUrl,
  DictionaryDetailsResponse,
  type DictionaryResult,
} from '@gramota/contracts'

const ResolveMatch = DictionaryMatch.omit({ partOfSpeech: true }).extend({
  lemma: z.string().min(1),
  pos: z.string().nullable(),
})

export const ResolveResponse = z.object({ matches: z.array(ResolveMatch) })

const UpstreamExample = z.object({
  text: z.string(),
  ref: z.string().optional(),
  bold_text_offsets: z
    .array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]))
    .optional()
    .catch(undefined),
})

const UpstreamSense = DictionaryDefinition.shape.senses.element.extend({
  examples: z.array(UpstreamExample),
})

const UpstreamDefinition = DictionaryDefinition.omit({ language: true }).extend({
  lang_code: z.string(),
  senses: z.array(UpstreamSense),
})

export const DefinitionsResponse = z.object({
  word: z.string(),
  edition: z.string(),
  definitions: z.array(UpstreamDefinition),
})

export function groupMatches(resolved: z.infer<typeof ResolveResponse>) {
  const groups = new Map<string, DictionaryMatch[]>()
  for (const { lemma, pos, ...match } of resolved.matches) {
    const matches = groups.get(lemma) ?? []
    matches.push({ ...match, partOfSpeech: pos })
    groups.set(lemma, matches)
  }
  return groups
}

export function adaptDefinitions(
  entry: z.infer<typeof DefinitionsResponse>,
  matches: DictionaryMatch[],
): DictionaryResult {
  return {
    word: entry.word,
    edition: entry.edition,
    matches,
    definitions: entry.definitions.map(({ lang_code, ...definition }) => ({
      ...definition,
      language: lang_code,
      senses: definition.senses.map((sense) => ({
        ...sense,
        examples: sense.examples.map(({ text, ref, bold_text_offsets }) => ({
          text,
          source: DictionaryExampleSource.enum.wiktionary,
          ...(ref ? { citation: ref } : {}),
          ...(bold_text_offsets ? { highlights: exampleHighlights(text, bold_text_offsets) } : {}),
        })),
      })),
    })),
  }
}

function exampleHighlights(text: string, ranges: [number, number][]) {
  // Wiktextract uses Python string indices (Unicode code points).
  const offsets = [0]
  for (const character of text) offsets.push(offsets[offsets.length - 1] + character.length)
  let previousEnd = 0
  return ranges
    .filter(([start, end]) => start < end && end < offsets.length)
    .sort(([a], [b]) => a - b)
    .flatMap(([start, end]) => {
      if (start < previousEnd) return []
      previousEnd = end
      return [{ start: offsets[start], end: offsets[end] }]
    })
}

const UpstreamSound = z.object({
  ipa: z.string().nullable().optional(),
  mp3_url: z.string().nullable().optional(),
  ogg_url: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
})
const FullEntry = z.object({
  pos: z.string().nullable().optional(),
  forms: z.array(DictionaryForm.extend({ tags: z.array(z.string()).default([]) })).default([]),
  sounds: z.array(UpstreamSound).default([]),
})
export const FullWordResponse = z.object({
  word: z.string(),
  entries: z.array(FullEntry),
})

export function adaptDetails(payload: unknown) {
  const data = FullWordResponse.parse(payload)
  return DictionaryDetailsResponse.parse({
    word: data.word,
    entries: data.entries.map((entry) => ({
      partOfSpeech: entry.pos ?? null,
      forms: entry.forms,
      pronunciations: entry.sounds
        .map((sound) => {
          const audioUrl =
            [sound.mp3_url, sound.ogg_url].find(
              (url) => DictionaryAudioUrl.safeParse(url).success,
            ) ?? null
          return { ipa: sound.ipa ?? null, audioUrl, tags: sound.tags }
        })
        .filter((sound) => sound.ipa || sound.audioUrl),
    })),
  })
}
