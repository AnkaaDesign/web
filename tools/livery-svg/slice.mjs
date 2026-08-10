#!/usr/bin/env node
/* Fatia a PRANCHA do cliente nas peças que compõem o painel do editor.
   ===========================================================================
   OFFLINE, roda à mão. A saída são SVGs pequenos mais um manifesto
   `layout.json`, em `public/models/vehicles/panels/`, versionados no repo. O
   engine só os baixa (ver engine/vehicle/livery-art.ts). Nada aqui roda no
   navegador.

   Uso:
       node tools/livery-svg/slice.mjs "~/Downloads/layout 15,40 para teste.svg"

   ---------------------------------------------------------------------------
   O PROBLEMA

   O painel do editor era uma FOTO — `panels/lateral.png` e `panels/traseira.png`
   — esticada sobre a janela. Um baú de 8,40 m e um de 15,40 m recebiam a mesma
   imagem, então a fita 3M, a cantoneira e a ferragem esticavam junto: peças de
   dimensão FIXA desenhadas com dimensão variável. Era o "esticando uma imagem
   como é atualmente" do pedido.

   ---------------------------------------------------------------------------
   A SOLUÇÃO: UMA GRADE 3x3 POR FACE, COM ÂNCORAS

   É a doutrina que a geometria 3D já usa. `trailer-assembly.ts` classifica cada
   casca em `roof` / `floor` / `stretch` / `follow` porque peça pequena não
   estica, TRANSLADA. Aqui é a mesma ideia no plano da textura:

       ┌─────────┬───────────────────┬─────────┐
       │ canto   │  banda de TOPO    │ canto   │  altura fixa, presa ao TETO
       ├─────────┼───────────────────┼─────────┤
       │ montante│  JANELA DE ARTE   │ montante│  estica nos dois eixos
       ├─────────┼───────────────────┼─────────┤
       │ canto   │  banda de BASE    │ canto   │  altura fixa, presa ao PISO
       └─────────┴───────────────────┴─────────┘
         largura                       largura
         fixa                          fixa

   Os quatro cantos nunca deformam. As bandas horizontais mantêm a ALTURA e
   acompanham o comprimento; as verticais mantêm a LARGURA e acompanham a
   altura. Só o miolo escala nos dois eixos — e ele é justamente a área onde a
   arte do cliente vai, que É elástica por natureza.

   ---------------------------------------------------------------------------
   AS BANDAS HORIZONTAIS REPETEM, NÃO ESTICAM — e é o ponto mais importante

   A fita 3M mora dentro da banda de base (medido: y 1322 na lateral direita,
   dentro do rodapé que vai de 1291,6 a 1359,8). Esticar a banda esticaria a
   fita, que é exatamente o defeito que estamos consertando.

   Então a banda é LADRILHADA com uma janela de UM PASSO de fita — 327,27 u,
   medido no arquivo com 14 segmentos e mín = máx, sem variação. O rodapé é uma
   barra de cor constante, então ladrilhá-lo é invisível; a fita, que é o motivo
   de tudo, sai com o espaçamento certo em qualquer comprimento.

   ---------------------------------------------------------------------------
   MEDIDAS, TODAS LIDAS DO ARQUIVO

   `k = 15400 / 4350,85 = 3,53954 mm por unidade` — a prancha é de 15,40 m e a
   janela de arte lateral tem 4350,85 u. Confere consigo mesma: cantoneira 241 +
   arte 2364 + rodapé 241 = 2846 mm, contra os 804,3 u entre os dois trilhos =
   2847 mm. Um milímetro em 2,85 m.

   O corpo tem a MESMA altura nas quatro faces (804,3 u ≈ 2847 mm), e cada uma
   parte essa altura de um jeito — é o que a tabela `FACES` abaixo declara.

   ---------------------------------------------------------------------------
   DOIS PLANOS: O QUE FICA ATRÁS E O QUE FICA NA FRENTE DA ARTE

   A foto que sai de cena era uma MOLDURA com a janela vazada: a ferragem passa
   POR CIMA do desenho do cliente, e é isso que faz um texto atravessado pela
   borracha aparecer cortado no editor do mesmo jeito que sai no baú.

   A grade preserva isso: as oito células da borda vão para o plano da FRENTE, e
   a chapa branca do miolo vai para o plano de TRÁS. O miolo da frente existe só
   onde há ferragem sobre a área pintável — na traseira, que tem varões,
   dobradiças e maçanetas sobre as folhas. Lá o branco é descartado por classe
   (`drop`), senão a célula taparia a arte inteira.

   ---------------------------------------------------------------------------
   O RECORTE É UMA JANELA (viewBox), NÃO UMA REESCRITA DE COORDENADAS

   Reescrever as coordenadas quebraria os gradientes (`userSpaceOnUse`, amarrados
   às coordenadas originais), os 50 `clipPath` e os `use` de uma vez. O sub-SVG
   mantém as coordenadas e declara `viewBox="x y w h"` sobre a região.

   E os 8 `<image>` embutidos SAEM: são 4,5 MB dos 5,5 MB, e dois deles são tiras
   de 14 898 × 284 px correndo a lateral inteira — ou seja, exatamente a coisa
   que estica. O que os substitui é o vetor que já estava no arquivo. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../../public/models/vehicles/panels');

/** mm por unidade do viewBox. Ver MEDIDAS no cabeçalho. */
const K = 15400 / 4350.85;
const mm = (u) => u * K;
const m = (u) => +(u * K / 1000).toFixed(4);

/** Um passo da fita 3M, em unidades. 14 segmentos medidos, mín = máx. */
const FITA_PITCH_U = 327.27;

/* As classes que pintam a CHAPA BRANCA da janela de arte. Descartadas em toda
   célula do plano da FRENTE: elas são o fundo sobre o qual a arte do cliente
   vai, e no plano da frente virariam uma demão branca por cima dela. */
const WINDOW_FILL = ['cls-135', 'cls-18', 'cls-140', 'cls-63'];

/* ---------------------------------------------------------------------------
   AS QUATRO FACES, EM UNIDADES DO viewBox DA PRANCHA.

   `body` é o retângulo do CORPO (o que vira o painel: piso→teto, ponta→ponta).
   `art` é a janela pintável dentro dele. As bandas saem da diferença entre os
   dois, então não há número redundante para divergir.

   Todos lidos do arquivo — ver a listagem de `rect` largos no cabeçalho. */
const FACES = {
  left: {
    label: 'lateral esquerda',
    /* `body` são as EXTENSÕES MEDIDAS da face (agrupamento de todos os
       elementos dentro dela), não um retângulo simétrico em volta da janela de
       arte. As duas pontas de uma lateral NÃO são iguais — 190 mm de um lado e
       90 mm do outro, espelhados entre esquerda e direita —, e supor simetria
       punha 100 mm de nada num dos montantes. */
    body: { x: 428.0, y: 2316.7, w: 4430.0, h: 804.3 },
    art: { x: 481.8, y: 2384.5, w: 4350.9, h: 667.9 },
    /* A ponta presa. No 3D o baú cresce PARA TRÁS (a dianteira carrega o
       pino-rei e não anda), e `addLiveryUV` faz x=0 ser a TRASEIRA na SIDE_L —
       ver `anchor` em livery-layers.ts. */
    anchor: 'end',
  },
  right: {
    label: 'lateral direita',
    body: { x: 1435.0, y: 555.5, w: 4431.0, h: 804.3 },
    art: { x: 1461.2, y: 623.9, w: 4350.9, h: 667.9 },
    anchor: 'start',
  },
  rear: {
    label: 'traseira',
    /* A traseira NÃO tem cantoneira nem rodapé como as laterais: a banda de topo
       é o trilho do marco (190 mm) e a de base o perfil sob as folhas (219 mm).
       A janela é mais alta em compensação — 2438 contra 2364 —, e a soma dá o
       mesmo corpo de 2847 mm. */
    body: { x: 6347.0, y: 555.5, w: 737.0, h: 804.3 },
    art: { x: 6375.7, y: 609.1, w: 679.2, h: 688.8 },
    anchor: 'start',
    /* O MIOLO DA TRASEIRA TEM FERRAGEM SOBRE A ÁREA PINTÁVEL — varões,
       dobradiças, maçanetas e a borracha central das quatro folhas. É o que a
       foto entregava e o que a pilha precisa entregar para haver paridade. */
    centreFront: true,
  },
  front: {
    label: 'testeira',
    body: { x: 6347.0, y: 2291.6, w: 738.0, h: 809.0 },
    art: { x: 6368.5, y: 2359.7, w: 694.8, h: 672.7 },
    anchor: 'start',
  },
};

/* ---------------- leitura ---------------- */

const src = process.argv[2];
if (!src) {
  console.error('uso: node tools/livery-svg/slice.mjs <prancha.svg>');
  process.exit(1);
}
const svgPath = src.replace(/^~/, process.env.HOME || '~');
const svg = readFileSync(svgPath, 'utf8');

const viewBox = (svg.match(/viewBox="([^"]+)"/) || [])[1];
if (!viewBox) { console.error('prancha sem viewBox'); process.exit(1); }
const [, , plateW, plateH] = viewBox.split(/[\s,]+/).map(Number);
const plateArea = plateW * plateH;

const style = (svg.match(/<style[^>]*>[\s\S]*?<\/style>/) || [''])[0];
let defs = (svg.match(/<defs[^>]*>[\s\S]*?<\/defs>/) || [''])[0];
defs = defs.replace(/<image\b[^>]*\/?>(?:<\/image>)?/g, '');

/* ---------------- geometria mínima ---------------- */

const nums = (s) => (s.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);

/* O `d` TEM DE SER PERCORRIDO, e não lido como uma lista de pares.
   Os 814 `path` desta prancha usam comandos RELATIVOS — todos, medido —, então
   os pares são DELTAS. Lidos como coordenadas absolutas, todo caminho ganhava
   uma caixa colada na origem e caía dentro de qualquer janela: 738 caminhos
   "dentro" de uma janela de 75 × 13,6 u. `h`/`v` são piores ainda: levam UM
   número, e agrupar de dois em dois desalinha o resto do caminho.
   As curvas entram pelos pontos de CONTROLE, o que superestima a caixa (o
   casco convexo contém a curva) — o erro seguro, porque só inclui a mais. */
const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

function pathPoints(d) {
  const pts = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let mt;
  while ((mt = re.exec(d))) {
    const cmd = mt[1];
    const rel = cmd === cmd.toLowerCase();
    const key = cmd.toLowerCase();
    const n = ARITY[key];
    const args = nums(mt[2]);
    if (key === 'z') { x = sx; y = sy; continue; }
    if (!n) continue;
    for (let i = 0; i + n <= args.length; i += n) {
      const a = args.slice(i, i + n);
      if (key === 'h') { x = rel ? x + a[0] : a[0]; }
      else if (key === 'v') { y = rel ? y + a[0] : a[0]; }
      else if (key === 'a') { x = rel ? x + a[5] : a[5]; y = rel ? y + a[6] : a[6]; }
      else {
        for (let k = 0; k + 1 < n; k += 2) {
          pts.push([rel ? x + a[k] : a[k], rel ? y + a[k + 1] : a[k + 1]]);
        }
        x = rel ? x + a[n - 2] : a[n - 2];
        y = rel ? y + a[n - 1] : a[n - 1];
      }
      pts.push([x, y]);
      if (key === 'm' && i === 0) { sx = x; sy = y; }
    }
  }
  return pts;
}

function bboxOf(tag) {
  const name = (tag.match(/^<([\w:-]+)/) || [])[1];
  const at = (n) => {
    const mt = tag.match(new RegExp(`\\b${n}="([^"]*)"`));
    return mt ? mt[1] : null;
  };
  const f = (n, d = 0) => { const v = at(n); return v == null ? d : parseFloat(v) || 0; };
  let pts = [];
  if (name === 'rect') {
    const x = f('x'), y = f('y'), w = f('width'), h = f('height');
    pts = [[x, y], [x + w, y + h]];
  } else if (name === 'line') {
    pts = [[f('x1'), f('y1')], [f('x2'), f('y2')]];
  } else if (name === 'polygon' || name === 'polyline') {
    const n = nums(at('points') || '');
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
  } else if (name === 'ellipse' || name === 'circle') {
    const cx = f('cx'), cy = f('cy'), rx = f('rx', f('r')), ry = f('ry', f('r'));
    pts = [[cx - rx, cy - ry], [cx + rx, cy + ry]];
  } else if (name === 'path') {
    pts = pathPoints(at('d') || '');
  } else return null;
  if (!pts.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

function drawables(doc) {
  const body = doc
    .replace(/<defs[^>]*>[\s\S]*?<\/defs>/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
  return body.match(/<(?:rect|line|polygon|polyline|path|ellipse|circle|use|image)\b[^>]*?\/?>/g) || [];
}

const ALL = drawables(svg);

/* ---------------- poda de estilo e defs ---------------- */

function collectRefs(text) {
  const ids = new Set();
  for (const mt of text.matchAll(/url\(\s*#([^)\s"']+)\s*\)/g)) ids.add(mt[1]);
  for (const mt of text.matchAll(/(?:xlink:)?href="#([^"]+)"/g)) ids.add(mt[1]);
  return ids;
}

function pruneStyle(styleBlock, usedClasses) {
  const css = styleBlock.replace(/^<style[^>]*>/, '').replace(/<\/style>$/, '');
  const out = [];
  for (const mt of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const sels = mt[1].split(',').map((x) => x.trim()).filter(Boolean);
    const keep = sels.filter((sel) => {
      const cls = [...sel.matchAll(/\.([\w-]+)/g)].map((c) => c[1]);
      return !cls.length || cls.some((c) => usedClasses.has(c));
    });
    if (keep.length) out.push(`${keep.join(',')}{${mt[2].trim()}}`);
  }
  return out.length ? `<style>${out.join('')}</style>` : '';
}

function pruneDefs(defsBlock, seed) {
  const inner = defsBlock.replace(/^<defs[^>]*>/, '').replace(/<\/defs>$/, '');
  const nodes = [];
  const re = /<([\w:-]+)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g;
  let mt;
  while ((mt = re.exec(inner))) {
    const id = (mt[0].match(/\bid="([^"]+)"/) || [])[1];
    nodes.push({ id, text: mt[0] });
  }
  const want = new Set(seed);
  for (let pass = 0; pass < 8; pass++) {
    let grew = false;
    for (const n of nodes) {
      if (!n.id || !want.has(n.id)) continue;
      for (const ref of collectRefs(n.text)) if (!want.has(ref)) { want.add(ref); grew = true; }
    }
    if (!grew) break;
  }
  const kept = nodes.filter((n) => n.id && want.has(n.id)).map((n) => n.text);
  return kept.length ? `<defs>${kept.join('')}</defs>` : '';
}

/* ---------------- recorte de UMA célula ---------------- */

/**
 * @param {{x,y,w,h}} win     janela em unidades da prancha
 * @param {string[]}  drop    classes a descartar (fundo da janela de arte)
 * @param {number}    pad     folga, para pegar traço centrado na aresta
 */
function cut(file, label, win, { drop = [], pad = 0.5 } = {}) {
  const box = { x0: win.x - pad, y0: win.y - pad, x1: win.x + win.w + pad, y1: win.y + win.h + pad };
  const kept = [];
  let outside = 0, bg = 0, dropped = 0, media = 0;

  for (const tag of ALL) {
    /* Os `<image>` e os `<use>` que apontam para eles são os bitmaps que este
       trabalho existe para substituir — e um `use` órfão desenha um retângulo
       preto em alguns motores. */
    if (/^<(?:image|use)/.test(tag)) { media++; continue; }
    const bb = bboxOf(tag);
    /* O FUNDO DA PRANCHA NÃO É ARTE: o primeiro elemento é a MESA cinza de
       7 443 × 5 136 sobre a qual as quatro faces estão desenhadas. Ela
       intersecta toda janela; sem esta linha cada peça sairia com a mesa opaca
       por baixo, e uma célula do plano da FRENTE taparia o painel inteiro. */
    if (bb && (bb.x1 - bb.x0) * (bb.y1 - bb.y0) > plateArea * 0.5) { bg++; continue; }
    if (bb && (bb.x1 < box.x0 || bb.x0 > box.x1 || bb.y1 < box.y0 || bb.y0 > box.y1)) {
      outside++; continue;
    }
    if (drop.length) {
      const cls = ((tag.match(/\bclass="([^"]*)"/) || [])[1] || '').split(/\s+/);
      if (cls.some((c) => drop.includes(c))) { dropped++; continue; }
    }
    kept.push(tag);
  }

  const usedClasses = new Set();
  for (const t of kept) {
    const c = (t.match(/\bclass="([^"]*)"/) || [])[1];
    if (c) for (const one of c.split(/\s+/)) if (one) usedClasses.add(one);
  }
  const styleOut = pruneStyle(style, usedClasses);
  const defsOut = pruneDefs(defs, collectRefs([...kept, styleOut].join('\n')));

  const out = '<svg xmlns="http://www.w3.org/2000/svg"'
    + ` viewBox="${win.x} ${win.y} ${win.w} ${win.h}"`
    + ` width="${win.w}" height="${win.h}" preserveAspectRatio="none">\n`
    + `<!-- ${label}\n`
    + `     ${win.w.toFixed(1)} x ${win.h.toFixed(1)} u = ${mm(win.w).toFixed(0)} x ${mm(win.h).toFixed(0)} mm\n`
    + `     Recortado de "${svgPath.split('/').pop()}" por tools/livery-svg/slice.mjs.\n`
    + '     Coordenadas ORIGINAIS da prancha; o recorte e o viewBox. -->\n'
    + `${styleOut}\n${defsOut}\n${kept.join('\n')}\n</svg>\n`;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, file), out, 'utf8');
  console.log(
    `  ${file.padEnd(26)} ${String(kept.length).padStart(4)} el`
    + `  (fora ${outside}, fundo ${bg}, descartadas ${dropped}, bitmap ${media})`
    + `  ${(out.length / 1024).toFixed(1)} kB`,
  );
  return { file, kept: kept.length };
}

/* ---------------- a grade de uma face ---------------- */

function sliceFace(key, f) {
  console.log(`\n${f.label}  —  corpo ${mm(f.body.w).toFixed(0)} x ${mm(f.body.h).toFixed(0)} mm`);
  const b = f.body, a = f.art;

  /* As quatro bandas, derivadas da diferença corpo − arte. Nenhuma é digitada
     duas vezes: mudar `body` ou `art` reescreve todas. */
  const bandTop = a.y - b.y;
  const bandBottom = (b.y + b.h) - (a.y + a.h);
  const colLeft = a.x - b.x;
  const colRight = (b.x + b.w) - (a.x + a.w);

  /* A largura da fatia LADRILHÁVEL das bandas horizontais.
     SÓ AS LATERAIS LADRILHAM, e a distinção é de conteúdo, não de eixo: a fita
     3M é um motivo REPETIDO ao longo do comprimento, e é só nas laterais que
     ela corre. Na traseira e na testeira a banda é uma peça DESENHADA de ponta
     a ponta — o trilho do marco, o perfil sob as folhas —, e ladrilhá-la
     desenharia a peça inteira duas vezes num painel de 2,6 m com um ladrilho de
     2,4 m, com a segunda cópia cortada ao meio. Aquelas duas acompanham a
     largura esticando, que é o certo para um perfil contínuo. */
  const flank = key === 'left' || key === 'right';
  const tileW = flank ? FITA_PITCH_U : a.w;

  const pieces = [];
  const add = (id, plane, file, win, rect, opts = {}) => {
    cut(file, `${f.label} — ${id}`, win, opts);
    pieces.push({ id, plane, file, ...rect, ...(opts.tile ? { tile: opts.tile } : {}) });
  };

  /* ---- bandas horizontais: altura FIXA, presas ao teto e ao piso ----
     `y` no manifesto é medido do PISO para cima, que é o referencial do painel
     (livery-layers.ts). Na prancha o y cresce para baixo, daí a inversão. */
  add('band-top', 'front', `${key}-band-top.svg`,
    { x: a.x, y: b.y, w: tileW, h: bandTop },
    { x: 0, y: m(b.h - bandTop), w: null, h: m(bandTop), anchorY: 'roof' },
    { tile: flank ? m(tileW) : 0, drop: WINDOW_FILL });

  add('band-bottom', 'front', `${key}-band-bottom.svg`,
    { x: a.x, y: a.y + a.h, w: tileW, h: bandBottom },
    { x: 0, y: 0, w: null, h: m(bandBottom), anchorY: 'floor' },
    { tile: flank ? m(tileW) : 0, drop: WINDOW_FILL });

  /* ---- montantes verticais: largura FIXA, presos às pontas ----
     Só existem quando há banda: a lateral tem os cantos fora da janela de arte
     (~92 mm cada), a traseira ~102 mm, a testeira ~76 mm. */
  if (colLeft > 1) {
    add('post-start', 'front', `${key}-post-start.svg`,
      { x: b.x, y: b.y, w: colLeft, h: b.h },
      { x: 0, y: 0, w: m(colLeft), h: null, anchorX: 'start' },
      { drop: WINDOW_FILL });
  }
  if (colRight > 1) {
    add('post-end', 'front', `${key}-post-end.svg`,
      { x: a.x + a.w, y: b.y, w: colRight, h: b.h },
      { x: 0, y: 0, w: m(colRight), h: null, anchorX: 'end' },
      { drop: WINDOW_FILL });
  }

  /* ---- o miolo, no plano da FRENTE ----
     Só onde há ferragem sobre a área pintável. Hoje é a traseira: varões,
     dobradiças, maçanetas e a borracha central das quatro folhas. Sem o
     `drop` das classes de fundo, esta célula seria uma chapa branca cobrindo
     a arte do cliente inteira. */
  if (f.centreFront) {
    add('centre', 'front', `${key}-centre.svg`,
      { x: a.x, y: a.y, w: a.w, h: a.h },
      { x: 0, y: 0, w: null, h: null, anchorX: 'stretch', anchorY: 'stretch' },
      { drop: WINDOW_FILL });
  }

  return {
    /* Medidas de PROJETO da prancha — o que ela desenha, em metros. O engine
       usa a medida do baú em cena; estas ficam para conferência. */
    designLength: m(b.w),
    designHeight: m(b.h),
    anchor: f.anchor,
    pieces,
  };
}

/* ---------------- roda ---------------- */

console.log(`prancha: viewBox ${viewBox} · ${(svg.length / 1e6).toFixed(2)} MB`);
console.log(`k = ${K.toFixed(5)} mm/u`);
console.log(`saída:  ${OUT_DIR}`);

const manifest = {
  schema: 'truck-studio/livery-art@1',
  source: svgPath.split('/').pop(),
  unitMm: +K.toFixed(5),
  note: 'Grade 3x3 por face. `anchorX`/`anchorY` dizem o que NÃO deforma;'
    + ' `tile` é a largura em metros de um ladrilho da banda (o passo da fita 3M'
    + ' nas laterais). w/h nulos significam "acompanhe a medida do painel".',
  faces: {},
};
for (const [key, f] of Object.entries(FACES)) manifest.faces[key] = sliceFace(key, f);

writeFileSync(resolve(OUT_DIR, 'layout.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('\nlayout.json escrito. O engine o lê em engine/vehicle/livery-art.ts.');
