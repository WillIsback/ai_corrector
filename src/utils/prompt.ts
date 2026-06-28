import type { CorrectionMode, CorrectionSettings } from "../types";

const modeDescriptions: Record<CorrectionMode, string> = {
  formel: "Formel et professionnel",
  "semi-formel": "Neutre, adapte au courrier",
  informel: "Decontracte, style conversationnel",
  technical: "Texte technique, clarte et precision",
};

const correctionLabels: Partial<Record<keyof CorrectionSettings, string>> = {
  fixGrammar: "grammaire",
  fixSpelling: "orthographe",
  fixSyntax: "syntaxe",
  fixStyle: "style",
};

export function buildSystemPrompt(settings: CorrectionSettings): string {
  const activeCorrections = (
    Object.entries(correctionLabels) as [keyof CorrectionSettings, string][]
  )
    .filter(([key]) => settings[key] === true)
    .map(([, label]) => label)
    .join(", ");

  const base =
    "Tu es un correcteur editorial expert en francais. " +
    "Mode: " +
    modeDescriptions[settings.mode] +
    ". " +
    "Corrections actives: " +
    (activeCorrections || "toutes") +
    ". " +
    "Corrige UNIQUEMENT ce qui necessite une correction selon ces criteres. Ne change pas le sens ni le style au-dela du mode demande. " +
    "Reponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant ou apres:\n";

  if (settings.showCorrections) {
    return (
      base +
      '{"texte_corrige": "le texte corrige complet", "corrections": [{"avant": "expression originale", "apres": "expression corrigee", "regle": "nom court de la regle ex: accord sujet-verbe"}, ...]}\n' +
      "Si aucune correction n'est necessaire, retourne corrections vide []."
    );
  }

  return `${base}{"texte_corrige": "le texte corrige complet"}`;
}

export function buildUserPrompt(text: string): string {
  return text;
}
