/* FUSÃO POR MATERIAL — a mesma imagem, com um vigésimo das chamadas de desenho.
   ===========================================================================
   ESTE ARQUIVO NÃO TIRA TRIÂNGULO NENHUM DA CENA. É a primeira coisa a dizer
   sobre ele, e é o que o separa do LOD (`vehicle/lod.ts`), que tira geometria e
   por isso custa qualidade. Aqui a coluna dos triângulos ANTES e DEPOIS é a
   mesma: 6,51 M → 6,51 M. O que muda é quantas vezes a CPU pede à placa para
   desenhá-los.

   O PORQUÊ, MEDIDO POR ABLAÇÃO (ver `GARGALO-2026-08-15.md`, §2 — os números
   abaixo são de lá, não meus):

       esconder as 1 073 malhas MENORES (5 % dos triângulos) → −9,64 ms
       esconder as 1 073 malhas MAIORES (95 % dos triângulos) → −8,19 ms

   Tirar cinco por cento dos triângulos devolveu MAIS milissegundos que tirar
   noventa e cinco. Em custo unitário dá 9,0 µs por chamada pequena contra
   7,6 µs por chamada grande — praticamente o mesmo número. **O triângulo é de
   graça; a chamada é o que se paga.** Decimar geometria neste acervo é trabalho
   perdido; agrupar chamadas é o conserto.

   O acervo explica por que há tanto a agrupar: `trailer.glb` traz 2 157
   primitivas em 38 materiais, sem uma única instância de GPU — a assinatura de
   um bake de CAD exportado inteiro, não de um asset autorado para tempo real.
   O `set.glb` do distrito, ao lado, faz 805 árvores em ~2 chamadas com
   `EXT_mesh_gpu_instancing`: a casa SABE fazer certo, o implemento é que não
   passou por isso.

   ---------------------------------------------------------------------------
   O DESENHO: NÃO DESTRUÍMOS O GRAFO DE ORIGEM

   As malhas de origem continuam exatamente onde estão, com os mesmos pais, as
   mesmas matrizes e os mesmos materiais. O que fazemos é (a) construir uma
   malha fundida por BALDE e pendurá-la como filha da raiz do implemento, e
   (b) marcar as malhas de origem com `.visible = false`.

   `WebGLRenderer.projectObject()` retorna no primeiro `if (object.visible ===
   false) return;` — SEM descer para os filhos —, então uma origem escondida
   custa **zero chamada de desenho** e uma visita de função por passe.

   ⚠️ AQUELA ESTIMATIVA VIROU MEDIÇÃO (2026-08-16), E O NÚMERO CONFIRMA O
   DESENHO. O grafo do `trailer.glb` foi reconstruído a partir do arquivo — mesma
   hierarquia, 5 852 nós, 2 151 malhas, profundidade 7 — e cronometrado em CPU
   pura, fora do navegador, num Ryzen 7 5700X:

       updateMatrixWorld, tudo congelado (o estado de hoje)      0,107 ms
       updateMatrixWorld, NADA congelado (a hipótese)            0,252 ms
       projectObject, tudo visível                               0,086 ms
       projectObject, 1 979 malhas invisíveis (esta fusão)       0,079 ms

   Três leituras, e todas fecham um assunto:

     1. **As duas mil visitas com retorno imediato custam 0,079 ms por passe**,
        ou seja ~0,16 ms nos dois passes. O "não destruímos o grafo de origem"
        está pago e é barato.
     2. **A travessia com as origens escondidas é MAIS BARATA que a travessia
        com tudo visível** (0,079 contra 0,086), porque uma raiz invisível corta
        a subárvore inteira. Esconder por malha não é um imposto; é um desconto.
     3. **Congelar mais nós não devolve quase nada.** A diferença entre tudo
        congelado e nada congelado é 0,145 ms por quadro no implemento INTEIRO —
        e `freezeMatrices()` de `vehicle/models.ts` já a coletou toda. Quem
        chegar aqui com a ideia de que "milhares de `updateMatrix()` por quadro"
        são o gargalo tem o teto do ganho escrito acima: um sétimo de
        milissegundo, já recolhido.

   ⚠️ E POR ISSO O `matrixAutoUpdate` DO GRUPO `FUSAO` FICA LIGADO — o único nó
   deste arquivo que não é congelado, e é DE PROPÓSITO. Ele é filho da raiz do
   implemento e os baldes penduram-se nele com `matrixAutoUpdate = false`; é a
   recomposição por quadro do grupo que marca `matrixWorldNeedsUpdate` e força a
   cascata para baixo, mantendo os baldes colados no implemento quando o engate
   inclina o chassi ou `setRigPlacement()` move o conjunto. Congelá-lo "para
   economizar" tira 0,00002 ms e deixa a fusão inteira desenhando na pose do
   quadro em que ela foi construída — e o defeito é SILENCIOSO até alguém
   redimensionar ou reengatar. Não congele este nó.

   ⚠️ **POR QUE NÃO O NÓ-GUARDA-CHUVA.** A ideia óbvia é pôr o implemento
   inteiro sob um `Group` invisível e pendurar os baldes como irmãos — uma única
   escrita de `.visible` em vez de duas mil, e a travessia morre na raiz. Ela
   quebra por um motivo que só aparece depois de escrita a lista de exclusões:
   **nem tudo é fundido.** Teto, chapas de livery, caixa de cozinha, Thermo King
   e tudo que é transparente ficam de FORA (ver A LISTA DE EXCLUSÕES). Sob um
   guarda-chuva invisível essas peças simplesmente sumiriam da tela — a fusão
   deixaria de ser "a mesma imagem" no primeiro item da lista. Esconder POR
   MALHA é o único jeito de o conjunto escondido ser exatamente o conjunto
   fundido.

   ---------------------------------------------------------------------------
   A FUSÃO POR ESCOPO — o terceiro caso, e o que ele conserta

   Até 2026-08-16 havia só dois destinos para uma malha: ela entrava na fusão
   GLOBAL (baldes por material, para o implemento inteiro) ou ficava de FORA. A
   lista de exclusões nasceu desse binário, e é por isso que ela exclui coisas
   que não precisavam ser excluídas.

   O caso que denuncia é a CAIXA DE COZINHA. `trim.ts` a exclui com este
   argumento, escrito lá em `TRIM_MERGE_EXCLUSIONS`:

     *"os seis materiais dentro dela são compartilhados com o implemento inteiro
     (`inox-ferragem` sozinho tem 1,56 M de triângulos de uma ponta à outra),
     então nenhum balde jamais coincide com a peça"*

   O argumento está CERTO e é INCOMPLETO: ele vale para uma fusão global. Uma
   fusão restrita aos 80 nós da própria caixa produz baldes que coincidem
   EXATAMENTE com a peça — porque o universo do balde é a peça.

   ⚠️ E A PREMISSA DELE TAMBÉM É MAIS FRACA DO QUE PARECE. Contado no arquivo,
   material a material, dentro da caixa contra o resto do implemento:

       caixa-estrutura-preta    10 dentro ·    0 fora  → exclusivo da caixa
       metal-claro               2 dentro ·    0 fora  → exclusivo da caixa
       plastico-cinza-polido     1 dentro ·    0 fora  → exclusivo da caixa
       inox-ferragem            59 dentro · 1 095 fora → mas ver abaixo
       metal-preto               6 dentro ·  577 fora  → COMPARTILHADO de verdade
       plastico-preto            2 dentro ·   41 fora  → COMPARTILHADO de verdade

   Três dos seis já são EXCLUSIVOS da caixa no bake. E o maior deles, o
   `inox-ferragem` das 59 primitivas, vira exclusivo em RUNTIME:
   `splitTrailerHardware()` (`models.ts`) troca o inox da caixa por uma variante
   `inox-ferragem__caixa` durante a carga, justamente para separá-lo do inox do
   implemento. Ou seja: **72 das 80 primitivas nunca dividiram material com nada
   fora da caixa.** Só 8 dividem.

   Isso não torna o escopo desnecessário — torna-o mais barato do que parecia.
   Sem escopo, essas 8 cairiam em baldes que atravessam o implemento inteiro, e
   um balde assim não pode ser escondido junto com a peça. O escopo é o que
   garante a coincidência para as OITO, e é a coincidência que vale.

   MEDIDO no `trailer.glb` (contagem de primitivas por nó, node puro):

       80 primitivas · 136,9 k tri · 6 materiais · ZERO transparente
       59 inox-ferragem · 10 caixa-estrutura-preta · 6 metal-preto
        2 metal-claro ·  2 plastico-preto ·  1 plastico-cinza-polido

   ⇒ **80 → 6 chamadas** (5 baldes + o singleton de `plastico-cinza-polido`, que
   não vira balde por não ter com quem se juntar). São **74 chamadas poupadas**,
   ou **13,4 % das 552** que o quadro submete depois da fusão global.

   O CRITÉRIO, e ele é uma pergunta só, para caber na cabeça de quem for
   acrescentar o próximo escopo:

       a peça é uma UNIDADE DE VISIBILIDADE, e ela NUNCA troca de material?

   As duas metades importam. "Unidade de visibilidade" é o que garante que os
   baldes coincidam com a peça — quem liga e desliga a peça liga e desliga o
   conjunto inteiro, nunca um pedaço. "Nunca troca de material" é o que um balde
   não sabe acompanhar: ele guarda a REFERÊNCIA do material no instante da
   fusão. Em `trim.ts` a resposta é literal: `hideable && !paintable`. A caixa é
   a única peça que satisfaz as duas (`box.paintable === false` desde
   2026-08-13, quando o produto tirou a cor dela).

   ---------------------------------------------------------------------------
   ⚠️⚠️ O CASULO — e sem ele o desenho acima QUEBRA, de um jeito que a bancada
   pegaria e o olho também.

   A ideia de pendurar os baldes num grupo cujo NOME case a regexp do dono é
   certa, e é o que faz `selfOrAncestor()` de `trim.ts` achá-los sem uma linha
   nova lá. Mas ela resolve só metade do ciclo. `applyTrim()` faz isto:

       for (const mesh of meshesOf(key)) mesh.visible = piece.visible;

   e `meshesOf()` varre o implemento inteiro casando pelo NOME. As 80 origens
   continuam casando — pelos próprios nomes, medido: 78 das 80 casam a regexp
   diretamente. Então MOSTRAR a caixa escreveria `visible = true` nas 80 origens
   que a fusão tinha escondido: a caixa passaria a ser desenhada DUAS vezes, 86
   chamadas em vez de 6, com as duas cópias brigando no z-buffer. O ciclo
   esconder→mostrar é justamente a trava de aceitação desta funcionalidade, e
   sem o casulo ela reprova no segundo passo.

   A saída não é disputar a posse de `.visible` — é tirar as origens do alcance
   de quem a disputa. Cada escopo ganha um CASULO: um `Group` permanentemente
   invisível, filho do grupo do escopo, para onde as origens fundidas se mudam.

     · `applyTrim()` escreve `visible = true` nas origens; elas continuam sem
       aparecer, porque `projectObject()` já parou no casulo. A escrita vira
       inofensiva em vez de ser disputada.
     · `applyTrim()` escreve nos baldes, que são irmãos do casulo e aparecem.
     · esconder escreve `false` nos dois conjuntos e a peça some inteira.
     · o casulo é um `Group` e não uma `Mesh`, então `meshesOf()` NUNCA o vê:
       este módulo é dono exclusivo do `.visible` dele, o que preserva a POSSE
       POSITIVA logo abaixo em vez de furá-la.

   ⚠️ AS ORIGENS FICAM NA ÁRVORE, e isso é decisão contra a alternativa óbvia
   (`removeFromParent()`). Detachá-las seria mais simples e vazaria memória: o
   descarte de veículo varre `state.trailer` para dar `dispose()` na geometria, e
   o que não está na árvore não é varrido. Dentro do casulo elas continuam
   alcançáveis por todo mundo que varre — inclusive por `Box3.expandByObject()`,
   que **não pula nó invisível** e é o que `frameAll()` e `setVehicleFocus()`
   usam.

   ⚠️ E É POR CAUSA DESSE `Box3` QUE A MATRIZ É REASSADA. Mudar de pai muda o
   referencial da matriz LOCAL, e estes nós estão congelados
   (`matrixAutoUpdate = false`, ver `freezeMatrices()` em `models.ts`) — ninguém
   vai recompô-la. Sem reassar, as 80 origens saltariam para outro lugar do
   espaço e o enquadramento automático passaria a medir uma caixa envolvente com
   uma caixa de cozinha jogada longe. A reassadura usa a MESMA matriz `alvo` dos
   baldes (mundo → espaço da raiz), porque o casulo está na identidade sob a
   raiz — então a pose de mundo é preservada exatamente, e `releaseMerge()`
   devolve a matriz salva junto com o pai e o índice.

   ---------------------------------------------------------------------------
   POSSE POSITIVA DE `.visible` — a mesma doutrina de `vehicle/lod.ts`

   `.visible` neste motor tem NOVE donos e nenhum árbitro (a lista completa está
   no cabeçalho de `vehicle/lod.ts`, com arquivo e linha). Somos o décimo, e
   obedecemos às mesmas duas regras que aquele arquivo escreveu:

     · só escondemos quem está VISÍVEL no momento — se outro dono já escondeu, a
       malha não vira nossa, e (isto é nosso, não do LOD) ela também não entra em
       balde nenhum: uma malha que alguém pode reexibir amanhã não pode ter os
       triângulos dela assados dentro de um balde que ninguém sabe desligar;
     · só revelamos quem a NOSSA lista diz que é nosso.

   O conjunto escondido é literalmente a união dos membros dos baldes, então a
   invariante "balde ligado ⇔ origens escondidas" é estrutural, não vigiada.

   ---------------------------------------------------------------------------
   A CHAVE DO BALDE, e cada pedaço dela é uma classe de defeito evitada

       material.uuid | banda de sombra | renderOrder | máscara de layers |
       assinatura de atributos

   · **material** — é o que a fusão existe para agrupar, e é o que faz
     `applyTrailerFinish()`, o livery e `vehicle/lights.ts` sobreviverem: o
     balde aponta para o MESMO objeto de material, não para uma cópia. Quem
     escrever uma `CanvasTexture` ou um uniforme nele continua acertando o
     desenho.

   · **banda de sombra** — quatro faixas FIXAS (< 5 cm · 5–10 cm · 10–20 cm ·
     ≥ 20 cm) sobre o `userData.tsWorldDiameter` que `setShadowCasters()` já
     guardou. Elas existem para que trocar `shadowCasterMinM` de nível LIGUE E
     DESLIGUE BALDES INTEIROS em vez de exigir uma refusão — e, mais importante
     que isso, para que o passe de sombra desenhe exatamente o mesmo conjunto de
     antes: se parafuso (< 5 cm, `castShadow = false`) e cantoneira (12 cm,
     `castShadow = true`) caíssem no mesmo balde, um dos dois mudaria de
     comportamento e a sombra mudaria de forma.

   · **renderOrder** — `setupCommon()` promove vidro e lente a `renderOrder 20`.
     Fundir duas ordens diferentes reordena o desenho, e reordenar é mudar a
     imagem.

   · **máscara de layers** — a câmera testa `object.layers`; misturar máscaras
     faria uma peça aparecer numa vista de onde ela estava excluída.

   · **assinatura de atributos** — nome, tamanho do item, `normalized` e o tipo
     do array de CADA atributo. Grupos com conjuntos diferentes (`uv1`,
     `tangent`, `color`) não podem ser fundidos entre si, e a saída NÃO é
     preencher o que falta com zeros: um `uv1` de zeros manda a arte inteira
     para o téxel (0,0). Quem não casa vira outro balde.

   ---------------------------------------------------------------------------
   AS ARMADILHAS DE GEOMETRIA — todas aparecem num bake de CAD, e todas estão
   tratadas abaixo. As contagens reais desta cena saem em `mergeInfo()`.

   ⚠️ **DETERMINANTE NEGATIVO.** Um nó espelhado (escala negativa em um eixo)
   tem `matrixWorld.determinant() < 0`. Assar os vértices em espaço de mundo
   INVERTE o sentido de enrolamento do triângulo, e o `frontFace` do WebGL passa
   a ver a face de dentro. É o defeito clássico deste tipo de fusão. O conserto é
   trocar a ordem dos dois últimos índices de cada triângulo desses nós — ver
   `espelhado` em `assar()`.

   ⚠️ **MATRIZ DE NORMAL.** Normal não vai pela matriz de mundo, vai pela
   INVERSA TRANSPOSTA da 3×3 dela — senão qualquer escala não uniforme (e este
   bake tem escalas de 0,0012 a 1,0022 dentro do mesmo arquivo) entorta a normal
   e o sombreamento muda. A TANGENTE, ao contrário da normal, vai pela matriz
   normal também no que toca à direção, mas o `w` dela é HANDEDNESS e tem de
   trocar de sinal num nó espelhado.

   ⚠️ **ÍNDICES DE 32 BITS.** Assim que um balde passa de 65 535 vértices, o
   índice tem de ser `Uint32Array`. WebGL2 tem `OES_element_index_uint` no
   núcleo, então não há degradação a prever.

   ⚠️ **`boundingSphere` / `boundingBox`** são recomputados. Sem isso o teste de
   frustum mentiria — e vale dizer o que ele passa a valer: um balde do tamanho
   do implemento **quase nunca é descartado**. Isso é aceitável e é o negócio que
   se está fazendo: trocamos 2 000 testes de frustum baratos que às vezes
   descartam por 20 testes que quase nunca descartam. A ablação já disse que o
   que se paga é a chamada, não o triângulo.

   ⚠️ **ATRIBUTOS INTERCALADOS E NORMALIZADOS.** A leitura é sempre por
   `getX/getY/getZ/getW` e a escrita por `setX…`, nunca por índice cru no array:
   `InterleavedBufferAttribute` não tem array próprio contíguo, e um atributo
   `normalized` é DESnormalizado na leitura e RENORMALIZADO na escrita pelo
   próprio three. Escrever no array cru corromperia os dois casos em silêncio.

   ---------------------------------------------------------------------------
   A LISTA DE EXCLUSÕES — por DONO, e cada linha é um dono que existe de verdade

   ⚠️ DUAS FAMÍLIAS, E O ESCOPO SÓ DERRUBA UMA. Desde A FUSÃO POR ESCOPO, um nó
   que cai num escopo PULA as exclusões de DONO (subárvore, nome de nó, nome de
   material, nome de malha) — porque o escopo é uma afirmação mais forte que
   elas: "este conjunto inteiro é uma unidade, e ela não troca de material".
   Mas ele NÃO derruba as exclusões ESTRUTURAIS, e a linha entre as duas não é
   negociável:

     de DONO         quem liga/desliga/pinta a peça. O escopo responde por ela.
     ESTRUTURAIS     transparência, malha em malha, instância, pele/morph,
                     material em array, sem posição, já invisível. São sobre a
                     CORREÇÃO do desenho e valem para qualquer universo de
                     fusão — global ou de escopo. Um vidro fundido dentro de um
                     escopo congela a ordenação por profundidade exatamente como
                     congelaria fora dele.

   O que NÃO entra em balde nenhum, e por causa de quem:

     · **o CAVALO inteiro.** Não é risco, é aritmética: os bakes de cabine trazem
       ~85 primitivas em ~85 materiais (§2.3 do GARGALO), ou seja fundir devolve
       85 baldes para 85 malhas — ZERO chamada poupada. Todo o 14,9× vem do
       implemento. Excluir o cavalo custa nada e tira do caminho a rip FBX
       inteira, o `headlight-cover`, o `halo` e o `beams`.
     · **`vehicle/trim.ts`, caixa de cozinha** — ⚠️ **NÃO ESTÁ MAIS FORA: virou o
       primeiro ESCOPO** (2026-08-16). O argumento que a excluía — "os seis
       materiais dela são compartilhados com o resto do implemento, então um
       balde nunca coincide com a peça" — vale para a fusão GLOBAL e cai para uma
       fusão restrita aos 80 nós dela. Ver A FUSÃO POR ESCOPO: 80 → 6 chamadas,
       74 poupadas, 13,4 % do quadro.
     · **`vehicle/trim.ts`, Thermo King** — `hideRoot` esconde a UNIDADE inteira,
       cinco malhas em subárvore própria. Fora, por subárvore.
     · **`vehicle/trim.ts`, teto e paralamas** — trocam de MATERIAL quando ganham
       cor própria. Um balde guarda a referência do material no instante da
       fusão; uma troca posterior não o alcançaria. Fora, por material e por nome.
     · **`models.setPaintTarget()` / `trailerPanelMeshes()`** — as chapas de
       livery (`SIDE_L`, `SIDE_R`, `REAR`, `FRONT`, os rebites e `TRAILER_ROOF`)
       e tudo que carrega o branco de carroceria trocam de material ao ligar
       "pintar o implemento". Fora, pelo mesmo motivo.
     · **`TrailerBody.rebuild()` / `trailer-assembly.ts`** — `setTrailerDims()`
       REGENERA o corpo branco e TRANSFORMA a ferragem da região do baú. Isso
       invalida qualquer balde que os contenha. Aqui a resposta não é exclusão e
       sim ORDEM: quem redimensiona solta a fusão antes e a refaz depois, atrás
       da cortina de resize que já existe (ver `setGeometryGuard()` em
       `vehicle/models.ts`).
     · **transparência** — três motivos num só. O renderizador ORDENA os objetos
       transparentes de trás para a frente por objeto; fundi-los congela essa
       ordem num único desenho e a imagem muda em algum ângulo. Além disso é onde
       moram as lentes das lanternas, o vidro e os decalques, que já têm
       `renderOrder` próprio. Fora, todos.
     · **malha com filhos, ou filha de malha** — é o padrão dos SOBREPOSTOS deste
       motor: a arte do livery e o overlay da testeira
       (`buildFrontWallOverlay()`) são malhas penduradas na malha que elas
       vestem. Esconder a mãe some com a filha. Fora, os dois lados.
     · **`InstancedMesh`** — já é UMA chamada. Fundir só destruiria a instância.
     · **`SkinnedMesh` / morph targets** — a pose é resolvida no vértice, em
       espaço de osso. Não há como assar.
     · **material em ARRAY** — a malha já submete um desenho por grupo; tratá-la
       exigiria remapear grupos, e o acervo não tem quantidade que justifique.
     · **já invisível** — ver POSSE POSITIVA. Não é nossa, e pode voltar.

   ---------------------------------------------------------------------------
   A ORDEM DE EXECUÇÃO, e ela é contrato

   `applyMerge()` roda DEPOIS de `setupCommon()` (que é quem escreve
   `tsWorldDiameter` e decide `castShadow`), depois de `extractDoorKit()` (que
   guarda REFERÊNCIAS de geometria e tem de vê-las antes), depois de
   `buildLiveryPanels()` (que recorta as chapas) e depois de `placeTrailer()` —
   e antes do primeiro quadro, debaixo da cortina que `ui/loader.ts` já mostra.
   Quem garante essa ordem é `studio.ts`, que é a raiz de composição.

   `applyMerge()` chama `updateMatrixWorld(true)` na raiz antes de ler uma
   matriz sequer. Sem isso um nó recém-pendurado seria assado pela matriz do
   quadro anterior — no pior caso a identidade, que é o mesmo defeito que
   `setShadowCasters()` documenta ("um parafuso com metros").

   ---------------------------------------------------------------------------
   POR QUE NÃO `BatchedMesh`

   Já refutado com leitura da implementação em `OTIMIZACAO-2026-08-14.md` §3.1:
   para 2 146 primitivas em ~104 materiais a fusão simples entrega as mesmas
   chamadas sem depender de `WEBGL_multi_draw`, sem ~190 MB pré-alocados e sem um
   contador de chamadas que mente. Não ressuscitar. */
import * as THREE from 'three';
import { getProfile } from '../core/quality';

/** Os três modos. `floor` é a Fase A do roteiro; `all` é a Fase B. */
export type MergeMode = 'off' | 'floor' | 'all';

/**
 * As FAIXAS DE TAMANHO DE SOMBRA, em metros — as bordas, não os centros.
 *
 * São exatamente os três valores que `shadowCasterMinM` pode assumir na tabela
 * de qualidade (alta 0,05 · média 0,10 · baixa 0,20). Por serem as MESMAS
 * bordas, mudar de nível nunca corta uma faixa ao meio: ele só desliga o
 * `castShadow` de baldes inteiros, e é por isso que trocar de nível não custa
 * uma refusão. Ver `refreshMergedShadowCasters()`.
 */
const BANDAS = [0, 0.05, 0.10, 0.20];

/** O valor do nível ALTO, usado enquanto `core/quality.ts` não declarar o campo.
 *  É a constante que `material-setup.ts` usava como literal antes disto. */
const SHADOW_MIN_PADRAO = 0.05;

/** Nome do nó que carrega os baldes. Filho da raiz do implemento, de propósito:
 *  assim ele herda TODA transformação que o implemento sofre depois da fusão —
 *  o engate, a inclinação do chassi, a colocação no cenário — sem que a fusão
 *  precise saber que elas existem. */
export const MERGE_GROUP_NAME = 'FUSAO';

/**
 * Quanto abaixo do piso do baú ainda conta como "região do baú".
 *
 * O número e o motivo são de `trailer-assembly.ts` (`SKIRT_BAND`): a fita 3M
 * lateral e a lanterna de posição moram ABAIXO da chapa branca, até 122 mm sob o
 * piso, e fazem parte do conjunto que o redimensionamento move.
 */
const SAIA = 0.15;

/* ⚠️ O CORTE PELO PISO É UMA HEURÍSTICA DE RISCO, NÃO UMA GARANTIA DE CORREÇÃO.
   `trailer-assembly.ts` documenta que "malhas cuja caixa inteira fica abaixo do
   piso são puladas sem serem tocadas", e é essa a autorização da Fase A — mas o
   próprio arquivo abre DUAS exceções que ele mesmo mede: a saia lateral (acima)
   e o RABO DA TRASEIRA (para-choque, lanternas e registros, até 935 mm sob o
   piso, que recuam junto com a porta). Ou seja: nem tudo que está sob o piso é
   imóvel.
   Quem garante a correção não é esta linha — é a ordem: `setTrailerDims()` solta
   a fusão antes de mexer e a refaz depois. O piso serve para escolher QUANTO
   fundir com quanto risco residual, não para decidir se está certo. */

/* ---------------------------------------------------------------------------
   O QUE FICA DE FORA, E POR QUEM — o motivo é o DONO, escrito por extenso, e é
   ele que `info()` publica.

   Uma string e não uma união fechada de propósito: metade dos motivos chega de
   fora, escrita por quem POSSUI a regra (`TRIM_MERGE_EXCLUSIONS` em `trim.ts`,
   `PAINT_MERGE_EXCLUSIONS` em `models.ts`), e uma união aqui obrigaria este
   arquivo a conhecer a lista de peças do produto — que é justamente o
   acoplamento que `MergePolicy` existe para não ter. Os motivos que ESTE módulo
   escreve estão em `MOTIVOS`, abaixo, e servem de vocabulário para os outros.

   Vocabulário dos donos externos, para quem for ler `info().excluidas`:
     'cavalo' · 'trim: caixa de cozinha' · 'trim: Thermo King' · 'trim: teto' ·
     'trim: paralamas' · 'pintura: chapa de carroceria' */
type Motivo = string;

const MOTIVOS = {
  transparente: 'transparente',
  sobreposta: 'sobreposta (malha em malha)',
  instanciada: 'instanciada',
  pele: 'com pele / morph',
  arrayDeMaterial: 'material em array',
  jaInvisivel: 'já invisível (outro dono)',
  semPosicao: 'sem posição',
  acimaDoPiso: 'acima do piso (modo floor)',
} as const;

export interface MergeInfo {
  /** O modo que está VIGENTE agora — não o que foi pedido. */
  modo: MergeMode;
  /** Malhas de origem que entraram em algum balde (e portanto estão escondidas). */
  origens: number;
  /** Malhas fundidas criadas. */
  baldes: number;
  /** `origens − baldes`: chamadas de desenho poupadas no passe principal. */
  poupadas: number;
  /** Milissegundos de construção da última fusão. */
  ms: number;
  /** Triângulos assados nos baldes — tem de bater com os das origens. */
  triangulos: number;
  /** Quantos nós ficaram de fora, por dono. */
  excluidas: Record<string, number>;
  /** Armadilhas de geometria que o acervo de fato tinha. */
  armadilhas: {
    /** Nós com determinante negativo cujo enrolamento foi invertido. */
    espelhados: number;
    /** Baldes que precisaram de índice de 32 bits. */
    indice32: number;
    /** Origens sem `normal` (o balde recebe a normal calculada por face). */
    semNormal: number;
    /** Origens sem índice (enrolamento sequencial gerado). */
    semIndice: number;
    /** Baldes criados só porque a assinatura de atributos não casava. */
    baldesPorAtributo: number;
  };
  /** Emissores de sombra vigentes entre os baldes, e o corte que os decidiu. */
  sombra: { minM: number; emissores: number };
  /** Um item por ESCOPO que de fato fundiu algo — ver A FUSÃO POR ESCOPO. */
  escopos: {
    /** O nome dado ao grupo — é ele que o matcher do dono tem de casar. */
    nome: string;
    /** O dono, por extenso. */
    motivo: string;
    /** Origens que entraram em balde (e portanto foram para o casulo). */
    origens: number;
    baldes: number;
    /** `origens − baldes`: chamadas poupadas SÓ por este escopo. */
    poupadas: number;
  }[];
}

interface Balde {
  malha: THREE.Mesh;
  /** Índice em `BANDAS` — a faixa de tamanho de mundo dos membros. */
  banda: number;
  fontes: THREE.Mesh[];
}

/** Uma origem que se mudou para um casulo, e tudo que é preciso para desfazer. */
interface Encasulada {
  o: THREE.Object3D;
  pai: THREE.Object3D;
  /** A posição entre os irmãos. Restaurada porque ordem de irmão é ordem de
   *  desenho entre objetos de mesmo `renderOrder` e mesma distância. */
  idx: number;
  /** A matriz LOCAL de antes da mudança de pai — ver o ⚠️ da reassadura. */
  matriz: THREE.Matrix4;
}

interface Escopo {
  def: MergeScope;
  grupo: THREE.Group;
  casulo: THREE.Group;
  baldes: Balde[];
  encasuladas: Encasulada[];
}

let baldes: Balde[] = [];
let escopos: Escopo[] = [];
let grupo: THREE.Group | null = null;
let raizAtual: THREE.Object3D | null = null;
let modoAtual: MergeMode = 'off';
let ultimoMs = 0;
let ultimasExclusoes: Record<string, number> = {};
let ultimasArmadilhas: MergeInfo['armadilhas'] = {
  espelhados: 0, indice32: 0, semNormal: 0, semIndice: 0, baldesPorAtributo: 0,
};
let ultimosTriangulos = 0;

/* ---------------------------------------------------------------------------
   O PERFIL, LIDO COM REDE

   `core/quality.ts` é do AGENTE 3 nesta passada e pode ainda não declarar os
   dois campos. Ler por um tipo opcional e cair no valor do nível ALTO mantém
   este arquivo compilando e rodando nos dois estados do repositório — e o dia em
   que o campo existir, ele passa a mandar sem que uma linha daqui mude. */
interface PerfilDaFusao {
  mergeVehicle?: MergeMode;
  shadowCasterMinM?: number;
}
const perfil = (): PerfilDaFusao => getProfile() as unknown as PerfilDaFusao;

/** O modo pedido pelo perfil. `all` é o valor do nível Alto — ver o contrato. */
export function mergeModeFromProfile(): MergeMode {
  const m = perfil().mergeVehicle;
  return m === 'off' || m === 'floor' || m === 'all' ? m : 'all';
}

/** O corte de emissor de sombra vigente, em metros de diâmetro de MUNDO. */
export function shadowCasterMinM(): number {
  const v = perfil().shadowCasterMinM;
  return typeof v === 'number' && v > 0 ? v : SHADOW_MIN_PADRAO;
}

/* ---------------------------------------------------------------------------
   CLASSIFICAÇÃO */

/** A faixa de `BANDAS` em que um diâmetro de mundo cai. */
function bandaDe(diametro: number): number {
  let i = 0;
  while (i + 1 < BANDAS.length && diametro >= BANDAS[i + 1]) i++;
  return i;
}

/** A assinatura de atributos de uma geometria — ver A CHAVE DO BALDE. */
function assinaturaDeAtributos(g: THREE.BufferGeometry): string {
  const nomes = Object.keys(g.attributes).sort();
  const partes: string[] = [];
  for (const nome of nomes) {
    const a = g.attributes[nome] as THREE.BufferAttribute;
    const arr = (a.array ?? (a as unknown as { data?: { array: ArrayLike<number> } })
      .data?.array) as ArrayLike<number> | undefined;
    const tipo = arr ? (arr.constructor as { name: string }).name : '?';
    partes.push(`${nome}:${a.itemSize}:${a.normalized ? 1 : 0}:${tipo}`);
  }
  return partes.join(',');
}

/** Um ancestral de `o`, até `ate` inclusive, é uma malha? */
function filhaDeMalha(o: THREE.Object3D, ate: THREE.Object3D): boolean {
  for (let n = o.parent; n; n = n.parent) {
    if ((n as THREE.Mesh).isMesh) return true;
    if (n === ate) break;
  }
  return false;
}

/** `o` está dentro de alguma das subárvores de `raizes`? */
function dentroDe(o: THREE.Object3D, raizes: (THREE.Object3D | null | undefined)[]): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    for (const r of raizes) if (r && n === r) return true;
  }
  return false;
}

/** Algum nome de nó da cadeia, até `ate`, casa `re`? */
function nomeNaCadeia(o: THREE.Object3D, ate: THREE.Object3D, re: RegExp): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (re.test(n.name || '')) return true;
    if (n === ate) break;
  }
  return false;
}

/**
 * A POLÍTICA, entregue por quem chama.
 *
 * ⚠️ ELA NÃO MORA AQUI DE PROPÓSITO. Os nomes de nó da caixa de cozinha, o
 * material branco de carroceria e a raiz do Thermo King são conhecimento de
 * `vehicle/models.ts` e de `vehicle/trim.ts` — e este módulo é importado POR
 * eles. Uma segunda cópia de "como se acha a caixa" divergiria da primeira no
 * próximo re-bake, que é exatamente o defeito que o cabeçalho de `trim.ts`
 * registra. Então a política desce como parâmetro, de `studio.ts`, que é a raiz
 * de composição e o único módulo que conhece todos os donos ao mesmo tempo.
 */
/**
 * Um ESCOPO: um conjunto de nós que se funde ENTRE SI, num grupo próprio, em vez
 * de entrar na fusão global ou de ficar de fora dela. Ver A FUSÃO POR ESCOPO.
 *
 * ⚠️ SÓ DECLARE UM ESCOPO SE A RESPOSTA ÀS DUAS PERGUNTAS FOR SIM: a peça é uma
 * unidade de VISIBILIDADE (quem a liga e desliga liga e desliga o conjunto
 * inteiro), e ela NUNCA troca de material. A segunda é a que morde em silêncio:
 * um balde guarda a referência do material no instante da fusão, então uma peça
 * que ganha cor própria depois ficaria com o balde pintado de fábrica e ninguém
 * veria um erro — só uma peça que não obedece ao card.
 */
export interface MergeScope {
  /**
   * Casa o nó (ele ou qualquer ancestral até a raiz). **A MESMA regexp que o
   * dono usa para achar a peça** — passada por ele, nunca recopiada aqui, pelo
   * motivo que `MergePolicy` inteiro documenta.
   */
  re: RegExp;
  /** O dono, por extenso. Sai em `info().escopos`. */
  motivo: Motivo;
  /**
   * O nome a dar ao grupo que carrega os baldes.
   *
   * ⚠️ **TEM DE CASAR `re`.** É essa coincidência que faz o matcher que o dono
   * já tem (`selfOrAncestor()` em `trim.ts`) encontrar os baldes sem uma linha
   * nova lá — e é ela que `applyMerge()` VERIFICA e recusa, com aviso, em vez de
   * fundir uma peça que o dono depois não conseguiria esconder.
   */
  nome: string;
}

export interface MergePolicy {
  /** A raiz a fundir — `models.state.trailer`. */
  root: THREE.Object3D;
  /**
   * Conjuntos que se fundem ENTRE SI em vez de entrar na fusão global — ver
   * A FUSÃO POR ESCOPO. Avaliados ANTES das exclusões de dono e DEPOIS das
   * estruturais; o primeiro que casar leva o nó.
   */
  scopes?: MergeScope[];
  /** Subárvores inteiras que ficam fora, com o dono de cada uma. */
  excludeRoots?: { root: THREE.Object3D | null | undefined; motivo: Motivo }[];
  /** Nós cujo NOME (ou de um ancestral) põe a malha fora, com o dono. */
  excludeNodeRe?: { re: RegExp; motivo: Motivo }[];
  /** Nomes de MATERIAL que põem a malha fora, com o dono. */
  excludeMaterialRe?: { re: RegExp; motivo: Motivo }[];
  /** Nomes de MALHA que a põem fora, com o dono. */
  excludeMeshRe?: { re: RegExp; motivo: Motivo }[];
  /**
   * O piso do baú, em espaço LOCAL de `root`. No modo `floor` só entram malhas
   * cuja caixa inteira fica abaixo de `floorY − SAIA`.
   *
   * LOCAL e não de mundo porque `placeTrailer()` INCLINA o implemento no engate,
   * e uma inclinação de dois graus sobre quinze metros move a ponta em mais de
   * trinta centímetros — mais que a saia inteira. No referencial da própria raiz
   * a inclinação não existe, e é lá que `TrailerBody` mediu o piso.
   */
  floorY?: number | null;
}

/* ---------------------------------------------------------------------------
   A COLETA */

interface Fonte {
  o: THREE.Mesh;
  chave: string;
  banda: number;
  mat: THREE.Material;
  /** Índice em `pol.scopes`, ou −1 para a fusão GLOBAL. */
  escopo: number;
}

function coletar(pol: MergePolicy, modo: MergeMode, escoposVivos: MergeScope[]) {
  const raiz = pol.root;
  const fontes: Fonte[] = [];
  const fora: Record<string, number> = {};
  const marcar = (m: Motivo) => { fora[m] = (fora[m] || 0) + 1; };

  const caixa = new THREE.Box3();
  const mLocal = new THREE.Matrix4();
  const inv = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  const cortePiso = typeof pol.floorY === 'number' ? pol.floorY - SAIA : null;
  const nossosGrupos: THREE.Object3D[] = grupo ? [grupo] : [];
  for (const e of escopos) nossosGrupos.push(e.grupo);

  raiz.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    /* Os NOSSOS grupos — o global e os de escopo —, se uma fusão anterior ainda
       estiver de pé. Sem os de escopo aqui, uma refusão assaria os baldes de
       ontem dentro dos de hoje. */
    if (nossosGrupos.length && dentroDe(o, nossosGrupos)) return;

    /* ---- AS EXCLUSÕES ESTRUTURAIS, E ELAS VÊM PRIMEIRO ----
       Antes até do escopo, porque nenhuma delas é negociável por dono: ver as
       DUAS FAMÍLIAS no cabeçalho. Um vidro dentro da caixa de cozinha continua
       sendo um vidro. */
    if ((o as unknown as THREE.InstancedMesh).isInstancedMesh) { marcar(MOTIVOS.instanciada); return; }
    if ((o as unknown as THREE.SkinnedMesh).isSkinnedMesh) { marcar(MOTIVOS.pele); return; }
    if (Array.isArray(o.material)) { marcar(MOTIVOS.arrayDeMaterial); return; }
    const mat = o.material as THREE.Material | null;
    if (!mat) { marcar(MOTIVOS.arrayDeMaterial); return; }

    /* ---- O ESCOPO, se houver: ele DERRUBA as exclusões de dono abaixo ----
       O primeiro que casar leva o nó. Dois escopos que se sobreponham são um
       erro de política, não um caso a resolver aqui — e a ordem torna o
       resultado determinístico em vez de arbitrário. */
    let escopo = -1;
    for (let i = 0; i < escoposVivos.length; i++) {
      if (nomeNaCadeia(o, raiz, escoposVivos[i].re)) { escopo = i; break; }
    }

    if (escopo < 0) {
      for (const r of pol.excludeRoots || []) {
        if (r.root && dentroDe(o, [r.root])) { marcar(r.motivo); return; }
      }
      for (const r of pol.excludeNodeRe || []) {
        if (nomeNaCadeia(o, raiz, r.re)) { marcar(r.motivo); return; }
      }
      for (const r of pol.excludeMeshRe || []) {
        if (r.re.test(o.name || '')) { marcar(r.motivo); return; }
      }
    }
    /* O material de FÁBRICA e não o corrente — `setPaintTarget()` já pode ter
       trocado o branco de carroceria por `carpaint`, e casar pelo corrente
       deixaria a chapa entrar num balde de onde ela nunca mais sairia. É a mesma
       lição de `factoryMaterials()` em models.ts. */
    const fab = (o.userData.origMat ?? o.userData.trimOrigMat ?? mat) as
      THREE.Material | THREE.Material[] | undefined;
    const nomesMat = (Array.isArray(fab) ? fab : [fab])
      .map((m) => (m && m.name) || '').concat(mat.name || '');
    let excluida = false;
    if (escopo < 0) {
      for (const r of pol.excludeMaterialRe || []) {
        if (nomesMat.some((n) => r.re.test(n))) { marcar(r.motivo); excluida = true; break; }
      }
    }
    if (excluida) return;

    /* ⚠️ DAQUI PARA BAIXO O ESCOPO NÃO ISENTA NINGUÉM — são as exclusões
       ESTRUTURAIS. Ver as DUAS FAMÍLIAS no cabeçalho. */
    if (mat.transparent) { marcar(MOTIVOS.transparente); return; }
    if (o.children.length) { marcar(MOTIVOS.sobreposta); return; }
    if (filhaDeMalha(o, raiz)) { marcar(MOTIVOS.sobreposta); return; }

    const g = o.geometry;
    if (!g || !g.attributes.position) { marcar(MOTIVOS.semPosicao); return; }
    if (g.morphAttributes && Object.keys(g.morphAttributes).length) {
      marcar(MOTIVOS.pele); return;
    }

    /* ⚠️ PORTA DE ENTRADA DA POSSE — ver POSSE POSITIVA no cabeçalho. Basta um
       ancestral invisível para a malha não ser nossa: quem a escondeu pode
       revelá-la, e um balde não sabe devolver um pedaço. */
    for (let n: THREE.Object3D | null = o; n; n = n.parent) {
      if (!n.visible) { marcar(MOTIVOS.jaInvisivel); return; }
      if (n === raiz) break;
    }

    if (cortePiso !== null && modo === 'floor') {
      mLocal.multiplyMatrices(inv, o.matrixWorld);
      if (!g.boundingBox) g.computeBoundingBox();
      caixa.copy(g.boundingBox as THREE.Box3).applyMatrix4(mLocal);
      if (caixa.max.y >= cortePiso) { marcar(MOTIVOS.acimaDoPiso); return; }
    }

    /* A MEDIDA VEM DE `setShadowCasters()`, que já a pagou. A rede é para a
       malha criada depois dele — e ela ESCREVE no mesmo campo, para os dois
       consumidores nunca discordarem (mesma regra de `vehicle/lod.ts`). */
    let d = typeof o.userData.tsWorldDiameter === 'number'
      ? (o.userData.tsWorldDiameter as number) : 0;
    if (!(d > 0)) {
      if (!g.boundingSphere) g.computeBoundingSphere();
      const bs = g.boundingSphere;
      d = bs && Number.isFinite(bs.radius)
        ? new THREE.Sphere().copy(bs).applyMatrix4(o.matrixWorld).radius * 2 : 0;
      o.userData.tsWorldDiameter = d;
    }
    const banda = bandaDe(d);

    /* ⚠️ O ESCOPO ENTRA NA CHAVE, E É ELE QUE FAZ A FUSÃO POR ESCOPO SER POR
       ESCOPO. Sem este primeiro campo, os 59 `inox-ferragem` da caixa cairiam no
       MESMO balde que os `inox-ferragem` espalhados pelo resto do implemento — e
       aí o balde deixaria de coincidir com a peça, que é exatamente o argumento
       pelo qual a caixa estava excluída. É uma string a mais e é a funcionalidade
       inteira. */
    const chave = [
      escopo, mat.uuid, banda, o.renderOrder, o.layers.mask, assinaturaDeAtributos(g),
    ].join('|');
    fontes.push({ o, chave, banda, mat, escopo });
  });

  return { fontes, fora };
}

/* ---------------------------------------------------------------------------
   A ASSADURA */

const _m3 = new THREE.Matrix3();
const _v3 = new THREE.Vector3();
/** A matriz local reassada de uma origem que vai para o casulo. Ver O CASULO. */
const _mCasulo = new THREE.Matrix4();

/**
 * Funde `itens` numa geometria só, em espaço LOCAL de `raiz`.
 *
 * `alvo` é a matriz que leva do mundo ao espaço da raiz — passada pronta porque
 * ela é a mesma para os ~20 baldes e inverter uma matriz por balde seria pagar
 * vinte vezes pela mesma resposta.
 */
function assar(
  itens: THREE.Mesh[], alvo: THREE.Matrix4, arm: MergeInfo['armadilhas'],
): THREE.BufferGeometry {
  const modelo = itens[0].geometry;
  const nomes = Object.keys(modelo.attributes);

  let nVert = 0, nIdx = 0;
  for (const o of itens) {
    const g = o.geometry;
    const p = g.attributes.position;
    nVert += p.count;
    nIdx += g.index ? g.index.count : p.count;
  }

  /* Cada atributo do destino nasce com o MESMO tipo de array, o mesmo
     `itemSize` e o mesmo `normalized` da origem — é o que a assinatura da chave
     garante ser igual em todos os membros. */
  const destinos: Record<string, THREE.BufferAttribute> = {};
  for (const nome of nomes) {
    const a = modelo.attributes[nome] as THREE.BufferAttribute;
    const src = (a.array ?? (a as unknown as { data: { array: ArrayLike<number> } })
      .data.array) as ArrayLike<number>;
    const Ctor = src.constructor as unknown as { new(n: number): ArrayLike<number> };
    const arr = new Ctor(nVert * a.itemSize) as unknown as
      Float32Array | Uint8Array | Uint16Array | Int16Array;
    destinos[nome] = new THREE.BufferAttribute(arr, a.itemSize, a.normalized);
  }

  const usa32 = nVert > 65535;
  if (usa32) arm.indice32++;
  const idx = usa32 ? new Uint32Array(nIdx) : new Uint16Array(nIdx);

  const temNormal = !!destinos.normal;
  const temTangente = !!destinos.tangent;

  let vo = 0, io = 0;
  for (const o of itens) {
    const g = o.geometry;
    const M = new THREE.Matrix4().multiplyMatrices(alvo, o.matrixWorld);
    /* ⚠️ A INVERSA TRANSPOSTA, não a matriz de mundo — ver MATRIZ DE NORMAL. */
    _m3.getNormalMatrix(M);
    const espelhado = M.determinant() < 0;
    if (espelhado) arm.espelhados++;

    const p = g.attributes.position as THREE.BufferAttribute;
    const dPos = destinos.position;
    for (let i = 0; i < p.count; i++) {
      _v3.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(M);
      dPos.setXYZ(vo + i, _v3.x, _v3.y, _v3.z);
    }
    if (temNormal) {
      const n = g.attributes.normal as THREE.BufferAttribute | undefined;
      if (n) {
        for (let i = 0; i < n.count; i++) {
          _v3.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(_m3).normalize();
          destinos.normal.setXYZ(vo + i, _v3.x, _v3.y, _v3.z);
        }
      } else {
        arm.semNormal++;
      }
    }
    if (temTangente) {
      const t = g.attributes.tangent as THREE.BufferAttribute | undefined;
      if (t) {
        for (let i = 0; i < t.count; i++) {
          _v3.set(t.getX(i), t.getY(i), t.getZ(i)).applyMatrix3(_m3).normalize();
          /* O `w` da tangente é HANDEDNESS (o sinal da bitangente). Num nó
             espelhado ele troca de sinal junto com o enrolamento, senão o mapa
             de normal sai com o relevo invertido. */
          const w = t.getW(i) * (espelhado ? -1 : 1);
          destinos.tangent.setXYZW(vo + i, _v3.x, _v3.y, _v3.z, w);
        }
      }
    }
    /* Os demais atributos não são espaciais: uv, uv1, color, e o que o bake
       tiver inventado. Cópia componente a componente, pelos acessores — ver
       ATRIBUTOS INTERCALADOS E NORMALIZADOS. */
    for (const nome of nomes) {
      if (nome === 'position' || nome === 'normal' || nome === 'tangent') continue;
      const a = g.attributes[nome] as THREE.BufferAttribute | undefined;
      const d = destinos[nome];
      if (!a) continue;
      for (let i = 0; i < a.count; i++) {
        if (a.itemSize === 1) d.setX(vo + i, a.getX(i));
        else if (a.itemSize === 2) d.setXY(vo + i, a.getX(i), a.getY(i));
        else if (a.itemSize === 3) d.setXYZ(vo + i, a.getX(i), a.getY(i), a.getZ(i));
        else d.setXYZW(vo + i, a.getX(i), a.getY(i), a.getZ(i), a.getW(i));
      }
    }

    /* ⚠️ DETERMINANTE NEGATIVO — ver o cabeçalho. Assar em espaço comum inverte
       o sentido de enrolamento de um nó espelhado; trocar os dois últimos
       índices de cada triângulo o devolve. */
    if (g.index) {
      const a = g.index;
      for (let t = 0; t + 2 < a.count; t += 3) {
        const i0 = vo + a.getX(t), i1 = vo + a.getX(t + 1), i2 = vo + a.getX(t + 2);
        idx[io + t] = i0;
        idx[io + t + 1] = espelhado ? i2 : i1;
        idx[io + t + 2] = espelhado ? i1 : i2;
      }
      io += a.count;
    } else {
      arm.semIndice++;
      for (let t = 0; t + 2 < p.count; t += 3) {
        idx[io + t] = vo + t;
        idx[io + t + 1] = vo + (espelhado ? t + 2 : t + 1);
        idx[io + t + 2] = vo + (espelhado ? t + 1 : t + 2);
      }
      io += p.count;
    }
    vo += p.count;
  }

  const bg = new THREE.BufferGeometry();
  for (const nome of nomes) bg.setAttribute(nome, destinos[nome]);
  bg.setIndex(new THREE.BufferAttribute(idx, 1));
  /* ⚠️ SEM ISTO O FRUSTUM MENTE — e vale reler o que ele passa a valer: um balde
     do tamanho do implemento praticamente nunca é descartado. Ver o cabeçalho. */
  bg.computeBoundingBox();
  bg.computeBoundingSphere();
  return bg;
}

/* ---------------------------------------------------------------------------
   A PORTA */

/**
 * Constrói (ou reconstrói) a fusão. Idempotente: solta a anterior antes.
 *
 * @param pol  a política — ver `MergePolicy`.
 * @param modo o modo. Ausente = o que o perfil de qualidade pedir.
 */
export function applyMerge(pol: MergePolicy, modo?: MergeMode): MergeInfo {
  releaseMerge();
  let modoPedido = modo ?? mergeModeFromProfile();
  raizAtual = pol.root;
  /* ⚠️ SEM PISO NÃO HÁ FASE A, E O PADRÃO SEGURO É NÃO FUNDIR — nunca cair no
     modo `all`. `floorY` vem da caixa do corpo paramétrico, e ela falta num bake
     sem material branco recortável (`state.trailerRig` nasce `null` ali — ver
     `buildTrailerRig()`). Sem o corte, um `floor` silenciosamente viraria `all`:
     o pedido era a faixa de risco quase nulo e a entrega seria a de risco
     máximo, sem uma linha no console dizendo que a troca aconteceu. */
  if (modoPedido === 'floor' && typeof pol.floorY !== 'number') {
    console.warn('[fusão] modo "floor" pedido sem piso medido (bake sem corpo'
      + ' paramétrico?) — a fusão fica DESLIGADA em vez de virar "all".');
    modoPedido = 'off';
  }
  if (modoPedido === 'off') {
    modoAtual = 'off';
    ultimoMs = 0;
    return mergeInfo();
  }

  const t0 = performance.now();
  /* ⚠️ ANTES DE LER UMA MATRIZ SEQUER — ver A ORDEM DE EXECUÇÃO.
     `updateWorldMatrix(true, true)` e não `updateMatrixWorld(true)`: o primeiro
     argumento sobe pelos PAIS antes de descer. Sem ele, a matriz da própria raiz
     viria da matriz de mundo do `trailerGroup`/`rigGroup` como ela estava no
     quadro anterior — e `setRigPlacement()` acabou de mexer nela. Assar por uma
     matriz de um quadro atrás é o defeito que `setShadowCasters()` documenta,
     com a diferença de que aqui ele fica ASSADO no buffer. */
  pol.root.updateWorldMatrix(true, true);

  const arm: MergeInfo['armadilhas'] = {
    espelhados: 0, indice32: 0, semNormal: 0, semIndice: 0, baldesPorAtributo: 0,
  };

  /* ---- OS ESCOPOS, VALIDADOS ANTES DE VALEREM ----
     ⚠️ UM ESCOPO CUJO `nome` NÃO CASE O PRÓPRIO `re` É PIOR QUE NENHUM, e é por
     isso que a checagem é aqui e não num comentário. O grupo existe para ser
     encontrado pelo matcher que o dono já tem; se o nome não casar, os baldes
     ficam fora do alcance dele e a peça deixa de poder ser escondida — as
     origens vão para o casulo e nada volta. O sintoma seria "a caixa de cozinha
     não some mais", num nível de qualidade só, e a causa não se parece nada com
     ele. Recusar o escopo devolve o comportamento de antes, que é a degradação
     certa. */
  const escoposVivos: MergeScope[] = [];
  for (const s of pol.scopes || []) {
    if (!s.re.test(s.nome)) {
      console.warn(`[fusão] escopo "${s.motivo}" RECUSADO: o nome do grupo`
        + ` ("${s.nome}") não casa a própria regexp (${s.re}). Sem isso o dono da`
        + ' peça não acha os baldes e ela deixa de poder ser escondida.'
        + ' O conjunto volta a ser tratado pelas exclusões.');
      continue;
    }
    escoposVivos.push(s);
  }

  const { fontes, fora } = coletar(pol, modoPedido, escoposVivos);

  const porChave = new Map<string, Fonte[]>();
  for (const f of fontes) {
    let a = porChave.get(f.chave);
    if (!a) { a = []; porChave.set(f.chave, a); }
    a.push(f);
  }
  /* Quantos baldes existem SÓ porque a assinatura de atributos não casou: se a
     chave fosse só material+banda+ordem+layers, quantos seriam? A diferença é o
     número que diz se vale a pena, um dia, normalizar os atributos do bake. */
  const semAtributo = new Set<string>();
  for (const f of fontes) semAtributo.add(`${f.mat.uuid}|${f.banda}|${f.o.renderOrder}|${f.o.layers.mask}`);
  arm.baldesPorAtributo = porChave.size - semAtributo.size;

  const g = new THREE.Group();
  g.name = MERGE_GROUP_NAME;
  const minM = shadowCasterMinM();
  const alvo = new THREE.Matrix4().copy(pol.root.matrixWorld).invert();

  /* ---- UM GRUPO E UM CASULO POR ESCOPO ----
     Os dois nascem na IDENTIDADE e filhos da raiz, e é isso que torna a
     reassadura da matriz das origens exata: com os dois em identidade,
     `casulo.matrixWorld === raiz.matrixWorld`, então a matriz local reassada é a
     MESMA `alvo · o.matrixWorld` que os baldes usam. Nenhuma segunda inversão,
     nenhuma segunda travessia.

     `matrixAutoUpdate` fica LIGADO nos dois, pela razão que o ⚠️ do cabeçalho
     dá para o grupo `FUSAO`: é a recomposição por quadro que marca
     `matrixWorldNeedsUpdate` e força a cascata até os baldes e as origens
     congeladas. Congelá-los tira 0,00004 ms e quebra a pose em silêncio. */
  for (const s of escoposVivos) {
    const gs = new THREE.Group();
    gs.name = s.nome;
    const casulo = new THREE.Group();
    casulo.name = `${MERGE_GROUP_NAME}__casulo`;
    /* ⚠️ A ÚNICA ESCRITA DESTE `false` EM TODO O ENGINE, e ela é a
       funcionalidade. Ver O CASULO no cabeçalho: é ele que torna inofensiva a
       escrita de `visible = true` que `applyTrim()` faz nas origens. */
    casulo.visible = false;
    gs.add(casulo);
    escopos.push({ def: s, grupo: gs, casulo, baldes: [], encasuladas: [] });
  }

  let tri = 0;
  for (const grupoFontes of porChave.values()) {
    /* Um balde de UMA malha não poupa chamada nenhuma e ainda paga uma cópia da
       geometria em memória. Deixe a origem visível e siga. */
    if (grupoFontes.length < 2) continue;
    const itens = grupoFontes.map((f) => f.o);
    const geo = assar(itens, alvo, arm);
    const malha = new THREE.Mesh(geo, grupoFontes[0].mat);
    const banda = grupoFontes[0].banda;
    malha.name = `${MERGE_GROUP_NAME}__${(grupoFontes[0].mat.name || 'sem-nome')}__b${banda}`;
    malha.receiveShadow = true;
    /* ⚠️ O `castShadow` VEM DA BANDA, não do tamanho do balde — que é enorme e
       responderia "sim" para todo mundo, acendendo sombra para os 483 parafusos
       que `setShadowCasters()` tinha desligado. E é por a decisão morar na banda
       que trocar de nível não exige refusão. */
    malha.castShadow = BANDAS[banda] >= minM;
    /* O CONTRATO COM `material-setup.ts`, e ele é por `userData` de propósito:
       aquele arquivo é FOLHA (o pipeline offline de renders e a bancada o
       importam sem querer arrastar a cena junto), então ele não pode importar
       este módulo. `setShadowCasters()` lê `tsMergeBand` e, quando ele existe,
       decide por ele em vez de pelo diâmetro. */
    malha.userData.tsMergeBand = BANDAS[banda];
    /* E o diâmetro do BALDE, que é o número honesto para quem pergunta o tamanho
       na tela — `vehicle/lod.ts` lê este campo, e um balde com o diâmetro dos
       MEMBROS faria o LOD esconder quatrocentos parafusos de uma vez. */
    const bs = geo.boundingSphere;
    malha.userData.tsWorldDiameter = bs ? bs.radius * 2 : 0;
    /* O BALDE é congelado — ele nasce na identidade em espaço da raiz e nunca se
       mexe sozinho. Quem o carrega pelo mundo é o grupo `FUSAO`, que
       DELIBERADAMENTE fica com `matrixAutoUpdate` ligado; ver o ⚠️ do cabeçalho,
       que explica por que congelar o grupo quebra a fusão em silêncio. */
    malha.matrixAutoUpdate = false;
    malha.updateMatrix();
    /* O DESTINO: o grupo do escopo quando há um, o grupo global quando não. */
    const esc = grupoFontes[0].escopo >= 0 ? escopos[grupoFontes[0].escopo] : null;
    (esc ? esc.grupo : g).add(malha);
    for (const o of itens) {
      /* ---- ESCONDER, OU ENCASULAR ----
         Fora de escopo, `visible = false` basta: ninguém mais escreve nessas
         malhas. DENTRO de um escopo não basta, e o cabeçalho explica por quê —
         `applyTrim()` reescreve `visible` em tudo que casa o nome da peça, e as
         origens continuam casando. Elas mudam de pai para o casulo, que é
         invisível e é nosso; a escrita de `applyTrim()` passa a não ter efeito
         em vez de ter o efeito errado. */
      if (esc) {
        const pai = o.parent;
        if (pai) {
          const idx = pai.children.indexOf(o);
          const matriz = o.matrix.clone();
          /* ⚠️ REASSAR A MATRIZ ANTES DE MUDAR DE PAI — ver o ⚠️ do cabeçalho.
             O nó está congelado, então ninguém a recomporia depois, e
             `Box3.expandByObject()` (que não pula invisível) leria a pose
             errada: o enquadramento automático passaria a medir uma caixa com a
             caixa de cozinha jogada longe. */
          _mCasulo.multiplyMatrices(alvo, o.matrixWorld);
          esc.casulo.add(o);
          o.matrix.copy(_mCasulo);
          o.matrix.decompose(o.position, o.quaternion, o.scale);
          /* `add()` NÃO suja o filho (three r179), e o nó é congelado — sem esta
             linha ele desenharia com a matriz de mundo do pai antigo. */
          o.matrixWorldNeedsUpdate = true;
          esc.encasuladas.push({ o, pai, idx, matriz });
        }
      } else {
        o.visible = false;
      }
      /* ---------------- A MEMÓRIA DE VÍDEO, E POR QUE ISTO NÃO É PERIGOSO ----
         Um balde é uma SEGUNDA cópia dos vértices. No implemento inteiro isso
         são ~4,3 M de vértices a 32 bytes mais os índices: da ordem de 200 MB
         (ESTIMADO — aritmética sobre a contagem de §2.3, não medição). Numa
         integrada de memória compartilhada, onde as texturas já ocupam 1 087 MB,
         200 MB a mais não é um detalhe: é o que decide se a página perde o
         contexto.

         `BufferGeometry.dispose()` libera SÓ o lado GPU. Os `TypedArray` do lado
         CPU ficam intactos — é por isso que soltar a fusão devolve a malha
         inteira: no primeiro quadro em que ela voltar a ser visível o three
         sobe os buffers de novo, pelo mesmo caminho preguiçoso que os subiu na
         primeira vez. Nada aqui destrói dado; o que se descarta é o upload de
         uma malha que ninguém vai desenhar.

         ⚠️ GEOMETRIA COMPARTILHADA não é problema, e vale dizer por quê: as
         rodas do FH16 são clones (`mold.clone(true)`), então várias malhas
         apontam para o mesmo buffer. Se uma delas ficar visível fora do balde, o
         `dispose()` só lhe custa UM reenvio no quadro seguinte, depois do qual o
         cache do renderizador a segura de novo. */
      o.geometry.dispose();
    }
    const b: Balde = { malha, banda, fontes: itens };
    baldes.push(b);
    if (esc) esc.baldes.push(b);
    tri += geo.index ? geo.index.count / 3 : 0;
  }

  /* ---- ESCOPO QUE NÃO FUNDIU NADA NÃO DEIXA GRUPO NA CENA ----
     Acontece de verdade e é legítimo: a peça pode estar ESCONDIDA pelo usuário
     no instante da carga, e aí `POSSE POSITIVA` recusa as origens (`jaInvisivel`)
     e nenhum balde nasce. Um grupo vazio com o nome da peça ficaria pendurado no
     implemento e — pior — passaria a casar o matcher do dono sem ter nada
     dentro, o que é ruído para quem for depurar. */
  escopos = escopos.filter((e) => {
    if (e.baldes.length) { pol.root.add(e.grupo); return true; }
    return false;
  });

  pol.root.add(g);
  grupo = g;
  modoAtual = modoPedido;
  ultimoMs = Math.round(performance.now() - t0);
  ultimasExclusoes = fora;
  ultimasArmadilhas = arm;
  ultimosTriangulos = tri;

  const origens = baldes.reduce((s, b) => s + b.fontes.length, 0);
  console.info('[fusão]', modoPedido, '—', origens, 'malhas →', baldes.length, 'baldes ·',
    origens - baldes.length, 'chamadas poupadas ·', ultimoMs, 'ms ·',
    (tri / 1e6).toFixed(2), 'M tri');
  for (const e of escopos) {
    console.info(`[fusão]   escopo "${e.def.motivo}" — ${e.encasuladas.length} malhas →`
      + ` ${e.baldes.length} baldes · ${e.encasuladas.length - e.baldes.length}`
      + ` chamadas poupadas · grupo "${e.def.nome}"`);
  }
  return mergeInfo();
}

/**
 * Desfaz a fusão: devolve as origens e descarta os baldes.
 *
 * @returns quantas malhas voltaram a ser visíveis.
 */
export function releaseMerge(): number {
  if (!baldes.length && !grupo && !escopos.length) { modoAtual = 'off'; return 0; }
  let n = 0;

  /* ---- OS ESCOPOS PRIMEIRO: DESENCASULAR ANTES DE MEXER EM `.visible` ----
     A ordem importa porque o laço global abaixo escreve `visible = true` nas
     fontes, e uma fonte encasulada não pode receber essa escrita — ver o ⚠️
     logo abaixo. Desfazer aqui, e marcar quem já foi tratada. */
  const jaTratadas = new Set<THREE.Object3D>();
  for (const e of escopos) {
    for (const enc of e.encasuladas) {
      const { o, pai, idx, matriz } = enc;
      pai.add(o);
      /* O ÍNDICE ENTRE OS IRMÃOS é restaurado, e não é preciosismo: irmãos de
         mesmo `renderOrder` e mesma distância são desenhados na ordem da lista,
         e a trava de aceitação desta funcionalidade é PIXEL A PIXEL. */
      const irmaos = pai.children;
      const atual = irmaos.indexOf(o);
      if (atual >= 0 && atual !== idx && idx >= 0 && idx < irmaos.length) {
        irmaos.splice(atual, 1);
        irmaos.splice(idx, 0, o);
      }
      /* A matriz LOCAL de antes da mudança de pai, e a marca de sujeira que
         `add()` não dá. Ver O CASULO. */
      o.matrix.copy(matriz);
      o.matrix.decompose(o.position, o.quaternion, o.scale);
      o.matrixWorldNeedsUpdate = true;
      /* ⚠️ `.visible` NÃO É TOCADO AQUI, E ISSO É A CORREÇÃO, NÃO UM ESQUECIMENTO.
         Enquanto a fusão esteve de pé, o DONO da peça (`applyTrim()`) escreveu
         `visible` nestas malhas todas as vezes que o usuário ligou ou desligou a
         peça — o casulo só fez essas escritas não aparecerem. O valor que está
         nelas agora é, portanto, exatamente o estado que o usuário escolheu.
         Forçar `true` aqui faria a caixa REAPARECER ao trocar de nível de
         qualidade depois de o usuário tê-la removido do produto. */
      jaTratadas.add(o);
      n++;
    }
    for (const b of e.baldes) b.malha.geometry.dispose();
    e.grupo.removeFromParent();
  }
  escopos = [];

  for (const b of baldes) {
    for (const o of b.fontes) {
      if (jaTratadas.has(o)) continue;      // encasulada: já devolvida acima
      o.visible = true;
      n++;
    }
    b.malha.geometry.dispose();
    /* O MATERIAL NÃO É DESCARTADO — ele é a referência COMPARTILHADA com as
       origens, e descartá-lo apagaria a textura do implemento inteiro. O balde
       nunca foi dono dele. */
  }
  baldes = [];
  if (grupo) {
    grupo.removeFromParent();
    grupo = null;
  }
  modoAtual = 'off';
  return n;
}

/**
 * Reaplica `castShadow` nos baldes a partir do corte vigente do perfil.
 *
 * SEM REFUNDIR — é para isto que a banda entra na chave. Chamado por
 * `setShadowCasters()`, que é quem já é chamado a cada mudança que possa mexer
 * no corte.
 *
 * @returns quantos baldes MUDARAM de estado.
 */
export function refreshMergedShadowCasters(minM?: number): number {
  const corte = typeof minM === 'number' && minM > 0 ? minM : shadowCasterMinM();
  let mudou = 0;
  for (const b of baldes) {
    const quer = BANDAS[b.banda] >= corte;
    if (b.malha.castShadow !== quer) { b.malha.castShadow = quer; mudou++; }
  }
  return mudou;
}

/** A fusão está de pé sobre esta raiz? */
export const isMergedRoot = (root: THREE.Object3D | null | undefined) =>
  !!root && raizAtual === root && baldes.length > 0;

/** O modo vigente. */
export const mergeMode = (): MergeMode => modoAtual;

/** Para o console e para a bancada — ver o portão de aceitação. */
export function mergeInfo(): MergeInfo {
  const origens = baldes.reduce((s, b) => s + b.fontes.length, 0);
  const minM = shadowCasterMinM();
  return {
    modo: modoAtual,
    origens,
    baldes: baldes.length,
    poupadas: origens - baldes.length,
    ms: ultimoMs,
    triangulos: ultimosTriangulos,
    excluidas: { ...ultimasExclusoes },
    armadilhas: { ...ultimasArmadilhas },
    sombra: { minM, emissores: baldes.filter((b) => b.malha.castShadow).length },
    escopos: escopos.map((e) => ({
      nome: e.def.nome,
      motivo: e.def.motivo,
      origens: e.encasuladas.length,
      baldes: e.baldes.length,
      poupadas: e.encasuladas.length - e.baldes.length,
    })),
  };
}
