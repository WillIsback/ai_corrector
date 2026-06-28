export type CorrectionMode = "formel" | "semi-formel" | "informel" | "technical";

export interface CorrectionSettings {
  engine: "llm" | "lt";
  mode: CorrectionMode;
  fixGrammar: boolean;
  fixSpelling: boolean;
  fixSyntax: boolean;
  fixStyle: boolean;
  showCorrections: boolean;
}

export interface CorrectionStats {
  processingTime: number;
  modificationCount: number;
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

// LLM types (migrés depuis api.ts)
export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface CorrectionEntry {
  avant: string;
  apres: string;
  regle: string;
}

export interface CorrectionResult {
  text: string;
  corrections: CorrectionEntry[];
}

export interface StreamCallbacks {
  onTextDone?: (text: string, duration: number) => void;
}
