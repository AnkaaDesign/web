#!/usr/bin/env node
/* RENOMEIA UM MATERIAL dentro de um `.glb`, sem tocar em geometria.
   ---------------------------------------------------------------------------
   Existe por uma razão só, e ela é estrutural no estúdio: **o engine despacha
   por NOME DE MATERIAL**. Acabamento, pintura, fita retrorrefletiva, lanterna,
   ferragem de inox — tudo casa nome. Um asset novo que traga a mesma peça com
   outro nome não entra em nada disso, sem erro nenhum.

   O caso que a criou: a unidade de refrigeração pequena
   (`thermoking_p360.glb`) chegou com os materiais do rip
   (`refri_mat_00NN_*`), e `TK_PAINT_SUB` em `models.ts` procura
   `tk-housing-white` para pôr a carcaça no conjunto de PINTURA. Sem o nome, a
   unidade fica branca quando o implemento é pintado — a do semirreboque
   acompanha e a do sobrechassi não.

   Só o chunk JSON é reescrito. A geometria (Draco inclusive) passa intacta,
   byte a byte, porque nome de material não vive nela.

   USO
       node tools/implement-bake/rename-material.mjs <glb> <de> <para> [--dry]
*/
import fs from 'node:fs';

const [file, de, para] = process.argv.slice(2);
const dry = process.argv.includes('--dry');
if (!file || !de || !para) {
  console.error('uso: rename-material.mjs <glb> <de> <para> [--dry]');
  process.exit(2);
}

const buf = fs.readFileSync(file);
if (buf.readUInt32LE(0) !== 0x46546c67) { console.error(file, 'não é GLB'); process.exit(2); }
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));

const alvo = (json.materials || []).filter((m) => m.name === de);
if (!alvo.length) {
  console.error(`material "${de}" não existe. Os que existem:`);
  for (const m of json.materials || []) console.error('   ', m.name);
  process.exit(1);
}
for (const m of alvo) m.name = para;
console.log(`${file}: "${de}" → "${para}" (${alvo.length} material(is))`);
if (dry) { console.log('--dry: nada escrito.'); process.exit(0); }

/* O chunk JSON tem de continuar alinhado em 4 e ser preenchido com ESPAÇO —
   é o que a especificação do GLB exige, e um byte a menos derruba o loader. */
const novo = Buffer.from(JSON.stringify(json), 'utf8');
const pad = (4 - (novo.length % 4)) % 4;
const jsonOut = Buffer.concat([novo, Buffer.alloc(pad, 0x20)]);
const resto = buf.subarray(20 + jsonLen);
const total = 12 + 8 + jsonOut.length + resto.length;
const out = Buffer.alloc(total);
out.writeUInt32LE(0x46546c67, 0);
out.writeUInt32LE(2, 4);
out.writeUInt32LE(total, 8);
out.writeUInt32LE(jsonOut.length, 12);
out.writeUInt32LE(0x4e4f534a, 16);
jsonOut.copy(out, 20);
resto.copy(out, 20 + jsonOut.length);
fs.writeFileSync(file, out);
console.log(`escrito · ${(total / 1024).toFixed(0)} kB`);
