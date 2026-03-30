import { LTMatch, LTResponse } from '../types';

const LT_API_BASE = 'http://localhost:3001';

export interface LTCheckResult {
  correctedText: string;
  matchCount: number;
  matches: LTMatch[];
}

export async function checkLanguageTool(text: string): Promise<LTCheckResult> {
  const response = await fetch(`${LT_API_BASE}/v2/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      language: 'fr',
    }),
  });

  if (!response.ok) {
    throw new Error(`LanguageTool API error: ${response.status}`);
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
    .filter(m => m.replacements.length > 0)
    .sort((a, b) => b.offset - a.offset);

  let result = text;
  for (const match of validMatches) {
    const firstReplacement = match.replacements[0];
    result = 
      result.slice(0, match.offset) + 
      firstReplacement + 
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
