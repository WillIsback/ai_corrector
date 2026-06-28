const MAX_CONTENT_LENGTH = 10000;

export function sanitizeInput(text: string): string {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    throw new Error("Le texte ne peut pas être vide");
  }

  const sanitized = trimmed.replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");

  if (sanitized.length > MAX_CONTENT_LENGTH) {
    return sanitized.substring(0, MAX_CONTENT_LENGTH);
  }

  return sanitized;
}
