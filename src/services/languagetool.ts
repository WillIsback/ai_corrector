import { LTMatch, LTResponse } from '../types';

const LT_API_BASE = import.meta.env.VITE_LT_API_BASE || 'http://127.0.0.1:3002';

export interface LTCheckResult {
  correctedText: string;
  matchCount: number;
  matches: LTMatch[];
}

export async function checkLanguageTool(text: string): Promise<LTCheckResult> {
  if (!text.trim()) {
    throw new Error('Le texte ne peut pas être vide');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  const response = await fetch(`${LT_API_BASE}/v2/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      text,
      language: 'fr',
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`LanguageTool API error: ${response.status}. Vérifiez que le serveur LT tourne sur ${LT_API_BASE}`);
  }

  const data: LTResponse = await response.json();
  const correctedText = applyAutoFix(text, data.matches);
  
  return {
    correctedText,
    matchCount: data.matches.length,
    matches: data.matches,
  };
}

function applyAutoFix(text: string, matches: LTMatch[]): string {
  if (matches.length === 0) {
    return text;
  }

  const validMatches = matches
    .filter(m => m.replacements && m.replacements.length > 0)
    .sort((a, b) => b.offset - a.offset);

  let result = text;
  for (const match of validMatches) {
    const firstReplacement = match.replacements[0];
    const replacementText = typeof firstReplacement === 'string' 
      ? firstReplacement 
      : (firstReplacement as { value: string }).value;
    
    result = 
      result.slice(0, match.offset) + 
      replacementText + 
      result.slice(match.offset + match.length);
  }

  return result;
}

export async function checkLTAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${LT_API_BASE}/v2/languages`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
