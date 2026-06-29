// Marks dist/esm output as ES modules so Node resolves the "import" condition
// correctly while the package root stays CommonJS (dist/cjs).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../dist/esm/package.json');

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify({ type: 'module' }, null, 2) + '\n');
