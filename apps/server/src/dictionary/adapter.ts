import { z } from 'zod'
import {
  DictionaryDefinition,
  DictionaryExampleSource,
  DictionaryMatch,
  type DictionaryResult,
} from '@gramota/contracts'

const ResolveMatch = DictionaryMatch.omit({ partOfSpeech: true }).extend({
  lemma: z.string().min(1),
  pos: z.string().nullable(),
})

export const ResolveResponse = z.object({ matches: z.array(ResolveMatch) })

const UpstreamExample = z.object({ text: z.string() })

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
        examples: sense.examples.map(({ text }) => ({
          text,
          source: DictionaryExampleSource.enum.wiktionary,
        })),
      })),
    })),
  }
}
