import { createHash } from "node:crypto";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ExtractedPdf, ExtractedPdfPage, TextChunk } from "./types.js";

type TextItemLike = {
  str?: string;
};

export async function extractEmbeddedPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  const data = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: true
  });

  const document = await loadingTask.promise;
  const pages: ExtractedPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => (item as TextItemLike).str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({
      pageNumber,
      text,
      textQuality: estimateTextQuality(text)
    });
  }

  const fullText = pages.map((page) => page.text).join("\n\n").trim();

  await document.destroy();

  return {
    pageCount: document.numPages,
    pages,
    fullText,
    sha256Hash: createHash("sha256").update(buffer).digest("hex")
  };
}

export function buildTextChunks(pages: ExtractedPdfPage[], maxChunkChars: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  let currentText = "";
  let currentPages = new Set<number>();

  for (const page of pages) {
    if (!page.text) {
      continue;
    }

    const pageText = `[page ${page.pageNumber}]\n${page.text}`;
    const separator = currentText ? "\n\n" : "";
    const nextText = `${currentText}${separator}${pageText}`;

    if (currentText && nextText.length > maxChunkChars) {
      chunks.push(toChunk(chunks.length, currentText, currentPages));
      currentText = pageText;
      currentPages = new Set([page.pageNumber]);
      continue;
    }

    currentText = nextText;
    currentPages.add(page.pageNumber);
  }

  if (currentText) {
    chunks.push(toChunk(chunks.length, currentText, currentPages));
  }

  return chunks;
}

function toChunk(chunkIndex: number, text: string, pageNumbers: Set<number>): TextChunk {
  return {
    chunkIndex,
    text,
    tokenCountEstimate: estimateTokenCount(text),
    pageNumbers: [...pageNumbers].sort((a, b) => a - b)
  };
}

function estimateTextQuality(text: string): number {
  if (!text) {
    return 0;
  }

  const printableCharacters = [...text].filter((char) => char >= " " && char !== "\uFFFD").length;
  return Math.min(1, Number((printableCharacters / text.length).toFixed(2)));
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
