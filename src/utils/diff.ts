import { DiffChunk } from '../types'
import diff_match_patch from 'diff-match-patch'

export function computeDiff(original: string, corrected: string): DiffChunk[] {
  const dmp = new diff_match_patch()
  
  const diffs = dmp.diff_main(original, corrected)
  dmp.diff_cleanupSemantic(diffs)
  
  return diffs.map(([type, text]: [number, string]) => {
    switch (type) {
      case 0: 
        return { type: 'unchanged', text }
      case 1: 
        return { type: 'added', text }
      case -1: 
        return { type: 'removed', text }
      default:
        return { type: 'unchanged', text }
    }
  })
}
