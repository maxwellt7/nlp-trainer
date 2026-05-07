import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const src = require.resolve('sql.js/dist/sql-wasm.wasm');
const dest = resolve(repoRoot, 'server/db/sql-wasm.wasm');

if (!existsSync(dirname(dest))) {
  mkdirSync(dirname(dest), { recursive: true });
}
copyFileSync(src, dest);
console.log(`copied ${src} -> ${dest}`);
