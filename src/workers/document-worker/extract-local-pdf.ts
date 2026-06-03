import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { buildTextChunks, extractEmbeddedPdfText } from "./pdf.js";

const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error("Usage: npm run worker:extract-local -- <path-to-pdf>");
  process.exit(1);
}

const buffer = await readFile(pdfPath);
const extracted = await extractEmbeddedPdfText(buffer);
const chunks = buildTextChunks(extracted.pages, 5000);

console.info(JSON.stringify(
  {
    file: basename(pdfPath),
    sha256Hash: extracted.sha256Hash,
    pageCount: extracted.pageCount,
    pagesWithText: extracted.pages.filter((page) => page.text.length > 0).length,
    chunks: chunks.length,
    preview: extracted.fullText.slice(0, 1000)
  },
  null,
  2
));
