// Minimal PDF text extraction using pdf-parse v2 (PDFParse class API).
// Returns plain text with paragraph breaks preserved.

import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

export async function extractTextFromPdf(filepathOrBuffer) {
  const buffer = Buffer.isBuffer(filepathOrBuffer)
    ? filepathOrBuffer
    : await readFile(filepathOrBuffer);
  // PDFParse expects a Uint8Array via the `data` option in v2.
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return (result.text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  } finally {
    if (typeof parser.destroy === 'function') {
      try { await parser.destroy(); } catch { /* ignore */ }
    }
  }
}

export async function extractTextFromTxt(filepathOrBuffer) {
  if (Buffer.isBuffer(filepathOrBuffer)) {
    return filepathOrBuffer.toString('utf8').trim();
  }
  const buf = await readFile(filepathOrBuffer);
  return buf.toString('utf8').trim();
}

export async function extractTextByExtension(extension, filepathOrBuffer) {
  const ext = (extension || '').toLowerCase().replace(/^\./, '');
  if (ext === 'pdf') return extractTextFromPdf(filepathOrBuffer);
  if (ext === 'txt' || ext === 'md' || ext === 'markdown') return extractTextFromTxt(filepathOrBuffer);
  throw new Error(`Unsupported document extension: .${ext}`);
}
