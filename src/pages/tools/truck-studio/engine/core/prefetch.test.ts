/* O que este teste protege, e por que ele existe.
   ---------------------------------------------------------------------------
   `core/prefetch.ts` é uma bomba de concorrência: uma fila, um teto de dois em
   voo, e um `pump()` chamado do `finally` de cada download. Código dessa forma
   falha de UM jeito e é sempre o mesmo — ele TRAVA, com a fila cheia e nenhum
   trabalho andando, e não faz barulho nenhum ao travar. O sintoma no produto
   seria "às vezes o carregamento é rápido, às vezes não", que é indepurável.

   Então os casos abaixo não são cobertura por cobertura: cada um é um jeito
   conhecido de a bomba parar.

   O `fetch` é substituído por um controlado à mão — o objetivo é medir a FILA,
   não a rede. E o corpo devolvido é um `ReadableStream` de verdade porque
   `drain()` o consome com `getReader()`: um mock que devolvesse `{ ok: true }`
   pelado testaria um caminho que a produção não tem. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  prefetch, cancelPrefetch, isWarm, prefetchStats,
} from './prefetch';

/* Um download que só termina quando o teste mandar. É isto que torna o teto de
   concorrência OBSERVÁVEL: sem uma resposta presa, os dois primeiros terminariam
   antes de o terceiro ser enfileirado e a fila nunca teria profundidade. */
interface Pending {
  url: string;
  resolve: () => void;
  reject: (e: unknown) => void;
  aborted: boolean;
}

let pending: Pending[] = [];
let realFetch: typeof globalThis.fetch;

/** Deixa o microtask queue drenar — o `pump()` roda dentro de um `finally`. */
const settle = () => new Promise<void>((r) => setTimeout(r, 0));

const body = () => new ReadableStream<Uint8Array>({
  start(c) { c.enqueue(new Uint8Array([1, 2, 3])); c.close(); },
});

beforeEach(() => {
  pending = [];
  realFetch = globalThis.fetch;
  globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    return new Promise<Response>((resolve, reject) => {
      const job: Pending = {
        url,
        resolve: () => resolve(new Response(body(), { status: 200 })),
        reject,
        aborted: false,
      };
      init?.signal?.addEventListener('abort', () => {
        job.aborted = true;
        reject(new DOMException('aborted', 'AbortError'));
      });
      pending.push(job);
    });
  }) as typeof globalThis.fetch;
});

/* LIMPEZA OBRIGATÓRIA, e a razão vale ser dita: o módulo é um SINGLETON de
   processo (é um cache), então um download que um caso deixa preso continua
   ocupando uma das duas vagas no caso seguinte — e o sintoma é um teto de
   concorrência que "às vezes" mede 1 em vez de 2. Aconteceu na primeira
   execução deste arquivo, exatamente assim.
   Cancelar as três etiquetas esvazia fila e voo; o `settle()` deixa o `pump()`
   do `finally` de cada aborto rodar antes do próximo caso. */
afterEach(async () => {
  cancelPrefetch('cab');
  cancelPrefetch('env');
  cancelPrefetch('trailer');
  await settle();
  globalThis.fetch = realFetch;
});

/* O módulo guarda estado GLOBAL de propósito (é um cache de processo), então
   cada teste usa URLs próprias. Um `resetModules()` por teste seria mais limpo,
   mas re-importar o módulo a cada caso esconderia justamente o que ele é: uma
   coisa só, viva pela sessão inteira. */
let n = 0;
const u = (name: string) => `models/vehicles/t${++n}-${name}.glb`;

describe('prefetch', () => {
  it('respeita o teto de dois em voo e drena a fila sozinho', async () => {
    const urls = [u('a'), u('b'), u('c'), u('d')];
    prefetch(urls, 'cab');
    await settle();

    expect(pending).toHaveLength(2);
    expect(prefetchStats().pendentes).toBe(2);

    /* O terceiro só pode entrar quando uma vaga abre — e tem de entrar SOZINHO,
       sem ninguém chamar pump() de fora. É esse o passo que trava quando o
       `finally` erra. */
    pending[0].resolve();
    await settle();
    expect(pending).toHaveLength(3);

    pending[1].resolve();
    pending[2].resolve();
    await settle();
    expect(pending).toHaveLength(4);

    pending[3].resolve();
    await settle();
    expect(prefetchStats().pendentes).toBe(0);
    expect(prefetchStats().emVoo).toBe(0);
    for (const url of urls) expect(isWarm(url)).toBe(true);
  });

  it('não repete uma URL já baixada, em voo ou enfileirada', async () => {
    const a = u('dup');
    prefetch([a], 'cab');
    await settle();
    expect(pending).toHaveLength(1);

    prefetch([a, a], 'cab');            // em voo
    await settle();
    expect(pending).toHaveLength(1);

    pending[0].resolve();
    await settle();
    prefetch([a], 'cab');               // já concluída
    await settle();
    expect(pending).toHaveLength(1);
  });

  it('cancela só a etiqueta pedida, e mantém o que já baixou', async () => {
    const cabA = u('cab-a'), cabB = u('cab-b'), env = u('env');
    prefetch([cabA], 'cab');
    await settle();
    pending[0].resolve();               // esta TERMINA antes do cancelamento
    await settle();
    expect(isWarm(cabA)).toBe(true);

    prefetch([cabB], 'cab');
    prefetch([env], 'env');
    await settle();
    expect(pending).toHaveLength(3);

    cancelPrefetch('cab');
    await settle();
    /* O abortado saiu; o de outra etiqueta continua de pé. */
    expect(pending.find((p) => p.url.includes('cab-b'))?.aborted).toBe(true);
    expect(pending.find((p) => p.url.includes('env'))?.aborted).toBe(false);
    /* E o que JÁ tinha baixado não é esquecido — voltar um passo é grátis. */
    expect(isWarm(cabA)).toBe(true);
    expect(isWarm(cabB)).toBe(false);
  });

  it('um download que falha não pode travar a fila', async () => {
    const [a, b, c] = [u('boom'), u('ok1'), u('ok2')];
    prefetch([a, b, c], 'cab');
    await settle();
    expect(pending).toHaveLength(2);

    /* Rede caída, CORS, o que for: a vaga TEM de abrir mesmo assim. Era o
       caminho em que um `catch` mal posto deixaria `live` com um fantasma e o
       teto de dois nunca mais seria atingido. */
    pending[0].reject(new TypeError('Failed to fetch'));
    await settle();
    expect(pending).toHaveLength(3);

    pending[1].resolve();
    pending[2].resolve();
    await settle();
    expect(prefetchStats().emVoo).toBe(0);
  });

  it('descarta null, undefined e string vazia sem enfileirar nada', async () => {
    prefetch([null, undefined, '', '   '], 'env');
    await settle();
    expect(pending).toHaveLength(0);
    expect(prefetchStats().pendentes).toBe(0);
  });
});
