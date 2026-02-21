import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";

/**
 * Convert HTML from TipTap editor to docx paragraphs.
 * Strips tags and creates ATS-friendly structure.
 */
function htmlToPlainLines(html: string): string[] {
  // Replace block elements with newlines, strip remaining tags
  const text = html
    .replace(/<\/?(p|div|br|h[1-6]|li|ul|ol)[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

function isHeadingLine(line: string): boolean {
  const headings = [
    "summary", "experience", "education", "skills", "projects",
    "certifications", "awards", "languages", "references",
    "professional experience", "work experience", "technical skills",
    "professional summary", "objective", "contact", "about",
  ];
  return headings.some((h) => line.toLowerCase().startsWith(h));
}

export async function exportImprovedCv(
  cvHtml: string,
  userName: string,
  jobTitle: string
) {
  const lines = htmlToPlainLines(cvHtml);
  const children: Paragraph[] = [];

  for (const line of lines) {
    if (isHeadingLine(line)) {
      children.push(
        new Paragraph({
          text: line.toUpperCase(),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
          border: {
            bottom: { style: "single" as any, size: 6, color: "999999" },
          },
        })
      );
    } else if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.replace(/^[•\-*]\s*/, ""),
              size: 22,
              font: "Calibri",
            }),
          ],
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 22, font: "Calibri" })],
          spacing: { after: 100 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
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
