// Token-aware chunking for RAG ingestion.
//
// We deliberately avoid pulling tiktoken (large dependency, native bindings)
// and use a conservative character-based approximation: ~4 chars per token
// for English text. For embedding models with an 8k token limit this gives
// us plenty of headroom.
//
// Strategy:
//   1. Split text into paragraphs on double-newline.
//   2. Greedily pack paragraphs into chunks up to maxChars.
//   3. If any single paragraph exceeds maxChars, break it on sentence
//      boundaries; if still too big, hard-split.
//   4. Carry an overlap window between consecutive chunks so the embedding
//      retains context across boundaries (helps retrieval for queries that
//      span a chunk seam).
//
// Output: array of { text, chunkIndex, charStart, charEnd } for traceability.

const DEFAULT_TARGET_CHARS = 2400;   // ~600 tokens at 4 chars/token
const DEFAULT_OVERLAP_CHARS = 300;   // ~75 tokens of overlap
const HARD_MAX_CHARS = 6000;         // safety cap per chunk (~1500 tokens)

function splitParagraphs(text) {
  return text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
}

function splitSentences(paragraph) {
  // Conservative — split on sentence-ending punctuation followed by space + capital.
  // Keeps the punctuation with the preceding sentence.
  return paragraph
    .split(/(?<=[.!?])\s+(?=[A-Z"'(\[])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function hardSplit(text, maxChars) {
  const out = [];
  for (let i = 0; i < text.length; i += maxChars) {
    out.push(text.slice(i, i + maxChars));
  }
  return out;
}

/**
 * Chunk a document for embedding.
 *
 * @param {string} text — full document text
 * @param {object} [opts]
 * @param {number} [opts.targetChars=2400] — target chunk size in characters (~600 tokens)
 * @param {number} [opts.overlapChars=300] — characters of overlap between consecutive chunks
 * @returns {Array<{ text: string, chunkIndex: number, charStart: number, charEnd: number }>}
 */
export function chunkDocument(text, opts = {}) {
  const targetChars = opts.targetChars ?? DEFAULT_TARGET_CHARS;
  const overlapChars = opts.overlapChars ?? DEFAULT_OVERLAP_CHARS;

  if (typeof text !== 'string') {
    throw new TypeError('chunkDocument: text must be a string');
  }
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return [];

  const paragraphs = splitParagraphs(trimmed);

  // Phase 1: pack paragraphs into pre-chunks up to targetChars.
  const preChunks = [];
  let buf = '';
  for (const p of paragraphs) {
    // Any paragraph longer than the chunk target gets sentence-split so we
    // don't end up with a single oversized chunk.
    if (p.length > targetChars) {
      if (buf) { preChunks.push(buf); buf = ''; }
      const sentences = splitSentences(p);
      let inner = '';
      for (const s of sentences) {
        if (s.length > targetChars) {
          if (inner) { preChunks.push(inner); inner = ''; }
          for (const piece of hardSplit(s, targetChars)) preChunks.push(piece);
          continue;
        }
        if (inner.length + s.length + 1 > targetChars && inner) {
          preChunks.push(inner);
          inner = s;
        } else {
          inner = inner ? `${inner} ${s}` : s;
        }
      }
      if (inner) preChunks.push(inner);
      continue;
    }

    const candidate = buf ? `${buf}\n\n${p}` : p;
    if (candidate.length > targetChars && buf) {
      preChunks.push(buf);
      buf = p;
    } else {
      buf = candidate;
    }
  }
  if (buf) preChunks.push(buf);

  // Phase 2: build final chunks with overlap baked in. The overlap re-emits the
  // last `overlapChars` of the previous pre-chunk at the head of the next one.
  const finalChunks = [];
  let cursor = 0;
  for (let i = 0; i < preChunks.length; i += 1) {
    let body = preChunks[i];
    if (i > 0 && overlapChars > 0) {
      const prev = preChunks[i - 1];
      const overlap = prev.slice(-overlapChars);
      body = `${overlap}\n${body}`;
    }
    const charStart = cursor;
    const charEnd = cursor + preChunks[i].length;
    cursor = charEnd;
    finalChunks.push({
      text: body.trim(),
      chunkIndex: i,
      charStart,
      charEnd,
    });
  }

  return finalChunks;
}

export const __testing = {
  splitParagraphs,
  splitSentences,
  hardSplit,
  DEFAULT_TARGET_CHARS,
  DEFAULT_OVERLAP_CHARS,
  HARD_MAX_CHARS,
};
