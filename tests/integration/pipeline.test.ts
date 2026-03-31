import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
vi.stubGlobal('localStorage', localStorageMock)

// Import the hook (without module mocks - use the real implementation)
import { useCorrector } from '../../src/hooks/useCorrector'

describe('Pipeline - Integration', () => {
  it('pipeline_emptyText - erreur quand texte vide', async () => {
    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      await result.current.handleCorrect()
    })

    expect(result.current.error).toBe('Veuillez entrer du texte')
  })

  it('pipeline_setTextContent - définit le texte', async () => {
    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      result.current.setTextContent('Bonjour')
    })
    
    expect(result.current.textContent).toBe('Bonjour')
  })

  it('pipeline_defaultSettings - vérifie les paramètres par défaut', () => {
    const { result } = renderHook(() => useCorrector())
    
    expect(result.current.settings.ltEnabled).toBe(true)
    expect(result.current.settings.ltPreFire).toBe(true)
    expect(result.current.settings.ltPostFire).toBe(true)
  })

  it('pipeline_updateSettings - met à jour les paramètres', async () => {
    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      result.current.setSettings({ ...result.current.settings, ltEnabled: false })
    })
    
    expect(result.current.settings.ltEnabled).toBe(false)
  })

  it('pipeline_handleReset - reset l\'état', async () => {
    const { result } = renderHook(() => useCorrector())
    
    await act(async () => {
      result.current.setTextContent('Test')
      result.current.handleReset()
    })
    
    expect(result.current.textContent).toBe('')
    expect(result.current.outputText).toBe('')
    expect(result.current.error).toBeNull()
  })

  it('pipeline_initialState - vérifie l\'état initial', () => {
    const { result } = renderHook(() => useCorrector())
    
    expect(result.current.textContent).toBe('')
    expect(result.current.outputText).toBe('')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.diffChunks).toEqual([])
  })
})