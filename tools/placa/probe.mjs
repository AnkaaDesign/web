#!/usr/bin/env node
/* ONDE A PLACA DE LICENCIAMENTO CABE EM CADA CAVALO — a sonda, e o manifesto.
   ===========================================================================
   ⚠️ "PLACA" AQUI É A PLACA DO VEÍCULO (Mercosul, 400 x 130 mm). Nesta base a
   palavra já significa outras duas coisas — a CHAPA da carroceria do implemento
   (`PLATE_PITCH`, `plateSeams()` em `vehicle/models.ts`) e o PRATO da quinta
   roda (`fifthWheel.plateTopY` em `hitch.json`). Nada aqui tem a ver com
   nenhuma das duas.

       node tools/placa/probe.mjs                 # mede e reescreve o manifesto
       node tools/placa/probe.mjs --dry           # mede e imprime, sem escrever
       node tools/placa/probe.mjs --só volvo      # filtra por nome de arquivo
       node tools/placa/probe.mjs --mapa volvo_fh_2021_4x2.glb   # o z-buffer em texto

   Saída: `public/models/vehicles/plates.json`.

   ===========================================================================
   POR QUE MEDIR UMA VEZ, FORA DO NAVEGADOR

   O mesmo argumento de `hitch.json`, e ele tem duas metades:

     · **o .glb do cavalo não muda em runtime.** Medir a cada carga seria pagar
       toda vez por uma resposta que é sempre a mesma — e pagar caro: a busca
       abaixo rasteriza ~600 mil triângulos por modelo;
     · **e uma medida automática precisa poder ser CORRIGIDA.** São 49 rips de
       cinco procedências, e nenhuma regra geométrica acerta 49 de 49. Um
       manifesto tem onde escrever a exceção (ver `AUTORADOS`); um heurístico em
       runtime não tem.

   ===========================================================================
   O QUE A SONDA MEDE, E POR QUE ASSIM

   **1. A ORIENTAÇÃO SAI DAS RODAS, não de `hitch.json`.** Dois dos 49 arquivos
   (`scania_r_2016_6x2t`, `vw_titan_6x2_tl`) não têm entrada lá, e uma sonda que
   dependesse do manifesto simplesmente não os cobriria. O eixo DIRECIONAL é a
   frente por definição, e os 49 bakes nomeiam as rodas `wheel_f_*` (direcional)
   e `wheel_r_*` (tração) — o mesmo `^wheel_` que `hitch.json` declara em
   `wheelMeshRegex`. O sinal de `z(direcional) − z(tração)` dá a frente.
   Conferido contra os 47 que TÊM entrada: bate em 47 de 47.

   **2. A SUPERFÍCIE SAI DE UM Z-BUFFER, não de vértices.** Amostrar vértice não
   responde "o que uma placa encostada aqui tocaria": um painel plano de meio
   metro quadrado tem QUATRO vértices, e a varredura devolve quatro células
   preenchidas num mapa de doze mil. Foi assim que a primeira versão desta sonda
   reprovou todos os 49 por "cobertura < 50 %". O que responde é rasterizar: cada
   triângulo virado para a frente é projetado na grade de 5 mm e a célula guarda
   o z MAIS DIANTEIRO. Aí a pergunta vira uma leitura.

   **3. O SÍTIO SAI DE UM AJUSTE DE PLANO, não de "o z máximo".** Para-choque de
   caminhão não é vertical: medido, ele cai de 1° (Scania S 2024e) a 27° (DAF XG)
   dentro da própria pegada da placa. Mínimos quadrados sobre a pegada devolvem
   de uma vez a POSIÇÃO e a INCLINAÇÃO, e o resíduo diz se aquilo é um painel ou
   uma grade — que é o teste que separa o para-choque do radiador atrás dele.

   **4. O CRITÉRIO É `rms`, NÃO O RESÍDUO MÁXIMO.** Um rebite dentro da pegada
   estoura o máximo e não atrapalha placa nenhuma. Com `res ≤ 30 mm` e
   `rms ≤ 8 mm` o passe estrito acha sítio em **46 dos 49** (os três que faltam
   são as variantes do DAF XF 105, que caem em `AUTORADOS`); com `res ≤ 15 mm`
   sozinho ele perdia sete, entre eles os três DAF XG, cujo melhor sítio tem
   `res` 13,9 mm e `rms` 5,9 mm.

   **5. A ALTURA PREFERIDA É 0,45 m, DENTRO DA BANDA MAIS BAIXA.** Não é "a mais
   baixa que passa": no FH 2021 a banda válida começa em 0,29 m, e uma placa
   centrada ali fica com a borda de baixo rente ao fundo do para-choque —
   pendurada, não montada. E não é "a de menor resíduo": essa sobe para o
   radiador em metade da frota. A regra é a banda contínua mais baixa com pelo
   menos 3 cm de curso, e dentro dela a altura mais próxima de 0,45 m — que é o
   meio da faixa em que um cavalo brasileiro carrega a dianteira.

   ===========================================================================
   O QUE SAI NO MANIFESTO: ESPAÇO CRU DO ARQUIVO

   Como `fifthWheel` em `hitch.json`, e pelo mesmo motivo: a pose da cabine em
   cena é decidida pelo engate, que muda com o implemento, com a inclinação e com
   o cenário. Um número em espaço de cena estaria errado no primeiro engate.
   Em espaço de arquivo o engine só precisa pendurar a placa na raiz da cabine —
   e aí ela acompanha tudo por construção.

   O implemento NÃO entra aqui, e isso é decisão: ele é PARAMÉTRICO. Uma posição
   congelada estaria errada no primeiro redimensionamento, e em silêncio. O lado
   dele é medido em runtime, no PORTA-PLACA sob a lanterna traseira — ver
   `engine/vehicle/license-plate.ts`. É a mesma divisão que `hitch.json` já faz
   com `implements: {}`. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGLB, walkNodes, boxOf, geometryOf, materialOf } from './glb.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(AQUI, '../..');
const PUBLIC = path.join(WEB, 'public');
const DESTINO = path.join(PUBLIC, 'models/vehicles/plates.json');

const ARGV = process.argv.slice(2);
const flag = (n) => ARGV.includes('--' + n);
const opt = (n) => { const i = ARGV.indexOf('--' + n); return i >= 0 ? ARGV[i + 1] : null; };

/* ---------------------------------------------------------------------------
   A PLACA, EM METROS. Resolução CONTRAN 780/2019: 400 x 130 mm para automóvel,
   caminhão e reboque. A pegada da busca é menor que a placa de propósito — a
   borda dela pode passar por cima de um chanfro sem que isso conte como "o
   painel não é plano". */
const PLACA_L = 0.400, PLACA_A = 0.130;
const RECUO_PEGADA = 0.012;

/* Grade do z-buffer. 5 mm é o que separa um friso de para-choque (~10 mm) de um
   painel: em 10 mm a célula erraria o friso metade das vezes. */
const CELULA = 0.005;

/* A janela de busca. Em x ela é pouco maior que a placa porque a placa é
   CENTRADA — nenhum cavalo brasileiro leva a dianteira de lado. Em y ela vai do
   fundo do para-choque até a altura em que já não é para-choque. */
const JANELA = { x0: -0.32, x1: 0.32, y0: 0.15, y1: 1.05 };

/** Teto do CENTRO da placa. ⚠️ Não é frescura: sem ele o DAF XF 105 — cuja
 *  dianteira não tem 130 mm planos em lugar nenhum do para-choque — subia para
 *  **1,31 m**, o painel liso ACIMA da grade, que é onde nenhuma placa vai. O
 *  cavalo mais alto do acervo é o VW Titan, com sítio próprio em 0,75 m. */
const ALTURA_MAX = 0.95;

/* Os cortes de aceitação — ver o item 4 do cabeçalho. */
const RMS_MAX = 0.008;
const RES_MAX = 0.030;
/** Um para-choque inclina; um capô, não. 22° passa o Scania R 2009 (−15°) e
 *  barra a rampa de 28° que ele tem logo abaixo. */
const PITCH_MAX = 22 * Math.PI / 180;
/** Curso mínimo para uma banda contínua contar como painel, e não como fresta. */
const BANDA_MIN = 0.03;
/** A altura preferida do centro da placa — ver o item 5 do cabeçalho. */
const ALTURA_ALVO = 0.45;
/** Folga entre a chapa da placa e a superfície: nunca interpenetrar. */
const FOLGA_MIN = 0.002;
/** Profundidade máxima do berço — ver `vao` e o cabeçalho de license-plate.ts. */
const VAO_MAX = 0.045;
/** Até aqui o berço ainda é um ARO. Acima, ele começa a virar caixa. */
const VAO_BOM = 0.014;

/* ---------------------------------------------------------------------------
   AS EXCEÇÕES ESCRITAS À MÃO

   Um valor aqui GANHA da busca, e o comentário ao lado é obrigatório: um número
   sem motivo é indistinguível de um número errado. Chave = nome do arquivo. */
const AUTORADOS = {
  /* ⚠️ O XF 105 NÃO TEM ONDE APOIAR UMA PLACA, e isso é medido, não opinado.
     Perfil da linha de centro, em recuo da ponta mais dianteira:

         y 0,335 … 0,365   54 → 24 mm    a barriga do para-choque, curvando
         y 0,375 … 0,445   15 →  0 → 14  o único trecho plano: **70 mm**
         y 0,450 … 0,490   45 mm         degrau, e um patamar de 40 mm
         y 0,495 … 0,890   16…76 mm      a grade, palhetas de passo 10,5 cm

     Uma placa precisa de 130 mm e o melhor que existe são 70. Sem esta entrada
     a busca tolerante escolhia **0,845 m** — no meio da grade, acima dos faróis
     —, que é pior de todas as formas. Aqui ela é montada no trecho plano, com o
     berço fazendo o papel que o suporte faz no caminhão de verdade. */
  'daf_xf_105_4x2.glb': { cy: 0.415, motivo: 'sem trecho plano de 130 mm; montada no pad do para-choque' },
  'daf_xf_105_6x2a_tl.glb': { cy: 0.415, motivo: 'idem daf_xf_105_4x2' },
  'daf_xf_105_6x4.glb': { cy: 0.415, motivo: 'idem daf_xf_105_4x2' },
};

/* ------------------------------------------------------------------ medidas */

const RODA_DIANTEIRA_RE = /^wheel_f[_\d]/i;
const RODA_TRASEIRA_RE = /^wheel_r[_\d]/i;
const PNEU_RE = /tire|pneu/i;

/**
 * A frente, o chão e a linha de centro, medidos NO ARQUIVO.
 *
 * `frente` é +1 quando a dianteira do caminhão está em +z e −1 quando está em
 * −z. `chao` é o y do plano de contato dos pneus. Ver o item 1 do cabeçalho.
 */
function referencial(g, entries) {
  let fz = 0, fn = 0, rz = 0, rn = 0, chao = Infinity, temPneu = false;
  let yLo = Infinity;
  /* ⚠️ A LINHA DE CENTRO SAI DAS RODAS, não da caixa do modelo. A caixa inclui
     escapamento, espelho e degrau — peças que existem de um lado só — e num
     rip como o XF 105 ela desloca o "centro" em 7 mm, que é a placa saindo do
     eixo do caminhão. As rodas são um par simétrico por construção. */
  let rodaLo = Infinity, rodaHi = -Infinity;
  for (const e of entries) {
    const nome = e.node.name || '';
    const b = boxOf(g, e);
    yLo = Math.min(yLo, b.min[1]);
    const cz = (b.min[2] + b.max[2]) / 2;
    const dianteira = RODA_DIANTEIRA_RE.test(nome), traseira = RODA_TRASEIRA_RE.test(nome);
    if (dianteira) { fz += cz; fn++; }
    if (traseira) { rz += cz; rn++; }
    if (dianteira || traseira) {
      rodaLo = Math.min(rodaLo, b.min[0]); rodaHi = Math.max(rodaHi, b.max[0]);
    }
    if (PNEU_RE.test(nome) || PNEU_RE.test(materialOf(g, e))) {
      chao = Math.min(chao, b.min[1]); temPneu = true;
    }
  }
  if (!fn || !rn) return null;
  const frente = (fz / fn) > (rz / rn) ? 1 : -1;
  return {
    frente,
    chao: temPneu ? chao : yLo,
    centro: (rodaLo + rodaHi) / 2,
    eixos: { dianteiro: fz / fn, traseiro: rz / rn },
  };
}

/**
 * Z-buffer da casca dianteira, no referencial NORMALIZADO da busca:
 * contato dos pneus em y = 0, linha de centro em x = 0, frente em +z.
 *
 * `depth[j·nx+i]` é o z do que estiver MAIS À FRENTE naquela célula, e
 * `owner` diz de que malha ele veio — é isso que faz o relatório poder dizer
 * "a placa deste modelo se apoia no `f_bumper_p5`".
 */
async function zbuffer(g, bin, entries, ref, janela) {
  const cell = CELULA;
  const nx = Math.round((janela.x1 - janela.x0) / cell) + 1;
  const ny = Math.round((janela.y1 - janela.y0) / cell) + 1;
  const depth = new Float32Array(nx * ny).fill(-Infinity);
  const owner = new Int32Array(nx * ny).fill(-1);
  const nomes = [];
  /* `frente` = −1 espelha z, e espelhar z sozinho INVERTE a mão do sistema —
     o winding de todo triângulo passa a mentir. Espelhar x junto devolve a mão
     (é a rotação de 180° em torno de Y, que é o que a normalização faz mesmo). */
  const s = ref.frente;

  for (const e of entries) {
    const b = boxOf(g, e);
    /* Caixa no referencial da busca — rejeição barata, antes de descomprimir. */
    const bx = [s * (b.min[0] - ref.centro), s * (b.max[0] - ref.centro)].sort((p, q) => p - q);
    const by = [b.min[1] - ref.chao, b.max[1] - ref.chao];
    if (by[1] < janela.y0 || by[0] > janela.y1) continue;
    if (bx[1] < janela.x0 || bx[0] > janela.x1) continue;

    const geo = await geometryOf(g, bin, e);
    const mi = nomes.length;
    nomes.push({ no: e.node.name || '?', material: materialOf(g, e) });
    const { pos: P0, nrm: N0, idx } = geo;
    const P = new Float64Array(P0.length);
    for (let i = 0; i < P0.length; i += 3) {
      P[i] = s * (P0[i] - ref.centro);
      P[i + 1] = P0[i + 1] - ref.chao;
      P[i + 2] = s * P0[i + 2];
    }
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = idx[t] * 3, b2 = idx[t + 1] * 3, c2 = idx[t + 2] * 3;
      const ax = P[a], ay = P[a + 1], az = P[a + 2];
      const bx2 = P[b2], by2 = P[b2 + 1], bz = P[b2 + 2];
      const cx2 = P[c2], cy2 = P[c2 + 1], cz = P[c2 + 2];
      const ux = bx2 - ax, uy = by2 - ay, uz = bz - az;
      const vx = cx2 - ax, vy = cy2 - ay, vz = cz - az;
      let gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      /* O bake pode trazer winding invertido; a normal de vértice desempata. */
      if (N0) {
        const nx0 = s * N0[a], ny0 = N0[a + 1], nz0 = s * N0[a + 2];
        if (gx * nx0 + gy * ny0 + gz * nz0 < 0) { gx = -gx; gy = -gy; gz = -gz; }
      }
      if (gz <= 0) continue;                          // vira as costas à frente
      const lo = [Math.min(ax, bx2, cx2), Math.min(ay, by2, cy2)];
      const hi = [Math.max(ax, bx2, cx2), Math.max(ay, by2, cy2)];
      if (hi[0] < janela.x0 || lo[0] > janela.x1 || hi[1] < janela.y0 || lo[1] > janela.y1) continue;
      const i0 = Math.max(0, Math.ceil((lo[0] - janela.x0) / cell));
      const i1 = Math.min(nx - 1, Math.floor((hi[0] - janela.x0) / cell));
      const j0 = Math.max(0, Math.ceil((lo[1] - janela.y0) / cell));
      const j1 = Math.min(ny - 1, Math.floor((hi[1] - janela.y0) / cell));
      if (i1 < i0 || j1 < j0) continue;
      const den = (by2 - cy2) * (ax - cx2) + (cx2 - bx2) * (ay - cy2);
      if (Math.abs(den) < 1e-12) continue;
      for (let j = j0; j <= j1; j++) {
        const py = janela.y0 + j * cell;
        for (let i = i0; i <= i1; i++) {
          const px = janela.x0 + i * cell;
          const l1 = ((by2 - cy2) * (px - cx2) + (cx2 - bx2) * (py - cy2)) / den;
          if (l1 < -1e-6 || l1 > 1 + 1e-6) continue;
          const l2 = ((cy2 - ay) * (px - cx2) + (ax - cx2) * (py - cy2)) / den;
          if (l2 < -1e-6) continue;
          const l3 = 1 - l1 - l2;
          if (l3 < -1e-6) continue;
          const z = l1 * az + l2 * bz + l3 * cz;
          const k = j * nx + i;
          if (z > depth[k]) { depth[k] = z; owner[k] = mi; }
        }
      }
    }
  }
  return { depth, owner, nomes, nx, ny, cell, x0: janela.x0, y0: janela.y0 };
}

/**
 * As células que a pegada da placa cobre, em ÍNDICE de grade.
 *
 * ⚠️ UMA função, e todo mundo a usa. Ela existia duas vezes — o ajuste andava
 * de `cy − hh` para cima somando o passo, e a medida do vão amostrava
 * `cy + hh` direto —, e as duas caíam em LINHAS DIFERENTES por causa do
 * arredondamento. O sintoma: o MAN TGX, com resíduo de 4,6 mm dentro da pegada,
 * relatava 45 mm de vão na borda — porque a borda que ele mediu era a linha
 * seguinte, já fora do para-choque.
 */
function celulas(zb, cx, cy) {
  const hw = PLACA_L / 2 - RECUO_PEGADA, hh = PLACA_A / 2 - RECUO_PEGADA;
  const i0 = Math.round((cx - hw - zb.x0) / zb.cell), i1 = Math.round((cx + hw - zb.x0) / zb.cell);
  const j0 = Math.round((cy - hh - zb.y0) / zb.cell), j1 = Math.round((cy + hh - zb.y0) / zb.cell);
  return { i0, i1, j0, j1 };
}

/** Mínimos quadrados de `z = a·x + b·y + c` sobre a pegada centrada em (cx, cy). */
function ajusta(zb, cx, cy) {
  const { i0, i1, j0, j1 } = celulas(zb, cx, cy);
  const xs = [], ys = [], zs = [];
  let n = 0, furos = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      n++;
      if (i < 0 || j < 0 || i >= zb.nx || j >= zb.ny) { furos++; continue; }
      const z = zb.depth[j * zb.nx + i];
      if (!Number.isFinite(z)) { furos++; continue; }
      xs.push(zb.x0 + i * zb.cell - cx); ys.push(zb.y0 + j * zb.cell - cy); zs.push(z);
    }
  }
  if (furos || zs.length < 50) return { ok: false, furos, n };
  let Sxx = 0, Sxy = 0, Syy = 0, Sx = 0, Sy = 0, Sxz = 0, Syz = 0, Sz = 0;
  const S1 = zs.length;
  for (let k = 0; k < S1; k++) {
    const x = xs[k], y = ys[k], z = zs[k];
    Sxx += x * x; Sxy += x * y; Syy += y * y; Sx += x; Sy += y;
    Sxz += x * z; Syz += y * z; Sz += z;
  }
  const M = [[Sxx, Sxy, Sx], [Sxy, Syy, Sy], [Sx, Sy, S1]];
  const V = [Sxz, Syz, Sz];
  const det3 = (A) => A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1])
    - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0])
    + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
  const det = det3(M);
  if (Math.abs(det) < 1e-14) return { ok: false, furos, n };
  const cramer = (col) => {
    const A = M.map((r) => r.slice());
    for (let r = 0; r < 3; r++) A[r][col] = V[r];
    return det3(A) / det;
  };
  const a = cramer(0), b = cramer(1), c = cramer(2);
  let res = 0, acima = 0, abaixo = 0, rms = 0;
  for (let k = 0; k < S1; k++) {
    const d = zs[k] - (a * xs[k] + b * ys[k] + c);
    if (Math.abs(d) > res) res = Math.abs(d);
    if (d > acima) acima = d;
    if (-d > abaixo) abaixo = -d;
    rms += d * d;
  }
  return { ok: true, a, b, c, res, acima, abaixo, rms: Math.sqrt(rms / S1), n: S1, furos: 0 };
}

/**
 * A busca inteira: bandas aceitas, a escolhida e a altura dentro dela.
 *
 * DOIS PASSES, e o segundo existe por causa de UM modelo. O DAF XF 105 não tem
 * 400 x 130 mm planos em ponto nenhum da dianteira: medido no eixo, a face
 * externa do para-choque vai de y 0,335 a 0,445 (110 mm, e curva 57 mm nesse
 * trecho), e logo acima começa a grade de palhetas com passo de 10,5 cm. Os
 * cortes do primeiro passe estão certos — aquilo ali não é um painel — e a
 * resposta certa não é afrouxá-los para todo mundo: é dizer, para este arquivo,
 * "o melhor que existe é este, e ele tem tanto de vão". Quem conserta o vão é o
 * BERÇO da placa; ver `vao` abaixo e o cabeçalho de `license-plate.ts`.
 */
function procura(zb) {
  const yLo = JANELA.y0 + PLACA_A / 2;
  const yHi = Math.min(ALTURA_MAX, JANELA.y1 - PLACA_A / 2);
  const todos = [];
  for (let cy = yLo; cy <= yHi; cy += CELULA) {
    const e = ajusta(zb, 0, cy);
    if (!e.ok) continue;
    if (Math.abs(Math.atan(-e.b)) > PITCH_MAX || Math.abs(Math.atan(e.a)) > PITCH_MAX) continue;
    const encosto = Math.max(e.acima, 0) + FOLGA_MIN;
    todos.push({ cy, ...e, encosto, vao: vaoDaBorda(zb, 0, cy, e, encosto) });
  }
  if (!todos.length) return null;
  const aceitos = todos.filter((e) => e.rms <= RMS_MAX && e.res <= RES_MAX);
  if (!aceitos.length) {
    const melhor = todos.reduce((p, q) => (q.rms < p.rms ? q : p), todos[0]);
    return { bandas: [], banda: [melhor], melhor, tolerante: true };
  }
  const bandas = [];
  for (const s of aceitos) {
    const ultima = bandas[bandas.length - 1];
    if (ultima && s.cy - ultima[ultima.length - 1].cy < CELULA * 1.5) ultima.push(s);
    else bandas.push([s]);
  }
  const altas = bandas.filter((b) => b[b.length - 1].cy - b[0].cy >= BANDA_MIN);
  const banda = altas[0] || bandas[0];
  /* DENTRO DA BANDA, O QUE DECIDE É O CONTORNO. Uma banda de 15 cm de curso tem
     alturas em que a borda da placa cai numa ranhura do para-choque e alturas em
     que não cai — medido no FH 2021, entre 3 mm e 41 mm de vão na MESMA banda,
     com o mesmo `rms` de 6,7 mm. Preferir as de contorno limpo é o que separa
     uma placa parafusada de uma placa sobre um caixote. */
  const limpos = banda.filter((s) => s.vao <= VAO_BOM);
  const candidatos = limpos.length ? limpos : banda;
  const alvo = Math.min(Math.max(ALTURA_ALVO, candidatos[0].cy), candidatos[candidatos.length - 1].cy);
  const melhor = candidatos.reduce(
    (p, q) => (Math.abs(q.cy - alvo) < Math.abs(p.cy - alvo) ? q : p), candidatos[0]);
  return { bandas, banda, melhor, tolerante: false };
}

/**
 * O VÃO VISÍVEL: o maior afastamento entre a chapa e a superfície **na BORDA**
 * da pegada.
 *
 * ⚠️ NA BORDA, e não na pegada inteira — a diferença chega a 30 mm e ela decide
 * o tamanho do berço. Um furo de parafuso ou uma fresta no meio do para-choque
 * fica ATRÁS da placa: ninguém o vê, e deixá-lo mandar na profundidade do berço
 * transformava o aro de 7 mm do FH 2021 numa caixa de 41 mm. O que se vê é o
 * contorno, então é o contorno que é medido.
 */
function vaoDaBorda(zb, cx, cy, m, folga) {
  const { i0, i1, j0, j1 } = celulas(zb, cx, cy);
  let pior = 0;
  const olha = (i, j) => {
    if (i < i0 || j < j0 || i > i1 || j > j1) return;
    if (i < 0 || j < 0 || i >= zb.nx || j >= zb.ny) return;
    const z = zb.depth[j * zb.nx + i];
    if (!Number.isFinite(z)) return;
    /* A placa é PARALELA ao plano ajustado, não perpendicular a z: o vão num
       ponto é a folga do encosto menos o quanto a superfície sobe ali. */
    const d = z - (m.a * (zb.x0 + i * zb.cell - cx) + m.b * (zb.y0 + j * zb.cell - cy) + m.c);
    const vao = folga - d;
    if (vao > pior) pior = vao;
  };
  for (let i = i0; i <= i1; i++) { olha(i, j0); olha(i, j1); }
  for (let j = j0; j <= j1; j++) { olha(i0, j); olha(i1, j); }
  return pior;
}

/** De onde a placa se apoia, por área da pegada — só para o relatório. */
function apoio(zb, cx, cy) {
  const hw = PLACA_L / 2 - RECUO_PEGADA, hh = PLACA_A / 2 - RECUO_PEGADA;
  const conta = new Map();
  for (let y = cy - hh; y <= cy + hh + 1e-9; y += zb.cell) {
    for (let x = cx - hw; x <= cx + hw + 1e-9; x += zb.cell) {
      const i = Math.round((x - zb.x0) / zb.cell), j = Math.round((y - zb.y0) / zb.cell);
      if (i < 0 || j < 0 || i >= zb.nx || j >= zb.ny) continue;
      const o = zb.owner[j * zb.nx + i];
      if (o >= 0) conta.set(o, (conta.get(o) || 0) + 1);
    }
  }
  const top = [...conta.entries()].sort((p, q) => q[1] - p[1])[0];
  return top ? zb.nomes[top[0]] : null;
}

/* ------------------------------------------------------------------ relatório */

function mapa(zb) {
  let zTopo = -Infinity;
  for (const v of zb.depth) if (v > zTopo) zTopo = v;
  const chars = '0123456789';
  const linhas = [];
  for (let j = zb.ny - 1; j >= 0; j -= 2) {
    let l = (zb.y0 + j * zb.cell).toFixed(2) + ' ';
    for (let i = 0; i < zb.nx; i += 2) {
      const z = zb.depth[j * zb.nx + i];
      if (!Number.isFinite(z)) { l += ' '; continue; }
      const d = zTopo - z;
      l += d > 0.30 ? '.' : chars[Math.min(9, Math.floor(d / 0.03))];
    }
    linhas.push(l);
  }
  return linhas.join('\n') + '\n     (0 = mais à frente; cada passo 3 cm de recuo)';
}

/* ------------------------------------------------------------------ execução */

function chassisDoCatalogo() {
  const j = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'brands/trucks/brands.json'), 'utf8'));
  const out = [];
  for (const mk of j.manufacturers || []) {
    for (const m of mk.models || []) {
      for (const c of m.chassis || []) if (c.file) out.push(c.file);
    }
  }
  return [...new Set(out)].sort();
}

async function mede(rel, autorado) {
  const abs = path.join(PUBLIC, rel);
  const { json: g, bin } = readGLB(abs);
  const entries = walkNodes(g);
  const ref = referencial(g, entries);
  if (!ref) return { rel, erro: 'não achei rodas `wheel_f_*` / `wheel_r_*` — orientação indecidível' };
  const zb = await zbuffer(g, bin, entries, ref, JANELA);
  /* Uma altura autorada NÃO pula a medida — ela só tira da busca a escolha de
     ONDE. O plano, a inclinação e o vão continuam saindo da malha, que é o que
     mantém a entrada válida depois de um re-bake do mesmo modelo. */
  let r;
  if (autorado) {
    const e = ajusta(zb, 0, autorado.cy);
    if (!e.ok) return { rel, ref, zb, erro: 'altura autorada ' + autorado.cy + ' tem furo na pegada' };
    r = { bandas: [], banda: [], melhor: { cy: autorado.cy, ...e }, tolerante: false, autorado };
  } else {
    r = procura(zb);
  }
  if (!r) return { rel, ref, zb, erro: 'nenhum sítio: nada na janela é plano o bastante' };
  const m = r.melhor;
  /* A placa encosta no plano ajustado, empurrada para a frente o quanto o
     ponto mais saliente da pegada exigir. Nunca interpenetra, por construção. */
  const encosto = Math.max(m.acima, 0) + FOLGA_MIN;
  const zPlaca = m.c + encosto;
  /* O VÃO: a profundidade que o berço precisa ter para a placa ficar MONTADA em
     vez de flutuando. Ver `vaoDaBorda()` para o porquê de ser a borda. */
  const vao = Math.min(Math.max(vaoDaBorda(zb, 0, m.cy, m, encosto), FOLGA_MIN), VAO_MAX);
  /* Normal do plano `z = a·x + b·y + c`, apontando para a frente. */
  const nl = [-m.a, -m.b, 1];
  const L = Math.hypot(...nl);
  const normNorm = nl.map((v) => v / L);
  /* De volta ao espaço CRU DO ARQUIVO — o inverso exato da normalização de
     `zbuffer()`: x e z espelhados quando a frente é −z, mais o chão e o centro. */
  const s = ref.frente;
  const pos = [s * 0 + ref.centro, m.cy + ref.chao, s * zPlaca];
  const normal = [s * normNorm[0], normNorm[1], s * normNorm[2]];
  return {
    rel, ref, zb, ajuste: m, bandas: r.bandas, banda: r.banda,
    apoio: apoio(zb, 0, m.cy),
    tolerante: r.tolerante, autorado: !!autorado,
    saida: {
      pos: pos.map((v) => +v.toFixed(5)),
      normal: normal.map((v) => +v.toFixed(5)),
      vao: +vao.toFixed(4),
      alturaSolo: +m.cy.toFixed(4),
      ajuste: {
        rms: +(m.rms * 1000).toFixed(2),
        res: +(m.res * 1000).toFixed(2),
        inclinacaoGraus: +(Math.atan(-m.b) * 180 / Math.PI).toFixed(2),
      },
      fonte: autorado ? 'altura autorada' : r.tolerante ? 'medido-tolerante' : 'medido',
      ...(autorado ? { motivo: autorado.motivo } : null),
    },
  };
}

async function main() {
  const filtro = opt('só') || opt('so') || opt('only');
  const soMapa = opt('mapa');
  const arquivos = (soMapa ? ['models/trucks/' + soMapa] : chassisDoCatalogo())
    .filter((f) => !filtro || f.includes(filtro));

  if (soMapa) {
    const r = await mede(arquivos[0]);
    if (r.erro) { console.error(r.erro); return 1; }
    console.log(mapa(r.zb));
    console.log('\nsítio: y=' + r.ajuste.cy.toFixed(3) + '  rms=' + (r.ajuste.rms * 1000).toFixed(1)
      + 'mm  res=' + (r.ajuste.res * 1000).toFixed(1) + 'mm  apoio=' + (r.apoio?.no || '?')
      + ' [' + (r.apoio?.material || '?') + ']');
    return 0;
  }

  const t0 = Date.now();
  const tractors = {};
  let falhas = 0;
  for (const rel of arquivos) {
    const nome = path.basename(rel);
    const r = await mede(rel, AUTORADOS[nome]);
    if (r.erro) {
      falhas++;
      console.log(nome.padEnd(34) + ' ✗ ' + r.erro);
      continue;
    }
    tractors[rel] = r.saida;
    const s = r.saida;
    console.log(nome.padEnd(34)
      + ' y=' + s.alturaSolo.toFixed(3)
      + ' rms=' + s.ajuste.rms.toFixed(1).padStart(4) + 'mm'
      + ' res=' + s.ajuste.res.toFixed(1).padStart(5) + 'mm'
      + ' inc=' + s.ajuste.inclinacaoGraus.toFixed(1).padStart(6) + '°'
      + ' vão=' + (s.vao * 1000).toFixed(0).padStart(3) + 'mm'
      + (r.autorado ? ' AUTORADA  ' : r.tolerante ? ' ⚠tolerante' : '           ')
      + ' ' + (r.apoio?.no || '?') + ' [' + (r.apoio?.material || '?') + ']');
  }

  const manifesto = {
    schema: 'truck-studio/plates@1',
    unidades: 'metros, ESPAÇO CRU DO ARQUIVO .glb (o mesmo de hitch.json/fifthWheel)',
    gerado: new Date().toISOString().slice(0, 10),
    _comment: [
      'Onde a PLACA DE LICENCIAMENTO (Mercosul, 400 x 130 mm) mora em cada cavalo.',
      'Gerado por tools/placa/probe.mjs — NÃO editar à mão: escreva a exceção em',
      'AUTORADOS naquele arquivo e rode a sonda de novo, senão a próxima corrida',
      'apaga a correção em silêncio.',
      '',
      '`pos`    centro da placa, no espaço cru do .glb.',
      '`normal` para onde ela olha, no mesmo espaço.',
      '`vao`    afastamento entre a chapa e a superfície NO CONTORNO da placa —',
      '         é a profundidade do berço, para ela ficar montada e não flutuando.',
      '`alturaSolo` é diagnóstico: a altura do centro sobre o plano dos pneus.',
      '',
      'O IMPLEMENTO NÃO ESTÁ AQUI de propósito: ele é paramétrico e a traseira',
      'anda a cada redimensionamento. O lado dele é medido em runtime, no',
      'PORTA-PLACA sob a lanterna traseira — ver engine/vehicle/license-plate.ts.',
    ],
    placa: { larguraM: PLACA_L, alturaM: PLACA_A },
    tractors,
  };

  if (flag('dry')) {
    console.log('\n--dry: nada escrito. ' + Object.keys(tractors).length + ' entradas.');
  } else {
    fs.writeFileSync(DESTINO, JSON.stringify(manifesto, null, 1) + '\n');
    console.log('\n' + path.relative(WEB, DESTINO) + ' — ' + Object.keys(tractors).length
      + ' cavalos, ' + falhas + ' sem sítio, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  }
  return falhas ? 2 : 0;
}

process.exitCode = await main();
