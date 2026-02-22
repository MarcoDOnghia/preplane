import { cvToPlainText } from "./cvParser";

/**
 * Client-side ATS score recalculation based on keyword matching against job description.
 */

function extractKeywords(jobDescription: string): string[] {
  const text = jobDescription.toLowerCase();
  const words = text
    .replace(/[^a-z0-9\s\-+#.]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Extract multi-word phrases (2-3 words) that look like skills
  const phrases: string[] = [];
  const rawWords = text.split(/\n|[,;•\-]/).map((s) => s.trim()).filter(Boolean);
  for (const phrase of rawWords) {
    const cleaned = phrase.replace(/[^a-z0-9\s\-+#.]/g, "").trim();
    if (cleaned.length > 2 && cleaned.length < 40 && cleaned.split(/\s+/).length <= 4) {
      phrases.push(cleaned);
    }
  }

  // Combine unique single important words + phrases
  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "are", "was", "were",
    "will", "have", "has", "had", "been", "being", "can", "could", "should",
    "would", "may", "might", "must", "shall", "not", "but", "also", "our",
    "your", "you", "they", "their", "them", "its", "about", "into", "over",
    "such", "than", "other", "which", "these", "those", "then", "when",
    "where", "who", "whom", "how", "all", "each", "every", "both",
  ]);

  const importantWords = words.filter((w) => !stopWords.has(w) && w.length > 3);
  const unique = [...new Set([...phrases, ...importantWords])];
  return unique.slice(0, 30);
}

export interface AtsScoreResult {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
}

export function calculateAtsScore(cvContent: string, jobDescription: string): AtsScoreResult {
  const cvText = cvToPlainText(cvContent).toLowerCase();
  const keywords = extractKeywords(jobDescription);

  if (keywords.length === 0) {
    return { score: 0, matchedKeywords: [], missingKeywords: [] };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of keywords) {
    if (cvText.includes(kw)) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  // Keyword match score (70% weight)
  const keywordScore = (matched.length / keywords.length) * 70;

  // Format quality score (30% weight)
  let formatScore = 30;
  const lineCount = cvText.split("\n").filter((l) => l.trim()).length;
  if (lineCount < 10) formatScore -= 10;
  if (cvText.length < 200) formatScore -= 10;
  // Check for section headers
  const hasHeaders = /\b(education|experience|skills|certifications)\b/i.test(cvText);
  if (!hasHeaders) formatScore -= 5;

  const score = Math.min(100, Math.max(0, Math.round(keywordScore + formatScore)));

  return {
    score,
    matchedKeywords: matched,
    missingKeywords: missing,
  };
}
