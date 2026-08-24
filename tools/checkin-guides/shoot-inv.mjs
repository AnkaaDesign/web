/* Roda `inv.ts` e escreve o inventário em `inventario.json`. */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openBench, TOOL } from './harness.mjs';

const { page, close } = await openBench('inv.ts', { width: 640, height: 400 });
const inv = await page.evaluate('window.__inv || null');
await close();

const out = join(TOOL, 'inventario.json');
await writeFile(out, JSON.stringify(inv, null, 1));
console.log('malhas', inv?.meshes, '· materiais', inv?.materiais?.length);
console.log('→', out);
