import { DiffChunk } from '../types'

interface Props {
  diffChunks: DiffChunk[]
  stats: { processingTime: number; modificationCount: number }
  onCopy: (text: string) => void
  onReset: () => void
}

export function Output({ diffChunks, stats, onCopy, onReset }: Props) {
  const handleCopy = () => {
    const text = diffChunks.map(chunk => chunk.text).join('')
    onCopy(text)
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            ✨ Résultat corrigé
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Le texte ci-dessous a été corrigé selon vos paramètres.
          </p>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          {diffChunks.length === 0 ? (
            <div className="text-center text-gray-400 dark:text-gray-500 py-12">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Aucune correction disponible. Entrez du texte et cliquez sur "Corriger".</p>
            </div>
          ) : (
            <p className="text-lg leading-relaxed text-gray-800 dark:text-gray-200">
              {diffChunks.map((chunk, index) => {
                switch (chunk.type) {
                  case 'added':
                    return (
                      <span key={index} className="bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-200 px-0.5 rounded">
                        {chunk.text}
                      </span>
                    )
                  case 'removed':
                    return (
                      <del key={index} className="text-red-600 dark:text-red-400">
                        {chunk.text}
                      </del>
                    )

                  default:
                    return <span key={index}>{chunk.text}</span>
                }
              })}
            </p>
          )}
        </div>
        
        {diffChunks.length > 0 && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Temps de traitement</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.processingTime}ms</p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Modifications</h3>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.modificationCount}</p>
              </div>
            </div>
            
            <div className="mt-6 flex gap-4">
              <button
                onClick={handleCopy}
                className="flex-1 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                📋 Copier le texte
              </button>
              <button
                onClick={onReset}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-colors"
              >
                🔄 Réinitialiser
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
