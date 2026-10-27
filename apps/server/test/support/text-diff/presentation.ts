import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { Script } from 'node:vm'
import ts from 'typescript'
import type { ChangeGroup } from '@gramota/text-diff'
import type { ComponentType } from '../../../../web/node_modules/@types/react'

// React and its types belong to the web workspace; reuse them without adding server dependencies.
const webRequire = createRequire(resolve(__dirname, '../../../../web/package.json'))
const { createElement } = webRequire(
  'react',
) as typeof import('../../../../web/node_modules/@types/react')
const { renderToStaticMarkup } = webRequire(
  'react-dom/server',
) as typeof import('../../../../web/node_modules/@types/react-dom/server')

/** Test-only compiler for the actual web modules. No effects, DOM or HTTP server. */
function loadWebModule(
  filename: string,
  cache = new Map<string, { exports: Record<string, unknown> }>(),
): Record<string, unknown> {
  if (cache.has(filename)) return cache.get(filename)!.exports
  const module = { exports: {} as Record<string, unknown> }
  cache.set(filename, module)
  const localRequire = createRequire(filename)
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2023,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText
  const compiled = new Script(`(function(require,module,exports){${code}\n})`, {
    filename,
  }).runInThisContext() as (
    require: (id: string) => unknown,
    module: { exports: Record<string, unknown> },
    exports: Record<string, unknown>,
  ) => void
  compiled(
    (id) => {
      if (!id.startsWith('.')) return localRequire(id)
      const base = resolve(dirname(filename), id)
      const target = [base + '.tsx', base + '.ts', resolve(base, 'index.ts')].find((candidate) =>
        existsSync(candidate),
      )
      if (!target) throw new Error(`Cannot resolve presentation import ${id}`)
      return loadWebModule(target, cache)
    },
    module,
    module.exports,
  )
  return module.exports
}

export function renderResult(
  original: string,
  corrected: string,
  variant: 'workspace' | 'history' | 'compact' = 'workspace',
) {
  const { ResultView } = loadWebModule(
    resolve(__dirname, '../../../../web/src/components/result-view.tsx'),
  )
  return renderToStaticMarkup(
    createElement(ResultView as ComponentType<Record<string, unknown>>, {
      result: {
        originalText: original,
        correctedText: corrected,
        requestId: '00000000-0000-4000-8000-000000000000',
        mode: 'strict',
      },
      view: 'changes',
      onViewChange: () => {},
      labelId: 'result-label',
      compact: variant === 'compact',
      actions: variant === 'workspace' ? undefined : createElement('button', null, 'Copy'),
    }),
  )
}

export function renderExcerpt(
  text: string,
  range: ChangeGroup['originalRange'],
  spans: ChangeGroup['originalSpans'],
) {
  const { ComparisonExcerpt } = loadWebModule(
    resolve(__dirname, '../../../../web/src/components/comparison-excerpt.tsx'),
  )
  return renderToStaticMarkup(
    createElement(ComparisonExcerpt as ComponentType<Record<string, unknown>>, {
      text,
      range,
      spans,
      empty: 'Empty',
    }),
  )
}
