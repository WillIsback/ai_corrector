import { LTMatch, LTResponse } from '../types';

const LT_API_BASE = import.meta.env.VITE_LT_API_BASE || 'http://127.0.0.1:3002';

let protectedAcronyms: Set<string> | null = null;

async function loadProtectedAcronyms(): Promise<Set<string>> {
  if (protectedAcronyms) {
    return protectedAcronyms;
  }
  
  protectedAcronyms = new Set();
  
  try {
    const response = await fetch('/data/dictionnaire.csv');
    if (!response.ok) {
      console.warn('Could not load dictionary, using empty list');
      return protectedAcronyms;
    }
    
    const text = await response.text();
    const lines = text.split('\n');
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length >= 1) {
        const acronym = parts[0].trim().toUpperCase();
        if (acronym && acronym.length > 1) {
          protectedAcronyms.add(acronym);
        }
      }
    }
    
    console.log(`Loaded ${protectedAcronyms.size} protected acronyms`);
  } catch (e) {
    console.warn('Failed to load dictionary:', e);
  }
  
  return protectedAcronyms;
}

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
  const acronyms = await loadProtectedAcronyms();
  const correctedText = applyAutoFix(text, data.matches, acronyms);
  
  return {
    correctedText,
    matchCount: data.matches.length,
    matches: data.matches,
  };
}

function isProtectedByAcronym(text: string, offset: number, length: number, acronyms: Set<string>): boolean {
  const matchedText = text.slice(offset, offset + length);
  const upperText = matchedText.toUpperCase();
  const cleanedText = upperText.replace(/[^A-Z0-9]/g, '');
  
  // Protect acronyms from dictionary
  if (acronyms.has(cleanedText)) {
    return true;
  }
  
  // Protect ALL UPPERCASE strings with 3+ chars (like COSSIM, DGCCRF, etc.)
  if (matchedText === upperText && cleanedText.length >= 3) {
    return true;
  }
  
  // Check partial match with known acronyms
  for (const acronym of acronyms) {
    if (cleanedText.includes(acronym) || acronym.includes(cleanedText)) {
      if (acronym.length >= 4 && Math.max(acronym.length, cleanedText.length) / Math.min(acronym.length, cleanedText.length) < 1.5) {
        return true;
      }
    }
  }
  
  return false;
}

function applyAutoFix(text: string, matches: LTMatch[], acronyms: Set<string> = new Set()): string {
  if (matches.length === 0) {
    return text;
  }

  const validMatches = matches
    .filter(m => m.replacements && m.replacements.length > 0)
    .filter(m => !isProtectedByAcronym(text, m.offset, m.length, acronyms))
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