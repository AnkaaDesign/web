#!/usr/bin/env node
/* O VEREDITO DA TROCA DE ACERVO — compara duas execuções de
   `tools/studio-bench/checks-geometria-partilhada.mjs`.
   ===========================================================================

   POR QUE UM COMPARADOR EXTERNO, E NÃO UM PORTÃO DENTRO DA BANCADA
   ---------------------------------------------------------------------------
   A pergunta que decide se `public/models/vehicles/trailer.glb` pode ser
   trocado pelo deduplicado é: **a malharia sai igual?** E "igual" só tem
   sentido contra o arquivo de HOJE — não existe forma de derivar, de dentro da
   página, onde cada peça deveria estar depois de um redimensionamento. O
   estado correto é, literalmente, o que o acervo original produz.

   Então o portão é entre DUAS execuções, e este arquivo é o juiz:

       node tools/studio-bench/bench.mjs --geometry \
         --checks checks-geometria-partilhada.mjs > /tmp/base.txt      # asset de hoje
       cp trailer.dedup.glb public/models/vehicles/trailer.glb          # ← só depois
       node tools/studio-bench/bench.mjs --geometry \
         --checks checks-geometria-partilhada.mjs > /tmp/dedup.txt
       node tools/studio-assets/diff-impressao.mjs /tmp/base.txt /tmp/dedup.txt

   ⚠️ A ORDEM IMPORTA: a linha de base tem de ser tirada ANTES da troca. Tirar
   as duas depois compara o arquivo novo consigo mesmo e aprova qualquer coisa.

   TOLERÂNCIA
   ---------------------------------------------------------------------------
   A impressão digital vem em DÉCIMOS DE MILÍMETRO, e a comparação é exata por
   padrão. `--tol N` afrouxa para N décimos de mm em cada componente da caixa —
   útil se algum dia entrar aritmética que reordene somas (a deduplicação não
   reordena nada, então a expectativa honesta aqui é ZERO diferença).

   O que ele SEMPRE reporta como falha, independente da tolerância:
     · uma peça presente numa execução e ausente na outra;
     · uma peça visível numa e invisível na outra;
     · uma peça que virou degenerada (caixa < 1 mm nos três eixos) só num lado —
       é o modo de falhar mais grave do compartilhamento, e o mais silencioso. */

import { readFileSync } from 'node:fs';

/** Extrai `IMPRESSAO-h250` de um relatório da bancada. */
function extrair(caminho) {
  const txt = readFileSync(caminho, 'utf8');
  /* O bench imprime `  =    NOME → JSON`. O JSON é uma string com aspas. */
  const m = /IMPRESSAO-h250 → (".*")\s*$/m.exec(txt);
  if (!m) throw new Error(`não achei IMPRESSAO-h250 em ${caminho} — a execução falhou antes?`);
  const linhas = JSON.parse(m[1]).split(';').filter(Boolean);
  const mapa = new Map();
  for (const l of linhas) {
    const i = l.indexOf('|');
    const j = l.indexOf('|', i + 1);
    mapa.set(l.slice(0, i), { vis: l.slice(i + 1, j), caixa: l.slice(j + 1) });
  }
  return mapa;
}

const degenerada = (c) => {
  if (c === 'vazia') return true;
  const p = c.split(',').map(Number);
  return p.length === 6 && p[3] < 1 && p[4] < 1 && p[5] < 1;   // extensões em décimos de mm
};

function main() {
  const [a, b] = process.argv.slice(2).filter((s) => !s.startsWith('--'));
  if (!a || !b) { console.log('uso: diff-impressao.mjs BASE.txt CANDIDATO.txt [--tol N]'); process.exit(1); }
  const iT = process.argv.indexOf('--tol');
  const tol = iT >= 0 ? Number(process.argv[iT + 1]) : 0;

  const A = extrair(a); const B = extrair(b);

  const soA = []; const soB = []; const vis = []; const deg = []; const mov = [];
  for (const [k, va] of A) {
    const vb = B.get(k);
    if (!vb) { soA.push(k); continue; }
    if (va.vis !== vb.vis) vis.push(`${k}: ${va.vis} → ${vb.vis}`);
    const da = degenerada(va.caixa); const db = degenerada(vb.caixa);
    if (da !== db) { deg.push(`${k}: ${da ? 'degenerada' : 'inteira'} → ${db ? 'DEGENERADA' : 'inteira'}`); continue; }
    if (va.caixa === vb.caixa) continue;
    const pa = va.caixa.split(',').map(Number); const pb = vb.caixa.split(',').map(Number);
    if (pa.length !== 6 || pb.length !== 6) { mov.push(`${k}: ${va.caixa} → ${vb.caixa}`); continue; }
    let pior = 0;
    for (let i = 0; i < 6; i++) pior = Math.max(pior, Math.abs(pa[i] - pb[i]));
    if (pior > tol) mov.push(`${(pior / 10).toFixed(2)} mm  ${k}`);
  }
  for (const k of B.keys()) if (!A.has(k)) soB.push(k);

  const linha = (t, l, mostra = 8) => {
    console.log(`  ${l.length === 0 ? 'ok  ' : 'FALHA'}  ${t}: ${l.length}`);
    for (const x of l.slice(0, mostra)) console.log(`          ${x}`);
    if (l.length > mostra) console.log(`          … e mais ${l.length - mostra}`);
  };

  console.log(`\n═══ ${a}  ×  ${b}   (tolerância ${tol} décimos de mm)`);
  console.log(`  malhas: ${A.size} × ${B.size}`);
  linha('peças que sumiram', soA);
  linha('peças que apareceram', soB);
  linha('peças que trocaram de visibilidade', vis);
  linha('peças que COLAPSARAM (ou deixaram de colapsar)', deg);
  mov.sort((x, y) => parseFloat(y) - parseFloat(x));
  linha('peças fora do lugar', mov);

  const falhas = soA.length + soB.length + vis.length + deg.length + mov.length;
  console.log(`\n  ${falhas === 0 ? '✓ APROVADO — a malharia é idêntica. Pode trocar o asset.'
    : `✗ REPROVADO — ${falhas} diferenças. NÃO troque o asset.`}\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main();
