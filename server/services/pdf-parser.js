// Minimal PDF text extraction using pdf-parse.
// Returns plain text with paragraph breaks preserved.

import { readFile } from 'node:fs/promises';

export async function extractTextFromPdf(filepathOrBuffer) {
  const { default: pdfParse } = await import('pdf-parse');
  const buffer = Buffer.isBuffer(filepathOrBuffer)
    ? filepathOrBuffer
    : await readFile(filepathOrBuffer);
  const result = await pdfParse(buffer);
  // pdf-parse already collapses page-internal whitespace; we just normalize
  // multi-blank-line runs that come from page breaks.
  return result.text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
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
