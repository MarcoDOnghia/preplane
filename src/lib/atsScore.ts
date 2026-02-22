import { cvToPlainText } from "./cvParser";

/**
 * Client-side ATS score recalculation with synonym-aware, fuzzy keyword matching.
 */

/** Synonym mappings for common job skills and qualifications */
const SYNONYMS: Record<string, string[]> = {
  // Technical skills
  excel: ["microsoft excel", "ms excel", "spreadsheet", "xlookup", "pivot tables", "vlookup"],
  "power bi": ["powerbi", "power business intelligence", "microsoft power bi"],
  python: ["python programming", "python scripting", "python3"],
  sql: ["structured query language", "mysql", "postgresql", "sql server", "t-sql", "tsql"],
  "financial modeling": ["financial models", "budgeting models", "forecast modeling", "forecasting"],
  "data analysis": ["data analytics", "analyzing data", "statistical analysis", "data-driven"],
  javascript: ["js", "ecmascript", "es6", "node.js", "nodejs"],
  typescript: ["ts"],
  react: ["reactjs", "react.js"],
  "machine learning": ["ml", "deep learning", "neural networks"],
  "project management": ["project manager", "managing projects", "pm"],
  // Qualifications
  "master's degree": ["masters degree", "msc", "m.s.", "laurea magistrale", "graduate degree", "master degree"],
  "bachelor's degree": ["bachelors degree", "bs", "b.s.", "ba", "b.a.", "undergraduate degree", "laurea", "bachelor degree"],
  // Soft skills
  "analytical thinking": ["analytical skills", "analysis skills", "analytical ability", "analytical capabilities"],
  "problem solving": ["problem-solving", "solving problems", "critical thinking"],
  "team collaboration": ["teamwork", "collaborative", "team player", "working in teams", "cross-functional"],
  communication: ["communication skills", "communicating", "verbal communication", "written communication"],
  leadership: ["leading teams", "team lead", "team leadership", "people management"],
  // Experience
  "financial analyst": ["financial analysis", "finance analyst"],
  controller: ["financial controller", "management control", "controllo di gestione"],
};

/**
 * Check if a keyword (or any of its synonyms) appears in the CV text.
 * Also does partial/fuzzy matching for multi-word keywords.
 */
function matchKeyword(keyword: string, cvText: string): boolean {
  const kw = keyword.toLowerCase();

  // Direct match
  if (cvText.includes(kw)) return true;

  // Synonym match
  const syns = SYNONYMS[kw];
  if (syns && syns.some((s) => cvText.includes(s))) return true;

  // Also check if the keyword itself is a synonym value for another key
  for (const [, values] of Object.entries(SYNONYMS)) {
    if (values.includes(kw)) {
      // Check the canonical form and all other synonyms
      for (const v of values) {
        if (v !== kw && cvText.includes(v)) return true;
      }
    }
  }

  // Partial/fuzzy match for multi-word keywords (e.g. "Excel (advanced)")
  if (kw.includes(" ") || kw.includes("(")) {
    // Strip parenthetical qualifiers for matching: "excel (advanced)" → check "excel"
    const withoutParens = kw.replace(/\s*\([^)]*\)/g, "").trim();
    if (withoutParens && cvText.includes(withoutParens)) return true;

    // Word overlap: if 70%+ of significant words match
    const words = kw
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3);
    if (words.length > 0) {
      const matchCount = words.filter((w) => cvText.includes(w)).length;
      if (matchCount / words.length >= 0.7) return true;
    }
  }

  return false;
}

function extractKeywords(jobDescription: string): string[] {
  const text = jobDescription.toLowerCase();
  const words = text
    .replace(/[^a-z0-9\s\-+#.]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const phrases: string[] = [];
  const rawWords = text.split(/\n|[,;•\-]/).map((s) => s.trim()).filter(Boolean);
  for (const phrase of rawWords) {
    const cleaned = phrase.replace(/[^a-z0-9\s\-+#.]/g, "").trim();
    if (cleaned.length > 2 && cleaned.length < 40 && cleaned.split(/\s+/).length <= 4) {
      phrases.push(cleaned);
    }
  }

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

/**
 * Recalculate ATS score using AI-provided keywords (preferred) or fallback to regex extraction.
 * Uses synonym-aware fuzzy matching for accurate keyword detection.
 */
export function calculateAtsScore(
  cvContent: string,
  jobDescription: string,
  aiKeywords?: string[]
): AtsScoreResult {
  const cvText = cvToPlainText(cvContent).toLowerCase();
  const keywords = aiKeywords && aiKeywords.length > 0
    ? aiKeywords
    : extractKeywords(jobDescription);

  if (keywords.length === 0) {
    return { score: 0, matchedKeywords: [], missingKeywords: [] };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of keywords) {
    if (matchKeyword(kw, cvText)) {
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
  const hasHeaders = /\b(education|experience|skills|certifications)\b/i.test(cvText);
  if (!hasHeaders) formatScore -= 5;

  const score = Math.min(100, Math.max(0, Math.round(keywordScore + formatScore)));

  return {
    score,
    matchedKeywords: matched,
    missingKeywords: missing,
  };
}
