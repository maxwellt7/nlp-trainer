#!/usr/bin/env node
// Bootstrap the Pinecone knowledge base from a local folder of .txt/.pdf files.
//
// Usage:
//   ENABLE_PINECONE=true \
//   PINECONE_API_KEY=... \
//   PINECONE_INDEX_KNOWLEDGE=sacred-heart \
//   OPENAI_API_KEY=... \
//   node scripts/ingest-knowledge-base.mjs <folder-path> [--category <label>]
//
// --category tags every chunk with metadata.category=<label>, used at retrieval
// time to filter (e.g. only NLP chunks for hypnosis script generation).
//
// If --category is omitted, the script tries to infer it from the parent
// folder name: "NLP" → 'nlp', "Coaching Knowledge" → 'coaching'. If it can't
// infer, chunks are stored without a category.
//
// Idempotent: kb_documents (SQLite) tracks content hashes, so re-running on
// an unchanged file is a no-op.

import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ingestDocument, getRuntimeInfo, CATEGORY_NLP, CATEGORY_COACHING } from '../server/services/knowledge-base.js';
import { extractTextByExtension } from '../server/services/pdf-parser.js';

const SUPPORTED = new Set(['txt', 'md', 'markdown', 'pdf']);

async function* walk(dir) {
  for (const name of await readdir(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) yield* walk(full);
    else if (s.isFile()) yield full;
  }
}

function ext(p) {
  const m = p.match(/\.([^./\\]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function inferCategory(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('nlp')) return CATEGORY_NLP;
  if (lower.includes('coaching')) return CATEGORY_COACHING;
  return null;
}

function parseArgs(argv) {
  const out = { positional: [], category: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--category') { out.category = argv[++i]; continue; }
    out.positional.push(a);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args.positional[0];
  if (!target) {
    console.error('Usage: node scripts/ingest-knowledge-base.mjs <folder-path> [--category <label>]');
    process.exit(1);
  }
  const root = resolve(target);
  const explicitCategory = args.category;
  const inferredCategory = explicitCategory || inferCategory(root.split('/').pop());

  console.log('ingest target:', root);
  console.log('category    :', explicitCategory || (inferredCategory ? `${inferredCategory} (inferred)` : '(none)'));
  console.log('Pinecone    :', JSON.stringify(await getRuntimeInfo(), null, 2));

  let processed = 0;
  let ingested = 0;
  let unchanged = 0;
  let skipped = 0;
  let zeroByteFiles = 0;

  for await (const file of walk(root)) {
    const e = ext(file);
    if (!SUPPORTED.has(e)) {
      skipped += 1;
      continue;
    }
    try {
      const s = await stat(file);
      if (s.size === 0) {
        zeroByteFiles += 1;
        console.warn(`zero-byte  ${file}  (likely Dropbox online-only — make available offline first)`);
        continue;
      }
      const text = await extractTextByExtension(e, file);
      const fileCategory = explicitCategory || inferCategory(file.split('/').slice(-2)[0]) || inferredCategory;
      const r = await ingestDocument({
        source: `local:${file.slice(root.length + 1)}`,
        text,
        category: fileCategory,
        metadata: { filename: file.split('/').pop() },
      });
      processed += 1;
      if (r.status === 'ingested') ingested += 1;
      if (r.status === 'unchanged') unchanged += 1;
      console.log(`${r.status.padEnd(10)} ${(fileCategory || '-').padEnd(8)} ${file}  (${r.chunkCount} chunks)`);
    } catch (err) {
      console.warn(`error      ${file}: ${err.message}`);
    }
  }

  console.log(`\nDone. processed=${processed}, ingested=${ingested}, unchanged=${unchanged}, skipped(non-doc)=${skipped}, zeroByte=${zeroByteFiles}`);
  if (zeroByteFiles > 0) {
    console.log('\nReminder: zero-byte files are Dropbox online-only placeholders.');
    console.log('Right-click the folder in Finder → "Make available offline" → re-run this script.');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
