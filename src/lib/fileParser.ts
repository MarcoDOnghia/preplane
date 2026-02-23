import mammoth from "mammoth";

export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  let text = "";
  if (extension === "docx") {
    text = await extractFromDocx(file);
  } else if (extension === "pdf") {
    text = await extractFromPdf(file);
  } else {
    throw new Error("Unsupported file type. Please upload a .pdf or .docx file.");
  }

  if (!text || text.trim().length < 20) {
    throw new Error("Could not read your CV - please make sure it is not a scanned image");
  }

  console.log("CV extracted text (first 500 chars):", text.substring(0, 500));

  return text;
}

async function extractFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  
  const workerUrl = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    
    // Reconstruct text preserving line structure using Y-coordinate grouping
    const items = content.items as any[];
    if (items.length === 0) {
      continue;
    }
    
    // Sort by Y position (descending = top to bottom), then X position (left to right)
    const sorted = [...items].sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) < 3) return a.transform[4] - b.transform[4]; // same line
      return yDiff;
    });
    
    const lines: string[] = [];
    let currentLine = "";
    let lastY = sorted[0]?.transform[5] ?? 0;
    
    for (const item of sorted) {
      const y = item.transform[5];
      if (Math.abs(y - lastY) > 3) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = item.str;
        lastY = y;
      } else {
        if (currentLine && !currentLine.endsWith(" ") && item.str && !item.str.startsWith(" ")) {
          currentLine += " ";
        }
        currentLine += item.str;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    
    textParts.push(lines.join("\n"));
  }

  return textParts.join("\n\n");
}
