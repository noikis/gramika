import { chunkSpeechText } from './voice/chunk-speech-text'

export type SpeechStatus = 'idle' | 'starting' | 'speaking' | 'paused'
export type SpeechError = 'unavailable' | 'failed' | 'voiceUnavailable'

type SpeechRun = {
  id: number
  sourceId: string
  chunks: string[]
  index: number
  lang: string
  status: SpeechStatus
  timer: number | null
}

const START_TIMEOUT_MS = 15000
const CHUNK_TIMEOUT_MS = 120000

export class SpeechSynthesisController {
  private run: SpeechRun | null = null
  private generation = 0
  private listener:
    | ((state: {
        sourceId: string | null
        status: SpeechStatus
        error: SpeechError | null
      }) => void)
    | null = null

  subscribe(listener: typeof this.listener) {
    this.listener = listener
    return () => {
      if (this.listener === listener) this.listener = null
    }
  }

  get state() {
    return {
      sourceId: this.run?.sourceId ?? null,
      status: this.run?.status ?? ('idle' as SpeechStatus),
      error: null as SpeechError | null,
    }
  }

  private emit(error: SpeechError | null = null) {
    this.listener?.({
      sourceId: this.run?.sourceId ?? null,
      status: this.run?.status ?? 'idle',
      error,
    })
  }

  private api() {
    if (
      typeof window === 'undefined' ||
      !window.speechSynthesis ||
      typeof window.SpeechSynthesisUtterance === 'undefined'
    )
      return null
    return window.speechSynthesis
  }

  play(sourceId: string, text: string, lang: string) {
    const api = this.api()
    if (!api) return this.fail(sourceId, 'unavailable')
    if (this.run?.sourceId === sourceId && this.run.status === 'starting') return
    this.cancel()
    const chunks = chunkSpeechText(text)
    if (!chunks.length) return this.fail(sourceId, 'failed')
    const run: SpeechRun = {
      id: ++this.generation,
      sourceId,
      chunks,
      index: 0,
      lang,
      status: 'starting',
      timer: null,
    }
    this.run = run
    this.emit()
    this.speakChunk(run, api)
  }

  pause(sourceId: string) {
    if (!this.run || this.run.sourceId !== sourceId || this.run.status !== 'speaking') return
    this.api()?.pause()
    this.run.status = 'paused'
    this.clearTimer()
    this.emit()
  }

  resume(sourceId: string) {
    if (!this.run || this.run.sourceId !== sourceId || this.run.status !== 'paused') return
    this.api()?.resume()
    this.run.status = 'speaking'
    this.armTimer(this.run, CHUNK_TIMEOUT_MS)
    this.emit()
  }

  cancel(sourceId?: string) {
    if (sourceId && this.run?.sourceId !== sourceId) return
    this.generation++
    this.clearTimer()
    try {
      this.api()?.cancel()
    } catch {
      /* browser cancellation is best effort */
    }
    this.run = null
    this.emit()
  }

  private fail(sourceId: string, error: SpeechError) {
    this.cancel()
    this.listener?.({ sourceId, status: 'idle', error })
  }

  private clearTimer() {
    if (this.run && this.run.timer !== null) window.clearTimeout(this.run.timer)
    if (this.run) this.run.timer = null
  }

  private armTimer(run: SpeechRun, timeout: number) {
    this.clearTimer()
    run.timer = window.setTimeout(() => {
      if (this.run?.id !== run.id) return
      this.fail(run.sourceId, 'failed')
    }, timeout)
  }

  private speakChunk(run: SpeechRun, api: SpeechSynthesis) {
    if (this.run?.id !== run.id) return
    const utterance = new window.SpeechSynthesisUtterance(run.chunks[run.index])
    utterance.lang = run.lang
    utterance.rate = 1
    const voice = api
      .getVoices()
      .find((candidate) => candidate.lang.toLowerCase() === run.lang.toLowerCase())
    if (voice) utterance.voice = voice
    utterance.onstart = () => {
      if (this.run?.id !== run.id) return
      run.status = 'speaking'
      this.armTimer(run, START_TIMEOUT_MS)
      this.emit()
    }
    utterance.onpause = () => {
      if (this.run?.id !== run.id) return
      run.status = 'paused'
      this.clearTimer()
      this.emit()
    }
    utterance.onresume = () => {
      if (this.run?.id !== run.id) return
      run.status = 'speaking'
      this.armTimer(run, CHUNK_TIMEOUT_MS)
      this.emit()
    }
    utterance.onend = () => {
      if (this.run?.id !== run.id) return
      this.clearTimer()
      if (++run.index >= run.chunks.length) {
        this.run = null
        this.emit()
      } else {
        run.status = 'starting'
        this.emit()
        this.speakChunk(run, api)
      }
    }
    utterance.onerror = (event) => {
      if (this.run?.id !== run.id) return
      if (event.error === 'canceled' || event.error === 'interrupted') return
      this.fail(run.sourceId, 'failed')
    }
    try {
      api.cancel()
      api.speak(utterance)
      this.armTimer(run, START_TIMEOUT_MS)
    } catch {
      this.fail(run.sourceId, 'failed')
    }
  }
}
