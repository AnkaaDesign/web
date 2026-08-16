/* A CURVA DO CRIADOR DE VÍDEO, PROVADA SEM NAVEGADOR.
   ===========================================================================
   Estes testes existem porque o interpolador é a parte deste recurso em que um
   erro NÃO APARECE NA TELA. Ele não lança, não pinta errado e não deixa rastro
   no console: ele entrega um vídeo que abre, com a câmera passando um pouco
   além de onde o usuário marcou — ou dando uma volta inteira pelo lado errado
   num azimute. Os dois só se descobrem assistindo os quatro minutos de render
   que vieram antes.

   Os quatro portões abaixo são, em ordem de gravidade:

     1. NÃO ULTRAPASSA. É o que garante que a câmera não entra na carroceria: as
        guardas da cena já validaram cada CHAVE, e um caminho que não sai do
        intervalo das chaves herda essa validade de graça.
     2. O ARCO É SEMPRE O MENOR. Sem o desembrulho, 170° → −170° varre 340°.
     3. A PAUSA PARA DE VERDADE. Um trecho chato tem de sair chato, senão o
        "respiro" vira um deslize lento e o percurso não descansa nunca.
     4. PASSA PELOS PONTOS E COMEÇA/TERMINA PARADO. O contrato básico. */
import { describe, it, expect } from 'vitest';
import {
  pchipTangents, sampleTrack, unwrapAngles, hermiteBasis, hermiteValue, segmentIndex,
} from './timeline-curve';

/** Amostra densa de uma faixa — é assim que se pega uma ultrapassagem. */
function sweep(t: number[], v: number[], steps = 2000): number[] {
  const m = pchipTangents(t, v);
  const t0 = t[0];
  const t1 = t[t.length - 1];
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    out.push(sampleTrack(t, v, m, t0 + ((t1 - t0) * i) / steps));
  }
  return out;
}

describe('portão 1 — a curva NÃO ULTRAPASSA', () => {
  /* Os três casos que quebram Catmull-Rom, e o primeiro é o do relato: um
     percurso que se aproxima e depois se afasta tem um mínimo local no RAIO, e
     uma tangente automática ali joga a câmera para DENTRO do caminhão. */
  const casos: [string, number[], number[]][] = [
    ['raio que fecha e reabre', [0, 2, 4, 6], [24, 12, 12.5, 26]],
    ['degrau brusco no meio', [0, 1, 2, 3], [5, 5, 30, 30]],
    ['sobe, para, desce', [0, 1.5, 3, 4.5, 6], [10, 22, 22, 9, 9.5]],
    ['tempos muito desiguais', [0, 0.2, 5, 5.4], [8, 26, 9, 25]],
  ];
  for (const [nome, t, v] of casos) {
    it(`${nome}: todo instante fica entre os dois vizinhos`, () => {
      const m = pchipTangents(t, v);
      for (let i = 0; i < t.length - 1; i++) {
        const lo = Math.min(v[i], v[i + 1]);
        const hi = Math.max(v[i], v[i + 1]);
        for (let k = 0; k <= 200; k++) {
          const at = t[i] + ((t[i + 1] - t[i]) * k) / 200;
          const y = sampleTrack(t, v, m, at);
          /* A folga de 1e-9 é numérica, não conceitual: a propriedade é
             EXATA. Um Catmull-Rom no primeiro caso passa de 12 para ~11,1 —
             ou seja quase um metro dentro da zona de expulsão. */
          expect(y).toBeGreaterThanOrEqual(lo - 1e-9);
          expect(y).toBeLessThanOrEqual(hi + 1e-9);
        }
      }
    });
  }

  it('e o mesmo vale para a varredura inteira: nada sai da faixa das chaves', () => {
    const t = [0, 2, 4, 6];
    const v = [24, 12, 12.5, 26];
    const ys = sweep(t, v);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(Math.min(...v) - 1e-9);
    expect(Math.max(...ys)).toBeLessThanOrEqual(Math.max(...v) + 1e-9);
  });
});

describe('portão 2 — o azimute pega sempre o ARCO MENOR', () => {
  const D = Math.PI / 180;

  it('170° → −170° vira 170° → 190°, não uma volta ao contrário', () => {
    const out = unwrapAngles([170 * D, -170 * D]);
    expect(out[0]).toBeCloseTo(170 * D, 12);
    expect(out[1]).toBeCloseTo(190 * D, 12);
    expect(Math.abs(out[1] - out[0])).toBeLessThanOrEqual(Math.PI + 1e-12);
  });

  it('uma volta inteira em quatro saltos de 90° acumula 360° no mesmo sentido', () => {
    /* Cru, `atan2` devolveria 0, 90, 180, −90, 0 — e o terceiro para o quarto
       salto varreria −270°. Desembrulhado, o percurso é monótono. */
    const cru = [0, 90, 180, 270, 360].map((d) => Math.atan2(
      Math.sin(d * D), Math.cos(d * D)));
    const out = unwrapAngles(cru);
    for (let i = 1; i < out.length; i++) {
      expect(out[i] - out[i - 1]).toBeCloseTo(90 * D, 9);
    }
    expect(out[4] - out[0]).toBeCloseTo(360 * D, 9);
  });

  it('nenhum passo consecutivo excede meia volta, em 500 sequências', () => {
    /* Determinístico de propósito: uma semente pseudoaleatória fixa dá o mesmo
       relato em qualquer máquina, que é o que faz uma falha ser reproduzível. */
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let n = 0; n < 500; n++) {
      const cru = Array.from({ length: 8 }, () => (rnd() * 2 - 1) * Math.PI);
      const out = unwrapAngles(cru);
      for (let i = 1; i < out.length; i++) {
        expect(Math.abs(out[i] - out[i - 1])).toBeLessThanOrEqual(Math.PI + 1e-9);
      }
      /* E o desembrulho não muda o ÂNGULO, só o ramo. */
      for (let i = 0; i < out.length; i++) {
        const volta = (out[i] - cru[i]) / (Math.PI * 2);
        expect(Math.abs(volta - Math.round(volta))).toBeLessThan(1e-9);
      }
    }
  });
});

describe('portão 3 — a PAUSA para de verdade', () => {
  /* É assim que `scene/timeline.ts` monta uma chave com `hold`: dois nós, o
     mesmo valor, dois tempos. O interpolador não tem exceção nenhuma para isso;
     quem faz a parada é a regra de Fritsch–Carlson zerando a tangente nos dois
     lados de um trecho chato. */
  const t = [0, 2, 3.5, 5.5];
  const v = [10, 25, 25, 8];
  const m = pchipTangents(t, v);

  it('o trecho chato sai CHATO — nenhum deslize no meio do respiro', () => {
    for (let k = 0; k <= 100; k++) {
      expect(sampleTrack(t, v, m, 2 + (1.5 * k) / 100)).toBeCloseTo(25, 12);
    }
  });

  it('a câmera CHEGA parando e SAI parando (tangente zero dos dois lados)', () => {
    expect(m[1]).toBe(0);
    expect(m[2]).toBe(0);
  });

  it('e uma chave sem pausa NÃO para: a tangente do meio é positiva', () => {
    const mm = pchipTangents([0, 2, 4], [10, 20, 30]);
    expect(mm[1]).toBeGreaterThan(0);
  });
});

describe('portão 4 — o contrato básico', () => {
  const t = [0, 1.5, 4, 6];
  const v = [30, 12, 18, 9];
  const m = pchipTangents(t, v);

  it('passa EXATAMENTE por cada ponto marcado, no instante marcado', () => {
    for (let i = 0; i < t.length; i++) {
      expect(sampleTrack(t, v, m, t[i])).toBeCloseTo(v[i], 12);
    }
  });

  it('começa e termina PARADO — a partida e a chegada são macias', () => {
    expect(m[0]).toBe(0);
    expect(m[m.length - 1]).toBe(0);
    /* E isso se vê na curva: o deslocamento no primeiro centésimo do primeiro
       trecho é uma fração ínfima do deslocamento total dele. */
    const d0 = Math.abs(sampleTrack(t, v, m, 0.015) - v[0]);
    expect(d0).toBeLessThan(Math.abs(v[1] - v[0]) * 0.01);
  });

  it('é contínua em VELOCIDADE nas emendas (C¹)', () => {
    /* Derivada numérica dos dois lados de cada nó interno. Uma emenda com
       chute — o defeito clássico de percurso keyframado — apareceria aqui como
       uma razão longe de 1. */
    const h = 1e-5;
    for (let i = 1; i < t.length - 1; i++) {
      const antes = (sampleTrack(t, v, m, t[i]) - sampleTrack(t, v, m, t[i] - h)) / h;
      const depois = (sampleTrack(t, v, m, t[i] + h) - sampleTrack(t, v, m, t[i])) / h;
      expect(depois).toBeCloseTo(antes, 3);
    }
  });

  it('fora do intervalo, segura a ponta em vez de extrapolar', () => {
    expect(sampleTrack(t, v, m, -5)).toBeCloseTo(v[0], 9);
    expect(sampleTrack(t, v, m, 99)).toBeCloseTo(v[v.length - 1], 9);
  });

  it('duas chaves sem pausa dão um `smoothstep` — o caso mais comum de todos', () => {
    const tt = [0, 1];
    const vv = [0, 1];
    const mm = pchipTangents(tt, vv);
    for (const s of [0.25, 0.5, 0.75]) {
      expect(sampleTrack(tt, vv, mm, s)).toBeCloseTo(s * s * (3 - 2 * s), 12);
    }
  });
});

describe('o cursor de busca', () => {
  const t = [0, 1, 2, 3];

  it('avança de onde parou e devolve sempre um trecho válido', () => {
    let c = 0;
    for (const [at, esperado] of [[0, 0], [0.5, 0], [1, 1], [2.4, 2], [3, 2]] as const) {
      c = segmentIndex(t, at, c);
      expect(c).toBe(esperado);
    }
  });

  it('RETROCEDE — é o arrasto do cabeçote para a esquerda', () => {
    /* Sem este ramo, arrastar a régua de volta devolveria a pose do trecho
       errado: o cursor ficaria parado no fim e a câmera pularia. */
    expect(segmentIndex(t, 0.2, 2)).toBe(0);
  });

  it('aguenta um cursor fora da faixa sem sair do array', () => {
    expect(segmentIndex(t, 1.5, 99)).toBe(1);
    expect(segmentIndex(t, 1.5, -3)).toBe(1);
  });
});

describe('a base de Hermite, dividida pelas sete faixas', () => {
  it('a soma de h00 e h01 é 1 em todo s — as faixas não ganham nem perdem', () => {
    for (let k = 0; k <= 20; k++) {
      const b = hermiteBasis(k / 20);
      expect(b.h00 + b.h01).toBeCloseTo(1, 12);
    }
  });

  it('avaliar com a base compartilhada dá o mesmo que avaliar faixa a faixa', () => {
    const t = [0, 2, 5];
    const a = [1, 9, 4];
    const b = [30, 13, 22];
    const ma = pchipTangents(t, a);
    const mb = pchipTangents(t, b);
    for (const at of [0.3, 1.7, 2.0, 3.9]) {
      const i = segmentIndex(t, at, 0);
      const h = t[i + 1] - t[i];
      const base = hermiteBasis((at - t[i]) / h);
      expect(hermiteValue(base, h, a[i], a[i + 1], ma[i], ma[i + 1]))
        .toBeCloseTo(sampleTrack(t, a, ma, at), 12);
      expect(hermiteValue(base, h, b[i], b[i + 1], mb[i], mb[i + 1]))
        .toBeCloseTo(sampleTrack(t, b, mb, at), 12);
    }
  });
});
