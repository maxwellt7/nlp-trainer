// Shared NLP knowledge-base rendering.
//
// The curated NLP corpus lives as structured JSON in server/data/*.json. Two
// consumers need it as readable TEXT rather than raw JSON:
//   1. The coaching system prompt — a CONDENSED markdown digest (keeps every
//      technique always-on but at a fraction of the token weight of
//      JSON.stringify, and reads far better for the model).
//   2. Pinecone ingestion — a fuller markdown rendering, chunked + embedded so
//      the coach can retrieve specifics on demand.
//
// One renderer serves both; callers tune `maxArrayItems` for density.

import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

// These two are NOT general NLP technique content:
//   modules.json          — Learn course curriculum scaffolding
//   coaching-frameworks.json — handled as its own block
const NLP_EXCLUDE = new Set(['modules.json', 'coaching-frameworks.json']);

function humanizeKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')   // camelCase → camel Case
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPrimitive(v) {
  return v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function omitKey(obj, key) {
  const { [key]: _omit, ...rest } = obj;
  return rest;
}

// Render an arbitrary JSON value as compact markdown. Long arrays are trimmed
// to `maxArrayItems` with a "(+N more)" marker so the digest stays bounded
// regardless of how example-heavy a source file is.
export function jsonToMarkdown(value, { depth = 0, maxArrayItems = 3 } = {}) {
  const indent = '  '.repeat(Math.max(0, depth));

  if (isPrimitive(value)) {
    return value === null ? '' : String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    const shown = value.slice(0, maxArrayItems);
    const extra = value.length - shown.length;
    const lines = shown.map((item) => {
      if (isPrimitive(item)) {
        return `${indent}- ${String(item)}`;
      }
      // Object item: render its fields inline as a titled bullet.
      const rendered = jsonToMarkdown(item, { depth: depth + 1, maxArrayItems });
      return `${indent}- ${rendered.replace(/^\s+/, '')}`;
    });
    if (extra > 0) lines.push(`${indent}- (+${extra} more)`);
    return lines.join('\n');
  }

  // Object: emit "**Key:** value" for primitives, nested blocks otherwise.
  const parts = [];
  for (const [key, v] of Object.entries(value)) {
    if (v === null || v === undefined || v === '') continue;
    const label = humanizeKey(key);
    if (isPrimitive(v)) {
      parts.push(`${indent}**${label}:** ${String(v)}`);
    } else if (Array.isArray(v) && v.every(isPrimitive)) {
      const shown = v.slice(0, maxArrayItems);
      const extra = v.length - shown.length;
      const inline = shown.map(String).join('; ') + (extra > 0 ? ` (+${extra} more)` : '');
      parts.push(`${indent}**${label}:** ${inline}`);
    } else {
      const rendered = jsonToMarkdown(v, { depth: depth + 1, maxArrayItems });
      if (rendered.trim()) parts.push(`${indent}**${label}:**\n${rendered}`);
    }
  }
  return parts.join('\n');
}

// Load the curated NLP technique files (same set the coach uses), as
// { name, data } objects in a stable, readable order.
export function loadNlpFiles() {
  const files = readdirSync(dataDir)
    .filter((f) => f.endsWith('.json') && !NLP_EXCLUDE.has(f))
    .sort();
  const out = [];
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(dataDir, file), 'utf-8'));
      out.push({ name: file.replace('.json', ''), data });
    } catch (err) {
      console.warn(`[nlp-content] skipping ${file}: ${err.message}`);
    }
  }
  return out;
}

// Condensed digest for the coaching system prompt: every file as a titled
// section, examples trimmed. Replaces the old ~28k-token JSON.stringify dump
// with a tighter (~10k-token) prose rendering that keeps all techniques present.
export function renderNlpDigest(nlpContent, { maxArrayItems = 3 } = {}) {
  // nlpContent is the { name: data } map the coach already builds; render each.
  const sections = [];
  for (const [name, data] of Object.entries(nlpContent || {})) {
    const isObj = data && typeof data === 'object' && !Array.isArray(data);
    const title = (isObj && data.title) ? data.title : humanizeKey(name);
    // Drop the `title` key from the body — it's already the heading.
    const body = jsonToMarkdown(isObj ? omitKey(data, 'title') : data, { maxArrayItems });
    if (body.trim()) sections.push(`### ${title}\n${body}`);
  }
  return sections.join('\n\n');
}

// Fuller markdown for one file, used when ingesting into Pinecone (keeps more
// examples so retrieval has richer material to match against).
export function renderNlpFileForIngest(name, data, { maxArrayItems = 12 } = {}) {
  const title = (data && typeof data === 'object' && data.title) ? data.title : humanizeKey(name);
  return `# ${title}\n\n${jsonToMarkdown(data, { maxArrayItems })}`;
}
