export const SPEECH_CHUNK_TARGET = 420

export function chunkSpeechText(text: string, target = SPEECH_CHUNK_TARGET): string[] {
  if (!text.trim()) return []
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > target) {
    const window = remaining.slice(0, target)
    let cut = Math.max(
      window.lastIndexOf('\n\n'),
      window.lastIndexOf('. '),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
    )
    if (cut < Math.floor(target * 0.45)) cut = window.lastIndexOf(' ')
    if (cut <= 0) cut = target
    else if (remaining[cut] === ' ' || remaining[cut] === '\n') cut += 1
    chunks.push(remaining.slice(0, cut))
    remaining = remaining.slice(cut)
  }
  if (remaining) chunks.push(remaining)
  return chunks
}
