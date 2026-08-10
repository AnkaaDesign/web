/* Pré-aquecimento de assets — baixar os bytes ANTES de alguém pedi-los.
   ---------------------------------------------------------------------------
   O PROBLEMA, medido. O seletor tem cinco passos (cenário → fabricante → modelo
   → chassi → cor) e um usuário leva de dez segundos a um minuto para
   atravessá-los. NENHUM byte de geometria desce nesse tempo: `runApply()` só
   começa depois que a escolha inteira está fechada, e aí baixa o cavalo (3,5 a
   46 MB), o cenário (HDRI 5,8 MB + set 3,5 a 7,4 MB) e — no primeiro boot — o
   implemento (31 MB), tudo sob a cortina. A rede fica ociosa durante a escolha e
   vira o único gargalo depois dela.

   A DECISÃO QUE FAZ ISTO SER SEGURO, e ela é a coisa mais importante do arquivo:

       ESTE MÓDULO AQUECE O CACHE HTTP. ELE NUNCA TOCA A CENA.

   Não existe aqui um `THREE.Group` parseado, um material, um cache de objeto ou
   qualquer coisa que `applyChoice()` pudesse adotar. Isso não é timidez: nem
   `applyEnvironment()` nem `loadCab()` são reentrantes ou canceláveis, e a fila
   de `studio.ts` existe justamente para garantir UMA aplicação por vez. Um
   pré-carregamento que produzisse objeto de cena teria de entrar naquela fila —
   e aí deixaria de ser especulativo, porque uma especulação errada custaria uma
   troca de cena. Aquecendo só o cache, uma especulação errada custa banda e
   nada mais, e o caminho de carga não muda uma linha.

   POR QUE O CACHE HTTP DÁ CONTA. A API serve `/studio-assets/` com
   `Cache-Control: public, max-age=31536000, immutable` para todo binário (ver
   `api/src/main.ts`) — o caminho carrega a versão (`/v1/`), então os bytes de
   uma URL são uma promessa. Um GET agora e um `GLTFLoader.load()` daqui a
   quarenta segundos são o mesmo recurso, e o segundo não toca a rede: `immutable`
   dispensa até a revalidação. O que sobra para o carregador pagar é o parse e o
   decode Draco, que é o que ele tem de pagar de qualquer jeito.

   O QUE PRECISA CASAR PARA O CACHE ACERTAR, e é onde isto se quebra em silêncio:
   a entrada de cache é indexada pela URL **e pelo modo da requisição**. O
   `FileLoader` do three faz `fetch(url, { credentials: 'same-origin' })` com
   `mode` implícito, e é exatamente isso que um `fetch(url)` pelado faz. Por isso
   este módulo NÃO passa `credentials`, NÃO passa `mode` e NÃO passa
   `cache: 'no-cache'` (que forçaria revalidação e jogaria fora metade do ganho).
   Mexer em qualquer um dos três faz o asset ser baixado DUAS vezes, sem nenhum
   sintoma além de o dobro de banda.

   O CORPO TEM DE SER CONSUMIDO. Uma resposta cujo corpo é abandonado é
   cancelada pelo navegador e não entra no cache — o prefetch viraria banda
   gasta à toa. Drenamos o stream e descartamos os pedaços, em vez de
   `arrayBuffer()`: são 31 MB no caso do implemento, e não há razão para
   materializá-los na memória só para soltá-los na linha seguinte.

   TODA URL PASSA POR `assetUrl()`, aqui e não nos chamadores. É a mesma decisão
   que `vehicle/models.ts:loadGLB()` tomou e pelo mesmo motivo, que `core/paths.ts`
   documenta: a árvore não é servida por esta origem, e um caminho cru entregue a
   um `fetch` resolve contra o web e dá 404 mudo. `assetUrl()` é idempotente por
   contrato, então um chamador que já resolveu não é punido. */
import { assetUrl } from '../catalog/catalog';

/**
 * A que ESCOLHA um download pertence. É por esta etiqueta que se cancela: o
 * usuário que passeia por seis modelos não pode deixar seis cabines em voo.
 *
 * - `trailer` — o implemento e seus acessórios. **Nunca é cancelado**: ele é
 *   carregado em todo boot, sem exceção, então não há nada de especulativo nele.
 * - `env`     — set/HDRI/poste do cenário escolhido no passo 1.
 * - `cab`     — o `.glb` do chassi. É o mais especulativo dos três (o passo do
 *   modelo aposta no chassi PADRÃO) e por isso o que mais é cancelado.
 */
export type PrefetchTag = 'trailer' | 'env' | 'cab';

/* DOIS, e não seis. O prefetch disputa banda com as imagens dos cards que o
   usuário está OLHANDO agora (`prefetchRenders()` em catalog/renders.ts), e
   perder essa disputa é trocar uma espera invisível por uma visível. Dois
   downloads grandes já saturam qualquer link em que isto importa. */
const MAX_IN_FLIGHT = 2;

/** URLs já baixadas com sucesso — o cache do navegador tem estas. */
const done = new Set<string>();
/** URLs em voo agora, com o controlador que as cancela. */
const live = new Map<string, { tag: PrefetchTag; ctrl: AbortController }>();
/** O que ainda não coube em MAX_IN_FLIGHT. */
const queue: { url: string; tag: PrefetchTag }[] = [];

let started = 0;
let bytesSkipped = 0;

/* `navigator.connection` não está na lib do TS (é Network Information API, e
   só o Chromium a implementa). Declarada aqui em vez de `any` para que o teste
   lá embaixo diga o que está perguntando. */
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Este dispositivo quer que a gente adivinhe downloads?
 *
 * Duas recusas, e as duas são do usuário e não nossas: `saveData` é a opção
 * "economia de dados" ligada por ele, e `2g`/`slow-2g` é um link em que 31 MB
 * especulativos seriam um sequestro da banda que ele precisa para os cards.
 * Ausente a API (Safari, Firefox), a resposta é SIM — é o comportamento que já
 * existe hoje, e nunca pior que ele.
 */
function speculationAllowed(): boolean {
  const c = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!c) return true;
  if (c.saveData) return false;
  return c.effectiveType !== '2g' && c.effectiveType !== 'slow-2g';
}

/* Consome o corpo sem materializá-lo. Ver a nota do cabeçalho: um corpo
   abandonado é uma resposta cancelada, e uma resposta cancelada não entra no
   cache — o prefetch seria banda gasta por nada.
   O ramo do `arrayBuffer()` é para navegadores sem `response.body` (Safari
   antigo): lá materializar é a única forma de terminar a resposta, e pagar 31 MB
   de pico transitório é melhor do que não aquecer nada. */
async function drain(res: Response): Promise<void> {
  if (!res.body) { await res.arrayBuffer(); return; }
  const reader = res.body.getReader();
  for (;;) {
    const { done: end } = await reader.read();
    if (end) return;
  }
}

function pump(): void {
  while (live.size < MAX_IN_FLIGHT && queue.length) {
    const job = queue.shift();
    if (!job) return;
    if (done.has(job.url) || live.has(job.url)) continue;
    const ctrl = new AbortController();
    live.set(job.url, { tag: job.tag, ctrl });
    started++;
    void (async () => {
      try {
        const res = await fetch(job.url, {
          signal: ctrl.signal,
          /* Dica de prioridade (Chromium). Onde não existe, é ignorada — nunca
             um erro. É o que impede o implemento de 31 MB de passar na frente
             das miniaturas dos cards. */
          priority: 'low',
        } as RequestInit);
        /* Um 404 aqui é informação, não falha: significa que o manifesto aponta
           para um arquivo que não existe, e o carregador de verdade vai
           descobrir isso de novo, no lugar onde há tratamento. Marcamos como
           feito para não repetir a pergunta. */
        if (res.ok) await drain(res);
        done.add(job.url);
      } catch {
        /* Abortado, offline, CORS, o que for. Aquecer é OTIMIZAÇÃO: uma falha
           aqui não pode ter consequência nenhuma além de o carregador real
           pagar a rede depois, que é o que ele fazia antes deste módulo
           existir. Sem `console.warn` de propósito — um aviso por asset
           especulativo treinaria todo mundo a ignorar o console. */
      } finally {
        live.delete(job.url);
        pump();
      }
    })();
  }
}

/**
 * Põe estes caminhos na fila de aquecimento sob uma etiqueta.
 *
 * Idempotente e barata: um caminho já baixado, já em voo ou já enfileirado é
 * ignorado, então chamar isto a cada clique do seletor não custa nada. `null` e
 * vazio são aceitos e descartados — os manifestos têm campos opcionais
 * (`hdri: null` no `armazem`, `set` ausente no `estudio`) e o chamador não
 * deveria ter de filtrá-los.
 */
export function prefetch(paths: (string | null | undefined)[], tag: PrefetchTag): void {
  if (!speculationAllowed()) {
    bytesSkipped += paths.filter(Boolean).length;
    return;
  }
  for (const p of paths) {
    const url = assetUrl(p);
    if (!url) continue;
    if (done.has(url) || live.has(url)) continue;
    if (queue.some((j) => j.url === url)) continue;
    queue.push({ url, tag });
  }
  pump();
}

/**
 * Cancela o que ainda não terminou sob esta etiqueta.
 *
 * O QUE ELE NÃO FAZ, e é deliberado: não esquece o que JÁ baixou. Voltar de um
 * modelo para o anterior tem de encontrar a cabine dele quente, não recomeçar.
 *
 * `trailer` é aceito pela assinatura mas nenhum chamador o usa — o implemento é
 * carregado em todo boot, então não há aposta a desfazer. Deixá-lo cancelável
 * seria oferecer um botão que só pode piorar a carga.
 */
export function cancelPrefetch(tag: PrefetchTag): void {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].tag === tag) queue.splice(i, 1);
  }
  for (const [url, job] of live) {
    if (job.tag !== tag) continue;
    job.ctrl.abort();
    live.delete(url);
  }
  pump();
}

/** Este caminho já está no cache do navegador por conta deste módulo? */
export const isWarm = (path: string | null | undefined): boolean => {
  const url = assetUrl(path);
  return !!url && done.has(url);
};

/**
 * Diagnóstico para o handle de console (`__studio.prefetch.stats()`).
 *
 * A pergunta que ele responde é "o aquecimento está adiantando alguma coisa?", e
 * a forma de responder é abrir o seletor, escolher devagar e conferir se
 * `pendentes` e `emVoo` chegam a zero ANTES do último clique. Se não chegarem, o
 * gargalo é a rede e não a fila.
 */
export function prefetchStats() {
  return {
    concluidos: done.size,
    emVoo: live.size,
    pendentes: queue.length,
    iniciados: started,
    ignoradosPorEconomiaDeDados: bytesSkipped,
    permitido: speculationAllowed(),
  };
}
