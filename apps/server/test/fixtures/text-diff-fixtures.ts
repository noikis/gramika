import { z } from 'zod'
import { ChangeKind } from '@gramota/text-diff'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const Expectation = z.strictObject({
  count: z.number().int().nonnegative().optional(),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().nonnegative().optional(),
  kinds: z.array(ChangeKind).optional(),
  originalFragments: z.array(z.string()).optional(),
  correctedFragments: z.array(z.string()).optional(),
  unchanged: z.array(z.string()).optional(),
  marker: z.enum(['deletion', 'move-source']).optional(),
})
export const Fixture = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  original: z.string(),
  corrected: z.string(),
  category: z.enum([
    'identical',
    'spelling',
    'inflection',
    'punctuation-insert',
    'punctuation-replace',
    'whitespace',
    'separator',
    'split-join',
    'movement',
    'independent',
    'rewrite',
    'unicode',
    'boundary',
    'performance',
  ]),
  description: z.string().min(1),
  evaluation: z.enum(['confirmed', 'exploratory']),
  expectation: Expectation.default({}),
  notes: z.string().optional(),
  performance: z.boolean().optional(),
})
export type Fixture = z.infer<typeof Fixture>

function example(
  id: string,
  original: string,
  corrected: string,
  category: Fixture['category'],
  description: string,
  expectation: Fixture['expectation'] = { min: 1 },
  evaluation: Fixture['evaluation'] = 'confirmed',
): Fixture {
  return { id, original, corrected, category, description, expectation, evaluation }
}

const LENGTHS = [100, 400, 1000, 5000] as const
const exact = (pattern: string, length: number) =>
  pattern.repeat(Math.ceil(length / pattern.length)).slice(0, length)
const timingCases = LENGTHS.flatMap((length) => [
  example(
    `perf-local-${length}`,
    exact('Тестовый текст готов. ', length),
    exact('Тестовый текст готов. ', length - 1) + '!',
    'performance',
    `Local edit at ${length} UTF-16 code units.`,
    { min: 1 },
  ),
  example(
    `perf-repeat-${length}`,
    exact('кот кот пёс ', length),
    exact('пёс кот кот ', length),
    'performance',
    `Repeated words at ${length} UTF-16 code units.`,
    { min: 1 },
  ),
  example(
    `perf-rewrite-${length}`,
    exact('Старая фраза здесь. ', length),
    exact('Другая мысль рядом. ', length),
    'performance',
    `Substantial rewrite at ${length} UTF-16 code units.`,
    { min: 1 },
  ),
]).map((fixture) => ({ ...fixture, performance: true }))

export function validateFixtures(input: unknown): Fixture[] {
  const result = z.array(Fixture).min(1).safeParse(input)
  if (!result.success) {
    const issue = result.error.issues[0]
    const index = issue.path[0]
    const entry = Array.isArray(input) && typeof index === 'number' ? input[index] : undefined
    const id =
      entry && typeof entry.id === 'string'
        ? `case "${entry.id}"`
        : `case index ${String(index ?? 'unknown')}`
    throw new Error(
      `Invalid fixture ${id}, field ${issue.path.slice(1).join('.') || '(entry)'}: ${issue.message}`,
    )
  }
  const ids = new Set<string>()
  for (const fixture of result.data) {
    if (ids.has(fixture.id)) throw new Error(`Duplicate fixture ID: ${fixture.id}`)
    ids.add(fixture.id)
  }
  return result.data
}

export function loadFixtures(filename: string): Fixture[] {
  try {
    return validateFixtures(JSON.parse(readFileSync(filename, 'utf8')))
  } catch (error) {
    throw new Error(
      `Cannot load fixtures from ${filename}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

export const fixtures = validateFixtures([
  ...loadFixtures(join(__dirname, 'text-diff.json')),
  ...timingCases,
])
