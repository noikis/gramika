import { describe, expect, it, vi } from 'vitest'
import {
  WORKSPACE_STORAGE_KEY,
  clearWorkspace,
  loadWorkspace,
  saveWorkspace,
} from '../../src/lib/workspace-storage'
import { correctionResult } from './fixtures'

describe('workspace storage', () => {
  it('restores a saved draft, theme, result and pending marker', () => {
    const result = correctionResult()
    saveWorkspace(
      JSON.stringify({
        version: 2,
        text: result.originalText,
        theme: 'dark',
        mode: 'strict',
        activeRequestId: result.requestId,
        results: [{ result, view: 'changes' }],
        isRequestPending: true,
        translation: null,
      }),
    )

    expect(loadWorkspace()).toEqual({
      workspace: {
        version: 3,
        text: result.originalText,
        theme: 'dark',
        mode: 'strict',
        activeRequestId: result.requestId,
        results: [{ result, view: 'changes' }],
        isRequestPending: true,
      },
      messageKey: null,
    })
  })

  it('clears corrupted workspace data and reports recovery', () => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, '{"version":1}')

    expect(loadWorkspace()).toEqual({ workspace: null, messageKey: 'workspaceRestoreFailed' })
    expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull()
  })

  it('reports unavailable storage without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    expect(loadWorkspace()).toEqual({ workspace: null, messageKey: 'storageUnavailable' })
    expect(clearWorkspace()).toBe(true)
  })
})
