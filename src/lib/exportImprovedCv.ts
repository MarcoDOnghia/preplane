import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import { parseCvToLines } from "./cvParser";

/** Normalize date separators: replace ---, --, – with em dash — */
function normalizeDateSeparators(text: string): string {
  return text
    .replace(/\s*---\s*/g, " — ")
    .replace(/\s*--\s*/g, " — ")
    .replace(/\s*–\s*/g, " — ");
}

/** Section headers that should be bold + uppercase */
const SECTION_KEYWORDS = [
  "profile summary", "professional summary", "summary",
  "professional experience", "work experience", "experience",
  "education", "skills", "technical skills",
  "certifications", "certificates", "languages",
  "projects", "awards", "volunteer", "references",
  "additional", "interests", "publications", "activities",
  "extracurricular", "leadership", "research",
];

function isSectionText(text: string): boolean {
  const lower = text.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  return SECTION_KEYWORDS.some((h) => lower === h || lower.startsWith(h + " "));
}

export async function exportImprovedCv(
  cvHtml: string,
  userName: string,
  jobTitle: string
) {
  const lines = parseCvToLines(cvHtml);
  const children: Paragraph[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const normalizedText = normalizeDateSeparators(line.text);

    switch (line.type) {
      case "name":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: normalizedText.toUpperCase(),
                bold: true,
                size: 24, // 12pt
                font: "Arial",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          })
        );
        break;

      case "contact":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: normalizedText,
                size: 20, // 10pt
                font: "Arial",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
          })
        );
        // Add extra space after the last contact line
        const nextLine = lines[i + 1];
        if (!nextLine || nextLine.type !== "contact") {
          children.push(new Paragraph({ spacing: { after: 200 } }));
        }
        break;

      case "section":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: normalizedText.toUpperCase(),
                bold: true,
                size: 22, // 11pt
                font: "Arial",
              }),
            ],
            spacing: { before: 280, after: 120 },
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: "444444",
              },
            },
          })
        );
        break;

      case "subtitle": {
        // Subtitles (job title, company, degree) are bold but NOT uppercase
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: normalizedText,
                bold: true,
                size: 22, // 11pt
                font: "Arial",
              }),
            ],
            spacing: { before: 80, after: 40 },
          })
        );
        break;
      }

      case "date":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: normalizedText,
                italics: true,
                size: 22, // 11pt
                font: "Arial",
              }),
            ],
            spacing: { after: 60 },
          })
        );
        break;

      case "bullet":
        // Bullets are NEVER bold — plain 11pt body text
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: normalizedText,
                bold: false,
                size: 22, // 11pt
                font: "Arial",
              }),
            ],
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
        break;

      case "text":
      default:
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: normalizedText,
                bold: false,
                size: 22, // 11pt
                font: "Arial",
              }),
            ],
            spacing: { after: 60 },
          })
        );
        break;
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const date = new Date().toISOString().slice(0, 10);
  const safeName = (userName || "CV").replace(/\s+/g, "_");
  saveAs(blob, `${safeName}_CV_Tailored_${date}.docx`);
}

export function copyToClipboard(cvHtml: string): string {
  const text = cvHtml
    .replace(/<\/?(p|div|br)[^>]*>/gi, "\n")
    .replace(/<\/?(h[1-6])[^>]*>/gi, "\n")
    .replace(/<\/?(li)[^>]*>/gi, "\n• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}
