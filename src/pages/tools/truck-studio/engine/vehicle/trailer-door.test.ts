import { describe, it, expect } from 'vitest';
import {
  layoutDoor, holeOf, doorFrameGeometry, rejectReason, flatSegments, snapFlatSegments,
  TRIM_WIDTH, TRIM_PROUD, TRIM_SINK,
  DOOR_REVEAL, LEAF_INSET, FRAME_WIDTH, FRAME_FRONT, FRAME_DEPTH, talaHeights,
  SEAL_SECTION, SEAL_OVERLAP, SEAL_FRONT, SEAL_DEPTH, SEAL_OUT, SEAL_W,
  DOOR_PARTS, LEAF_FLAT_BANDS,
  type DoorRect, type DoorPlane,
} from './trailer-door';

/* Datums do bake: piso 1.391857, crista da pele em x 1.3035, batente medido
   pela saia em 1.5194 + 8 mm de respiro. */
const FLOOR = 1.391857;
const SILL = 1.5194 + 0.008;
const PLANE: DoorPlane = { xSkin: 1.3035, sign: 1 };

/* O pé da FOLHA fica `DOOR_REVEAL` acima do batente, porque quem assenta sobre
   o perfil galvanizado é o VÃO — ver `doorsOf()` em `trailer-geometry.ts`. */
const leafOf = (w: number, h: number): DoorRect =>
  ({ y0: SILL + DOOR_REVEAL, y1: SILL + DOOR_REVEAL + h, z0: -0.5, z1: -0.5 + w });

const pitchOf = (ys: number[]) => ys.slice(1).map((y, i) => y - ys[i]);

describe('dobradiças: passo FIXO, contagem variável', () => {
  for (const [w, h, n] of [[0.87, 2.46, 4], [1.0, 2.0, 3], [1.0, 3.0, 5]] as const) {
    it(`porta ${w} × ${h} m → ${n} talas a 685,4 mm`, () => {
      const leaf = leafOf(w, h);
      const ys = layoutDoor(leaf, PLANE)
        .filter((p) => p.part === 'TALA').map((p) => p.y).sort((a, b) => a - b);
      expect(ys.length).toBe(n);
      for (const p of pitchOf(ys)) expect(p).toBeCloseTo(0.6854, 6);
      /* Centrada: a folga do pé é igual à do topo. */
      expect(ys[0] - leaf.y0).toBeCloseTo(leaf.y1 - ys[ys.length - 1], 6);
    });
  }

  it('nenhuma tala nasce a menos de 60 mm da borda da folha', () => {
    /* O que `Math.floor` na contagem garante, e `Math.round` não garantiria: a
       tala tem 92 mm, então uma corrida que a jogasse a 30 mm da borda deixaria
       meia peça pendurada fora da folha. Varrido em 5 mm de 0,90 a 3,50 m. */
    for (let h = 0.90; h <= 3.5001; h += 0.005) {
      const leaf = leafOf(1.0, h);
      const ys = talaHeights(leaf);
      expect(ys.length).toBeGreaterThanOrEqual(2);
      expect(ys[0] - leaf.y0).toBeGreaterThanOrEqual(0.060 - 1e-9);
      expect(leaf.y1 - ys[ys.length - 1]).toBeGreaterThanOrEqual(0.060 - 1e-9);
    }
  });

  it('a folha da traseira reproduz a medida: 4 talas, 1ª a 201,9 mm do pé', () => {
    /* A folha da porta traseira direita do NOSSO `trailer.glb` tem 2460 mm e
       leva as talas a 201,9 · 887,3 · 1572,7 · 2258,1 — passo 685,4. A regra
       CENTRADA devolve (2460 − 3 × 685,4) / 2 = 201,9 exato.

       Esteve com o passo do RIP (682,05), que sobre a mesma folha põe a
       primeira em 206,9: certo por um décimo de milímetro em nenhuma medida e
       errado por 5 mm em todas. Se a corrida fosse distribuída pelo vão (como
       esta função já fez), o primeiro item sairia certo por construção e o
       PASSO é que erraria — o defeito ao contrário, invisível num teste que
       olhasse só a primeira tala. */
    const leaf = leafOf(0.87, 2.46);
    const ys = layoutDoor(leaf, PLANE)
      .filter((p) => p.part === 'TALA').map((p) => p.y).sort((a, b) => a - b);
    expect(ys.map((y) => +((y - leaf.y0) * 1000).toFixed(1)))
      .toEqual([201.9, 887.3, 1572.7, 2258.1]);
  });

  it('a dobradiça vem completa: tala, pino, 2 porcas, trava e 4 rebites', () => {
    const p = layoutDoor(leafOf(0.87, 2.46), PLANE);
    const n = p.filter((x) => x.part === 'TALA').length;
    expect(n).toBe(4);
    expect(p.filter((x) => x.part === 'PINO').length).toBe(n);
    expect(p.filter((x) => x.part === 'PORCA').length).toBe(2 * n);
    expect(p.filter((x) => x.part === 'TRAVA_PINO').length).toBe(n);
  });

  it('o varão vem completo: cabeçotes, 2 guias com suporte, 4 anéis e 2 machos', () => {
    const p = layoutDoor(leafOf(0.87, 2.46), PLANE);
    expect(p.filter((x) => x.part === 'VARAO').length).toBe(1);
    expect(p.filter((x) => x.part === 'CABECOTE').length).toBe(2);
    expect(p.filter((x) => x.part === 'GUIA').length).toBe(2);
    expect(p.filter((x) => x.part === 'SUPORTE_GUIA').length).toBe(2);
    /* DOIS, não quatro: o rip listava anéis em v 10 e 104, mas o nosso bake só
       tem o de v 10 em cada ponta (`kit.json`) — o de 104 caía dentro do vão do
       cabeçote, flutuando sobre a trava superior do varão. */
    expect(p.filter((x) => x.part === 'ANEL').length).toBe(2);
    expect(p.filter((x) => x.part === 'MACHO').length).toBe(2);
    expect(p.filter((x) => x.part === 'ENCAIXE').length).toBe(2);
  });

  it('o fecho vem completo, e o trinco junto', () => {
    const p = layoutDoor(leafOf(0.87, 2.46), PLANE);
    for (const part of ['BATENTE', 'SUPORTE_FECHO', 'CONTRAFECHO', 'MANIPULO',
      'ALAVANCA', 'TRINCO']) {
      expect(p.filter((x) => x.part === part).length).toBe(1);
    }
  });

  it('peça de ponta: a instância de CIMA é espelhada, a de baixo não', () => {
    /* Cabeçote, macho, encaixe e travessa de borracha existem em par espelhado
       na vertical. O kit guarda a orientação da ponta de BAIXO; sem o `flipY`
       na de cima, o came do macho superior apontava para longe da boca do
       encaixe — "a parte de segurar o varão superior não está batendo com a
       parte soldada". */
    const leaf = leafOf(0.87, 2.46);
    const p = layoutDoor(leaf, PLANE);
    const meio = (leaf.y0 + leaf.y1) / 2;
    for (const part of ['CABECOTE', 'MACHO', 'ENCAIXE', 'BORRACHA_H']) {
      const xs2 = p.filter((x) => x.part === part);
      expect(xs2.length).toBe(2);
      for (const x of xs2) expect(!!x.flipY).toBe(x.y > meio);
    }
    /* E nada mais é espelhado: rebite, anel e fecho são simétricos ou de pé. */
    for (const x of p) {
      if (['CABECOTE', 'MACHO', 'ENCAIXE', 'BORRACHA_H'].includes(x.part)) continue;
      expect(x.flipY).toBeUndefined();
    }
  });

  it('o macho passa ALÉM da folha nas duas pontas — e o encaixe o espera lá', () => {
    const leaf = leafOf(0.87, 2.46);
    const p = layoutDoor(leaf, PLANE);
    const ys = p.filter((x) => x.part === 'MACHO').map((x) => x.y).sort((a, b) => a - b);
    expect(ys[0]).toBeLessThan(leaf.y0);
    expect(ys[1]).toBeGreaterThan(leaf.y1);
    /* E o encaixe fica no Z DO MACHO, não no do varão: são 20 mm de diferença,
       e alinhá-lo pelo varão punha a boca 20 mm ao lado da ponta que ela
       recebe. Medido no bake: encaixe u 1109,6 · macho 1112,1 · varão 1091,9. */
    const zMacho = p.find((x) => x.part === 'MACHO')!.z;
    const zEncaixe = p.find((x) => x.part === 'ENCAIXE')!.z;
    const zVarao = p.find((x) => x.part === 'VARAO')!.z;
    expect(Math.abs(zEncaixe - zMacho)).toBeLessThan(0.005);
    expect(Math.abs(zEncaixe - zVarao)).toBeGreaterThan(0.015);
  });
});

describe('a mão da porta: charneira na TRASEIRA, varão na DIANTEIRA', () => {
  /* A dianteira é +Z. Este bloco existe porque a versão anterior tinha as duas
     pontas trocadas com uma justificativa de primeiros princípios no comentário
     ("a porta abre para trás") que o implemento desmente. Um teste é mais
     difícil de argumentar contra do que um parágrafo. */
  const leaf = leafOf(0.87, 2.35);
  const p = layoutDoor(leaf, PLANE);
  const zOf = (part: string) => p.filter((x) => x.part === part).map((x) => x.z);
  const meio = (leaf.z0 + leaf.z1) / 2;

  it('toda tala fica na metade TRASEIRA da folha', () => {
    const zs = zOf('TALA');
    expect(zs.length).toBeGreaterThan(0);
    for (const z of zs) expect(z).toBeLessThan(meio);
  });

  it('varão, guias e machos ficam na metade DIANTEIRA', () => {
    for (const part of ['VARAO', 'GUIA', 'SUPORTE_GUIA', 'ANEL', 'CABECOTE',
      'MACHO', 'ENCAIXE']) {
      const zs = zOf(part);
      expect(zs.length).toBeGreaterThan(0);
      for (const z of zs) expect(z).toBeGreaterThan(meio);
    }
  });

  it('o fecho acompanha o varão, não a charneira', () => {
    for (const part of ['MANIPULO', 'CONTRAFECHO', 'SUPORTE_FECHO', 'BATENTE',
      'ALAVANCA', 'TRINCO']) {
      const zs = zOf(part);
      expect(zs.length).toBeGreaterThan(0);
      for (const z of zs) expect(z).toBeGreaterThan(meio);
    }
  });

  it('toda peça da folha cai DENTRO da largura dela', () => {
    /* O fecho inteiro mora entre o varão e o meio da folha; nada pode escapar
       pela borda, que é onde a chapa acaba e o marco começa. O batente esteve a
       318,3 mm por uma medição que achou o batente DO OUTRO FECHO (a traseira
       tem dois, v 193 e v 373) e o pôs na altura deste, enfiado na ponta do
       manípulo. O do fecho de v 193 está a 380,6 no bake (384,8 na convenção
       deste arquivo) — que é o que o rip sempre disse (376,5). */
    for (const x of p) {
      if (x.part === 'PINO' || x.part === 'PORCA' || x.part === 'TRAVA_PINO'
        || x.part === 'SUPORTE_TALA' || x.part === 'BORRACHA_V'
        || x.part === 'BORRACHA_H') continue;
      expect(x.z).toBeGreaterThanOrEqual(leaf.z0 - 1e-9);
      expect(x.z).toBeLessThanOrEqual(leaf.z1 + 1e-9);
    }
  });
});

describe('marco e vedação fecham o vão, com as medidas do bake', () => {
  const leaf = leafOf(1.0, 2.0);
  const hole = holeOf(leaf);
  const { frame } = doorFrameGeometry(leaf, PLANE);

  const xs = (s: { position: number[] }) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < s.position.length; i += 3) {
      lo = Math.min(lo, s.position[i]); hi = Math.max(hi, s.position[i]);
    }
    return { lo, hi };
  };
  /* Faixa em Z ocupada pela peça, na metade traseira — é onde as superfícies se
     encontram e onde uma fresta apareceria. */
  const zs = (s: { position: number[] }) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 2; i < s.position.length; i += 3) {
      if (s.position[i] > (leaf.z0 + leaf.z1) / 2) continue;
      lo = Math.min(lo, s.position[i]); hi = Math.max(hi, s.position[i]);
    }
    return { lo, hi };
  };

  it('o vão é maior que a folha em DOOR_REVEAL por lado', () => {
    expect(hole.z0).toBeCloseTo(leaf.z0 - DOOR_REVEAL, 9);
    expect(hole.y1).toBeCloseTo(leaf.y1 + DOOR_REVEAL, 9);
  });

  it('o marco é UM anel escalonado: nada de segundo anel de borracha', () => {
    /* Aqui vinham duas superfícies, e a segunda era um quadro de `borracha-preta`
       desenhado à mão, com seção e profundidade próprias — uma vedação por cima
       da vedação extraída, 4 mm atrás dela. Este teste tranca a remoção: um
       anel de perfil (4 caixas) mais um de retorno (4 caixas), tudo no mesmo
       material do marco. */
    expect(frame.position.length / 3).toBe(2 * 4 * 12 * 3);
    for (let i = 0; i < frame.normal.length; i += 3) {
      expect(Math.hypot(frame.normal[i], frame.normal[i + 1], frame.normal[i + 2]))
        .toBeCloseTo(1, 9);
    }
  });

  it('as peças soldadas ao marco são EXTRAÍDAS, e vêm na conta certa', () => {
    const p = layoutDoor(leaf, PLANE);
    expect(p.filter((x) => x.part === 'SUPORTE_TALA').length)
      .toBe(talaHeights(leaf).length);
    expect(p.filter((x) => x.part === 'ENCAIXE').length).toBe(2);
  });

  it('a vedação são quatro PERFIS extraídos, não um anel chapado', () => {
    const p = layoutDoor(leaf, PLANE);
    const v = p.filter((x) => x.part === 'BORRACHA_V');
    const hh = p.filter((x) => x.part === 'BORRACHA_H');
    expect(v.length).toBe(2);
    expect(hh.length).toBe(2);
    /* Extrusões: cada uma estica no PRÓPRIO eixo e em nenhum outro. */
    for (const x of v) { expect(x.sy).toBeGreaterThan(0); expect(x.sz).toBeUndefined(); }
    for (const x of hh) { expect(x.sz).toBeGreaterThan(0); expect(x.sy).toBeUndefined(); }
  });

  it('a vedação fica ATRÁS da folha, e por isso por baixo de toda a ferragem', () => {
    /* O defeito: `SEAL_W` guardava a posição da FACE da borracha (+0,6 mm) e a
       peça é ancorada pelo CENTRO, então o perfil inteiro saía 38 mm para FORA
       da parede — "a borracha está estranha", "as borrachas devem ir um pouco
       para dentro". A conversão face → centro é meia profundidade. */
    expect(SEAL_W).toBeLessThan(0);
    /* A face da borracha passa 4,5 mm À FRENTE da folha — mais que os 5,2 mm de
       relevo do friso? não, e é de propósito que a conta seja essa: 4,5 contra
       um friso de 5,2 mm deixa a crista da folha 0,7 mm atrás da borracha, com
       folga suficiente para o z-buffer a 25 m. Com os 0,6 mm que o rip dá, as
       pontas de friso furavam a faixa preta em ângulo rasante. */
    expect((SEAL_W + SEAL_DEPTH / 2) * 1000).toBeCloseTo(4.5, 6);
    /* E ela fica à frente do marco, que é o que faz a vedação encostar nos dois. */
    expect(SEAL_FRONT).toBeLessThan(FRAME_FRONT);
    expect(SEAL_FRONT).toBeLessThan(LEAF_INSET);
    /* E toda a ferragem da folha fica à FRENTE dela. */
    const p = layoutDoor(leaf, PLANE);
    const selo = p.find((x) => x.part === 'BORRACHA_V')!;
    for (const part of ['MANIPULO', 'CONTRAFECHO', 'GUIA', 'TALA', 'VARAO']) {
      const q = p.find((x) => x.part === part)!;
      expect(q.x).toBeGreaterThan(selo.x);
    }
  });

  it('a borracha monta na folha e sobra por cima do marco', () => {
    expect(SEAL_OVERLAP * 1000).toBeCloseTo(SEAL_SECTION * 1000 / 2 - SEAL_OUT * 1000, 6);
    expect(SEAL_OVERLAP).toBeGreaterThan(0);
    /* Sobra para fora = seção/2 + SEAL_OUT = 35,25 mm; o marco chega a
       DOOR_REVEAL − FRAME_WIDTH = 15,7 mm da folha. A sobreposição é a
       diferença, 19,55 mm, e é o que o rip mede ("monta 20,9 mm no marco"). */
    const sobra = SEAL_SECTION / 2 + SEAL_OUT;
    const marcoAte = DOOR_REVEAL - FRAME_WIDTH;
    expect((sobra - marcoAte) * 1000).toBeCloseTo(19.55, 1);
    expect(sobra).toBeGreaterThan(marcoAte);
  });

  it('o marco vai de 6,0 mm (a face medida) até 71,1 mm atrás da crista', () => {
    /* A face já esteve NA crista, "para tapar a borda cortada da chapa" — e aí
       ela passava 0,6 mm à frente da borracha e engolia a sobreposição: da
       vedação sobravam 15,7 mm visíveis ("a borracha está muito fina"). A face
       medida é 6,0 mm atrás da crista, ATRÁS da borracha, que monta sobre ela. */
    const x = xs(frame);
    expect((PLANE.xSkin - x.hi) * 1000).toBeCloseTo(6.0, 1);
    expect((PLANE.xSkin - x.lo) * 1000).toBeCloseTo(71.1, 1);
  });

  it('o marco chega da borda do vão até a borda da FOLHA, sem fresta', () => {
    /* `FRAME_WIDTH` esteve em 40 mm "por aparência", e o preço era um furo: o
       perfil parava a 54,4 mm da folha e a borracha só alcança 35,25 mm — 19 mm
       de fresta aberta para o interior do baú em toda a volta. Com 78,7 mm o
       perfil chega a 15,7 mm, e o retorno do fundo fecha o resto. */
    const f = zs(frame);
    expect(f.lo).toBeCloseTo(hole.z0, 9);
    expect(f.hi).toBeCloseTo(leaf.z0, 9);
    expect(FRAME_WIDTH * 1000).toBeCloseTo(78.7, 1);
  });

  it('a moldura é uma tira galvanizada em volta do vão, quase rasante', () => {
    /* Pedido de produto: "uma moldurinha bem sutil em volta do frame metálico,
       uma pequena tira de elevação, galvanizada". Anel de 4 caixas POR FORA do
       vão, de `TRIM_PROUD` à frente da crista até `TRIM_SINK` atrás (passa o
       vale do friso e fecha contra a chapa em qualquer fase). */
    const { trim } = doorFrameGeometry(leaf, PLANE);
    expect(trim.position.length / 3).toBe(4 * 12 * 3);
    const x = xs(trim);
    expect((x.hi - PLANE.xSkin) * 1000).toBeCloseTo(TRIM_PROUD * 1000, 6);
    expect((PLANE.xSkin - x.lo) * 1000).toBeCloseTo(TRIM_SINK * 1000, 6);
    let zLo = Infinity, zHi = -Infinity;
    for (let i = 2; i < trim.position.length; i += 3) {
      zLo = Math.min(zLo, trim.position[i]); zHi = Math.max(zHi, trim.position[i]);
    }
    expect(zLo).toBeCloseTo(hole.z0 - TRIM_WIDTH, 9);
    expect(zHi).toBeCloseTo(hole.z1 + TRIM_WIDTH, 9);
  });

  it('a porta é RASANTE: nada passa de 71,2 mm atrás da crista', () => {
    for (let i = 0; i < frame.position.length; i += 3) {
      expect(frame.position[i]).toBeLessThanOrEqual(PLANE.xSkin + 1e-9);
      expect((PLANE.xSkin - frame.position[i]) * 1000).toBeLessThanOrEqual(71.2);
    }
    expect((FRAME_FRONT + FRAME_DEPTH) * 1000).toBeCloseTo(71.1, 1);
  });
});

describe('faixas lisas da folha', () => {
  it('os segmentos cobrem a folha inteira, sem buraco e sem sobreposição', () => {
    const leaf = leafOf(0.87, 2.35);
    const segs = flatSegments(leaf);
    expect(segs[0].lo).toBeCloseTo(leaf.y0, 9);
    expect(segs[segs.length - 1].hi).toBeCloseTo(leaf.y1, 9);
    for (let i = 1; i < segs.length; i++) expect(segs[i].lo).toBeCloseTo(segs[i - 1].hi, 9);
    for (const s of segs) expect(s.hi).toBeGreaterThan(s.lo);
  });

  it('cada faixa medida vira um segmento LISO na fração exata', () => {
    const leaf = leafOf(0.87, 2.35);
    const h = leaf.y1 - leaf.y0;
    const lisos = flatSegments(leaf).filter((s) => s.flat)
      .map((s) => [+((s.lo - leaf.y0) / h).toFixed(4), +((s.hi - leaf.y0) / h).toFixed(4)]);
    expect(lisos).toEqual(LEAF_FLAT_BANDS.map(([a, b]) => [+a.toFixed(4), +b.toFixed(4)]));
  });

  it('ancorada na grade, toda borda interna de faixa cai no VALE do friso', () => {
    /* O defeito: as bordas são fração da altura da folha e o friso vem
       recortado da parede — a fase é acidente, e uma borda no meio do ARCO
       deixa o perfil cortado a meia subida, o degrau que lia como "a parte
       lisa está construída em cima do friso" (só a 2ª de baixo escapava, por
       sorte de fase). Ancorada, a borda de baixo termina a descida do friso e
       a de cima para onde o arco seguinte começa — em QUALQUER altura. */
    const grid = { row0: 1.5669, pitch: 0.0534, valeH: 0.0271 };
    const fase = (y: number) => {
      const p = (y - grid.row0) % grid.pitch;
      return p < 0 ? p + grid.pitch : p;
    };
    for (const hh of [0.9, 1.6, 2.1, 2.35, 2.46, 3.0]) {
      const leaf = leafOf(0.87, hh);
      const segs = snapFlatSegments(leaf, grid);
      /* cobertura contínua, como sempre */
      expect(segs[0].lo).toBeCloseTo(leaf.y0, 9);
      expect(segs[segs.length - 1].hi).toBeCloseTo(leaf.y1, 9);
      for (let i = 1; i < segs.length; i++) {
        expect(segs[i].lo).toBeCloseTo(segs[i - 1].hi, 9);
      }
      /* No vale = fase ∈ [0, valeH]. O 0 chega pelos DOIS lados: `paraCima`
         ancora no início do vale e, em float, `fase()` pode devolver
         `pitch − ε` em vez de 0 — o wrap é aceito como o zero que é. */
      const noVale = (y: number) => {
        const p = fase(y);
        return p <= grid.valeH + 1e-6 || p >= grid.pitch - 1e-6;
      };
      for (const s of segs.filter((x) => x.flat)) {
        if (Math.abs(s.lo - leaf.y0) > 1e-9) expect(noVale(s.lo)).toBe(true);
        if (Math.abs(s.hi - leaf.y1) > 1e-9) expect(noVale(s.hi)).toBe(true);
      }
      /* e as faixas só CRESCEM: as guias (0,3611/0,6389) continuam dentro. */
      const h = leaf.y1 - leaf.y0;
      for (const f of [0.3611, 0.6389]) {
        const y = leaf.y0 + f * h;
        expect(segs.some((s) => s.flat && y >= s.lo && y <= s.hi)).toBe(true);
      }
    }
  });

  it('sem grade, a ancoragem degrada para as frações puras', () => {
    const leaf = leafOf(0.87, 2.35);
    expect(snapFlatSegments(leaf, undefined)).toEqual(flatSegments(leaf));
  });
});

describe('a tabela de peças', () => {
  it('nenhuma família repete nome', () => {
    const names = DOOR_PARTS.map((s) => s.part);
    expect(new Set(names).size).toBe(names.length);
  });

  it('duas famílias do mesmo material são distinguíveis por tamanho', () => {
    /* `extractDoorKit()` casa por MULTICONJUNTO de dimensões, dentro do
       material, e entrega a malha à família de MENOR erro. Isso resolve os
       pares que se sobrepõem na tolerância — `GUIA` (100 × 34 × 41,4) e
       `ENCAIXE` (101,5 × 36,5 × 44) diferem 2,6 mm e cabem um no outro dentro
       dos 4 mm de `PART_TOL` —, mas NÃO resolve um empate: duas famílias com o
       mesmo tamanho seriam decididas pela ordem de travessia, que é um
       cara-ou-coroa. Este teste é a rede, com 1 mm de margem de decisão. */
    const erro = (a: number[], b: number[]) => {
      const used = [false, false, false];
      let worst = 0;
      for (const t of a) {
        let best = -1, err = Infinity;
        for (let i = 0; i < 3; i++) {
          if (used[i]) continue;
          const e = Math.abs(b[i] - t);
          if (e < err) { err = e; best = i; }
        }
        used[best] = true;
        if (err > worst) worst = err;
      }
      return worst;
    };
    for (let i = 0; i < DOOR_PARTS.length; i++) {
      for (let j = i + 1; j < DOOR_PARTS.length; j++) {
        const a = DOOR_PARTS[i], b = DOOR_PARTS[j];
        if (a.material.source !== b.material.source) continue;
        expect(erro(a.size, b.size) * 1000, `${a.part} × ${b.part}`)
          .toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('recusa', () => {
  it('porta estreita demais diz por quê', () => {
    expect(rejectReason(leafOf(0.4, 2.0))).toMatch(/largura/);
  });
  it('porta baixa demais diz por quê', () => {
    expect(rejectReason(leafOf(1.0, 0.8))).toMatch(/altura/);
  });
  it('a porta de fábrica passa', () => {
    expect(rejectReason(leafOf(0.87, 2.35))).toBeNull();
  });
  it('o vão assenta EXATAMENTE sobre o perfil da lateral, nunca abaixo dele', () => {
    /* O defeito que este teste tranca: com a FOLHA ancorada no batente, o vão
       — que é 94,5 mm maior em cada lado — descia 94,5 mm por baixo do perfil
       galvanizado, e a peça de baixo da porta saía POR CIMA do perfil quando
       ela tem de sair acima dele. */
    const hole = holeOf(leafOf(0.87, 2.35));
    expect(hole.y0).toBeCloseTo(SILL, 9);
    expect(hole.y0).toBeGreaterThan(FLOOR);
  });
});
