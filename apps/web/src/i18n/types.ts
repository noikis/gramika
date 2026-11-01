export const Locale = {
  English: 'en',
  French: 'fr',
  Russian: 'ru',
} as const

export type Locale = (typeof Locale)[keyof typeof Locale]
export const LOCALES = Object.values(Locale)
export type LocaleCode = `${Locale}`

export type InterfaceCatalog = {
  dictionary: string
  dictionaryPossibleForms: string
  dictionaryForms: string
  dictionaryForm: string
  dictionaryGrammarLabel: string
  dictionaryPronunciation: string
  dictionaryRecording: string
  dictionaryAudioFailed: string
  dictionaryDetailsLoading: string
  dictionaryNoForms: string
  dictionaryNoMatchingForms: string
  dictionaryNoPronunciation: string
  dictionaryCitation: string
  dictionaryGrammar: Record<string, string>
  dictionarySource: string
  dictionaryInvalid: string
  dictionaryIdle: string
  dictionaryLoading: string
  dictionaryEmpty: string
  dictionaryTimeout: string
  dictionaryUnavailable: string
  dictionaryFailed: string
  dictionarySelected: string
  dictionaryExamples: string
  dictionaryWiktionary: string
  dictionaryGenerated: string
  dictionaryParts: Record<string, string>

  correction: string
  history: string
  mobileNavigation: string
  settings: string
  appearance: string
  language: string
  clearLocalData: string
  correctionMode: string
  original: string
  result: string
  newCorrection: string
  paste: string
  typeOrPaste: string
  correct: string
  text: string
  changes: string
  previous: string
  next: string
  copy: string
  retry: string
  retryConnection: string
  searchHistory: string
  filters: string
  reset: string
  newestFirst: string
  oldestFirst: string
  model: string
  allModels: string
  resultFilter: string
  allResults: string
  corrected: string
  unchanged: string
  failed: string
  pending: string
  from: string
  to: string
  clearSearch: string
  previousPage: string
  nextPage: string
  close: string
  details: string
  delete: string
  cancel: string
  explain: string
  explanation: string
  translation: string
  translating: string
  noTranslation: string
  english: string
  french: string
  russian: string
  translate: string
  translationTarget: string
  translationSource: string
  install: string
  notNow: string
  themeSystem: string
  themeLight: string
  themeDark: string
  secondOpinion: string
  strictMode: string
  rewriteMode: string
  metrics: Record<string, string>
}

export type Messages = InterfaceCatalog & {
  pasting: string
  correcting: string
  noResult: string
  noChanges: string
  copying: string
  deleting: string
  loading: string
  loadingHistory: string
  noMatchingCorrections: string
  noCorrectionsYet: string
  unavailable: string
  requestingOpinion: string
  retryOpinion: string
  generateAgain: string
  savedResult: string
  originalChanged: string
  noResultYet: string
  copyResult: string
  clearDescription: string
  writeWithConfidence: string
  higherCost: string
  gettingOpinion: string
  installIos: string
  installHome: string
  installAndroid: string
  installBrowser: string
  noOriginalText: string
  removedText: string
  deleteConfirmation: string
  correctionsCount: string
  noMatchingHint: string
  correctionsWillAppear: string
  explanationRequests: string
  noExplanationRequests: string
  metricsUnavailable: string
  previousExplanation: string
  savedExplanation: string
  interruptedRequest: string
}
