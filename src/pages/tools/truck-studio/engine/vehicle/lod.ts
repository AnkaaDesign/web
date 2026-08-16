/* O LOD POR TAMANHO EM TELA — ⚠️⚠️ **APOSENTADO EM 2026-08-15.**
   ===========================================================================
   ┌───────────────────────────────────────────────────────────────────────────┐
   │ `lodMinPx` vale **0 nos TRÊS níveis**. Nenhuma tabela de `core/quality.ts`  │
   │ liga este mecanismo. O código abaixo continua correto, testado e de pé —   │
   │ ele só não é acionado por ninguém.                                        │
   └───────────────────────────────────────────────────────────────────────────┘

   POR QUE O ARQUIVO NÃO FOI APAGADO: ele carrega a MEDIÇÃO, e a medição é boa.
   A distribuição de tamanhos do `trailer.glb`, a aritmética de pixel projetado e
   a máquina de posse positiva de `.visible` não existem em nenhum outro lugar
   deste repositório. Apagar o arquivo perderia tudo isso e a próxima pessoa
   reinventaria o LOD do zero — provavelmente pelo mesmo raciocínio errado.

   ---------------------------------------------------------------------------
   POR QUE ELE FOI APOSENTADO — três achados, e cada um bastaria

   **1. Ele era o único botão do perfil que apagava PEÇA DO CAMINHÃO.**

   ⚠️⚠️ **NUNCA CHAME ISTO DE "CORTE SUB-PIXEL".** A tentação é enorme e a
   aritmética a desmente. A lente do estúdio é `CARD_FOV = 30°` (scene.ts:590) e
   `setVehicleFocus()` prende a órbita entre ~8,6 e ~22,4 m. Com isso o tamanho
   projetado de uma peça é

       px = D · H / ( 2 · tan(15°) · L )

   onde D é o diâmetro em metros, H a altura do BUFFER em pixels e L a distância
   ao olho. Uma peça de **5 cm, a 25 m, num buffer de 1080 px, mede 4,0 px de
   altura** — quatro pixels são um parafuso VISÍVEL, não um erro de arredondamento.
   O limiar honestamente invisível (1 px na pior distância) é **12,4 mm**, e nessa
   faixa existem **2 primitivas no implemento inteiro**.

   DISTRIBUIÇÃO MEDIDA no `trailer.glb` pela auditoria (primitivas / triângulos,
   pelo mesmo diâmetro de mundo que `setShadowCasters()` calcula):

       < 12,4 mm →     2 prims /      38 tri      ← o corte honesto: não paga nada
       < 20   mm →    63 prims / 104 485 tri
       < 30   mm →   191 prims / 192 669 tri
       < 50   mm →   592 prims / 697 996 tri
       < 100  mm → 1 045 prims / 1 174 034 tri

   As tabelas antigas usavam **1,5 px no Médio e 3,0 px no Baixo**. Nessa faixa
   some parafusaria e ferragem que o olho VÊ. É metade literal do relato que
   originou esta passagem: *"no baixo a qualidade visual fica horrível"*.

   E é a régua do portão de aceitação
   (`tools/studio-bench/checks-aceitacao.mjs`), escrita como um inteiro sem
   interpretação: **a contagem de malhas VISÍVEIS do veículo tem de ser IDÊNTICA
   nos três níveis.** Com `lodMinPx > 0` ela não é, e o portão reprova — com
   razão.

   **2. Ele não tocava o passe de sombra, que é metade do problema.**

   Medido em `GARGALO-2026-08-15.md` §1.1: das 588 chamadas que o LOD tirava do
   nível Médio, **ZERO** saíam do passe de sombra. O motivo é bonito e ninguém
   tinha percebido: `setShadowCasters()` já tira do passe de sombra tudo abaixo
   de 5 cm, que é exatamente a população que este LOD mais toca. **As duas
   otimizações se sobrepunham**, e o contador de chamadas escondia isso porque
   `renderer.info.render.calls` nunca contou o passe de sombra (o `info.reset()`
   do three 0.179.1 roda na linha 16477, DEPOIS do `shadowMap.render()` da
   16471). O passe de sombra são **1 574 das 3 804 chamadas** de um quadro de
   arrasto no nível Alto.

   **3. A fusão por material o deixou sem assunto.**

   `mergeVehicle: 'all'` funde o veículo por material: 2 146 malhas → 104, e o
   passe principal cai de 2 230 para **168 chamadas**, com quadro 14,9× mais
   rápido e **triângulos idênticos**. Este LOD existe para tirar CHAMADAS DE
   DESENHO. Depois da fusão não há chamada para tirar — e, pior, as malhas
   fundidas têm diâmetro de mundo grande por construção, então o registro abaixo
   não encontraria quase nada para registrar.

   ---------------------------------------------------------------------------
   O QUE O RESSUSCITARIA

   Uma condição, e ela é específica: **um quadro em que a contagem de chamadas
   volte a dominar, com a fusão indisponível.** Concretamente:

     · `mergeVehicle` em `'off'` ou `'floor'` — porque um dono novo (a lista está
       em `GARGALO-2026-08-15.md` §6.3: `vehicle/trim.ts` casa por NÓ,
       `setTrailerDims()` regenera o corpo branco) obrigou a tirar uma faixa
       grande da fusão; **e**
     · um acervo novo que volte a trazer milhares de primitivas separadas — o
       `trailer.glb` de hoje tem 2 157 primitivas e **nenhuma** instância de GPU,
       enquanto o `set.glb` do distrito faz 805 árvores em ~2 chamadas com
       `EXT_mesh_gpu_instancing`. Um acervo consertado (§6.5) reduz a chance
       ainda mais.

   E, se voltar, **volta com limiar honesto**: 12,4 mm é o número que não custa
   nada, e nessa faixa há 2 primitivas. Ou seja, mesmo ressuscitado ele quase não
   vale a pena — que é a conclusão a que se deveria ter chegado em 2026-08-14, e
   está registrada aqui para não se ter de chegar a ela uma terceira vez.

   ⚠️ E NÃO SE RESSUSCITA POR "está lento". A resposta certa para "está lento"
   nesta cena, em ordem de ganho medido, é: estrangular a reassadura do mapa de
   sombra (−34 % do quadro no Médio), fundir por material (14,9×), e KTX2 nos
   conjuntos de chão (−256 MB). Nenhuma das três custa um pixel do caminhão.

   ---------------------------------------------------------------------------
   POSSE POSITIVA DE `.visible`, E POR QUE UMA HEURÍSTICA NÃO SERVE AQUI

   `.visible` neste motor tem **nove donos** e nenhum árbitro: `trim.ts:430-431`,
   `trailer-geometry.ts:1843/:2062`, `models.ts:1295/:1305/:1357-1358`,
   `wheels.ts:277`, `livery-snapshot.ts:562/:707/:713-715`,
   `scene/capture.ts:508/:518/:532`, `scene/probe.ts:74-75/:85` e
   `scene/seethrough.ts:804/:837`.

   `capture.ts:508` resolve o problema dele com uma heurística — *"se já está
   invisível, não é meu"* — e ela é CERTA lá, porque `isolateVehicle()` roda uma
   vez, esconde e restaura dentro do mesmo `try/finally`. Aqui não serve: o LOD
   roda em TODO quadro desenhado e a mesma malha entra e sai da lista dezenas de
   vezes num arrasto. "Estava invisível quando olhei" não distingue *"eu escondi
   no quadro passado"* de *"o `seethrough` escondeu agora"*, e a diferença entre
   as duas é um caminhão que reaparece pela metade.

   Então a posse é REGISTRADA: cada entrada carrega `oculta`, escrita só por
   `esconder()`/`revelar()` deste arquivo. As duas regras que saem daí:

     · só escondemos quem está VISÍVEL no momento (se outro dono já escondeu, a
       malha não passa a ser nossa — a heurística de `capture.ts`, usada como
       porta de ENTRADA da posse, que é onde ela é válida);
     · só revelamos quem `oculta` diz que é nosso.

   ⚠️ O QUE ISTO AINDA NÃO RESOLVE, dito por inteiro: se um segundo dono esconder
   uma malha que já é NOSSA, ao revelá-la nós passamos por cima dele. Não há como
   evitar sem um árbitro de verdade (uma pilha de razões por objeto), e um árbitro
   é uma refatoração de nove arquivos. O risco real é pequeno porque as faixas não
   se cruzam: o `seethrough` opera em CARROCERIAS de cenário e o `probe` roda com
   o laço parado, enquanto este módulo só registra peças abaixo de 15 cm.

   ---------------------------------------------------------------------------
   HISTERESE É OBRIGATÓRIA, NÃO É REFINAMENTO

   A órbita atravessa o limiar continuamente — é a mesma distância variando com o
   arrasto do mouse. Com uma soleira só, uma peça parada exatamente no limiar
   piscaria a cada quadro, e "piscar" num campo de 592 parafusos é um chuvisco.
   Então são DUAS: esconde em `minPx`, reexibe em `minPx · 1,15`. A banda morta de
   15 % é a menor que sobrevive ao tremor de mão num zoom lento (estimado — o
   número não foi calibrado contra gravação, e se alguém vir cintilação o conserto
   é aumentar `HISTERESE`, não diminuir).

   ---------------------------------------------------------------------------
   A SOMBRA, E O QUANTO DELA SOBRA

   `.visible` muda o passe de sombra, e o renderizador roda com
   `shadowMap.autoUpdate = false` (scene.ts) — ou seja o mapa NÃO se refaz
   sozinho, e uma malha que sumiu da cena continuaria projetando a sombra que
   escreveu antes. Daí `renderer.shadowMap.needsUpdate = true` quando algo muda.

   Mas o número é pequeno, e a razão é bonita: `setShadowCasters()` já tirou do
   passe de sombra TUDO abaixo de 5 cm (`SHADOW_CASTER_MIN_M`, que desde
   2026-08-15 é `shadowCasterMinM` do perfil: 5 / 10 / 15 cm), e é justamente
   essa a população que este LOD mais toca. Cruzando as duas medidas: das 1 045
   primitivas abaixo de 100 mm, 592 estão abaixo de 50 mm e portanto **já não
   projetam sombra nenhuma** — só as ~453 restantes (50…100 mm) podem sujar o
   mapa. A faixa 100…150 mm que este registro também alcança NÃO FOI MEDIDA.
   Por isso a marcação é CONDICIONAL (`if (m.castShadow)`): num arrasto que só
   mexa em parafuso o mapa de sombra não é refeito uma vez sequer.

   ⚠️ E ESSA SOBREPOSIÇÃO É EXATAMENTE O ACHADO QUE APOSENTOU ESTE ARQUIVO. O que
   aqui estava escrito como uma virtude ("o número é pequeno") é, lido do outro
   lado, o veredito: o LOD tirava 588 chamadas do passe principal do nível Médio
   e **zero** do passe de sombra, que são 1 574 chamadas. Ver o cabeçalho.

   ---------------------------------------------------------------------------
   ONDE ELE RODA — A DECISÃO EM `onDrawFrame`, O PAGAMENTO DA SOMBRA EM `onFrame`

   Parecem contraditórios e não são: são duas coisas diferentes com prazos
   diferentes, e cada uma está no gancho que o prazo dela exige.

   **A DECISÃO é `onDrawFrame()` (scene.ts) e nunca `onFrame()`.** `onFrame` roda
   também em quadro PULADO, e o próprio bloco de lá diz o que aquilo pressupõe:
   *"são umas poucas operações de vetor, não uma chamada de desenho"*. Um LOD em
   quadro pulado seria trabalho de CPU para decidir a visibilidade de um quadro
   que não vai existir. `onDrawFrame` roda depois de `drawSuspended`/`dirtyFrames`
   e IMEDIATAMENTE antes do `render()`, que é exatamente o instante em que a
   decisão vale: o que escrevermos ali é o que aquele `render()` desenha.

   **O PAGAMENTO DA DÍVIDA DE SOMBRA é `onFrame()`, e a razão é de ORDEM.** Ver
   o bloco A TEMPESTADE DE SOMBRA logo abaixo.

   ---------------------------------------------------------------------------
   ⚠️⚠️ A TEMPESTADE DE SOMBRA — o defeito que este arquivo escondia atrás de outro

   `applyLod()` marcava `renderer.shadowMap.needsUpdate = true` **direto**, dentro
   do `onDrawFrame`, sempre que uma peça com `castShadow` cruzasse o limiar. Num
   ZOOM CONTÍNUO isso é uma peça cruzando o limiar em quase todo quadro — ou
   seja, **uma reassadura completa do mapa de sombra por quadro**, que é
   exatamente a classe de defeito medida em `GARGALO-2026-08-15.md` §1.2 e
   estrangulada em 2026-08-15 do lado do `seethrough.ts`: +6,06 ms por quadro no
   nível Alta, ~40 % do quadro, 1 574 chamadas.

   Ele ficava INVISÍVEL porque a tempestade do `seethrough` já sujava o mapa em
   100 % dos quadros de arrasto: uma segunda fonte sujando um mapa já sujo não
   custa nada. Conserta-se a primeira e a segunda aparece. Esta é a segunda.

   O CONSERTO É A MESMA DOUTRINA, e ela é REUSADA e não duplicada — o padrão está
   em `scene.ts` (`seeShadowDebt`/`seeShadowNextAt`, que por sua vez copia o
   `shadowStale`/`scrubUntil` do arrasto do relógio):

     · a mudança CONTÍNUA vira DÍVIDA, cobrada no ritmo de
       `getProfile().shadowRefreshHz` (20/12/8);
     · a dívida é PAGA, sempre — senão a peça reaparece sem sombra, que é o
       defeito que a marcação existe para não ter;
     · enquanto houver dívida o laço é invalidado, porque num laço SOB DEMANDA
       ninguém desenha o quadro que pagaria;
     · uma reassadura pedida por OUTRO dono quita a dívida de graça.

   ⚠️ **E O PAGAMENTO TEM DE ACONTECER EM `onFrame`, NÃO EM `onDrawFrame`, POR UMA
   RAZÃO DE ORDEM DENTRO DO LAÇO.** `startLoop()` amostra `const assaSombra =
   renderer.shadowMap.needsUpdate` na linha 4903, **antes** de rodar os
   `drawHooks` (4921) e **depois** dos `frameHooks` (4827). Um `needsUpdate`
   escrito de dentro de um `drawHook` chega tarde demais para o laço saber que o
   passe rodou, e isso estraga três coisas de uma vez:

     1. `seeShadowNextAt` não avança — ou seja o estrangulamento do `seethrough`
        passa a permitir uma reassadura extra por cima da nossa;
     2. o contador de `reassaduras` não registra — e é ele que alimenta o
        `shadowRefreshHz` OBSERVADO do painel, o número que prova o conserto;
     3. pior de todas, o laço credita a contagem daquele quadro a
        `callsSemSombra` (4943) num quadro que **assou a sombra**, e o split
        `shadowCalls` do diagnóstico sai errado — no limite, negativo.

   ⚠️ **E ISTO ESTÁ ADORMECIDO HOJE.** Com o LOD aposentado (`lodMinPx: 0` nos
   três níveis) nada aqui chega a marcar sombra nenhuma. O conserto entra assim
   mesmo, e a etiqueta fica: quem ressuscitar o LOD ressuscita junto uma segunda
   tempestade de sombra, e ela é cara.

   ---------------------------------------------------------------------------
   POR QUE ESTE MÓDULO NÃO É IMPORTADO POR `material-setup.ts`

   Seria o lugar óbvio para registrar (`setupCommon()` é a porta por onde TODA
   raiz de veículo passa), e é proibido: `material-setup.ts` é FOLHA de propósito
   — o pipeline offline de renders de card (`tools/studio-render/rig.ts`) e a
   bancada (`tools/trailer-bench/*.ts`) importam `setupCommon()` justamente para
   não arrastar `scene/scene.ts`, que constrói um `WebGLRenderer` no tempo de
   import. Este arquivo IMPORTA `scene.ts` (precisa do laço, da câmera e do
   renderizador), então importá-lo de lá quebraria as três ferramentas.

   A saída é este módulo se AUTO-ALIMENTAR: ele acha o `RIG` pelo nome na cena e
   só revarre quando uma impressão digital barata da árvore muda. `registerLod()`
   continua exportado para quem quiser registrar explicitamente (é o caminho mais
   barato, e é o que `models.ts` deveria chamar no dia em que alguém encostar
   nele). */
import * as THREE from 'three';
import { camera, invalidate, onDrawFrame, onFrame, renderer, scene } from '../scene/scene';
import { getProfile, onQualityChange } from '../core/quality';

/**
 * O maior diâmetro que vale registrar, em metros.
 *
 * Nada acima disto pode ser escondido por nenhuma combinação plausível de
 * limiar, distância e resolução, então registrar seria pagar uma transformação
 * de vetor por quadro para sempre decidir "fica".
 *
 * A CONTA (feita quando o maior limiar da tabela era `lodMinPx = 3`, no nível
 * Baixa): a órbita mais distante é ~22,4 m e o buffer mais BAIXO que este
 * produto desenha é o de uma janela pequena já com a escala de render do nível
 * Baixa — digamos 600 px de CSS a 0,65, ou seja 390 px. Invertendo a fórmula do
 * cabeçalho:
 *
 *     D_max = px · 2 · tan(15°) · L / H = 3 · 0,5359 · 22,4 / 390 = 0,092 m
 *
 * 0,15 m dá ~1,6× de folga sobre esse pior caso. Pela distribuição medida isso
 * põe no registro a população "abaixo de 15 cm" — 1 045 primitivas até 100 mm
 * mais uma faixa 100…150 mm que NÃO FOI MEDIDA; da ordem de 1 100 a 1 400
 * entradas, ESTIMADO.
 *
 * ⚠️ **ESTE NÚMERO GANHOU UM SEGUNDO DONO EM 2026-08-15.** Com o LOD aposentado,
 * `core/quality.ts` adotou 0,15 m como `shadowCasterMinM` do nível Baixa, e a
 * justificativa de lá aponta para cá: é o teto do que ESTE arquivo mediu e
 * chamou de parafusaria. Os dois mecanismos passam a compartilhar uma definição
 * só de "peça pequena" — o que muda entre eles é o preço. O LOD tirava a PEÇA; o
 * corte de sombra tira só a SOMBRA dela, e por isso sobreviveu.
 */
const LOD_MAX_DIAM = 0.15;

/** Reexibe em `minPx · 1,15`. Ver HISTERESE É OBRIGATÓRIA, no cabeçalho. */
const HISTERESE = 1.15;

/** Intervalo mínimo entre duas conferências da impressão digital do `RIG`.
 *  A conferência custa ~10 leituras de propriedade; o que ela evita custar é a
 *  varredura de 2 157 nós. 400 ms é imperceptível numa troca de caminhão, que já
 *  passa por uma cortina de carregamento. */
const RESCAN_MIN_MS = 400;

interface Entry {
  mesh: THREE.Mesh;
  /** Centro da esfera envolvente, em espaço LOCAL da geometria. Transformado por
   *  `matrixWorld` a cada quadro — a mesma operação que o próprio
   *  `WebGLRenderer.projectObject()` já faz para o teste de frustum, o que é a
   *  prova de que este custo é suportável nesta contagem. */
  c: THREE.Vector3;
  /** Diâmetro de mundo AO QUADRADO. Guardado quadrado para o teste não precisar
   *  de raiz nem de divisão — ver `applyLod()`. */
  d2: number;
  /** ⚠️ A POSSE. `true` só quando foi ESTE módulo que escondeu. */
  oculta: boolean;
}

let registro: Entry[] = [];
/** Quantas entradas estão ocultas POR NÓS. Evita percorrer o registro só para
 *  descobrir que não há nada a soltar. */
let ocultas = 0;

const _sph = new THREE.Sphere();
const _camPos = new THREE.Vector3();
const _p = new THREE.Vector3();

/* ---------------------------------------------------------------------------
   A DÍVIDA DE SOMBRA — ver ⚠️⚠️ A TEMPESTADE DE SOMBRA, no cabeçalho.
   --------------------------------------------------------------------------- */

/** Há um emissor que mudou e cuja sombra ainda não foi reassada. */
let sombraDevida = false;
/** Antes deste instante a dívida espera. `performance.now()`. */
let sombraProximaEm = 0;

/**
 * Teto de reassaduras por segundo, do perfil.
 *
 * ⚠️ RESERVA NO NÍVEL MAIS PESADO (20 Hz), e é a mesma escolha que `scene.ts`
 * faz e pelo mesmo motivo: uma reserva alta pode deixar desempenho na mesa;
 * uma reserva baixa daria ao nível Alto uma sombra mais defasada do que o dono do
 * perfil autorizou, e "a sombra arrasta" é indistinguível de um bug.
 */
function hzSombra(): number {
  const hz = (getProfile() as { shadowRefreshHz?: number }).shadowRefreshHz;
  return hz && hz > 0 ? hz : 20;
}

/**
 * A mudança CONTÍNUA — uma peça cruzou o limiar num quadro de zoom. Vira dívida.
 *
 * Nunca escreve `needsUpdate` na hora: é este caminho que, num zoom, dispara em
 * quase todo quadro.
 */
function marcarSombraDevida() { sombraDevida = true; }

/**
 * A BORDA — a devolução em massa de `releaseLod()`.
 *
 * ⚠️ **NÃO É ESTRANGULADA, E A DISTINÇÃO É A DOUTRINA INTEIRA.** Estrangula-se
 * uma fonte CONTÍNUA (o zoom cruzando limiares quadro a quadro); jamais uma
 * BORDA. `releaseLod()` roda em troca de nível, em desligamento do LOD e —
 * decisivo — dentro de `scene/capture.ts`, que devolve todas as peças e
 * fotografa em seguida. Uma foto tirada com a sombra estrangulada sairia com o
 * mapa do estado anterior, e a foto é o produto: ela sai sempre no teto.
 */
function marcarSombraAgora() {
  sombraDevida = false;
  renderer.shadowMap.needsUpdate = true;
}

/* O PAGAMENTO, em `onFrame` e não em `onDrawFrame` — ver o ⚠️ de ORDEM no
   cabeçalho. Em quadro pulado o custo é uma comparação de booleano.

   O laço é SOB DEMANDA: sem `invalidate()` a dívida ficaria aberta para sempre
   assim que o zoom parasse, e a peça reapareceria sem sombra. `invalidate(2)`
   (o mesmo número que `scene.ts` usa para a dívida da dissolvência) cobre o
   quadro que assa e o que apresenta. Isto TERMINA por construção: a dívida se
   fecha dentro de 1/`shadowRefreshHz` e o gancho volta a sair na primeira
   linha. */
onFrame(() => {
  if (!sombraDevida) return;
  const agora = performance.now();
  /* DE CARONA: se outro dono já pediu a reassadura, a nossa acontece junto e não
     gasta a janela. É a mesma regra do `seeShadowDebt = false` de `scene.ts`. */
  if (renderer.shadowMap.needsUpdate) {
    sombraDevida = false;
    sombraProximaEm = agora + 1000 / hzSombra();
    return;
  }
  invalidate(2);
  if (agora < sombraProximaEm) return;
  renderer.shadowMap.needsUpdate = true;
  sombraDevida = false;
  sombraProximaEm = agora + 1000 / hzSombra();
});

/**
 * Registra as malhas de `root` que o LOD pode alcançar. Idempotente por malha —
 * chamar de novo com a mesma raiz não duplica entradas.
 *
 * ⚠️ `InstancedMesh` É IGNORADA DE PROPÓSITO. Uma instanciada já é UMA chamada
 * de desenho seja qual for a contagem, então escondê-la não devolve chamada
 * nenhuma — devolveria só os triângulos, e ao preço de sumir com as 76 fitas
 * refletivas ou os 40 halos de uma vez, que são efeitos autorados e não
 * parafusaria. (Ver `trailer-assembly.ts`, que é quem converte as fitas.)
 *
 * @returns quantas entradas NOVAS entraram.
 */
export function registerLod(root: THREE.Object3D | null | undefined): number {
  if (!root) return 0;
  /* Sem isto, uma raiz recém-pendurada teria `matrixWorld` de um quadro atrás — e
     no pior caso a identidade, que é o defeito que `setShadowCasters()` documenta
     (um parafuso "com metros"). É a mesma linha e pelo mesmo motivo. */
  root.updateMatrixWorld(true);
  const jaTem = new Set<THREE.Mesh>();
  for (const e of registro) jaTem.add(e.mesh);
  let n = 0;
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    if ((o as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    if (jaTem.has(o)) return;
    const g = o.geometry;
    if (!g) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const bs = g.boundingSphere;
    if (!bs || !Number.isFinite(bs.radius)) return;
    /* A MEDIDA VEM DE `setShadowCasters()`, que já a pagou — ver o bloco A MEDIDA
       FICA GUARDADA em `material-setup.ts`. O cálculo aqui é só a rede para quem
       não passou por lá (uma malha criada depois do `setupCommon()`), e ele
       ESCREVE no mesmo campo, para os dois consumidores nunca discordarem. */
    const guardado: unknown = o.userData.tsWorldDiameter;
    let d = typeof guardado === 'number' && guardado > 0 ? guardado : 0;
    if (!d) {
      d = _sph.copy(bs).applyMatrix4(o.matrixWorld).radius * 2;
      o.userData.tsWorldDiameter = d;
    }
    if (!(d > 0) || d > LOD_MAX_DIAM) return;
    registro.push({ mesh: o, c: bs.center.clone(), d2: d * d, oculta: false });
    jaTem.add(o);
    n++;
  });
  return n;
}

/** Solta a posse de tudo e esvazia o registro. Usada na revarredura. */
function limparRegistro() {
  releaseLod();
  registro = [];
}

/**
 * Decide quem some, pelo tamanho projetado em `frameHeightPx` pixels de ALTURA.
 *
 * ⚠️ A ALTURA É A DO BUFFER EM QUE SE VAI DESENHAR, e no caso da captura isso
 * **não é o ladrilho**: ver a chamada em `scene/capture.ts`.
 *
 * `minPx <= 0` desliga — e desligar significa DEVOLVER o que escondemos, não
 * apenas parar de esconder. É por isso que o caminho de desligamento passa por
 * `releaseLod()` em vez de um `return 0`: sem ele, mudar de nível no meio da
 * sessão (ou tirar uma foto) deixaria o caminhão com os parafusos que o nível
 * anterior tinha apagado.
 *
 * @returns quantas malhas MUDARAM de estado. Quem chama de fora do laço pode usar
 *   isto para pedir um quadro só quando > 0.
 */
export function applyLod(
  cam: THREE.PerspectiveCamera, frameHeightPx: number, minPx: number,
): number {
  if (!(minPx > 0) || !(frameHeightPx > 0)) return releaseLod();
  const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov) * 0.5);
  if (!(tanH > 0)) return releaseLod();

  /* px = D·k / L, com k = H / (2·tan(fov/2)). Tudo daqui para baixo trabalha ao
     QUADRADO, para o laço não pagar nem raiz nem divisão por entrada:

         esconde  se  px² < minPx²          ⇔  D²k² < minPx²·L²
         reexibe  se  px² > (minPx·1,15)²   ⇔  D²k² > (minPx·1,15)²·L²

     Como D², k² e L² são todos ≥ 0, elevar ao quadrado preserva a ordem — o que
     é a licença para trocar a comparação. */
  const k = frameHeightPx / (2 * tanH);
  const k2 = k * k;
  const limEsconde = minPx * minPx;
  const limRevela = limEsconde * HISTERESE * HISTERESE;
  _camPos.setFromMatrixPosition(cam.matrixWorld);

  let mudou = 0;
  let mexeuEmSombra = false;
  for (let i = 0; i < registro.length; i++) {
    const e = registro[i];
    const m = e.mesh;
    _p.copy(e.c).applyMatrix4(m.matrixWorld);
    const l2 = _camPos.distanceToSquared(_p);
    const px2L2 = e.d2 * k2;              // (D·k)² = (px·L)²
    if (e.oculta) {
      if (px2L2 > limRevela * l2) {
        e.oculta = false;
        m.visible = true;
        ocultas--;
        mudou++;
        if (m.castShadow) mexeuEmSombra = true;
      }
    } else if (px2L2 < limEsconde * l2) {
      /* ⚠️ PORTA DE ENTRADA DA POSSE, e é a única leitura de `.visible` que este
         módulo faz como heurística: quem já está escondido por outro dono não
         vira nosso. Ver POSSE POSITIVA no cabeçalho. */
      if (!m.visible) continue;
      e.oculta = true;
      m.visible = false;
      ocultas++;
      mudou++;
      if (m.castShadow) mexeuEmSombra = true;
    }
  }
  /* Só quando um EMISSOR mudou — ver A SOMBRA, E O QUANTO DELA SOBRA.
     ⚠️ DÍVIDA e não escrita direta: este caminho dispara em quase todo quadro de
     um zoom contínuo. Ver ⚠️⚠️ A TEMPESTADE DE SOMBRA no cabeçalho. */
  if (mexeuEmSombra) marcarSombraDevida();
  return mudou;
}

/**
 * Devolve TUDO que este módulo escondeu. Idempotente.
 *
 * @returns quantas malhas voltaram.
 */
export function releaseLod(): number {
  if (!ocultas) return 0;
  let n = 0;
  let mexeuEmSombra = false;
  for (let i = 0; i < registro.length; i++) {
    const e = registro[i];
    if (!e.oculta) continue;
    e.oculta = false;
    e.mesh.visible = true;
    n++;
    if (e.mesh.castShadow) mexeuEmSombra = true;
  }
  ocultas = 0;
  /* ⚠️ AGORA, SEM ESTRANGULAMENTO — é BORDA, não fonte contínua, e um dos
     chamadores é a captura. Ver `marcarSombraAgora()`. */
  if (mexeuEmSombra) marcarSombraAgora();
  return n;
}

/* ---------------------------------------------------------------------------
   A AUTO-ALIMENTAÇÃO — achar o conjunto sem poder pedir a ninguém

   Ver o último bloco do cabeçalho para POR QUE ninguém nos chama. O que sobra é
   observar o `RIG` (models.ts:239 lhe dá esse nome) e revarrer quando ele mudar.

   A IMPRESSÃO DIGITAL é deliberadamente rasa — três níveis de `id` e de contagem
   de filhos, algo como uma dúzia de leituras de propriedade, e **não por quadro**:
   `RESCAN_MIN_MS` a limita a 2,5 conferências por segundo. Ela não precisa ser um
   hash da árvore; precisa distinguir "trocou de cavalo / de implemento / de roda"
   de "nada aconteceu". Uma troca cria objetos novos, e `Object3D.id` é um
   contador global que nunca se repete.

   ⚠️ O QUE ELA NÃO PEGA: um REDIMENSIONAMENTO do baú que reescale nós existentes
   sem criar nem destruir nenhum. Nesse caso o registro fica com diâmetros
   antigos. O erro é pequeno na direção que importa (um baú mais longo não
   reescala parafuso) e o conserto certo é o dono do redimensionamento chamar
   `setShadowCasters()` de novo — que é um dever que ele já tem, porque o
   `castShadow` envelheceria junto. Ver o aviso em `material-setup.ts`. */

/* ⚠️ A BANDEIRA SEPARADA existe porque QUALQUER inteiro de 32 bits é uma
   impressão digital legítima — não há valor sentinela seguro. Um `-1` sentinela
   colidiria com uma árvore real uma vez em 4 bilhões, e o sintoma seria uma
   troca de caminhão que não revarre: os parafusos do caminhão ANTERIOR ficariam
   no registro. Baratíssimo de evitar, impossível de depurar depois. */
let fpValido = false;
let fpAnterior = 0;
let proximaConferencia = 0;

function impressaoDigital(rig: THREE.Object3D): number {
  let h = rig.id | 0;
  const a = rig.children;
  h = (Math.imul(h, 31) + a.length) | 0;
  for (let i = 0; i < a.length; i++) {
    const c = a[i];
    h = (Math.imul(h, 31) + c.id) | 0;
    const b = c.children;
    h = (Math.imul(h, 31) + b.length) | 0;
    for (let j = 0; j < b.length; j++) {
      h = (Math.imul(h, 31) + b[j].id) | 0;
      h = (Math.imul(h, 31) + b[j].children.length) | 0;
    }
  }
  return h;
}

function garantirRegistro(agora: number) {
  if (agora < proximaConferencia) return;
  proximaConferencia = agora + RESCAN_MIN_MS;
  /* `getObjectByName` percorre a cena, e por isso ela só é chamada na
     conferência (2,5×/s no máximo) e nunca no laço de decisão. */
  const rig = scene.getObjectByName('RIG');
  if (!rig) {
    if (registro.length) limparRegistro();
    fpValido = false;
    return;
  }
  const fp = impressaoDigital(rig);
  if (fpValido && fp === fpAnterior) return;
  fpAnterior = fp;
  fpValido = true;
  /* DO ZERO, e não incremental: uma varredura incremental deixaria entradas
     apontando para malhas que acabaram de ser descartadas, e `disposeTree()` não
     nos avisa (não temos como ser avisados — ver o cabeçalho). Refazer é O(nós)
     e acontece uma vez por troca de veículo, debaixo da cortina de carga. */
  limparRegistro();
  registerLod(rig);
}

/* ---------------------------------------------------------------------------
   O LIMIAR VIGENTE — FUNÇÃO, e com cache invalidado por evento

   `lodMinPx` NÃO pode ser lido uma vez no tempo de import: o nível muda no meio
   da sessão (o medidor rebaixa, o usuário escolhe), e um valor congelado
   entregaria para sempre o LOD do nível em que a página abriu. É a mesma lição
   que `textureAnisotropy()` e `groundVariant()` já registram em `quality.ts`.

   Mas também não pode ser `getProfile()` por quadro: `getProfile()` monta um
   objeto novo (espalha a tabela e apara pelo device) a cada chamada, o que a 60
   Hz é uma alocação por quadro para ler um número que muda algumas vezes por
   sessão. Daí o cache invalidado por `onQualityChange()`, que é o evento exato. */
let minPxCache = -1;
const minPxAtual = () => (minPxCache >= 0 ? minPxCache : (minPxCache = getProfile().lodMinPx));
onQualityChange(() => { minPxCache = -1; });

onDrawFrame(() => {
  const minPx = minPxAtual();
  if (!(minPx > 0)) {
    /* ⚠️ **DESDE 2026-08-15 ESTE É O CAMINHO PERMANENTE**, nos três níveis: o
       LOD está aposentado e `lodMinPx` vale 0 em toda a tabela. O custo por
       quadro desenhado é uma chamada de função e a leitura de um número em
       cache — `garantirRegistro()` nem chega a rodar, então o registro fica
       vazio e não há entrada nenhuma a percorrer.

       O `releaseLod()` continua aqui porque desligar tem de DEVOLVER o que já
       estava escondido, e não só parar de esconder: sem ele, quem estivesse num
       nível antigo com o LOD ligado (uma sessão que sobreviveu a um deploy)
       ficaria com o caminhão sem os parafusos que o nível anterior apagou. O
       registro fica de pé de propósito — voltar a um nível com LOD não deve
       pagar uma varredura de 2 157 nós no primeiro quadro. */
    if (ocultas) releaseLod();
    return;
  }
  const agora = performance.now();
  garantirRegistro(agora);
  /* ⚠️ A ALTURA É A DO BUFFER DE DESENHO (`domElement.height`), que já carrega o
     `setPixelRatio` E a escala de render do perfil — e as duas pertencem à conta.
     O limiar é sobre o pixel que vai ser RASTERIZADO: num nível Baixa, que
     desenha a 0,65, a mesma peça ocupa 1,54× menos pixels de verdade, e é certo
     que ela caia no corte mais cedo. Usar o tamanho CSS aqui faria o LOD
     prometer uma nitidez que o buffer não tem. */
  applyLod(camera, renderer.domElement.height, minPx);
});

/** Para o console e para a bancada. */
export function getLodInfo() {
  const h = renderer.domElement.height;
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
  const minPx = minPxAtual();
  return {
    limiarPx: minPx,
    registradas: registro.length,
    ocultas,
    histerese: HISTERESE,
    diametroMax: LOD_MAX_DIAM,
    alturaDoBuffer: h,
    /* ⚠️ `aposentado` é a resposta que a bancada precisa numa palavra: um limiar
       0 nos três níveis não é um defeito de configuração, é a doutrina de
       2026-08-15. Ver o cabeçalho. */
    aposentado: !(minPx > 0),
    sombraDevida,
    sombraTetoHz: hzSombra(),
    /* O diâmetro que este quadro esconderia na órbita mais distante (22,4 m) —
       o número que diz, em milímetros, o que se está perdendo AGORA. */
    cortaAbaixoDeMm: minPx > 0
      ? Math.round(minPx * 2 * tanH * 22.4 / Math.max(1, h) * 1e4) / 10
      : 0,
  };
}
