/* A CURVA DO CRIADOR DE VÍDEO, SEM CENA NENHUMA.
   ===========================================================================
   Quatro funções puras: nenhum import, nenhum estado, nenhum `three`. Elas são
   o miolo de `scene/timeline.ts` — o que transforma "cinco pontos e quatro
   tempos" no percurso que a câmera faz —, e moram separadas por UMA razão
   prática que vale mais que a organização:

       ⚠️ `scene/scene.ts` CONSTRÓI UM `WebGLRenderer` NO TEMPO DE IMPORT.

   Ou seja: qualquer módulo que o importe, direto ou por transitividade, é
   impossível de carregar num teste de nó. O interpolador é a parte deste
   recurso em que um erro NÃO APARECE NA TELA — ele produz um vídeo que roda,
   com a câmera passando um pouco além de onde o usuário marcou, ou dando a
   volta pelo lado errado num azimute. Os dois só se descobrem assistindo. Com
   as funções aqui, `timeline-curve.test.ts` prova as duas propriedades sem
   abrir navegador.

   É a mesma separação que `vehicle/trailer-door.ts` já faz pelo mesmo motivo, e
   `vehicle/livery-layers.ts` por outro.

   ---------------------------------------------------------------------------
   POR QUE PCHIP E NÃO CATMULL-ROM: o argumento inteiro está no cabeçalho de
   `scene/timeline.ts`, § A CURVA É PCHIP. O resumo de uma linha: Catmull-Rom
   ULTRAPASSA, e uma câmera que passa do outro lado do ponto marcado e volta lê
   como defeito — e, no eixo do raio, chega a empurrá-la para dentro da zona de
   expulsão da carroceria. */

/**
 * As tangentes de Fritsch–Carlson (1980) para uma faixa `(t, v)`.
 *
 * Média harmônica ponderada dos declives vizinhos, ZERADA em todo extremo local
 * e em todo trecho chato. Isso é o que dá as duas propriedades de que tudo
 * depende:
 *
 *   1. **NÃO ULTRAPASSA.** Todo valor entre dois nós fica entre os valores
 *      desses nós. Como as chaves nascem de poses que o laço vivo já validou —
 *      as guardas de distância, de ângulo polar e a coleira da mira já agiram
 *      sobre elas —, um caminho que não sai do intervalo das chaves é um
 *      caminho que não viola nenhuma daquelas guardas. Não é preciso aparar no
 *      meio, e aparar no meio é o que produz a "dobra" que um percurso
 *      keyframado tem de não ter.
 *   2. **A PARADA SAI DE GRAÇA.** Uma chave com pausa entra duas vezes na
 *      tabela, com o mesmo valor; o trecho entre as duas cópias tem declive
 *      zero, e a regra zera as tangentes dos dois lados dele. A câmera chega
 *      parando, fica parada de verdade e sai acelerando, sem nenhuma exceção no
 *      interpolador.
 *
 * ⚠️ AS PONTAS FICAM EM ZERO À FORÇA, e não na tangente de uma face só que a
 * literatura sugere: é o que dá partida e parada macias ao vídeo inteiro sem
 * nenhum controle na interface. Um vídeo que abre com a câmera já em velocidade
 * de cruzeiro parece um corte no meio de um movimento.
 *
 * `t` tem de ser estritamente crescente. Passos nulos são absorvidos por um
 * piso de 1e-6 em vez de virarem `Infinity`: o chamador já garante a ordem, e
 * uma divisão por zero aqui apagaria o percurso inteiro em vez de errar um nó.
 */
export function pchipTangents(t: readonly number[], v: readonly number[]): number[] {
  const n = t.length;
  const m = new Array<number>(n).fill(0);
  if (n < 2) return m;
  const h: number[] = new Array(n - 1);
  const d: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = Math.max(1e-6, t[i + 1] - t[i]);
    d[i] = (v[i + 1] - v[i]) / h[i];
  }
  for (let i = 1; i < n - 1; i++) {
    /* Sinais opostos (um extremo local) ou um trecho chato: tangente zero. É a
       condição que impede a ultrapassagem, e é ela que faz a pausa funcionar. */
    if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
    const w1 = 2 * h[i] + h[i - 1];
    const w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  return m;
}

/**
 * Os quatro polinômios de Hermite em `s ∈ [0,1]`.
 *
 * Separados da avaliação porque as SETE faixas do percurso (azimute, elevação,
 * raio, lente e as três da mira) dividem a mesma grade de tempos: calcular a
 * base uma vez por quadro e reusá-la sete vezes é o que mantém o custo do
 * `place()` abaixo do ruído, num laço que roda 3 600 vezes por vídeo.
 */
export interface HermiteBasis {
  h00: number; h10: number; h01: number; h11: number;
}

export function hermiteBasis(s: number): HermiteBasis {
  const u = s < 0 ? 0 : s > 1 ? 1 : s;
  const u2 = u * u;
  const u3 = u2 * u;
  return {
    h00: 2 * u3 - 3 * u2 + 1,
    h10: u3 - 2 * u2 + u,
    h01: -2 * u3 + 3 * u2,
    h11: u3 - u2,
  };
}

/** O valor de um trecho, dada a base já calculada. `h` é a largura do trecho. */
export function hermiteValue(
  b: HermiteBasis, h: number, v0: number, v1: number, m0: number, m1: number,
): number {
  return b.h00 * v0 + b.h10 * h * m0 + b.h01 * v1 + b.h11 * h * m1;
}

/**
 * O trecho que contém `t`, com busca a partir de um cursor.
 *
 * O laço de render e a prévia pedem tempos MONOTÔNICOS, então avançar de onde
 * parou é O(1) amortizado sobre o percurso inteiro — uma busca binária por
 * quadro seria O(N log N) para o mesmo resultado. O RETROCESSO existe para o
 * arrasto do cabeçote, que salta para trás: sem ele, arrastar a régua para a
 * esquerda devolveria a pose do trecho errado.
 *
 * Devolve o índice do nó da ESQUERDA, sempre em `[0, n-2]`.
 */
export function segmentIndex(t: readonly number[], at: number, cursor: number): number {
  const last = t.length - 1;
  let i = cursor < 0 || cursor > last - 1 ? 0 : cursor;
  if (at < t[i]) i = 0;
  while (i < last - 1 && t[i + 1] <= at) i++;
  return i;
}

/**
 * Avaliação completa de UMA faixa. É a forma lenta e é a que os testes usam;
 * o `place()` do percurso usa `hermiteBasis` + `hermiteValue` para dividir a
 * base entre as sete faixas.
 */
export function sampleTrack(
  t: readonly number[], v: readonly number[], m: readonly number[], at: number,
): number {
  if (t.length === 0) return 0;
  if (t.length === 1) return v[0];
  const i = segmentIndex(t, at, 0);
  const h = Math.max(1e-6, t[i + 1] - t[i]);
  const s = (at - t[i]) / h;
  return hermiteValue(hermiteBasis(s), h, v[i], v[i + 1], m[i], m[i + 1]);
}

/**
 * Traz cada ângulo para o ramo mais próximo do anterior.
 *
 * ⚠️ SEM ISTO O PERCURSO DÁ UMA VOLTA INTEIRA AO CONTRÁRIO, e é o defeito mais
 * caro que este arquivo evita. `atan2` devolve (-π, π]: duas chaves a 170° e a
 * −170° estão a 20° uma da outra, e interpolar os números crus varreria 340°
 * pelo lado errado — em dois segundos, num vídeo que a pessoa só descobre
 * errado depois de esperar o render inteiro.
 *
 * Depois desta função, a diferença entre chaves consecutivas cai sempre em
 * (−π, π]: **entre dois pontos a câmera pega sempre o arco menor**. Quem quiser
 * a volta longa marca um ponto no meio, que é como se pede isso em qualquer
 * editor.
 *
 * Devolve um array NOVO — o de entrada é a leitura das chaves e não pode ser
 * remexido.
 */
export function unwrapAngles(a: readonly number[]): number[] {
  const TWO_PI = Math.PI * 2;
  const out = a.slice();
  for (let i = 1; i < out.length; i++) {
    out[i] += TWO_PI * Math.round((out[i - 1] - out[i]) / TWO_PI);
  }
  return out;
}
