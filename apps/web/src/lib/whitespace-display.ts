const runs = /(?:\r\n)+| +|\t+|\n+|\r+|\u00a0+|\s/gu

function describeRun(run: string) {
  const crlf = run.startsWith('\r\n')
  const count = crlf ? run.length / 2 : Array.from(run).length
  const unit =
    crlf || run[0] === '\n'
      ? 'line break'
      : run[0] === ' '
        ? 'space'
        : run[0] === '\t'
          ? 'tab'
          : run[0] === '\r'
            ? 'carriage return'
            : run[0] === '\u00a0'
              ? 'non-breaking space'
              : `U+${run.codePointAt(0)!.toString(16).toUpperCase()} whitespace character`
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

export function whitespaceSummary(original: string, corrected: string) {
  const describe = (text: string) =>
    Array.from(text.matchAll(runs), ([run]) => describeRun(run)).join(', ') || 'no whitespace'
  return `${describe(original)} → ${describe(corrected)}`
}

export function correctionDescription(original: string, corrected: string, spacingOnly: boolean) {
  if (spacingOnly) {
    const before = original.replace(/\S/gu, '')
    const after = corrected.replace(/\S/gu, '')
    if (/^ *$/u.test(before) && /^ *$/u.test(after) && before.length !== after.length) {
      const removed = before.length - after.length
      const position = /\. +(?:\S|$)/u.test(original) ? ' after the period' : ''
      const action =
        removed > 0
          ? removed === 1
            ? 'Removed an extra space'
            : `Removed ${removed} extra spaces`
          : removed === -1
            ? 'Added a space'
            : `Added ${-removed} spaces`
      return `${action}${position}: ${before.length} → ${after.length}.`
    }
    return `Adjusted spacing: ${whitespaceSummary(original, corrected)}.`
  }
  if (original.replace(/\s/gu, '') === corrected.replace(/\s/gu, '')) {
    const oldWords = original.trim().split(/\s+/u).length
    const newWords = corrected.trim().split(/\s+/u).length
    if (oldWords > 1 && newWords === 1)
      return oldWords === 2 ? 'Joined two words.' : `Joined ${oldWords} words.`
    if (oldWords === 1 && newWords > 1)
      return newWords === 2 ? 'Split one word into two.' : `Split one word into ${newWords}.`
  }
  return 'Text change'
}
