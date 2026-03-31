import { CorrectionMode, CorrectionSettings } from '../types'
import React from 'react'

interface Props {
  settings: CorrectionSettings
  setSettings: (settings: CorrectionSettings) => void
}

const modeLabels: Record<CorrectionMode, string> = {
  formel: 'Formel / Professionnel',
  'semi-formel': 'Semi-formel',
  informel: 'Informel / Chat',
  technical: 'Technique / Clair',
}

export function Sidebar({ settings, setSettings }: Props) {
  const modeKeys = Object.keys(modeLabels) as CorrectionMode[]

  const handleModeChange = (newMode: CorrectionMode) => {
    setSettings({ ...settings, mode: newMode })
  }

  const handleSettingChange = (setting: keyof CorrectionSettings, value: boolean) => {
    setSettings({ ...settings, [setting]: value })
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        e.preventDefault()
        handleModeChange(modeKeys[(index + 1) % modeKeys.length])
        break
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        e.preventDefault()
        handleModeChange(modeKeys[(index - 1 + modeKeys.length) % modeKeys.length])
        break
      }
      case 'Enter':
      case ' ': {
        e.preventDefault()
        handleModeChange(modeKeys[index])
        break
      }
    }
  }

  return (
    <aside className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Mode de correction</h2>
      
      <div role="radiogroup" aria-label="Mode de correction" className="space-y-2">
        {modeKeys.map((key, index) => (
          <div key={key} className="flex items-center gap-2">
            <input
              type="radio"
              id={`mode-${key}`}
              name="mode"
              value={key}
              checked={settings.mode === key}
              onChange={() => handleModeChange(key)}
              className="peer sr-only"
            />
            <label
              htmlFor={`mode-${key}`}
              role="radio"
              tabIndex={0}
              aria-checked={settings.mode === key}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onClick={() => handleModeChange(key)}
              className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border-2 transition-all duration-200
                peer-checked:border-blue-600 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/30
                border-transparent hover:border-gray-300 dark:hover:border-gray-600
                text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span className="text-base">{modeLabels[key]}</span>
            </label>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Corrections a appliquer</h3>
        
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.fixGrammar}
              onChange={(e) => handleSettingChange('fixGrammar', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-blue-400"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Grammaire</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.fixSpelling}
              onChange={(e) => handleSettingChange('fixSpelling', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-blue-400"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Orthographe</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.fixSyntax}
              onChange={(e) => handleSettingChange('fixSyntax', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-blue-400"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Syntaxe</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.fixStyle}
              onChange={(e) => handleSettingChange('fixStyle', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-blue-400"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Style</span>
          </label>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          LanguageTool 
          <span className="text-xs font-normal text-gray-500 ml-1">(toujours actif)</span>
        </h3>
        
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.ltPreFire}
              onChange={(e) => setSettings({ ...settings, ltPreFire: e.target.checked })}
              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Pre-correction LLM</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.ltPostFire}
              onChange={(e) => setSettings({ ...settings, ltPostFire: e.target.checked })}
              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">Post-correction LLM</span>
          </label>
        </div>
      </div>
    </aside>
  )
}