import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import { parseCvToLines } from "./cvParser";

export async function exportImprovedCv(
  cvHtml: string,
  userName: string,
  jobTitle: string
) {
  const lines = parseCvToLines(cvHtml);
  const children: Paragraph[] = [];

  for (const line of lines) {
    switch (line.type) {
      case "name":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.text.toUpperCase(),
                bold: true,
                size: 28, // 14pt
                font: "Calibri",
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
                text: line.text,
                size: 22, // 11pt
                font: "Calibri",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );
        break;

      case "section":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                bold: true,
                size: 24, // 12pt
                font: "Calibri",
              }),
            ],
            spacing: { before: 240, after: 80 },
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

      case "date":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                italics: true,
                size: 22,
                font: "Calibri",
              }),
            ],
            spacing: { after: 60 },
          })
        );
        break;

      case "bullet":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                size: 22,
                font: "Calibri",
              }),
            ],
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
        break;

      case "subtitle":
      case "text":
      default:
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.text,
                size: 22,
                font: "Calibri",
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
