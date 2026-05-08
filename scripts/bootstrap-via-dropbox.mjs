#!/usr/bin/env node
// One-shot bootstrap that pulls every supported file from a Dropbox folder
// (recursively) and runs it through the same ingestion pipeline as the cron
// sync. Useful when local Dropbox sync hasn't materialized files yet.
//
// Usage:
//   ENABLE_PINECONE=true PINECONE_API_KEY=... PINECONE_INDEX_KNOWLEDGE=...
//   DROPBOX_ACCESS_TOKEN=... DROPBOX_KNOWLEDGE_FOLDER='/path/to/folder'
//   node scripts/bootstrap-via-dropbox.mjs

import { runSyncOnce } from '../server/services/dropbox-sync.js';
import { getRuntimeInfo } from '../server/services/knowledge-base.js';

console.log('Pinecone runtime:', JSON.stringify(await getRuntimeInfo(), null, 2));
console.log('Dropbox folder  :', process.env.DROPBOX_KNOWLEDGE_FOLDER);
console.log('');

const summary = await runSyncOnce();
console.log('\n--- summary ---');
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.errors && summary.errors.length > 0 ? 1 : 0);
