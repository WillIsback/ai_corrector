import { CorrectionMode } from '../types'

interface Props {
  mode: CorrectionMode
  setMode: (mode: CorrectionMode) => void
  settings: {
    mode: CorrectionMode
    fixGrammar: boolean
    fixSpelling: boolean
    fixSyntax: boolean
    fixStyle: boolean
  }
  setSettings: (settings: typeof settings) => void
}

const modeLabels: Record<CorrectionMode, string> = {
  formel: 'Formel / Professionnel',
  'semi-formel': 'Semi-formel',
  informel: 'Informel / Chat',
  technical: 'Technical / Clair',
}

export function Sidebar({ mode, setMode, settings, setSettings }: Props) {
  const handleModeChange = (newMode: CorrectionMode) => {
    setMode(newMode)
    setSettings({ ...settings, mode: newMode })
  }

  const handleSettingChange = (setting: keyof typeof settings, value: boolean) => {
    setSettings({ ...settings, [setting]: value })
  }

  return (
    <aside className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Mode de correction</h2>
      
      <div className="space-y-2">
        {Object.entries(modeLabels).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value={key}
              checked={mode === key}
              onChange={() => handleModeChange(key as CorrectionMode)}
              className="text-blue-600 focus:ring-blue-500 dark:text-blue-400 dark:focus:ring-blue-300"
            />
            <span className="text-gray-900 dark:text-gray-100">{label}</span>
          </label>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Corrections à appliquer</h3>
        
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
    </aside>
  )
}
