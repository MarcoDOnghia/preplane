/**
 * Parses raw CV text (plain text or basic HTML) into structured HTML
 * with proper headings, bullets, and spacing for TipTap editor.
 */

const SECTION_HEADERS = [
  "education", "professional experience", "work experience", "experience",
  "skills", "technical skills", "projects", "certifications", "certificates",
  "awards", "languages", "references", "volunteer", "volunteer experience",
  "summary", "professional summary", "objective", "about", "contact",
  "additional", "interests", "publications", "activities",
  "extracurricular", "leadership", "research",
];

function isSectionHeader(line: string): boolean {
  const lower = line.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  return SECTION_HEADERS.some((h) => lower === h || lower.startsWith(h + " "));
}

function isContactLine(line: string): boolean {
  // Lines with email, phone, linkedin, location patterns
  const patterns = [/@/, /\+?\d[\d\s\-()]{6,}/, /linkedin\.com/, /github\.com/];
  return patterns.some((p) => p.test(line));
}

function isBulletLine(line: string): boolean {
  return /^\s*[•\-*▪◦‣⁃]\s/.test(line) || /^\s*\d+[.)]\s/.test(line);
}

function isDateLine(line: string): boolean {
  return /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\b\s*\d{4}/i.test(line)
    || /\d{4}\s*[-–—]\s*(present|\d{4})/i.test(line)
    || /\b(expected|graduating|graduation)\b/i.test(line);
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|blockquote)[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

export function cvTextToStructuredHtml(input: string): string {
  // If already has rich HTML structure, return as-is
  if (/<h[12][^>]*>/.test(input) && /<(ul|li)[^>]*>/.test(input)) {
    return input;
  }

  const raw = input.includes("<") ? stripHtml(input) : input;
  const lines = raw.split("\n").map((l) => l.trim());

  const htmlParts: string[] = [];
  let inList = false;
  let isFirstNonEmpty = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      if (inList) {
        htmlParts.push("</ul>");
        inList = false;
      }
      continue;
    }

    // First non-empty line is likely the name
    if (isFirstNonEmpty) {
      isFirstNonEmpty = false;
      if (!isSectionHeader(line) && !isBulletLine(line)) {
        if (inList) { htmlParts.push("</ul>"); inList = false; }
        htmlParts.push(`<h1>${escapeHtml(line)}</h1>`);
        continue;
      }
    }

    // Contact line (email, phone, etc.)
    if (isContactLine(line) && !isSectionHeader(line) && !isBulletLine(line)) {
      if (inList) { htmlParts.push("</ul>"); inList = false; }
      htmlParts.push(`<p>${escapeHtml(line)}</p>`);
      continue;
    }

    // Section header
    if (isSectionHeader(line)) {
      if (inList) { htmlParts.push("</ul>"); inList = false; }
      htmlParts.push(`<h2>${escapeHtml(line.toUpperCase())}</h2>`);
      continue;
    }

    // Bullet line
    if (isBulletLine(line)) {
      const text = line.replace(/^\s*[•\-*▪◦‣⁃]\s*/, "").replace(/^\s*\d+[.)]\s*/, "");
      if (!inList) {
        htmlParts.push("<ul>");
        inList = true;
      }
      htmlParts.push(`<li>${escapeHtml(text)}</li>`);
      continue;
    }

    // Regular line
    if (inList) { htmlParts.push("</ul>"); inList = false; }
    htmlParts.push(`<p>${escapeHtml(line)}</p>`);
  }

  if (inList) htmlParts.push("</ul>");

  return htmlParts.join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Parses CV HTML/text into structured lines for docx export.
 */
export interface CvLine {
  type: "name" | "contact" | "section" | "subtitle" | "date" | "bullet" | "text";
  text: string;
}

export function parseCvToLines(input: string): CvLine[] {
  const raw = input.includes("<") ? stripHtml(input) : input;
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const result: CvLine[] = [];
  let isFirstLine = true;

  for (const line of lines) {
    if (isFirstLine) {
      isFirstLine = false;
      if (!isSectionHeader(line) && !isBulletLine(line)) {
        result.push({ type: "name", text: line });
        continue;
      }
    }

    if (isContactLine(line) && !isSectionHeader(line) && result.length <= 3) {
      result.push({ type: "contact", text: line });
    } else if (isSectionHeader(line)) {
      result.push({ type: "section", text: line.toUpperCase() });
    } else if (isBulletLine(line)) {
      const text = line.replace(/^\s*[•\-*▪◦‣⁃]\s*/, "").replace(/^\s*\d+[.)]\s*/, "");
      result.push({ type: "bullet", text });
    } else if (isDateLine(line)) {
      result.push({ type: "date", text: line });
    } else {
      result.push({ type: "text", text: line });
    }
  }

  return result;
}
