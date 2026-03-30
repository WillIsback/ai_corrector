export type CorrectionMode = 
  | 'formel'
  | 'semi-formel'
  | 'informel'
  | 'technical';

export interface CorrectionSettings {
  mode: CorrectionMode;
  fixGrammar: boolean;
  fixSpelling: boolean;
  fixSyntax: boolean;
  fixStyle: boolean;
}

export interface DiffChunk {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  text: string;
}

export interface CorrectionStats {
  processingTime: number;
  modificationCount: number;
}

export interface CorrectionResult {
  originalText: string;
  correctedText: string;
  diff: DiffChunk[];
  stats: CorrectionStats;
}

export type ToastType = 'success' | 'error' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
}
