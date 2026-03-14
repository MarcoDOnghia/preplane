/**
 * Sanitize AI-generated text for safe UI rendering.
 * - Strips CJK / non-Latin unicode characters (碎, 挀, etc.)
 * - Detects and removes raw JSON blobs
 * - Returns clean plain text
 */

// CJK Unified Ideographs + CJK Compatibility + misc non-Latin blocks
// Keeps Latin, Latin Extended, common punctuation, accented chars, digits, whitespace
const CJK_REGEX = /[\u2E80-\u2FFF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3200-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u{20000}-\u{2A6DF}\u{2A700}-\u{2EBEF}\u{2F800}-\u{2FA1F}]/gu;

const JSON_BLOB_REGEX = /\{[^{}]*\"(?:score|companyBrief|keywordsFound|keywordsMissing|formattingIssues|quickWins|cvSuggestions|coverLetter|interviewQuestions|atsAnalysis|keyRequirements)\"[^{}]*\}/g;

export function sanitizeDisplayText(text: unknown): string {
  if (typeof text !== "string") return "";
  let cleaned = text;

  // Remove any embedded JSON objects
  cleaned = cleaned.replace(JSON_BLOB_REGEX, "");

  // Remove CJK and other non-standard unicode
  cleaned = cleaned.replace(CJK_REGEX, "");

  // Clean up leftover artifacts
  cleaned = cleaned
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned;
}

/**
 * Sanitize an array of strings, filtering out empty results.
 */
export function sanitizeDisplayArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => sanitizeDisplayText(item))
    .filter((s) => s.length > 0);
}

/**
 * Check if text is valid for display (not empty, not raw JSON).
 */
export function isValidDisplayText(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Reject if it looks like raw JSON
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try { JSON.parse(trimmed); return false; } catch { /* not JSON, ok */ }
  }
  return true;
}
