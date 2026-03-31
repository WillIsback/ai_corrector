export type CorrectionMode = "formel" | "semi-formel" | "informel" | "technical";

export interface CorrectionSettings {
  mode: CorrectionMode;
  fixGrammar: boolean;
  fixSpelling: boolean;
  fixSyntax: boolean;
  fixStyle: boolean;
  ltEnabled: boolean;
  ltPreFire: boolean;
  ltPostFire: boolean;
}

export type CorrectionSource = "llm" | "lt_pre" | "lt_post";

export type DiffChunkType = "unchanged" | "added" | "removed";

export interface DiffChunk {
  type: DiffChunkType;
  text: string;
  source?: CorrectionSource;
  ltMatchId?: string;
}

export interface CorrectionStats {
  processingTime: number;
  modificationCount: number;
  ltPreCorrections: number;
  ltPostCorrections: number;
}

export interface CorrectionResult {
  originalText: string;
  correctedText: string;
  diff: DiffChunk[];
  stats: CorrectionStats;
}

export type ToastType = "success" | "error" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// LanguageTool types
export interface LTMatch {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: string[];
  rule: { id: string };
}

export interface LTResponse {
  matches: LTMatch[];
}

// Entity protection types
export interface SuspectWord {
  placeholder: string; // "__PROT_0__"
  originalText: string; // "Noota"
  offset: number; // position in original text
  length: number; // length of original word
  wasCorrected: boolean; // true if LT would have corrected this word
}

export interface ProtectedText {
  text: string; // text with placeholders
  suspects: SuspectWord[];
}
