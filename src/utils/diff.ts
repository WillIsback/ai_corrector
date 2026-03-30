import { DiffChunk, CorrectionSource } from '../types';
import diff_match_patch from 'diff-match-patch';

export function computeDiff(
  original: string, 
  corrected: string, 
  source: CorrectionSource = 'llm'
): DiffChunk[] {
  const dmp = new diff_match_patch();
  
  const diffs = dmp.diff_main(original, corrected);
  dmp.diff_cleanupSemantic(diffs);
  
  return diffs.map(([type, text]: [number, string]) => {
    switch (type) {
      case 0: 
        return { type: 'unchanged', text };
      case 1: 
        return { type: 'added', text, source };
      case -1: 
        return { type: 'removed', text };
      default:
        return { type: 'unchanged', text };
    }
  });
}

// Note: Only 'added' chunks from chunks2 are processed;
// removed/unchanged chunks are preserved from chunks1
export function mergeDiffs(chunks1: DiffChunk[], chunks2: DiffChunk[]): DiffChunk[] {
  const result: DiffChunk[] = [...chunks1];
  
  for (const chunk of chunks2) {
    if (chunk.type === 'added' && chunk.source) {
      const lastChunk = result[result.length - 1];
      if (lastChunk && lastChunk.type === 'added' && lastChunk.source === chunk.source) {
        // Clone to avoid mutating original chunks1
        result[result.length - 1] = { ...lastChunk, text: lastChunk.text + chunk.text };
      } else {
        result.push({ ...chunk });
      }
    }
  }
  
  return result;
}
