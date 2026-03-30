import { useState, useEffect } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { Output } from './components/Output'
import { Toast } from './components/Toast'
import { useCorrector } from './hooks/useCorrector'

function App() {
  const {
    textContent,
    setTextContent,
    diffChunks,
    mode,
    setMode,
    settings,
    setSettings,
    isLoading,
    error,
    stats,
    handleCorrect,
    handleReset,
  } = useCorrector()

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    const root = window.document.documentElement
    
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  const handleCloseToast = () => {
    setToast(null)
  }

  const handleCopySuccess = (text: string) => {
    navigator.clipboard.writeText(text)
    setToast({ id: `copy-${Date.now()}-${Math.random().toString(36).substring(7)}`, message: 'Texte copié dans le presse-papier !', type: 'success' })
  }



  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Header 
        theme={theme} 
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        onOpenSettings={() => {}}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          mode={mode} 
          setMode={setMode}
          settings={settings}
          setSettings={setSettings}
        />
        
        <Editor 
          text={textContent}
          onChange={setTextContent}
          onCorrect={handleCorrect}
          isLoading={isLoading}
        />
        
        <Output 
          diffChunks={diffChunks}
          stats={stats}
          onCopy={handleCopySuccess}
          onReset={handleReset}
        />
      </div>

      {toast && <Toast toast={toast} onClose={handleCloseToast} />}
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 px-6 py-4">
          <p className="text-red-700 dark:text-red-400 text-center max-w-4xl mx-auto">{error}</p>
        </div>
      )}
    </div>
  )
}

export default App
