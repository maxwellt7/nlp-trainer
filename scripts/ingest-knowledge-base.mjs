#!/usr/bin/env node
// Bootstrap the Pinecone knowledge base from a local folder of .txt/.pdf files.
//
// Usage:
//   ENABLE_PINECONE=true \
//   PINECONE_API_KEY=... \
//   PINECONE_INDEX_KNOWLEDGE=core-hypnosis-knowledge \
//   OPENAI_API_KEY=... \
//   node scripts/ingest-knowledge-base.mjs <folder-path>
//
// Idempotent: kb_documents (SQLite) tracks content hashes, so re-running on
// an unchanged file is a no-op.

import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ingestDocument, getRuntimeInfo } from '../server/services/knowledge-base.js';
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

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node scripts/ingest-knowledge-base.mjs <folder-path>');
    process.exit(1);
  }
  const root = resolve(target);
  console.log('ingest target:', root);

  console.log('Pinecone runtime:', JSON.stringify(await getRuntimeInfo(), null, 2));

  let processed = 0;
  let ingested = 0;
  let unchanged = 0;
  let skipped = 0;

  for await (const file of walk(root)) {
    const e = ext(file);
    if (!SUPPORTED.has(e)) {
      skipped += 1;
      continue;
    }
    try {
      const text = await extractTextByExtension(e, file);
      const r = await ingestDocument({
        source: `local:${file.slice(root.length + 1)}`,
        text,
        metadata: { filename: file.split('/').pop() },
      });
      processed += 1;
      if (r.status === 'ingested') ingested += 1;
      if (r.status === 'unchanged') unchanged += 1;
      console.log(`${r.status.padEnd(10)} ${file}  (${r.chunkCount} chunks)`);
    } catch (err) {
      console.warn(`error      ${file}: ${err.message}`);
    }
  }

  console.log(`\nDone. processed=${processed}, ingested=${ingested}, unchanged=${unchanged}, skipped(non-doc)=${skipped}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
