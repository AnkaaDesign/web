#!/usr/bin/env node
/* O ERRO DE RECONSTRUÇÃO DE CADA VARIANTE — o número com o qual se ESCOLHE.
   ===========================================================================

   POR QUE ISTO EXISTE
   ---------------------------------------------------------------------------
   `core/quality.ts` decide a variante de chão por um número: "UASTC/BC7 a
   2048²: erro de 0,11 a 5,80, contra 0,66–13,11 do resize a 1024²". Esse número
   é a coisa mais importante do campo `groundVariant`, e até agora ele estava
   escrito no comentário sem uma ferramenta que o reproduzisse.

   Aqui ele é reproduzido, e — o que motivou o arquivo — ESTENDIDO para a
   variante nova. `@ktx2-1k` soma DOIS erros: a reamostragem para 1024² **e** a
   compressão UASTC. A pergunta que decide se ela pode ser o degrau do nível
   Baixo é se essa soma fica melhor ou pior que o resize simples a 1024², que é
   o degrau que ela substitui. Não dá para responder por raciocínio; tem de
   medir.

   A MÉTRICA, e por que ela é esta
   ---------------------------------------------------------------------------
   Erro absoluto médio por canal, em 0..255, contra o arquivo ORIGINAL em
   resolução cheia — e o que se compara é sempre uma imagem de 2048², porque é
   nessa taxa que o shader amostra. Uma variante de 1024² é decodificada,
   reamostrada de volta para 2048² (Lanczos, o mesmo filtro da redução) e só
   então comparada. Medir 1024² contra 1024² responderia "a compressão foi boa?"
   quando a pergunta é "o chão ficou parecido?".

   ⚠️ ALFA FORA DA CONTA. Os 16 mapas de chão são opacos; incluir um canal
   constante só diluiria o erro dos três que importam. Se um dia entrar um mapa
   com alfa de verdade, esta linha tem de mudar junto.

   ⚠️ O QUE ESTE NÚMERO **NÃO** É: uma métrica perceptual. Ele não sabe que 3 de
   erro num `_rough` quase uniforme é invisível e 3 de erro num `_nor` de grama
   muda a estatística do grão — que é exatamente a armadilha que
   `core/quality.ts` documenta ter pego o `@1k`. Ele serve para COMPARAR duas
   codificações do MESMO arquivo, que é o uso aqui. Para decidir se um valor
   absoluto é aceitável, ainda é preciso olhar.

   ⚠️ O TRANSCODIFICADOR TEM DE SER CARREGADO À MÃO, e a razão é uma armadilha
   de verdade: `public/vendor/basis/basis_transcoder.js` é UMD e termina em
       if (typeof exports === 'object' && typeof module === 'object')
         module.exports = BASIS;
   O `package.json` do web declara `"type": "module"`, então o Node trata todo
   `.js` da árvore como ESM — `module` e `exports` não existem, o ramo UMD não
   roda, e um `require()`/`import()` devolve **`{}` sem erro nenhum**. Por isso
   o arquivo é lido como TEXTO e avaliado num escopo com `module` de mentira.
   (No navegador nada disso acontece: o `KTX2Loader` o carrega por
   `importScripts` dentro de um Worker, onde ele é um script clássico.)

   USO
   ---------------------------------------------------------------------------
       node tools/studio-assets/erro-ktx2.mjs                    # as duas variantes
       node tools/studio-assets/erro-ktx2.mjs --variantes @ktx2-1k
       node tools/studio-assets/erro-ktx2.mjs --alvo public/models/vehicles/panels

   Sem argumento ele mede `public/textures/` e inclui a coluna `resize` — o
   degrau de comparação, calculado na hora (reduz a 1024² e volta), que é o
   número contra o qual a variante de 1024² tem de ganhar. */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename } from 'node:path';
import { createRequire } from 'node:module';

const RAIZ_REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const DIR_BASIS = join(RAIZ_REPO, 'public/vendor/basis') + '/';

/* cTFRGBA32 na tabela do basis_universal — a única saída NÃO comprimida do
   transcodificador, e a única com que dá para medir erro. */
const cTFRGBA32 = 13;

/** Carrega o transcodificador UMD apesar do `"type": "module"`. Ver o topo.
 *
 *  ⚠️ O `require` TEM DE SER PASSADO. O glue do emscripten detecta que está em
 *  Node e usa `require('fs')`/`require('path')` para ler o `.wasm` do disco —
 *  num escopo ESM esse identificador não existe e o módulo morre com
 *  "require is not defined" **depois** de já ter sido avaliado. `createRequire`
 *  fabrica um resolvedor ancorado neste arquivo, que é o que ele espera. */
async function carregarBasis() {
  const src = readFileSync(join(DIR_BASIS, 'basis_transcoder.js'), 'utf8');
  const mod = { exports: {} };
  const req = createRequire(import.meta.url);
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'define', 'require', '__filename', '__dirname', src)(
    mod, mod.exports, undefined, req, join(DIR_BASIS, 'basis_transcoder.js'), DIR_BASIS);
  const BASIS = mod.exports;
  if (typeof BASIS !== 'function')
    throw new Error('basis_transcoder.js não exportou uma função — o ramo UMD não rodou');
  const M = await BASIS({ locateFile: (f) => join(DIR_BASIS, f) });
  M.initializeBasis();
  if (!M.KTX2File) throw new Error('este basis_transcoder não tem KTX2File');
  return M;
}

/** RGBA cru de uma imagem, opcionalmente reamostrada. */
function rgba(caminho, lado) {
  const args = [caminho];
  if (lado) args.push('-filter', 'Lanczos', '-resize', `${lado}x${lado}!`);
  args.push('-depth', '8', 'RGBA:-');
  return new Uint8Array(execFileSync('magick', args, { maxBuffer: 1 << 30 }));
}

/** Reamostra um RGBA cru em memória (usado para levar 1024² de volta a 2048²). */
function reamostrar(buf, de, para) {
  const out = execFileSync('magick',
    ['-size', `${de}x${de}`, '-depth', '8', 'RGBA:-',
      '-filter', 'Lanczos', '-resize', `${para}x${para}!`, '-depth', '8', 'RGBA:-'],
    { input: Buffer.from(buf), maxBuffer: 1 << 30 });
  return new Uint8Array(out);
}

/** Erro absoluto médio em RGB, 0..255. Alfa fora — ver o topo. */
function erro(a, b) {
  if (a.length !== b.length) throw new Error(`tamanhos diferentes: ${a.length} vs ${b.length}`);
  let s = 0; let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    n += 3;
  }
  return s / n;
}

/** Nível 0 de um `.ktx2`, em RGBA cru, pelo mesmo wasm que o navegador usa. */
function decodificarKtx2(M, caminho) {
  const f = new M.KTX2File(new Uint8Array(readFileSync(caminho)));
  try {
    if (!f.isValid()) throw new Error('KTX2 inválido: ' + basename(caminho));
    if (!f.startTranscoding()) throw new Error('startTranscoding falhou: ' + basename(caminho));
    const w = f.getWidth(); const h = f.getHeight();
    const n = f.getImageTranscodedSizeInBytes(0, 0, 0, cTFRGBA32);
    const dst = new Uint8Array(n);
    if (!f.transcodeImage(dst, 0, 0, 0, cTFRGBA32, 0, -1, -1))
      throw new Error('transcodeImage falhou: ' + basename(caminho));
    return { data: dst, w, h, uastc: f.isUASTC() };
  } finally { f.close(); f.delete(); }
}

async function main() {
  const argv = process.argv.slice(2);
  const iA = argv.indexOf('--alvo');
  const dir = iA >= 0 ? argv[iA + 1] : join(RAIZ_REPO, 'public/textures');
  const iV = argv.indexOf('--variantes');
  const variantes = iV >= 0 ? argv[iV + 1].split(',') : ['@ktx2', '@ktx2-1k'];
  const comResize = !argv.includes('--sem-resize');

  const M = await carregarBasis();

  /* As origens são os arquivos SEM `@` no nome — a variante é sufixo, então o
     original é o que não tem nenhum. */
  const origens = readdirSync(dir)
    .filter((f) => /\.(webp|jpg|jpeg|png)$/i.test(f) && !f.includes('@'))
    .sort();

  console.log(`\n═══ erro de reconstrução — ${dir}`);
  console.log('  (erro absoluto médio em RGB, 0..255, contra o ORIGINAL na resolução cheia)\n');
  const cab = 'arquivo'.padEnd(22) + 'dims'.padStart(11)
    + variantes.map((v) => v.padStart(11)).join('') + (comResize ? '     resize1k' : '');
  console.log(cab);
  console.log('-'.repeat(cab.length));

  const acum = {};
  for (const v of variantes) acum[v] = [];
  const acumResize = [];

  for (const f of origens) {
    const orig = join(dir, f);
    const [w, h] = execFileSync('identify', ['-format', '%w %h', orig]).toString().trim().split(/\s+/).map(Number);
    const ref = rgba(orig);
    const cols = [];
    for (const v of variantes) {
      const alvo = join(dir, f.replace(/\.[^.]+$/, `${v}.ktx2`));
      if (!existsSync(alvo)) { cols.push('—'.padStart(11)); continue; }
      const d = decodificarKtx2(M, alvo);
      /* De volta à taxa de amostragem do original antes de comparar. */
      const igual = d.w === w && d.h === h ? d.data : reamostrar(d.data, d.w, w);
      const e = erro(ref, igual);
      acum[v].push({ f, e });
      cols.push(e.toFixed(2).padStart(11));
    }
    let cr = '';
    if (comResize && w >= 2048) {
      /* O DEGRAU DE COMPARAÇÃO: reduzir a 1024² e voltar, sem comprimir nada.
         É o `@1k` que `core/quality.ts` mede em 0,66–13,11 — e é contra ELE que
         a variante comprimida de 1024² tem de ganhar para valer a pena. */
      const e = erro(ref, reamostrar(rgba(orig, 1024), 1024, w));
      acumResize.push({ f, e });
      cr = e.toFixed(2).padStart(13);
    }
    console.log(basename(f).padEnd(22) + `${w}x${h}`.padStart(11) + cols.join('') + cr);
  }

  console.log('');
  const faixa = (l) => l.length
    ? `${Math.min(...l.map((x) => x.e)).toFixed(2)} … ${Math.max(...l.map((x) => x.e)).toFixed(2)}`
      + `  (média ${(l.reduce((a, x) => a + x.e, 0) / l.length).toFixed(2)}, pior: ${l.slice().sort((a, b) => b.e - a.e)[0].f})`
    : '(nenhum arquivo)';
  for (const v of variantes) console.log(`  ${v.padEnd(11)} ${faixa(acum[v])}`);
  if (comResize) console.log(`  ${'resize 1k'.padEnd(11)} ${faixa(acumResize)}`);
}

const ehPrograma = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (ehPrograma) main().catch((e) => { console.error(e); process.exit(1); });
