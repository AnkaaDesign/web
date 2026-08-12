/* AS LUZES DO VEÍCULO — farol, lanterna, delimitadora e placa, acesas às 18:00.
   ===========================================================================
   O PEDIDO: *"ache as luzes do cavalo do caminhão e tambem do implemento, faca
   com que elas acendam a partir das 18:00"*, e depois *"o implemento e o cavalo
   possui muitas lanternas que ainda nao emitem luzes"*. Este módulo acha quais
   materiais são luz e acende o emissivo deles em função da hora. Quem joga FEIXE
   no chão é `vehicle/beams.ts` — ver "O FEIXE MORA NO POOL" no fim.

   ===========================================================================
   O QUE A SEGUNDA RODADA MEDIU, E QUE DERRUBOU A PREMISSA CENTRAL DA PRIMEIRA.

   A primeira versão escolhia UMA COR POR MATERIAL, pela posição média das malhas
   dele. Está errado, e não por afinação: **nos bakes de cavalo a geometria vem
   FUNDIDA POR MATERIAL — uma primitiva por material, uma malha por primitiva.**
   Varrido o acervo inteiro (49 cavalos + implemento + `iveco_sway_metallica`):

     · **37 dos 57 bakes** têm ao menos um material de lâmpada espalhado por mais
       de 30 % do comprimento do veículo;
     · em 12 deles UM ÚNICO material cobre 93–100 % — `cabin_mat_0006_color` do
       MAN TGX vai de z −3,06 a 3,84 (o caminhão inteiro), e é o **único** material
       emissivo externo daquele bake: farol, delimitadora de teto, lanterna de
       lateral e lanterna traseira na MESMA malha, com o MESMO material.

   Não existe cor por material que sirva a isso, e clonar material por grupo de
   posição — que era o plano herdado — também não serve: **não há grupos**, é uma
   malha só. Então a cor passou a ser resolvida POR FRAGMENTO, da posição de
   mundo do próprio pixel, dentro do shader. É a única granularidade que a
   geometria do acervo admite, e de quebra ela resolve o implemento junto (ver
   `lanterna-pequena-cantos-redondo(VERMELHO)`, que tem peças na frente E atrás).

   ===========================================================================
   QUEM É LUZ: A DECLARAÇÃO DO BAKE, NÃO O NOME.

   A tentação é uma lista de nomes, e ela não sobrevive ao acervo. Medido nos 49
   bakes de cavalo que estão em disco: os materiais de luz aparecem com 47 nomes
   distintos, de cinco convenções diferentes de quem ripou —
   `f_light_chs_mat_0000_lights`, `sideskirt_mat_0000_positional`,
   `r_light_mat_0000_animated_blinkers_col`, `cabin_mat_0009_lamps`,
   `truck_mat_0009_notfound_notfound_farol`, e um `parasol_mat_0002_faror` com
   "farol" escrito errado em sueco. Uma lista de nomes falharia em silêncio no
   próximo chassi do catálogo, e a falha é invisível: a luz simplesmente não
   acende, e ninguém abre o app às 20h para conferir os 58 chassis.

   O que TODOS eles têm em comum, e que veio do autor do modelo:

     · `emissiveFactor` não-preto — 145 ocorrências nos 49 arquivos, e **todo
       bake tem pelo menos uma**. É o autor dizendo "esta superfície emite".
     · `emissiveTexture` — **145 de 145**, sem uma exceção.

   Então a primeira regra é: **emissivo autorado + mapa emissivo = é luz**, menos
   o que o nome disser que é INTERIOR (painel, GPS, ícone de botão — esses vêm com
   emissivo [1,1,1] e acendê-los junto poria o interior aceso visto de fora pelo
   vidro). É a mesma doutrina que `paint.ts` usa para achar a tinta: perguntar ao
   asset, não adivinhar pelo nome.

   ⚠️ **MAS O `emissiveTexture` NÃO É UMA MÁSCARA DE LÂMPADA.** Medido: o
   `emissiveTexture` e o `baseColorTexture` do FH 2021 são o **mesmo arquivo**
   (md5 idêntico, 462 146 bytes) — o bake reusa o ALBEDO. O mapa é um ATLAS com
   lente, refletor e carcaça na mesma imagem, e não um recorte de onde a luz sai.
   É por isso que ele entra só pela LUMINÂNCIA e a cor é nossa (ver A COR É
   AUTORADA, O MAPA É MÁSCARA).

   ===========================================================================
   O IMPLEMENTO É O CASO CONTRÁRIO, e por isso existe a segunda regra.

   O `trailer.glb` tem oito materiais de lanterna e **nenhum emissivo autorado**:
   `lanterna-pisca-quadrado(LEDs)`, `painel-curva-led-vermelho`,
   `led-branco-e-red-sinaleira`, `lanterna-pequena-cantos-redondo(VERMELHO)`,
   `lanterna-pisca-circular`, `lanterna-interna-lente` — todos com albedo
   texturizado e emissivo zero. Aqui o nome É o único sinal que existe, e ele é
   confiável porque é UM arquivo, versionado com o produto, não um acervo de
   terceiros. Nesses, o emissivo é autorado por nós: `emissiveMap = map`.

   E AS TAMPAS TRANSPARENTES FICAM DE FORA. `lente-sinaleita-traseira` e
   `vidro-lanternas-pisca` são as capas de acrílico SOBRE a placa colorida —
   `alphaMode: BLEND` com opacidade 0,06/0,10. Acendê-las poria a luz na frente da
   lente em vez de dentro dela. O corte é por TRANSPARÊNCIA e não por nome, porque
   `lanterna-interna-lente` também tem "lente" no nome e é a placa, não a capa.

   ===========================================================================
   POR QUE 18:00 E NÃO `nightness`.

   O rig já tem `nightness` — um smoothstep da altura do sol — e as luminárias de
   rua andam com ele. Para o VEÍCULO isso estaria errado por duas razões:

     1. É O QUE FOI PEDIDO, e faz sentido de operação: um motorista acende o
        farol pelo relógio e pelo hábito, não quando o sol cruza −3°. Neste
        cenário o sol se põe às 18,4 h, então `nightness` às 18:00 ainda vale
        ~0,25 e as lanternas ficariam num quarto de brilho na hora em que o
        pedido diz que elas estão acesas.
     2. UMA RAMPA CURTA LÊ COMO ALGUÉM ACENDENDO. 18:00 → 18:36 é rápido o
        bastante para ler como um gesto e lento o bastante para não estalar.

   O nível mora no RIG (`RIG_BASE.vehLights`), calculado por `resolveRig()` a
   partir da hora — e não lido daqui — porque assim ele atravessa `lerpRig()` como
   qualquer outro campo, e `applyRig()` continua sendo o único escritor.

   ===========================================================================
   O FEIXE MORA NO POOL, e a razão é `NUM_SPOT_LIGHTS` ser chave de cache de
   programa de TODO material da cena. Acrescentar uma `SpotLight` avulsa ao
   caminhão recompilaria a cena inteira na primeira vez que ela aparecesse. O
   caminho certo — e o que `vehicle/beams.ts` faz — é ENTRAR no pool fixo de
   `lamps.ts`, que cresceu de 8 para 12 exatamente para caber o veículo. */
import * as THREE from 'three';
import {
  registerHeadlightCover, setHeadlightCoverBox, setHeadlightCoverLevel,
} from './headlight-cover';
import { rebuildLampHalos, setLampHaloLevel, type HaloSite } from './halo';

/** Emissivo de dentro da cabine — painel, GPS, ícone de botão, luz de teto. */
const INTERIOR_RE =
  /interior|dashboard|_gps\b|button|codrv|steering|intlight|ilum_l|painel-de-instr/i;

/**
 * O SUFIXO do material diz se ele é lâmpada — não o nome inteiro.
 *
 * A convenção dos bakes de cavalo é `<peça>_mat_NNNN_<sufixo>`, e é o SUFIXO que
 * descreve o material; a peça descreve onde ele está. A diferença importa e foi
 * medida: no FH 2021 o conjunto do farol é a peça `f_light_chs`, e dentro dela
 * moram `..._0000_lights` (o refletor), `..._0004_lights_w` (a lente branca) e
 * `..._0001_galvanized_steel` (o suporte). Casar o NOME INTEIRO acenderia o
 * suporte de aço galvanizado junto; casar o sufixo acende as duas primeiras e
 * deixa a terceira em paz.
 *
 * O que não casa `_mat_\d+_` (o implemento, cujos materiais têm nome livre) é
 * testado inteiro.
 */
const LAMPADA_RE =
  /lights?|lamps?|farol|faror|lanterna|led-|painel-curva|sinaleira|sinaleita|positional|pos_light/i;
/* `blinker` NÃO entra aqui de propósito: quem responde por ele é INTERMITENTE_RE,
   que é consultado ANTES e exclui. Deixá-lo nas duas listas seria duas fontes de
   verdade para o mesmo material. */

/**
 * O que mora DENTRO de um conjunto de farol e não é lâmpada.
 *
 * Existe por causa de uma falha achada na varredura do acervo: `PECA_FAROL_RE`
 * casa a PEÇA (`^f_light`), e dentro dela mora `f_light_chs_mat_0001_galvanized_steel`
 * — o suporte de aço. Em 2 bakes ele estava sendo tratado como difusor de farol e
 * acendia em branco a 40 de radiância, que é um pedaço de estrutura brilhando.
 * A bancada já tinha a trava certa (`nenhum SUPORTE de farol acende`); ela só não
 * reprovava porque o cavalo que ela carrega é o Volvo, e no Volvo esse material
 * não existe. Também pega `f_light_mid_mat_0006_plain_grey`.
 *
 * ⚠️ `plastic` genérico NÃO entra: `f_light_chs_mat_0003_light_plastic_c` do DAF
 * XG é a LENTE, e o corte tem de ser estreito o bastante para não apagá-la.
 */
const NAO_LAMPADA_RE =
  /galvaniz|plain_grey|brushed_metal|plastic_hard|_steel\b|rubber|screw|parafus/i;

/** O sufixo, ou o nome inteiro quando não há convenção. */
function sufixoDe(nome: string) {
  const m = /_mat_\d+_(.+)$/.exec(nome);
  return m ? m[1] : nome;
}

/**
 * LÂMPADA INTERMITENTE — pisca, luz de freio, marcha a ré. Fica APAGADA.
 *
 * Acender pisca é errado por si: um caminhão PARADO tem luz de posição, farol,
 * lanterna e luz de placa acesas — e pisca, freio e ré apagados, porque as três
 * são função de uma ação que não está acontecendo. Numa foto de produto, um pisca
 * aceso lê como "está saindo", que não é o que a foto diz.
 *
 * ⚠️ **MAS O NOME DO MATERIAL SOZINHO NÃO DECIDE ISSO**, e foi assim que dez
 * lanternas de posição do implemento ficaram apagadas — o relato *"na lateral
 * possui 4 lanternas em cada lateral, abaixo frame metalico"*. Medido no
 * `trailer.glb`:
 *
 *     material `lanterna-pisca-quadrado(LEDs)`  × 10 primitivas
 *       peças  `lanterna-lateral-chassis(leds)-001…010`
 *              x = ±1,30 · y = 1,28 (SOB o frame) · z = 4,17 … −7,21 (5 por lado)
 *
 * O material chama "pisca" e a PEÇA é `lanterna-lateral-chassis`: quem autorou
 * reusou o material do pisca quadrado nas lanternas de posição da lateral. Os
 * piscas de verdade são outras peças — `lanterna-pisca-circular-D/E`, em z = 7,24,
 * na frente. Ver `ehIntermitente()` para a regra que separa os dois.
 */
const INTERMITENTE_RE = /pisca|blinker|brake|freio|reverse|marcha.?re|backup/i;

/**
 * A LENTE BRANCA — difusor de farol. Nela o mapa é DESCARTADO.
 *
 * Foi a última peça do *"falta a luz frontal"*, e ela precisou de duas medições
 * para aparecer. A primeira (a sonda `checks-farol.mjs`) mostrou que a malha do
 * farol amostra o canto do atlas, onde o albedo é 0,073 linear — daí o farol
 * apagado. A segunda mostrou que normalizar pelo pico do mapa NÃO resolve aquele
 * caso: `f_light_chs_p0` usa o atlas INTEIRO, então o pico da região usada é 1 e o
 * fator vira 1 — enquanto a superfície visível continua no 0,073.
 *
 * A conclusão é sobre o DADO, não sobre o número: **o albedo de uma lente é a
 * aparência dela APAGADA.** Cinza-escuro é exatamente como um difusor se vê de
 * dia; ele não diz nada sobre onde a luz sai quando acende — e não diz porque não
 * precisa dizer: um difusor emite UNIFORME, é para isso que ele existe.
 */
const LENTE_BRANCA_RE = /lights?_w\b|_w$|farol|faror|head_?light|drl/i;

/**
 * A PEÇA do farol dianteiro. Tudo dela é difusor (menos o que NAO_LAMPADA_RE tira).
 *
 * O sufixo sozinho não bastou, e a razão está DENTRO do material: `f_light_chs_p0`
 * usa `..._0000_lights`, e nessa MESMA imagem moram o refletor (cinza claro, ~0,7
 * linear) e a lente (cinza chapado, 0,073 — medido pela sonda no UV 0,99/0,005).
 * Dez vezes de diferença no albedo, então NENHUMA escala única acende a lente sem
 * estourar o refletor.
 *
 * O corte é a convenção `f_`/`r_` que os próprios bakes usam: **`f_light*` é
 * farol, e farol é BRANCO**, então perder a cor do mapa não perde informação. Já
 * `r_light*` e `r_bumper*` são lanterna, e ali a POSIÇÃO é a informação — por isso
 * a regra vale só para a frente.
 */
const PECA_FAROL_RE = /^f_light/i;

/* ---------------- E QUANDO O BAKE NÃO DECLARA FAROL NENHUM ----------------
   ⚠️ **METADE DO ACERVO NÃO DECLARA.** Varridos os 49 bakes de cavalo em disco
   (parse do glTF, sem decodificar geometria), as duas regras acima — sufixo de
   lente branca e peça `f_light*` — não casam NADA em **26 deles**. E a falha é
   silenciosa em cascata, porque três coisas dependem do mesmo veredito:

     · a lente nunca vira difusor branco a `PICO_FAROL`, então fica no albedo de
       lâmpada apagada (medido: 0,073 linear no FH — brilho nenhum);
     · `registerHeadlightCover()` não roda, então a capa de vidro continua nos
       0,8 de opacidade autorados e tampa o que houvesse;
     · e `temFarol` sai `false`, o que joga `beams.ts` no ramo de fallback.

   Esse último era o pior, e foi MEDIDO ao vivo: no Scania R 2009 os dois feixes
   de farol nasceram em **y = 2,98 m** com intensidade 240, porque a lâmpada mais
   dianteira daquele bake é o QUEBRA-SOL. O feixe saía do teto da cabine. Em ~20
   dos 49 bakes a lâmpada mais dianteira está entre 1,9 e 3,1 m de altura.

   Então existe uma SEGUNDA regra, geométrica, que roda depois das matrizes de
   mundo valerem (em `medirRaiz`) e só quando a primeira não achou nada. Ela é
   deliberadamente ESTREITA, porque promover a farol o material errado é pior que
   não promover nenhum: farol vira branco puro a 40 de radiância, e fazer isso com
   um material que cobre o caminhão inteiro acenderia a lataria toda.

   Os quatro testes, e a medida que justifica cada um:

     1. É BAKE DE CAVALO. Algum material da raiz casa `_mat_\d+_` — a convenção
        dos 49 ripados. O `trailer.glb` usa nome livre, então o implemento nunca
        entra aqui (e um implemento com farol seria um defeito por si).
     2. É LOCAL. A faixa em z da lâmpada é curta em termos absolutos E pequena
        perto do vão da raiz. É este teste que barra os 12 bakes em que UM material
        cobre 93–100 % do comprimento (`cabin_mat_0006_color` do MAN vai de
        −3,06 a 3,84) — ali não há farol a promover, há um caminhão inteiro.
     3. ESTÁ NA PONTA DIANTEIRA, a menos de `FAROL_GEO_FRENTE_M` da face.
     4. E NA ALTURA DE UM FAROL. Medido nos 23 bakes que DECLARAM farol, o centro
        do conjunto fica entre 0,58 e 1,26 m; a janela abaixo tem folga dos dois
        lados e ainda exclui quebra-sol (2,9–3,1 m) e delimitadora de teto. */
const CONVENCAO_BAKE_RE = /_mat_\d+_/;
const FAROL_GEO_FRENTE_M = 0.80;
const FAROL_GEO_FAIXA_M = 1.20;
const FAROL_GEO_FAIXA_FRACAO = 0.25;
const FAROL_GEO_Y_MIN = 0.35, FAROL_GEO_Y_MAX = 1.70;

/**
 * Altura do farol quando NÃO há conjunto identificável — os 12 bakes fundidos.
 *
 * 0,95 m, e é uma medida e não um gosto: nos 23 bakes que declaram farol o centro
 * do conjunto cai entre 0,58 m (FH 2021) e 1,26 m (Scania S 2024e), com mediana
 * 0,85. Errar por 0,3 m na altura de onde o cone nasce é invisível na foto; errar
 * por 2 m — que é o que a régua anterior fazia ao pegar o quebra-sol — põe o
 * feixe saindo do teto.
 */
const FAROL_Y_PADRAO = 0.95;
/** E a meia-bitola do par, pela mesma régua: 0,72…0,88 m nos que declaram. */
const FAROL_X_PADRAO = 0.80;

/**
 * Radiância de pico da lâmpada acesa, onde o mapa emissivo é branco.
 *
 * 2,2 em unidades de cena, e o número CAIU de 3,0 — foi a metade da correção do
 * *"a parte vermelha nao parece realmente vermelha"*. O ACES desaturar realce é
 * de projeto (é o que faz uma foto não ficar com neon nas altas), então uma
 * lente vermelha em (2,25 · 0,3 · 0,3) rola para laranja-branco antes de chegar
 * à tela. Em 2,2 o vermelho fica no trecho onde o tonemap ainda guarda croma, e
 * o miolo continua estourando — que é como uma lanterna acesa se fotografa.
 */
const PICO = 2.2;

/**
 * Pico do FAROL, que é outro bicho: 40.
 *
 * Não é o mesmo número que a lanterna porque não é o mesmo objeto, e é 40 por uma
 * razão MEDIDA: **o farol é visto ATRAVÉS de uma capa que transmite 20 %.** A
 * sonda `checks-quem-desenha.mjs` varre o retângulo do farol na MESMA pose da foto
 * e a pilha de acertos diz tudo:
 *
 *     [0] cabin_mat_0006_glass_ex        68 raios · opacidade 0,8 BLEND · cor 0,1
 *     [1] f_light_chs_mat_0000_lights    72 raios · emiInt 40 · emissivo branco
 *
 * ⚠️ E SUBIR O NÍVEL NÃO RESOLVE SOZINHO: **o tonemap roda ANTES da mistura.** A
 * lâmpada já sai do shader saturada em 1,0; a capa então mistura
 * 0,8 x vidro-escuro + 0,2 x 1,0 ≈ 0,25 — cinza escuro — para QUALQUER nível.
 * Medido subindo de 2,2 para 8 e de 8 para 40 sem diferença visível. Quem tira o
 * farol do escuro é o FEIXE de `beams.ts`, que é luz de verdade e não passa pela
 * capa; o 40 aqui é o que faz a lente ler como acesa vista de lado.
 *
 * MEXER NA CAPA foi avaliado e rejeitado: `cabin_mat_0006_glass_ex` é uma malha só
 * (`cabin_p7`, medido) com para-brisa, janela e capa de farol no mesmo material —
 * clarear a capa clarearia o para-brisa dos 49 chassis.
 */
const PICO_FAROL = 40.0;

/* ---------------- A COR É AUTORADA, O MAPA É MÁSCARA ----------------
   Esta é a quarta versão desta parte, e as três anteriores erraram pelo mesmo
   motivo: tentar TIRAR a cor da lâmpada do albedo. Não dá, e está medido por quê
   — `emissiveTexture` é o próprio `baseColorTexture` (md5 idêntico), e nele
   lente, refletor cromado e carcaça moram na mesma imagem. Já foram tentadas
   expansão de saturação, supressão de neutro em três valores e normalização pelo
   pico colorido; cada uma consertava um caso e estragava outro, porque a
   informação simplesmente não está lá.

   O dono do produto então disse o que se espera, e é a regulamentação:

     · lanterna de posição LATERAL — laranja/amarelada;
     · lanterna TRASEIRA — vermelha;
     · farol e delimitadora DIANTEIRA — branco.

   Com isso a divisão certa aparece: **o mapa diz ONDE e QUANTO; a cor é
   autorada.** O shader usa o mapa só pela LUMINÂNCIA e multiplica pela cor —
   e o refletor cromado ao lado da lente passa a acender NA COR DA LÂMPADA, que é
   o que ele faz na vida real (é um refletor).

   E DE ONDE SAI A COR: da DISTÂNCIA DO FRAGMENTO ÀS DUAS FACES da raiz dele, em
   METROS. Não de `zRel` normalizado, e a diferença é medida:

     · o rufo do implemento tem seis delimitadoras em z local −6,19 … 5,96, com as
       faces em −7,50 e 7,25. Em `zRel` elas caem em 0,09 … 0,90 — ou seja duas
       delas cruzariam os limiares 0,20/0,80 e sairiam BRANCA e VERMELHA no meio
       de uma fileira de seis iguais. Em METROS todas estão a 1,29–1,31 m das
       faces, e as seis saem ÂMBAR, que é o que o dono do produto pediu
       (*"delimitadoras do rufo: âmbar na lateral"*).
     · o cavalo é o caso oposto: o cluster do farol do FH 2021 tem 0,56 m de
       profundidade em z (−3,13 … −2,57) e a régua em metros mantém o conjunto
       inteiro branco, enquanto uma fração do comprimento total mudaria de
       veredito conforme o chassi fosse 4x2 ou 6x4.

   Por RAIZ, e não pelo conjunto: o traseiro do CAVALO fica no meio do comboio,
   mas é o extremo de trás da raiz dele. */

/** Até onde, em metros da face, ainda é "a ponta". */
const PONTA_M0 = 0.45, PONTA_M1 = 0.85;

/* As três cores. Vermelho e âmbar de lanterna automotiva; o branco é levemente
   quente porque farol de LED de caminhão não é branco de escritório. */
const COR_TRAS = 0xff1608;
const COR_LADO = 0xff8f16;
const COR_FRENTE = 0xfff4e2;

/* Uniformes COMPARTILHADOS por todos os materiais de lâmpada: são constantes de
   produto, e três lê `.value` a cada upload, então um objeto só serve a todos. */
const uCorFrente = { value: new THREE.Color(COR_FRENTE) };
const uCorLado = { value: new THREE.Color(COR_LADO) };
const uCorTras = { value: new THREE.Color(COR_TRAS) };

/* ---------------- QUANDO O NOME DECLARA A COR, O NOME MANDA ----------------
   A posição é uma boa regra e ela erra em dois casos, os dois medidos:

     · `lanterna-pequena-cantos-redondo(VERMELHO)` tem 4 peças no rufo TRASEIRO
       (z −7,49) e 4 na ponta DIANTEIRA (z 7,24/7,25). Pela posição as quatro da
       frente sairiam brancas — e o nome diz VERMELHO em maiúsculas. É um
       lanterninha de lente vermelha que o autor reusou na frente: de dia ela é
       vermelha, então acesa ela é vermelha.
     · `lanterna-lateral-chassis` (as 10 de posição da lateral) tem a peça mais
       traseira a 0,29 m da face de trás — dentro da zona vermelha. São cinco
       lanternas idênticas em fila; a quinta virar vermelha seria um defeito
       visível. A PEÇA declara `lateral`, e isso é dado.

   AMBIGUIDADE CAI PARA A POSIÇÃO, e o caso existe: `led-branco-e-red-sinaleira`
   nomeia DUAS cores (é a peça que tem a lanterna vermelha e a luz de ré branca na
   mesma imagem). Nome que declara duas cores não declara nenhuma. */
const COR_POR_NOME: [RegExp, number][] = [
  [/vermelho|(^|[^a-z])red([^a-z]|$)/i, COR_TRAS],
  [/laranja|[âa]mbar|amarel|amber|lateral|sideskirt/i, COR_LADO],
  [/branco|white/i, COR_FRENTE],
];

/** A cor que os nomes declaram, ou 0 quando não declaram UMA só. */
function corDosNomes(nomes: string[]) {
  const achadas = new Set<number>();
  for (const [re, cor] of COR_POR_NOME) {
    if (nomes.some((n) => re.test(n))) achadas.add(cor);
  }
  return achadas.size === 1 ? [...achadas][0] : 0;
}

/**
 * A LUZ DE TRABALHO, que é branca e não sinaliza posição.
 *
 * ⚠️ **`interna` SAIU DAQUI**, e essa palavra era o defeito. O relato foi *"essa
 * da traseira do implemento tambem esta pior"* — as seis delimitadoras ovais do
 * rufo apareciam BRANCAS. A causa: as peças chamam `lanternas-internas-01…06` e o
 * material `lanterna-interna-lente`, e "interna" ali significa **EMBUTIDA**, não
 * "de dentro do baú" — medido, elas estão em x = ±1,21 e y = 4,04, ou seja na
 * QUINA SUPERIOR EXTERNA, ao longo dos 12 m. São as delimitadoras laterais do
 * rufo, e a régua em metros agora as pinta de âmbar.
 */
const INTERNA_RE = /cargo|\bbau\b|baú|work.?light/i;

/**
 * O nome da PEÇA, sem o sufixo que o exportador colou nele.
 *
 * Este exportador nomeia o nó como `<peça>_<material>_<n>` — por exemplo
 * `lanterna-lateral-chassis(leds)-002_lanterna-pisca-quadrado(LEDs)_0`. Testar
 * "pisca" no nome do nó cru daria o MESMO veredito que testar no material, que é
 * exatamente o defeito que se está corrigindo: o nome do material viaja embutido
 * no nome da peça.
 *
 * Tira só o SUFIXO ancorado no fim, nunca todas as ocorrências — em
 * `lanterna-pisca-circular-E_lanterna-pisca-circular_0` a peça REALMENTE se chama
 * pisca, e um `replaceAll` apagaria o sinal que decide o caso.
 *
 * O `(_\d+)*` no fim é o desempate do GLTFLoader: `createUniqueName()` acrescenta
 * `_1`, `_2` … a nomes repetidos, então o sufixo pode chegar como `_0_1`.
 */
function nomeDaPeca(no: string, material: string) {
  if (!material) return no;
  const esc = material.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return no.replace(new RegExp('_' + esc + '(_\\d+)*$', 'i'), '');
}

/**
 * É pisca/freio/ré? — e QUEM decide isso.
 *
 * A regra em uma frase: **quando a peça tem nome próprio de lâmpada, é a PEÇA que
 * diz; senão vale o nome do material.** Os quatro casos do acervo, todos medidos:
 *
 *   peça `lanterna-lateral-chassis(leds)-002`  mat `lanterna-pisca-quadrado(LEDs)`
 *     → a peça é nome de lâmpada e NÃO diz pisca ⇒ ACENDE. São as 10 lanternas de
 *       posição da lateral do implemento, o defeito relatado.
 *   peça `lanterna-pisca-circular-E`            mat `lanterna-pisca-circular`
 *     → a peça é nome de lâmpada e DIZ pisca ⇒ apagada. São os piscas de verdade.
 *   peça `truck_p7`                             mat `truck_mat_0001_pisca`
 *     → a peça não diz nada ⇒ vale o material ⇒ apagada. É o repetidor lateral do
 *       para-lama do VW Titan (z −2,24…−2,16), com o farol a 0,55 m dele.
 *   peça `r_light_p0`                           mat `r_light_mat_0000_animated_blinkers_col`
 *     → a peça é nome de lâmpada (`r_light`) e não diz pisca ⇒ ACENDE. E tem de
 *       acender: nos 6 bakes Scania R/S esse material é a MALHA INTEIRA do
 *       conjunto traseiro (z 3,14…3,20) e o ÚNICO material de luz da traseira —
 *       apagá-lo deixava a traseira daqueles caminhões sem lanterna nenhuma.
 *
 * O caso `r_bumper_p5` (Scania 2024e) não é resolvido aqui e sim por
 * `readmitirPontaEscura()`, que é a rede de segurança do mesmo problema.
 */
function ehIntermitente(mat: string, pecas: string[]) {
  const informativas = pecas.filter((p) => LAMPADA_RE.test(p));
  if (informativas.length) return informativas.some((p) => INTERMITENTE_RE.test(p));
  return INTERMITENTE_RE.test(mat);
}

interface Lampada {
  mat: THREE.MeshStandardMaterial;
  /** Fator que leva `emissiveIntensity` de 1 ao pico. Ver picoDoMapa(). */
  escala: number;
  /** É farol? Difusor branco, sem mapa e com pico próprio. */
  farol?: boolean;
  /** O pico medido do mapa, para o diagnóstico dizer POR QUE a escala é aquela. */
  picoMapa?: number;
  /** Nomes que descrevem esta lâmpada — o material e as peças que a usam. */
  nomes: string[];
  /**
   * Excluída por INTERMITENTE_RE pelo nome do MATERIAL (a peça não opinou).
   * Fica de molho até `readmitirPontaEscura()` decidir, o que só pode acontecer
   * depois de as matrizes de mundo valerem.
   */
  emEspera?: boolean;
  /** Caixa desta lâmpada em mundo, remedida a cada invalidação. */
  z0?: number; z1?: number;
  /** Centro em x e y da mesma caixa — é o que `beams.ts` usa para mirar. */
  xC?: number; yC?: number; xMeia?: number;
  /**
   * A caixa inteira, em mundo.
   *
   * Guardada para TODAS as lâmpadas, e não só para o farol como era: quem decide
   * "isto aqui é um farol?" na segunda regra (a geométrica) precisa da caixa de
   * cada candidata, e ela roda depois desta medida. Uma `Box3` por lâmpada, com
   * 1 a 12 lâmpadas por raiz, não é custo que se pese.
   */
  caixa?: THREE.Box3;
  /** Promovida a farol pela régua geométrica. Só para o diagnóstico dizer isso. */
  farolPorGeometria?: boolean;
  /** Readmitida como marcador DIANTEIRO de implemento. Ver readmitirPontaEscura(). */
  marcadorDianteiro?: boolean;
  /**
   * A PEÇA — não só o material — diz que é intermitente.
   *
   * Separado de `emEspera` porque as duas readmissões tratam os dois casos de
   * forma diferente: a régua da "ponta escura" existe para material de nome
   * errado num conjunto FUNDIDO, onde a peça não opina, e não deve valer quando a
   * peça afirma que aquilo é uma seta. Já a régua do marcador dianteiro vale para
   * os dois, porque ela é geométrica.
   */
  piscaPorPeca?: boolean;
  /** Uniformes próprios: as duas faces da raiz e a cor fixa (preto = posição). */
  uFaces: { value: THREE.Vector2 };
  uFixa: { value: THREE.Color };
  /** A cor que o CENTRO desta lâmpada recebe — só para diagnóstico e bancada. */
  cor?: number;
}

/* ---------------- O PICO DO MAPA, MEDIDO ----------------
   Este bloco existe por causa de uma medição que derrubou a premissa anterior, e
   ela merece estar escrita porque é contraintuitiva.

   O farol do FH continuou APAGADO depois de o material da lente entrar no
   registro. A sonda `tools/studio-bench/checks-farol.mjs` (raycast no pixel do
   farol, com amostra do albedo no UV do acerto) devolveu:

       f_light_chs_mat_0000_lights   uv 0,99 / 0,005   albedo 76,76,76

   Ou seja: **o mapa não é uma textura de lâmpada, é uma PALETA.** A malha do
   farol amostra o CANTO do atlas, onde há um cinza chapado — 76/255 = 0,30 em
   sRGB, **0,073 em linear**. Multiplicando: 0,35 (o emissivo autorado) × 0,073 =
   0,026 de radiância. Não é pouco brilho, é brilho nenhum.

   Então o fator do MAPA é o MÁXIMO da região usada, não a média:

     · pelo MÁXIMO, "a parte mais clara desta lâmpada" chega exatamente ao pico,
       seja ela um cinza chapado de 0,073 (o farol) ou uma lente vermelha de 0,24
       (a lanterna do implemento) — e o que é mais escuro que ela fica
       proporcionalmente mais escuro, que é o que preserva o desenho da peça;
     · pela MÉDIA, a carcaça escura da lanterna entraria na conta e empurraria a
       lente para muito além do pico.

   A REGIÃO USADA sai do atributo `uv` das malhas, não da textura inteira: o atlas
   do FH tem refletores claros que aquela malha nunca amostra, e usar o máximo
   global daria um farol quatro vezes mais escuro que o pedido. */

/** Resolução da leitura. 256² por material é ~30 ms no total e não alisa um LED. */
const AMOSTRA = 256;
/** Teto do fator, para um mapa quase preto não virar uma escala absurda. */
const ESCALA_MAX = 400;

let leitor: CanvasRenderingContext2D | null = null;

/** sRGB de byte para linear — é o que o shader faz ao amostrar um mapa de cor. */
function paraLinear(b: number) {
  const c = b / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Luminância LINEAR máxima do mapa de `mat` dentro do retângulo de UV `r`.
 *
 * @returns 0 quando não há como ler (textura sem imagem, canvas contaminado) —
 *   e aí quem chama cai no fator 1, que é o comportamento de antes.
 */
function picoDoMapa(mat: THREE.MeshStandardMaterial, r: THREE.Box2) {
  const tex = mat.emissiveMap || mat.map;
  const img = tex && (tex.image as (HTMLImageElement | ImageBitmap | null));
  if (!img || !(img as ImageBitmap).width) return 0;
  if (!leitor) {
    const cv = document.createElement('canvas');
    cv.width = AMOSTRA;
    cv.height = AMOSTRA;
    leitor = cv.getContext('2d', { willReadFrequently: true });
  }
  if (!leitor) return 0;
  let dados: Uint8ClampedArray;
  try {
    leitor.clearRect(0, 0, AMOSTRA, AMOSTRA);
    leitor.drawImage(img as CanvasImageSource, 0, 0, AMOSTRA, AMOSTRA);
    dados = leitor.getImageData(0, 0, AMOSTRA, AMOSTRA).data;
  } catch (_) {
    return 0;                        // textura de outra origem: nada a medir
  }
  /* O retângulo com uma folga de um texel de cada lado: um UV exatamente na borda
     de um pixel pode cair do lado de fora por arredondamento, e o caso real é
     justamente esse (o farol amostra 0,99 / 0,005, as duas beiras). */
  const passo = 1 / AMOSTRA;
  const u0 = Math.max(0, r.min.x - passo), u1 = Math.min(1, r.max.x + passo);
  /* `flipY` das texturas do glTF: v = 0 é a BASE da imagem, e o canvas cresce
     para baixo — sem a inversão a amostra vem do lado oposto do atlas. */
  const v0 = Math.max(0, 1 - r.max.y - passo), v1 = Math.min(1, 1 - r.min.y + passo);
  const x0 = Math.floor(u0 * (AMOSTRA - 1)), x1 = Math.ceil(u1 * (AMOSTRA - 1));
  const y0 = Math.floor(v0 * (AMOSTRA - 1)), y1 = Math.ceil(v1 * (AMOSTRA - 1));
  /* DOIS PICOS: o do conteúdo COLORIDO e o geral. Quem manda é o colorido quando
     existe, e a razão é que a luz sai pela LENTE, e é a lente que tem de chegar
     ao alvo. Normalizar pelo pico GERAL de uma imagem que tem lente vermelha
     (0,24) ao lado de refletor branco (1,0) deixaria a lente em um quarto do
     alvo — e foi o que fez a lanterna do implemento ficar creme em vez de
     vermelha. */
  let pico = 0, picoCor = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * AMOSTRA + x) * 4;
      const r = paraLinear(dados[i]);
      const g = paraLinear(dados[i + 1]);
      const b = paraLinear(dados[i + 2]);
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (l > pico) pico = l;
      const hi = Math.max(r, Math.max(g, b));
      const lo = Math.min(r, Math.min(g, b));
      /* 0,35 de saturação separa lente de refletor sem pegar o cinza levemente
         azulado que quase toda textura tem. */
      if (hi > 1e-4 && (hi - lo) / hi > 0.35 && l > picoCor) picoCor = l;
    }
  }
  return picoCor > 1e-4 ? picoCor : pico;
}

/* ---------------- O SHADER ----------------
   Duas injeções, e as duas são obrigatórias juntas: a posição de MUNDO do
   fragmento não existe em `MeshStandardMaterial` sem varying próprio (o
   `<worldpos_vertex>` do three só declara `worldPosition` quando há envmap,
   sombra ou transmissão — não dá para depender dele).

   NADA DE CRASE NESTES BLOCOS — são template strings de JS, e uma crase de
   citação em comentário de GLSL fecha o literal. Já quebrou o bundle três vezes
   neste projeto: o `tsc` acusa TS1005 e a bancada mede o binário velho. */
const PARS_VERT = /* glsl */`
varying vec3 vTsLampW;
`;

/* DEPOIS de `project_vertex` e refazendo a conta em vez de reusar `mvPosition`:
   aquele já está em espaço de VISTA, e voltar dele para mundo custaria a inversa
   da matriz da câmera. `transformed` continua válido — `project_vertex` só lê.
   `instanceMatrix` entra pelo mesmo `#ifdef` que o three usa, e ele é NECESSÁRIO:
   `trailer-assembly.ts` troca as 10 lanternas laterais por um `InstancedMesh` no
   primeiro resize (mesmo material, malha nova), então sem isto a lateral inteira
   passaria a ser colorida pela posição da malha-molde, na origem local. */
const MAIN_VERT = /* glsl */`
#include <project_vertex>
{
  vec4 tsLampP = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    tsLampP = instanceMatrix * tsLampP;
  #endif
  vTsLampW = ( modelMatrix * tsLampP ).xyz;
}
`;

const PARS_FRAG = /* glsl */`
varying vec3 vTsLampW;
uniform vec2 tsLampFaces;      // z da face dianteira, z da face traseira (mundo)
uniform vec3 tsLampFixa;       // cor declarada pelo nome; preto = decidir pela posicao
uniform vec3 tsLampFrente;
uniform vec3 tsLampLado;
uniform vec3 tsLampTras;
`;

/* A CONTA, e por que ela é em METROS e não em fração do comprimento: ver o bloco
   A COR É AUTORADA. `emissive.r` é a intensidade porque `mat.emissive` é BRANCO —
   o uniforme `emissive` do three chega como `material.emissive * emissiveIntensity`
   (WebGLMaterials.refreshUniformsCommon), então com emissivo branco ele é a
   intensidade nos três canais. */
const MAIN_FRAG = /* glsl */`
#include <emissivemap_fragment>
{
  float tsdF = abs( vTsLampW.z - tsLampFaces.x );
  float tsdT = abs( vTsLampW.z - tsLampFaces.y );
  vec3 tsCor = tsLampLado;
  tsCor = mix( tsLampFrente, tsCor, smoothstep( TS_PONTA0, TS_PONTA1, tsdF ) );
  tsCor = mix( tsLampTras, tsCor, smoothstep( TS_PONTA0, TS_PONTA1, tsdT ) );
  tsCor = mix( tsCor, tsLampFixa, step( 0.0001, dot( tsLampFixa, vec3( 1.0 ) ) ) );
  float tsMapa = 1.0;
  #ifdef USE_EMISSIVEMAP
    tsMapa = dot( texture2D( emissiveMap, vEmissiveMapUv ).rgb,
      vec3( 0.2126, 0.7152, 0.0722 ) );
  #endif
  totalEmissiveRadiance = tsCor * emissive.r * tsMapa;
}
`;

/* ⚠️ OS UNIFORMES SÃO DO MATERIAL, NÃO DA `Lampada` — e isto é um conserto.
   ---------------------------------------------------------------------------
   `injetar()` é guardado por um `WeakSet` de MATERIAIS (a injeção não pode
   acontecer duas vezes), mas os uniformes que ela amarra ao shader viviam no
   objeto `Lampada`, que é RECRIADO a cada `registerVehicleLights()`. Basta o
   mesmo material ser registrado uma segunda vez — e isso acontece: o implemento
   e as rodas são carregados uma vez e reaproveitados, e o clone do FBX dos
   Scania compartilha a fonte — para o shader continuar lendo o uniforme do
   registro VELHO, que ninguém mais atualiza.

   O sintoma é silencioso e exatamente o que o dono do produto fotografou: a
   lâmpada acende com as FACES de outra vida. Se aquelas faces tiverem sido
   medidas em espaço local, todo fragmento fica longe das duas pontas e a régua
   devolve ÂMBAR — a traseira laranja e o letreiro do teto dourado.

   Com os uniformes presos ao MATERIAL, um segundo registro reencontra os mesmos
   objetos e a amarração do shader nunca fica órfã. */
const uniformesDoMat = new WeakMap<THREE.Material,
  { uFaces: { value: THREE.Vector2 }; uFixa: { value: THREE.Color } }>();

function uniformesDe(mat: THREE.Material) {
  let u = uniformesDoMat.get(mat);
  if (!u) {
    u = {
      uFaces: { value: new THREE.Vector2(0, 1) },
      uFixa: { value: new THREE.Color(0, 0, 0) },
    };
    uniformesDoMat.set(mat, u);
  }
  return u;
}

const injetados = new WeakSet<THREE.Material>();

/**
 * Instala a cor por fragmento em `mat`. Idempotente, e ENCADEIA — os materiais do
 * veículo já passam por `paint.ts` e por `material-setup.ts`, e sobrescrever o
 * gancho apagaria o que eles fazem sem erro nenhum.
 */
function injetar(l: Lampada) {
  const mat = l.mat;
  if (injetados.has(mat)) return;
  injetados.add(mat);
  const antesCompile = mat.onBeforeCompile;
  const antesChave = mat.customProgramCacheKey;
  const num = (v: number) => v.toFixed(4);
  mat.onBeforeCompile = function (shader, renderer) {
    if (antesCompile) antesCompile.call(this, shader, renderer);
    shader.uniforms.tsLampFaces = l.uFaces;
    shader.uniforms.tsLampFixa = l.uFixa;
    shader.uniforms.tsLampFrente = uCorFrente;
    shader.uniforms.tsLampLado = uCorLado;
    shader.uniforms.tsLampTras = uCorTras;
    shader.vertexShader = PARS_VERT + shader.vertexShader
      .replace('#include <project_vertex>', MAIN_VERT);
    shader.fragmentShader = PARS_FRAG + shader.fragmentShader
      .replace('#include <emissivemap_fragment>', MAIN_FRAG)
      .replace(/TS_PONTA0/g, num(PONTA_M0))
      .replace(/TS_PONTA1/g, num(PONTA_M1));
  };
  /* Sem isto o three serve o programa CACHEADO, sem a injeção, para o segundo
     material em diante — a chave de cache dele não conhece onBeforeCompile. */
  mat.customProgramCacheKey = function () {
    return 'ts-lamp-v4|' + (antesChave ? antesChave.call(this) : '');
  };
  mat.needsUpdate = true;
}

/* POR RAIZ, e a razão é o descarte. Cavalo e implemento são trocados a cada
   clique do seletor, e um registro global viraria uma lista crescente de
   materiais mortos recebendo escrita a cada mudança de rig. Chaveado pela raiz,
   `setVehicleLightsLevel()` descarta sozinho quem saiu da cena — um `Object3D`
   removido tem `parent` null, e isso não depende de ninguém se lembrar de avisar. */
interface Registro {
  lista: Lampada[];
  /** A admissão (intermitentes, cor fixa) já foi resolvida? Roda uma vez. */
  admitido: boolean;
  /** As faces desta raiz, em mundo. */
  z0: number; z1: number;
  /** Esta raiz usa a convenção `_mat_NNNN_` dos bakes de cavalo? */
  ehBake: boolean;
  /**
   * Onde os HALOS desta raiz vão, em mundo — um por aglomerado de lâmpada.
   *
   * Reunidos na mesma varredura que mede as caixas, porque é a única que já
   * percorre exatamente estas malhas. Ver `sitiosDaMalha()`.
   */
  halos: HaloSite[];
}
const porRaiz = new Map<THREE.Object3D, Registro>();
let nivel = 0;

/** Raízes cuja medida está velha — remedidas na próxima escrita. */
const aMedir = new Set<THREE.Object3D>();

const _c = new THREE.Color();

/** Luminância relativa, para saber se o bake declarou emissivo. */
function lum(c: THREE.Color) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/**
 * Acha as luzes de `root` e as deixa APAGADAS.
 *
 * Chamado por `setupCommon()`, que já roda em toda raiz de veículo (cavalo,
 * implemento, Thermo King, roda avulsa). Idempotente por raiz.
 *
 * APAGADAS é a metade que também é uma correção: os bakes chegam com
 * `emissiveIntensity` 1 e emissivo 0,35, ou seja as lanternas de todos os 49
 * chassis brilhavam de leve ao MEIO-DIA — invisível contra um HDRI de sol, e
 * visível na sombra do baú. Uma lanterna acesa a pino é um erro de continuidade.
 *
 * ⚠️ **NADA DE POSIÇÃO AQUI.** Roda dentro de `setupCommon()`, que é chamado
 * assim que o `.glb` é parseado — ANTES do engate —, e naquele instante
 * `matrixWorld` ainda é identidade: `Box3.setFromObject()` devolveria a caixa
 * LOCAL, e no espaço local do implemento as portas ficam no MENOR z. Foi assim
 * que as lanternas traseiras saíram com `zRel 0,02` e foram pintadas de branco.
 * Tudo que depende de onde a peça está mora em `medirRaiz()`.
 */
export function registerVehicleLights(root: THREE.Object3D | null | undefined) {
  if (!root) return 0;
  const lista: Lampada[] = [];
  const apagadas: string[] = [];
  const vistos = new Set<THREE.Material>();
  /* Retângulo de UV usado por material — acumulado na varredura, porque o pico do
     mapa só faz sentido dentro do que as malhas de fato amostram. */
  const uvPorMat = new Map<THREE.Material, THREE.Box2>();
  /* Os nomes das PEÇAS que usam cada material. É o mapa que faltava, e é ele que
     separa o pisca de verdade da lanterna de posição — ver ehIntermitente(). */
  const pecasPorMat = new Map<THREE.Material, Set<string>>();
  const _uv = new THREE.Vector2();
  const marcarUV = (mat: THREE.Material, mesh: THREE.Mesh) => {
    const a = mesh.geometry && mesh.geometry.getAttribute('uv');
    if (!a) return;
    let r = uvPorMat.get(mat);
    if (!r) { r = new THREE.Box2(); r.makeEmpty(); uvPorMat.set(mat, r); }
    /* Amostrado, não completo: 1 024 vértices dão o retângulo com folga de sobra
       e uma peça de 80 k vértices não custa 80 k iterações por material. */
    const passo = Math.max(1, Math.floor(a.count / 1024));
    for (let i = 0; i < a.count; i += passo) {
      r.expandByPoint(_uv.set(a.getX(i), a.getY(i)));
    }
  };

  /* PRIMEIRA PASSADA: quem usa o quê. Separada da decisão porque o nome da peça
     de um material só fica completo depois de ver TODAS as malhas dele — e o
     caso que obriga a isso é justamente o das dez lanternas laterais, que só se
     distinguem do pisca pelo conjunto de peças que as usa. */
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat) continue;
      let s = pecasPorMat.get(mat);
      if (!s) { s = new Set(); pecasPorMat.set(mat, s); }
      s.add(nomeDaPeca(mesh.name || '', mat.name || ''));
      marcarUV(mat, mesh);
    }
  });

  /* SEGUNDA PASSADA: a decisão, uma vez por material. */
  for (const [m, pecas] of pecasPorMat) {
    const mat = m as THREE.MeshStandardMaterial;
    if (vistos.has(mat)) continue;
    vistos.add(mat);
    const nome = mat.name || '';
    if (INTERIOR_RE.test(nome)) continue;
    /* `emissive` só existe em Standard/Physical; um Basic não tem o slot e
       escrever nele seria uma propriedade morta. */
    if (!mat.emissive) continue;
    /* A CAPA DE ACRÍLICO FICA DE FORA, e o teste é o primeiro de todos agora: ela
       é a tampa SOBRE a lente, e acendê-la poria a luz na frente do vidro em vez
       de dentro dele. Antes isto morava só dentro do ramo da lâmpada comum, e
       bastava um caminho novo (o farol, ou a readmissão) para vazar. */
    if (mat.transparent && (mat.opacity ?? 1) < 0.5) continue;

    const suf = sufixoDe(nome);
    const listaNomes = [nome, ...pecas].filter(Boolean);
    if (NAO_LAMPADA_RE.test(suf)) continue;

    let escala = 0;
    const ehFarol = LENTE_BRANCA_RE.test(suf) || PECA_FAROL_RE.test(nome);
    if (ehFarol) {
      /* DIFUSOR: emite uniforme, e o mapa é a aparência APAGADA dele — o albedo
         de uma lente é como ela se vê de dia, e um difusor emite parelho de
         qualquer forma. Medido: no FH a lente amostra um cinza chapado de 0,073
         linear no canto do atlas, o que dava 0,026 de radiância. */
      mat.emissiveMap = null;
      escala = PICO_FAROL;
      mat.needsUpdate = true;
    } else if ((lum(mat.emissive) > 1e-4 || LAMPADA_RE.test(suf))
      && (mat.emissiveMap || mat.map)) {
      /* OS DOIS SINAIS CONTINUAM VALENDO — emissivo autorado pelo bake OU nome
         de lâmpada —, e é a união deles que dá cobertura: há material de lâmpada
         que o bake declarou e cujo nome não diz nada (`cabin_mat_0006_color` do
         MAN, `truck_mat_0001_color` do Iveco Stralis, e são os ÚNICOS materiais
         de luz externa daqueles bakes) e há o contrário (as oito lanternas do
         implemento, com emissivo zero). */
      if (!mat.emissiveMap) mat.emissiveMap = mat.map;
      escala = PICO;
      mat.needsUpdate = true;
    }
    if (!escala) continue;

    const u = uniformesDe(mat);
    const l: Lampada = {
      mat, escala, farol: ehFarol, nomes: listaNomes,
      uFaces: u.uFaces, uFixa: u.uFixa,
    };
    /* PISCA, FREIO E RÉ. Quem decide é a PEÇA quando ela tem nome próprio de
       lâmpada — ver ehIntermitente(). Os dois casos vão de molho, e NÃO se
       descarta aqui: `readmitirPontaEscura()` roda depois, já com as matrizes de
       mundo valendo, e é ela que sabe se a lâmpada é a única daquela ponta ou se
       está na face dianteira de um implemento (que não tem seta dianteira). Uma
       primeira versão descartava na hora o que a peça acusava, e por isso a
       lanterna redonda da frente do baú continuou apagada mesmo depois da regra
       que existia para acendê-la. */
    if (ehIntermitente(nome, [...pecas])) {
      l.emEspera = true;
      l.piscaPorPeca = [...pecas].some((p) => LAMPADA_RE.test(p));
    }

    /* Sem mapa emissivo não há região a medir: o difusor já emite uniforme e a
       escala dele é o pico direto. */
    if (!mat.emissiveMap) l.picoMapa = 1;
    else {
      const r = uvPorMat.get(mat);
      const pico = r && !r.isEmpty() ? picoDoMapa(mat, r) : 0;
      if (pico > 1e-5) l.escala = Math.min(ESCALA_MAX, l.escala / pico);
      l.picoMapa = pico;
    }

    injetar(l);
    /* BRANCO, sempre: a cor sai do shader, e o uniforme `emissive` do three passa
       a carregar só a INTENSIDADE. Ver MAIN_FRAG. */
    mat.emissive.setRGB(1, 1, 1);
    mat.emissiveIntensity = 0;
    lista.push(l);
  }

  if (apagadas.length) {
    console.info('[luzes] apagadas por serem intermitentes: ' + apagadas.join(', '));
  }
  /* O relatório real sai de `readmitirPontaEscura()`, que roda depois — aqui
     ainda não se sabe onde nada está. */
  if (!lista.length) return 0;
  /* A CAPA EXTERIOR, se esta raiz tiver uma. Aqui, e não em `setupCommon()`,
     porque quem sabe onde o farol está é este módulo — e sem farol não há o que
     revelar. Ver vehicle/headlight-cover.ts. */
  /* A CAPA NÃO É REGISTRADA AQUI, e a mudança é de MOMENTO: quem decide se um
     material transparente é capa de farol é ele CRUZAR a caixa do conjunto
     óptico, e aqui as matrizes de mundo ainda são identidade. Quem chama é
     `medirRaiz()`. Ver o bloco QUEM É A CAPA em `headlight-cover.ts`. */
  /* A CONVENÇÃO DO BAKE, decidida aqui porque é aqui que se vê todo material da
     raiz. É ela que autoriza a promoção geométrica a farol — e o que a mantém
     fora do implemento, cujos materiais têm nome livre. */
  const ehBake = [...pecasPorMat.keys()].some((m) => CONVENCAO_BAKE_RE.test(m.name || ''));
  porRaiz.set(root, { lista, admitido: false, z0: 0, z1: 1, ehBake, halos: [] });
  aMedir.add(root);
  /* ⚠️ **NADA DE MEDIR AQUI, E ESTA LINHA JÁ ERROU.** Havia um
     `if (nivel > 0) { medirRaiz(root, ...) }` neste ponto, para que um implemento
     engatado às 20h nascesse aceso. Ele contradizia o aviso em caixa alta do
     cabeçalho desta função e produzia o defeito mais caro desta rodada: medido em
     `models.ts`, `setupCommon(cab)` roda ENTRE o `setRigPlacement(false)` e o
     `state.cabGroup.add(cab)`, ou seja com a raiz SEM PAI e o rig na identidade.
     As faces saíam em espaço local (z −3,13…2,78 no FH) e o shader passava a
     comparar a posição de MUNDO do fragmento (z ≈ 5,2 na traseira) contra elas:
     tudo longe das duas pontas, tudo ÂMBAR.

     Quem acende um implemento recém-engatado é o gancho de colocação — ver
     `invalidateVehicleLightBounds()`, chamado por `models.ts` assim que
     `setRigPlacement(true)` devolve o conjunto ao lugar dele. Ali as matrizes
     valem, e é a única hora em que valem. */
  if (nivel > 0) escrever(porRaiz.get(root)!);
  return lista.length;
}

/* ---------------- A MEDIDA, DEPOIS QUE AS MATRIZES VALEM ----------------
   O DATUM SÃO AS PRÓPRIAS LÂMPADAS, e não a caixa da raiz. Três razões, as três
   medidas:

     1. A caixa da raiz é CACHEADA e fica velha. `Box3.setFromObject()` usa
        `geometry.boundingBox` (e `InstancedMesh.boundingBox`), e nenhum dos dois
        é invalidado quando `TrailerAssembly.set()` reescreve os vértices — um
        implemento redimensionado de 12 para 15 m continuaria medido a 12, e as
        lanternas traseiras cairiam a 3 m da face "de trás", ou seja âmbar.
        Invalidar aqueles caches na mão custaria recomputar a caixa de 2 151
        malhas e ~2,7 M vértices por resize, e mexeria em cache que é do three.
     2. O extremo das lâmpadas É o extremo do veículo, para o que importa. Medido:
        no implemento as lâmpadas vão de −7,49 a 7,25 e a caixa da raiz de −7,50 a
        7,25 — 1 cm de diferença. No MAN TGX o material de luz cobre −3,06…3,84
        contra −3,07…3,85 da raiz.
     3. E dá uma propriedade que a caixa da raiz não dá: a lâmpada MAIS DIANTEIRA
        e a MAIS TRASEIRA caem exatamente sobre as faces, então elas são sempre
        classificadas como frente e traseira. Um para-choque ou um para-lama que
        avance além do farol não empurra mais o farol para fora da zona branca.

   Custo: uma varredura da árvore (barata, sem geometria) mais a caixa das poucas
   malhas de lâmpada. No implemento são ~40 malhas de 34 a 7 468 vértices; nos
   cavalos, de 1 a 6 malhas por raiz. */
const _cx = new THREE.Box3();
const _cxFarol = new THREE.Box3();

/* ---------------- OS SÍTIOS DE HALO, DA CAIXA DE CADA NÓ ----------------
   O halo de `vehicle/halo.ts` precisa saber onde cada LANTERNA está — não onde
   cada MATERIAL está, e a diferença é a razão de este bloco existir. Medido, os
   três casos que quebram o atalho "um halo por material":

     · `r_bumper_mat_0003_r_lights` do FH é UMA primitiva com as DUAS lanternas
       traseiras (x −1,21…1,20). Um halo no centro da caixa poria o brilho no meio
       do para-choque, entre as duas lâmpadas, onde não há lâmpada nenhuma.
     · `sideskirt_mat_0001_pos_light_dif` é UMA primitiva com a fileira inteira da
       saia (z 1,35…3,70). Um halo só seria uma mancha de 2,35 m.
     · e no implemento `lanterna-pisca-quadrado(LEDs)` vira um `InstancedMesh` de
       10 no primeiro resize (ver `trailer-assembly.ts`), então nem malha por
       lâmpada existe.

   ⚠️ **A PRIMEIRA VERSÃO DISTO AGRUPAVA VÉRTICES NUMA GRADE, E FOI UM DESASTRE
   MEDIDO.** Ela devolveu **98 sítios** num comboio — dezenas deles a poucos
   centímetros uns dos outros. Somando em `AdditiveBlending`, halos empilhados
   saturam: o relato foi *"as luzes parecem estar flutuando"*, com bolas BRANCAS
   (a soma estourando os três canais) sobre o trem de pouso e a escada da cabine,
   e a lanterna lateral do implemento *"indo ate o frame metalico superior"*.
   Amostrar com passo grande ainda por cima punha o centróide em lugar nenhum.

   Então nada de vértice. A caixa de cada NÓ já basta, e é exata:

     · UM NÓ QUE ATRAVESSA A LINHA DE CENTRO são DUAS lanternas, uma por lado —
       um caminhão é simétrico, e essa é a única leitura possível de uma caixa que
       vai de −1,21 a 1,20. Cada halo vai encostado na borda EXTERNA, recuado do
       próprio raio, porque é ali que a lâmpada está;
     · UM NÓ COMPRIDO é uma FILEIRA, e recebe halos distribuídos ao longo do eixo
       maior, espaçados o bastante para não se somarem;
     · e o RAIO sai da segunda maior medida da caixa, nunca da maior: numa
       lanterna de 2,41 × 0,13 × 0,08 m a maior é o vão entre as duas lâmpadas, e
       usá-la daria um halo de 1,2 m.

   ⚠️ **E O QUE É FUNDIDO CONTINUA FORA.** Nos 12 bakes em que um único material
   cobre o caminhão inteiro não há informação nenhuma sobre onde a lâmpada está —
   `cabin_mat_0003_color` do FH16 2009 mede 2,46 × 3,18 × 6,01 m. O corte é ser
   GORDO NOS TRÊS EIXOS: toda lanterna de verdade é fina em pelo menos um. */

/* ⚠️ **NEM A CAIXA DO NÓ SERVE, E ESTE É O ERRO QUE PRODUZIU "LUZES FLUTUANDO".**
   A versão anterior punha o halo no CENTRO da caixa de cada nó. Medido no Scania
   S 2016, o nó `cabin_p9` (material `cabin_mat_0009_lamps`) tem caixa
   **y 0,50 … 3,40** — 2,9 m de altura, porque ele junta numa primitiva só as
   lanternas do para-choque E as delimitadoras do teto. O centro dela é y = 1,95 m:
   uma luz boiando na frente do para-brisa, presa a nada. Era isso na foto.

   Caixa é o envelope, não o conteúdo. O conteúdo tem de vir dos VÉRTICES — e da
   primeira vez isso também falhou, por um motivo diferente e igualmente concreto:
   eu emitia um halo POR CÉLULA da grade, o que dava 98 halos sobrepostos que se
   somavam até o branco. A correção não era abandonar os vértices, era AGLOMERAR:

     1. amostra a posição e leva para mundo;
     2. joga numa grade fina e faz um preenchimento por inundação nas 26 vizinhas,
        o que transforma as células num punhado de PEÇAS conectadas — uma peça é
        uma lanterna;
     3. UM halo por peça, no centróide dela (não no centro da caixa), com o raio
        tirado da própria peça;
     4. e uma peça comprida demais para ser uma lanterna — a fileira da saia tem
        2,35 m — é fatiada ao longo do eixo maior.

   O resultado é verificável, e a bancada verifica: `checks-noite.mjs` mede a
   distância de cada halo ao vértice de lâmpada mais próximo. Se algum estiver
   flutuando, aquele número acusa. */
const HALO_CELULA_M = 0.11;
/** Vértices amostrados por malha. Uma lanterna do acervo tem 34 a 7 468. */
const HALO_AMOSTRA = 4000;
/** Acima disto, nos TRÊS eixos, a malha é conjunto fundido e não lanterna. */
const HALO_FINO_M = 0.60;
/** Raio do halo, dos limites da segunda maior medida da PEÇA. */
const HALO_RAIO_MIN = 0.045, HALO_RAIO_MAX_SITIO = 0.16;
/** Peça mais comprida que isto é fileira, e vira várias. */
const HALO_PECA_MAX_M = 0.85;
/** Passo da fatia de uma fileira. */
const HALO_FATIA_M = 0.55;
/** Teto por malha e por raiz, para uma malha patológica não virar centenas. */
const HALO_PECAS_MAX = 16, HALO_SITIOS_MAX = 64;

const _vHalo = new THREE.Vector3();
const _mHalo = new THREE.Matrix4();
const _mLocal = new THREE.Matrix4();
const _cxRaiz = new THREE.Box3();
/** Folga da caixa do veículo para um halo ainda contar como "em cima dele". */
const HALO_FORA_M = 0.25;

interface Celula {
  sx: number; sy: number; sz: number; n: number;
  lo: THREE.Vector3; hi: THREE.Vector3;
  peca: number;
}

/**
 * Os sítios de `mesh`, em mundo — um por aglomerado de vértices.
 *
 * @param destino recebe os sítios; a cor é escrita depois, quando ela for
 *   conhecida (só `resolverCorFixa()`/`corEmZ()` sabem).
 */
function sitiosDaMalha(mesh: THREE.Mesh, cx: THREE.Box3, destino: HaloSite[]) {
  if (destino.length >= HALO_SITIOS_MAX) return;
  const e = [cx.max.x - cx.min.x, cx.max.y - cx.min.y, cx.max.z - cx.min.z];
  if (!(e[0] >= 0)) return;
  /* GORDO NOS TRÊS EIXOS é conjunto fundido — `cabin_mat_0003_color` do FH16 2009
     mede 2,46 x 3,18 x 6,01 m e é a carroceria inteira. Ali não há informação
     sobre onde a lâmpada está, e a resposta honesta é halo nenhum. */
  if (e[0] > HALO_FINO_M && e[1] > HALO_FINO_M && e[2] > HALO_FINO_M) return;

  const pos = mesh.geometry.getAttribute('position');
  if (!pos || !pos.count) return;
  const inst = mesh as THREE.InstancedMesh;
  const nInst = inst.isInstancedMesh ? Math.min(inst.count, 40) : 1;
  const passo = Math.max(1, Math.ceil((pos.count * nInst) / HALO_AMOSTRA));

  /* ---- 1. as células ocupadas ---- */
  const celulas = new Map<string, Celula>();
  const chave = (i: number, j: number, k: number) => i + '|' + j + '|' + k;
  for (let inst_i = 0; inst_i < nInst; inst_i++) {
    _mHalo.copy(mesh.matrixWorld);
    if (inst.isInstancedMesh) {
      inst.getMatrixAt(inst_i, _mLocal);
      _mHalo.multiply(_mLocal);
    }
    for (let v = 0; v < pos.count; v += passo) {
      _vHalo.fromBufferAttribute(pos, v).applyMatrix4(_mHalo);
      const i = Math.floor(_vHalo.x / HALO_CELULA_M);
      const j = Math.floor(_vHalo.y / HALO_CELULA_M);
      const k = Math.floor(_vHalo.z / HALO_CELULA_M);
      const c = celulas.get(chave(i, j, k));
      if (c) {
        c.sx += _vHalo.x; c.sy += _vHalo.y; c.sz += _vHalo.z; c.n++;
        c.lo.min(_vHalo); c.hi.max(_vHalo);
      } else {
        celulas.set(chave(i, j, k), {
          sx: _vHalo.x, sy: _vHalo.y, sz: _vHalo.z, n: 1,
          lo: _vHalo.clone(), hi: _vHalo.clone(), peca: -1,
        });
      }
    }
  }
  if (!celulas.size) return;

  /* ---- 2. as PEÇAS, por inundação nas 26 vizinhas ---- */
  const pecas: Celula[][] = [];
  const fila: string[] = [];
  for (const [k0, c0] of celulas) {
    if (c0.peca >= 0) continue;
    if (pecas.length >= HALO_PECAS_MAX) break;
    const id = pecas.length;
    const grupo: Celula[] = [];
    pecas.push(grupo);
    c0.peca = id;
    fila.length = 0;
    fila.push(k0);
    while (fila.length) {
      const k = fila.pop()!;
      const c = celulas.get(k)!;
      grupo.push(c);
      const [i, j, l] = k.split('|').map(Number);
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          for (let dl = -1; dl <= 1; dl++) {
            if (!di && !dj && !dl) continue;
            const kv = chave(i + di, j + dj, l + dl);
            const cv = celulas.get(kv);
            if (!cv || cv.peca >= 0) continue;
            cv.peca = id;
            fila.push(kv);
          }
        }
      }
    }
  }

  /* ---- 3. um halo por peça, fatiando o que for fileira ---- */
  for (const grupo of pecas) {
    if (destino.length >= HALO_SITIOS_MAX) return;
    let lo = new THREE.Vector3(Infinity, Infinity, Infinity);
    let hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const c of grupo) { lo.min(c.lo); hi.max(c.hi); }
    const ext = [hi.x - lo.x, hi.y - lo.y, hi.z - lo.z];
    const eixo = ext[0] >= ext[1] && ext[0] >= ext[2] ? 0 : (ext[1] >= ext[2] ? 1 : 2);
    const comprimento = ext[eixo];
    const nFatias = comprimento > HALO_PECA_MAX_M
      ? Math.min(8, Math.max(2, Math.round(comprimento / HALO_FATIA_M))) : 1;
    const base = eixo === 0 ? lo.x : eixo === 1 ? lo.y : lo.z;
    for (let f = 0; f < nFatias; f++) {
      if (destino.length >= HALO_SITIOS_MAX) return;
      let sx = 0, sy = 0, sz = 0, n = 0;
      const flo = new THREE.Vector3(Infinity, Infinity, Infinity);
      const fhi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      for (const c of grupo) {
        const m = [c.sx / c.n, c.sy / c.n, c.sz / c.n][eixo];
        const idx = nFatias === 1 ? 0
          : Math.min(nFatias - 1, Math.floor(((m - base) / comprimento) * nFatias));
        if (idx !== f) continue;
        sx += c.sx; sy += c.sy; sz += c.sz; n += c.n;
        flo.min(c.lo); fhi.max(c.hi);
      }
      if (!n) continue;
      /* DUAS MEDIDAS, e não uma: a HORIZONTAL (a maior entre x e z, porque a
         lente pode estar virada para a lateral ou para a traseira) e a VERTICAL.
         Ver `HaloSite.rx/ry` em halo.ts para o defeito que isto conserta — um
         raio único tirado da segunda maior medida deixava o halo mais estreito
         que a própria lanterna. */
      const eh = Math.max(fhi.x - flo.x, fhi.z - flo.z);
      const ev = fhi.y - flo.y;
      const rx = THREE.MathUtils.clamp(eh / 2, HALO_RAIO_MIN, HALO_RAIO_MAX_SITIO);
      /* E o halo nunca é mais fino que 40 % da largura dele: uma lente de 8 cm de
         altura por 50 de comprimento daria um risco, e risco não lê como luz. */
      const ry = THREE.MathUtils.clamp(Math.max(ev / 2, rx * 0.40),
        HALO_RAIO_MIN, HALO_RAIO_MAX_SITIO);
      destino.push({
        x: sx / n, y: sy / n, z: sz / n, rx, ry,
        cor: 0xffffff,
        de: (mesh.material && !Array.isArray(mesh.material)
          ? (mesh.material as THREE.Material).name : '') || mesh.name || '?',
      });
    }
  }
}

function medirRaiz(root: THREE.Object3D, reg: Registro) {
  const alvo = new Map<THREE.Material, Lampada>();
  const caixas = new Map<Lampada, THREE.Box3>();
  for (const l of reg.lista) {
    alvo.set(l.mat, l);
    l.z0 = Infinity; l.z1 = -Infinity;
    caixas.set(l, new THREE.Box3().makeEmpty());
  }
  /* Os halos são refeitos a cada medida: um implemento alongado move as
     lanternas, e um halo parado no lugar antigo é pior que halo nenhum. */
  const halos: { sitio: HaloSite; dono: Lampada }[] = [];

  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let toca = false;
    for (const m of mats) if (m && alvo.has(m)) toca = true;
    if (!toca) return;
    /* Os caches são NOSSOS de zerar aqui: estas malhas são as que a montagem do
       implemento reescreve, e uma caixa velha delas é exatamente o defeito que o
       bloco acima descreve. Fora daqui nada é tocado. */
    mesh.geometry.boundingBox = null;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      (mesh as THREE.InstancedMesh).boundingBox = null;
    }
    _cx.makeEmpty();
    _cx.expandByObject(mesh);
    if (_cx.isEmpty()) return;
    let dono: Lampada | null = null;
    for (const m of mats) {
      const l = m && alvo.get(m);
      if (!l) continue;
      l.z0 = Math.min(l.z0!, _cx.min.z);
      l.z1 = Math.max(l.z1!, _cx.max.z);
      caixas.get(l)!.union(_cx);
      if (!dono) dono = l;
    }
    /* O DONO do halo é a PRIMEIRA lâmpada da malha, e é dele que sai a cor. Uma
       malha com dois materiais de lâmpada não existe no acervo — o glTF dá uma
       primitiva por material —, então "a primeira" é "a única". */
    if (!dono) return;
    const soDela: HaloSite[] = [];
    sitiosDaMalha(mesh, _cx, soDela);
    for (const s of soDela) halos.push({ sitio: s, dono });
  });
  for (const [l, cx] of caixas) {
    if (cx.isEmpty()) continue;
    l.xC = (cx.min.x + cx.max.x) / 2;
    l.yC = (cx.min.y + cx.max.y) / 2;
    l.xMeia = (cx.max.x - cx.min.x) / 2;
    l.caixa = (l.caixa || new THREE.Box3()).copy(cx);
  }

  /* ⚠️ A READMISSÃO VEM ANTES DAS FACES, e a ordem inversa é um defeito silencioso
     que a bancada não pegaria (ela carrega o Volvo, que não tem o caso).
     `readmitirPontaEscura()` só precisa do z de cada lâmpada, que acabou de ser
     medido — mas quem ela devolve MUDA a face. No Scania R/S 2016 a lâmpada
     devolvida é o conjunto traseiro inteiro em z 3,14…3,20 e a acesa mais
     traseira que sobrava era o `sideskirt` em 0,24: com as faces calculadas antes,
     a traseira readmitida ficaria a 2,9 m da "face de trás" e sairia ÂMBAR — ou
     seja a correção entregaria o defeito que ela existe para corrigir. */
  if (!reg.admitido) readmitirPontaEscura(reg);

  /* As faces da raiz: o extremo do conjunto de lâmpadas. Quem não foi encontrado
     em malha nenhuma (material órfão) fica de fora da conta e recebe as faces do
     resto — não há posição a inventar para ele. */
  let z0 = Infinity, z1 = -Infinity;
  for (const l of reg.lista) {
    if (!Number.isFinite(l.z0!)) continue;
    z0 = Math.min(z0, l.z0!);
    z1 = Math.max(z1, l.z1!);
  }
  if (!Number.isFinite(z0)) { z0 = 0; z1 = 1; }
  reg.z0 = z0;
  reg.z1 = z1;

  /* ⚠️ A PROMOÇÃO GEOMÉTRICA VEM ANTES DE `resolverCorFixa()`, e a ordem é dura:
     é `resolverCorFixa()` que escreve COR_FRENTE no farol, então promover depois
     dela deixaria o farol novo decidindo a cor pela posição — branco por sorte na
     maioria e âmbar em qualquer bake cujo conjunto óptico não encoste na face. */
  if (!reg.admitido) promoverFarolGeometrico(reg);

  if (!reg.admitido) { resolverCorFixa(reg); reg.admitido = true; }

  /* A CAPA DO FAROL. A união das caixas de todo material de farol desta raiz —
     união, e não a primeira, porque no FH o conjunto são DOIS materiais (o
     refletor e a lente branca) e a capa cobre os dois.
     E o REGISTRO acontece aqui, não em `registerVehicleLights()`: quem é capa é
     decidido por cruzar esta caixa, e ela só existe depois de medir. Ver o bloco
     QUEM É A CAPA em `headlight-cover.ts`. */
  _cxFarol.makeEmpty();
  for (const l of reg.lista) if (l.farol && l.caixa) _cxFarol.union(l.caixa);
  const temCaixa = !_cxFarol.isEmpty();
  if (temCaixa) registerHeadlightCover(root, _cxFarol);
  setHeadlightCoverBox(root, temCaixa ? _cxFarol : null);

  for (const l of reg.lista) {
    l.uFaces.value.set(z0, z1);
    l.cor = corDaLampada(l, reg);
  }

  /* E a cor dos halos, agora que ela existe. `corDaLampada()` devolve a cor do
     CENTRO da lâmpada; para um material que muda de cor ao longo do veículo isso
     é uma aproximação, e é a certa aqui — o halo é uma mancha difusa de 20 cm,
     não a lente. */
  /* ⚠️ E A REDE DE SEGURANÇA: **um halo fora da caixa do veículo é, por
     definição, uma luz flutuando.** Ela existe por um caso que a bancada pegou
     UMA vez e não reproduziu: um sítio em (1,14 · 4,14 · 1,34), a 1,81 m de
     qualquer lâmpada e 1,4 m À FRENTE da parede do baú. A explicação provável é
     a armadilha já conhecida deste motor — `InstancedMesh` nasce em IDENTIDADE
     (three r155+), então uma medida que caia entre a troca de malha do
     `trailer-assembly.ts` e a escrita das matrizes lê as dez lanternas da lateral
     na origem local. Perseguir a corrida custaria mais do que barrar o resultado
     dela, e barrar é verificável: o halo TEM de estar sobre o veículo. */
  _cxRaiz.setFromObject(root);
  _cxRaiz.expandByScalar(HALO_FORA_M);
  const dentro = halos.filter(({ sitio }) =>
    _cxRaiz.containsPoint(_vHalo.set(sitio.x, sitio.y, sitio.z)));
  if (dentro.length !== halos.length) {
    console.info('[luzes] ' + (halos.length - dentro.length) + ' halo(s) descartado(s)'
      + ' por caírem fora da caixa do veículo — ver a rede de segurança em medirRaiz().');
  }
  reg.halos = dentro.map(({ sitio, dono }) => {
    sitio.cor = corEmZ(dono, reg, sitio.z);
    return sitio;
  });
}

/**
 * Promove a farol o conjunto óptico dianteiro quando o bake não nomeou nenhum.
 *
 * Roda UMA vez por raiz, dentro de `medirRaiz()` e só depois das faces — ela
 * precisa saber onde é a frente. Ver o bloco `E QUANDO O BAKE NÃO DECLARA FAROL`
 * para os quatro testes e a medida de cada um.
 *
 * O que ela faz com quem passa é exatamente o que `registerVehicleLights()` faria
 * se o nome tivesse casado: descarta o mapa (a lente é difusor, e o albedo dela é
 * a aparência APAGADA) e sobe a escala para `PICO_FAROL`. A CAPA vem de graça —
 * quem a registra é `medirRaiz()`, logo abaixo, a partir da caixa que esta função
 * acabou de tornar existente.
 */
function promoverFarolGeometrico(reg: Registro) {
  if (!reg.ehBake) return;
  if (reg.lista.some((l) => l.farol)) return;
  const vao = Math.max(0.01, reg.z1 - reg.z0);
  let escolhida: Lampada | null = null;
  let melhor = Infinity;
  for (const l of reg.lista) {
    if (!l.caixa || !Number.isFinite(l.z0!)) continue;
    const faixa = l.z1! - l.z0!;
    if (faixa > FAROL_GEO_FAIXA_M || faixa > vao * FAROL_GEO_FAIXA_FRACAO) continue;
    const d = Math.abs(l.z0! - reg.z0);
    if (d > FAROL_GEO_FRENTE_M) continue;
    const y = l.yC ?? 0;
    if (y < FAROL_GEO_Y_MIN || y > FAROL_GEO_Y_MAX) continue;
    if (d < melhor) { melhor = d; escolhida = l; }
  }
  if (!escolhida) return;
  escolhida.farol = true;
  escolhida.farolPorGeometria = true;
  escolhida.mat.emissiveMap = null;
  escolhida.escala = PICO_FAROL;
  escolhida.picoMapa = 1;
  escolhida.mat.needsUpdate = true;
  console.info('[luzes] "' + (escolhida.mat.name || '?') + '" promovido a FAROL'
    + ' pela geometria: a ' + melhor.toFixed(2) + ' m da face dianteira, a'
    + ' ' + (escolhida.yC ?? 0).toFixed(2) + ' m do chão, faixa de'
    + ' ' + (escolhida.z1! - escolhida.z0!).toFixed(2) + ' m (o bake não nomeou nenhum).');
}

/**
 * DEVOLVE quem foi excluído por nome de material e é a ÚNICA luz daquela ponta.
 *
 * O caso que obriga a isto está no Scania S 2024e: `r_bumper_mat_0005_animated_blinkers_col`
 * é a malha inteira do conjunto traseiro (z 3,22…3,29) e a peça se chama
 * `r_bumper_p5`, que não opina. Excluído pelo nome do material, a traseira daquele
 * caminhão ficava SEM lanterna nenhuma — e trocar uma seta acesa por uma traseira
 * apagada é o pior dos dois erros numa foto de produto.
 *
 * A régua é a DISTÂNCIA em z até a lâmpada admitida mais próxima, e 1,20 m sai
 * das quatro medidas do acervo:
 *
 *   VW Titan  `truck_mat_0001_pisca`   z −2,24…−2,16, farol a 0,55 m  ⇒ fica apagado
 *   Scania S 2024e  `r_bumper…blinkers`  z 3,22…3,29, admitida mais próxima a 1,46 m ⇒ VOLTA
 *   Scania R/S 2016 `r_light…blinkers`   z 3,14…3,20, admitida mais próxima a 2,90 m ⇒ VOLTA
 *   implemento `lanterna-pisca-circular` z 7,24, sobreposta à admitida da quina  ⇒ fica apagado
 *
 * Ou seja: um pisca que tem outra lâmpada acesa ao lado dele continua sendo um
 * pisca; um "pisca" isolado a mais de um metro de qualquer luz é o conjunto
 * inteiro daquela ponta com o nome errado.
 */
const READMITIR_M = 1.20;

/**
 * A SEGUNDA REGRA DE READMISSÃO: **um implemento não tem pisca DIANTEIRO.**
 *
 * Relato: *"essa da frontal do implemento nao acende"*. Medido no `trailer.glb`,
 * na face dianteira (z local 7,25):
 *
 *     lanterna-pisca-circular-E   x  1,12… 1,21   y 1,32…1,41
 *     lanterna-pisca-circular-D   x −1,21…−1,12   y 1,32…1,41
 *
 * Uma lanterna redonda de ~9 cm em cada quina inferior da FRENTE do baú. O nome
 * da peça diz "pisca" e por isso ela ficava apagada — e está errado, porque um
 * semirreboque **não tem seta dianteira**: as setas dele são traseiras, e a
 * redonda âmbar da frente é a lanterna de POSIÇÃO dianteira. Quem autorou reusou
 * a peça do pisca circular, exatamente como reusou o material do pisca quadrado
 * nas dez de posição da lateral (ver INTERMITENTE_RE).
 *
 * A regra fica geométrica e não nominal: **raiz SEM farol** (ou seja, não é o
 * cavalo) **e lâmpada na face DIANTEIRA**. Ela não devolve seta nenhuma do
 * cavalo — o repetidor do para-lama do VW Titan continua apagado, porque aquela
 * raiz tem farol — nem seta traseira de implemento, porque essas não estão na
 * face da frente.
 */
const MARCADOR_FRENTE_M = 0.60;

function readmitirPontaEscura(reg: Registro) {
  const admitidas = reg.lista.filter((l) => !l.emEspera && Number.isFinite(l.z0!));
  const temFarol = reg.lista.some((l) => l.farol);
  /* A face dianteira para este teste sai das lâmpadas JÁ admitidas, que é a mesma
     régua do resto do módulo. Com nenhuma admitida não há face, e o teste não
     roda — a régua da ponta escura, abaixo, dá conta do caso. */
  let zFrente = Infinity;
  for (const a of admitidas) zFrente = Math.min(zFrente, a.z0!);

  for (const l of reg.lista) {
    if (!l.emEspera) continue;
    if (!Number.isFinite(l.z0!)) { l.emEspera = false; continue; }
    /* MARCADOR DIANTEIRO DE IMPLEMENTO — ver o bloco acima. */
    if (!temFarol && Number.isFinite(zFrente)
      && l.z0! <= zFrente + MARCADOR_FRENTE_M) {
      l.emEspera = false;
      l.marcadorDianteiro = true;
      console.info('[luzes] "' + (l.mat.name || '?') + '" voltou a acender:'
        + ' está na face dianteira de uma raiz sem farol'
        + ' (implemento não tem seta dianteira; é lanterna de posição).');
      continue;
    }
    /* A régua da PONTA ESCURA não vale quando a PEÇA afirma ser seta — ver o
       campo `piscaPorPeca`. Ela existe para material de nome errado num conjunto
       fundido, e ali a peça não opina. */
    if (l.piscaPorPeca) continue;
    const perto = admitidas.some(
      (a) => a.z0! - READMITIR_M <= l.z1! && a.z1! + READMITIR_M >= l.z0!);
    if (perto) continue;
    l.emEspera = false;
    console.info('[luzes] "' + (l.mat.name || '?') + '" voltou a acender:'
      + ' é a única luz entre z ' + l.z0!.toFixed(2) + ' e ' + l.z1!.toFixed(2)
      + ' (o nome diz intermitente, a geometria diz conjunto inteiro).');
  }
  /* Quem sobrou em espera some da lista: um material apagado não é uma lâmpada, e
     deixá-lo aqui faria a bancada contar lâmpada que nunca acende. */
  for (let i = reg.lista.length - 1; i >= 0; i--) {
    if (reg.lista[i].emEspera) reg.lista.splice(i, 1);
  }
}

/** A cor que o nome declara, escrita no uniforme. Preto = decidir pela posição. */
function resolverCorFixa(reg: Registro) {
  for (const l of reg.lista) {
    /* O FAROL é branco por definição e não entra na régua de posição — ele JÁ é a
       frente, e classificá-lo por posição só criaria uma chance de errar. A luz
       de trabalho do baú também: ela ilumina carga, não sinaliza posição. */
    /* O MARCADOR DIANTEIRO DO IMPLEMENTO É ÂMBAR, e não branco pela posição: a
       lente dele é âmbar (é a peça do pisca circular, e a textura é o âmbar liso
       medido em INTERMITENTE_RE). É a mesma doutrina de
       `lanterna-pequena-cantos-redondo(VERMELHO)` — a cor que a peça TEM de dia é
       a cor que ela acende. Um brilho branco atrás de uma lente âmbar seria
       inventar informação que o asset já dá. */
    const fixa = l.marcadorDianteiro ? COR_LADO
      : (l.farol || l.nomes.some((n) => INTERNA_RE.test(n)))
        ? COR_FRENTE : corDosNomes(l.nomes);
    if (fixa) l.uFixa.value.setHex(fixa);
    else l.uFixa.value.setRGB(0, 0, 0);
  }
}

/**
 * A mesma conta do shader, NUM z qualquer — para o halo e para o diagnóstico.
 *
 * Em z e não no centro da lâmpada porque o halo é POR SÍTIO: um material fundido
 * põe lanterna na frente e atrás, e um halo vermelho na dianteira do caminhão
 * seria o mesmo defeito que a cor por material era.
 */
function corEmZ(l: Lampada, reg: Registro, z: number) {
  const fixa = l.uFixa.value;
  if (fixa.r + fixa.g + fixa.b > 1e-4) return _c.copy(fixa).getHex();
  if (!Number.isFinite(z)) return COR_LADO;
  const dF = Math.abs(z - reg.z0), dT = Math.abs(z - reg.z1);
  if (dF <= dT) return dF < (PONTA_M0 + PONTA_M1) / 2 ? COR_FRENTE : COR_LADO;
  return dT < (PONTA_M0 + PONTA_M1) / 2 ? COR_TRAS : COR_LADO;
}

/** A cor do CENTRO da lâmpada — para o diagnóstico e a bancada. */
function corDaLampada(l: Lampada, reg: Registro) {
  if (!Number.isFinite(l.z0!)) return corEmZ(l, reg, NaN);
  return corEmZ(l, reg, (l.z0! + l.z1!) / 2);
}

function escrever(reg: Registro) {
  for (const l of reg.lista) l.mat.emissiveIntensity = l.escala * nivel;
}

/* Registrado por scene.ts no init; um no-op até lá, o que é correto — antes do
   primeiro tween não há pose de rig a reescrever. Mesmo padrão (e mesma razão) do
   `setLampRigRefresh()` de scene/lamps.ts: quem escreve nos materiais é
   `applyRig()`, e `applyRig()` só roda em tween. */
let rigRefresh = () => {};
export function setVehicleLightsRigRefresh(fn: () => void) { rigRefresh = fn; }

/**
 * Esquece uma raiz DESCARTADA. Chamado por `disposeTree()` em `models.ts`.
 *
 * É a única porta de saída do registro, e existe porque a outra régua possível —
 * "não tem pai" — confunde descarte com desmontagem temporária. Ver a nota em
 * `setVehicleLightsLevel()`.
 */
export function unregisterVehicleLights(root: THREE.Object3D | null | undefined) {
  if (!root || !porRaiz.has(root)) return;
  porRaiz.delete(root);
  aMedir.delete(root);
  /* Os halos daquela raiz somem junto, e a malha é refeita sem eles. */
  const todos: HaloSite[] = [];
  let cena: THREE.Object3D | null = null;
  for (const [r, reg] of porRaiz) {
    if (!r.parent) continue;
    todos.push(...reg.halos);
    if (!cena) { let o: THREE.Object3D = r; while (o.parent) o = o.parent; cena = o; }
  }
  rebuildLampHalos(todos, cena);
}

/**
 * Manda remedir as faces e as lâmpadas na próxima escrita.
 *
 * Chamado por `TrailerRig.set()`, que é o único lugar em que o implemento muda de
 * tamanho. Sem isto as lanternas traseiras de um baú alongado ficariam a metros
 * da face que a medida anterior registrou — âmbar em vez de vermelhas.
 */
export function invalidateVehicleLightBounds() {
  for (const raiz of porRaiz.keys()) aMedir.add(raiz);
  /* E pede a reescrita: marcar sozinho só teria efeito na próxima mudança de luz,
     e redimensionar o baú não é uma delas. */
  rigRefresh();
}

/**
 * Acende/apaga. `n` é 0..1 e vem de `rig.vehLights`.
 *
 * @returns quantos materiais foram escritos, para o log e a bancada.
 */
export function setVehicleLightsLevel(n: number) {
  nivel = THREE.MathUtils.clamp(n, 0, 1);
  let escritos = 0;
  let refazerHalos = false;
  for (const [raiz, reg] of porRaiz) {
    /* ⚠️ **SEM PAI NÃO QUER DIZER MORTO**, e tratar os dois como a mesma coisa
       era um defeito de perda total. Medido em `models.ts`: entre
       `setupCommon(cab)` e `state.cabGroup.add(cab)` — e de novo entre
       `setupCommon(trailer)` e `state.trailerGroup.add(trailer)` — a raiz fica
       alguns milissegundos DESLIGADA da cena. Um `applyRig()` nessa janela
       apagava o cavalo do registro para sempre: `registerVehicleLights()` só roda
       uma vez, de dentro de `setupCommon()`, então ninguém o traria de volta.
       A partir dali as lâmpadas dele congelavam com as faces que tivessem, o
       `getVehicleLightSpans()` deixava de vê-lo, e `beams.ts` caía no fallback —
       que põe o FAROL na frente do IMPLEMENTO, ou seja na escada da cabine. Era
       o relato *"o feixe de luz frontal esta indo para baixo/tras dele, na
       escada para entrar na cabine"*.

       Quem some do registro agora é quem foi DESCARTADO, e quem avisa é o dono:
       `disposeTree()` chama `unregisterVehicleLights()`. Uma raiz apenas
       destacada é PULADA e volta a ser medida quando reencontrar um pai. */
    if (!raiz.parent) { aMedir.add(raiz); continue; }
    if (aMedir.has(raiz)) { medirRaiz(raiz, reg); aMedir.delete(raiz); refazerHalos = true; }
    escrever(reg);
    escritos += reg.lista.length;
  }
  /* A capa clareia junto com a lâmpada, e pelo mesmo número: uma capa clara com o
     farol apagado seria um buraco no para-choque. */
  setHeadlightCoverLevel(nivel);
  /* OS HALOS SÓ SÃO REFEITOS QUANDO ALGUÉM FOI REMEDIDO, e o nível vai sempre.
     A malha de halo é uma `InstancedMesh` reconstruída do zero; refazê-la a cada
     quadro do arrasto do controle de hora seria uma realocação por quadro para
     escrever o mesmo conteúdo. O que muda com a hora é um uniforme. */
  if (refazerHalos) {
    const todos: HaloSite[] = [];
    let cena: THREE.Object3D | null = null;
    for (const [raiz, reg] of porRaiz) {
      if (!raiz.parent) continue;
      todos.push(...reg.halos);
      /* A CENA, achada subindo — e não importada, que fecharia um ciclo
         (`scene.ts` já importa este módulo). Os sítios estão em MUNDO, então o
         grupo tem de pendurar acima do `RIG`, que carrega o giro de 180° e o
         recuo de 4 m de `RIG_PLACEMENT`. */
      if (!cena) { let o: THREE.Object3D = raiz; while (o.parent) o = o.parent; cena = o; }
    }
    rebuildLampHalos(todos, cena);
  }
  setLampHaloLevel(nivel);
  return escritos;
}

/**
 * Onde estão as lâmpadas acesas, em mundo — o que `beams.ts` precisa para pôr o
 * feixe no lugar certo sem saber nada sobre materiais.
 *
 * Devolve UMA entrada por raiz registrada, com as faces medidas e a altura das
 * lâmpadas de cada ponta. `null` para quem ainda não foi medido.
 */
export interface VehicleLightSpan {
  root: THREE.Object3D;
  /** As duas faces em z de mundo — dianteira e traseira. */
  z0: number; z1: number;
  /** Há farol nesta raiz (declarado OU promovido)? É o que identifica o CAVALO. */
  temFarol: boolean;
  /** Altura da lâmpada mais próxima de cada face — é a altura a imitar. */
  yFrente: number; yTras: number;
  /** Meia-largura entre as lâmpadas de cada face, para separar os dois feixes. */
  xFrente: number; xTras: number;
  /** Centro em x das lâmpadas da raiz. */
  xMeio: number;
  /**
   * A altura da frente veio do FAROL, e não de um palpite?
   *
   * `beams.ts` não muda de conta por causa disto — a altura já chega pronta —,
   * mas a bancada precisa distinguir os dois casos para poder travar o defeito
   * que originou tudo (feixe nascendo no quebra-sol).
   */
  farolMedido: boolean;
}

/* ⚠️ A ALTURA DA FRENTE É A DO FAROL, E NÃO A DA LÂMPADA MAIS DIANTEIRA.
   ---------------------------------------------------------------------------
   Esta função dava ao feixe a altura da lâmpada mais próxima da face — e MEDIDO
   ao vivo no Scania R 2009, essa lâmpada é o quebra-sol: os dois faróis nasceram
   em `y = 2,98 m`, com intensidade 240, apontando para o asfalto a 22 m. O feixe
   saía do teto da cabine, e a foto ficava com uma poça enorme e um conjunto óptico
   apagado — o relato *"possui o feixe de luz, mas nao indica na propria lanterna"*.

   Não é um caso isolado: em ~20 dos 49 bakes a lâmpada mais dianteira está entre
   1,9 e 3,1 m (quebra-sol, delimitadora de teto, letreiro do teto).

   A régua nova tem três degraus, do mais medido para o menos:

     1. o FAROL desta raiz, quando existe — declarado pelo nome ou promovido por
        `promoverFarolGeometrico()`. É a caixa dele que dá altura e meia-bitola;
     2. a lâmpada mais dianteira que ESTEJA NA ALTURA DE UM FAROL (a mesma janela
        de `FAROL_GEO_Y_*`), para uma raiz que tenha conjunto óptico sem que
        nenhuma das duas regras o tenha reconhecido;
     3. `FAROL_Y_PADRAO` / `FAROL_X_PADRAO` — os 12 bakes fundidos, onde a
        geometria simplesmente não diz onde o farol está. Ver a constante. */
/** Até onde, da face, um sítio ainda conta como "a lanterna daquela ponta". */
const ANCORA_M = 0.60;
/** A janela de altura de uma lanterna traseira. Medido: 0,59 a 1,24 m no acervo. */
const ANCORA_TRAS_Y_MIN = 0.20, ANCORA_TRAS_Y_MAX = 2.20;

/**
 * Onde estão as lâmpadas de uma PONTA, a partir dos sítios já aglomerados.
 *
 * @returns `y` médio e o `x` da lanterna mais EXTERNA — que é a que o par de
 *   feixes tem de imitar —, ou `null` quando não há sítio naquela ponta (os 12
 *   bakes fundidos, onde não há aglomerado nenhum a extrair).
 */
function ancorar(reg: Registro, zRef: number, yMin: number, yMax: number) {
  let y = 0, x = 0, n = 0;
  for (const s of reg.halos) {
    if (Math.abs(s.z - zRef) > ANCORA_M) continue;
    if (s.y < yMin || s.y > yMax) continue;
    y += s.y;
    x = Math.max(x, Math.abs(s.x));
    n++;
  }
  if (!n) return null;
  return { y: y / n, x: Math.max(0.35, Math.min(1.25, x)) };
}

export function getVehicleLightSpans(): VehicleLightSpan[] {
  const out: VehicleLightSpan[] = [];
  for (const [raiz, reg] of porRaiz) {
    if (!raiz.parent || !reg.admitido) continue;
    let dT = Infinity;
    let yT = 0, xT = 0.7, xM = 0, n = 0;
    /* Degrau 1 e 2, escolhidos no mesmo laço: o farol ganha de qualquer
       candidato de altura, e entre candidatos ganha o mais dianteiro. */
    let farol: Lampada | null = null;
    let candidato: Lampada | null = null;
    for (const l of reg.lista) {
      if (!Number.isFinite(l.z0!) || l.yC === undefined) continue;
      const z = (l.z0! + l.z1!) / 2;
      xM += l.xC!; n++;
      if (l.farol && (!farol || l.z0! < farol.z0!)) farol = l;
      const naAltura = l.yC >= FAROL_GEO_Y_MIN && l.yC <= FAROL_GEO_Y_MAX;
      if (naAltura && (!candidato || l.z0! < candidato.z0!)) candidato = l;
      if (Math.abs(z - reg.z1) < dT) {
        dT = Math.abs(z - reg.z1); yT = l.yC; xT = Math.max(0.25, l.xMeia! * 0.75);
      }
    }
    if (!n) continue;
    const frente = farol || candidato;
    /* ⚠️ A ÂNCORA MANDA, quando existe. Os SÍTIOS DE HALO são as lâmpadas
       aglomeradas de verdade (ver `sitiosDaMalha()`), então perguntar a eles onde
       o conjunto óptico está é melhor do que derivar da caixa do MATERIAL — e a
       diferença é medida: no FH a caixa de `r_bumper_mat_0003_r_lights` vai de
       x −1,21 a 1,20 porque ela contém as DUAS lanternas, e `xMeia * 0,75` dá
       0,90; as lanternas de verdade estão em x = ±0,99 (confirmado no atlas do
       Blender, `tools/studio-bench/lamp-atlas.py`). Nove centímetros por lado num
       feixe que nasce colado na lataria é a diferença entre o cone sair DA
       lanterna e sair do para-choque ao lado dela. */
    const aF = ancorar(reg, reg.z0, FAROL_GEO_Y_MIN, FAROL_GEO_Y_MAX);
    const aT = ancorar(reg, reg.z1, ANCORA_TRAS_Y_MIN, ANCORA_TRAS_Y_MAX);
    out.push({
      root: raiz, z0: reg.z0, z1: reg.z1, temFarol: !!farol,
      yFrente: aF ? aF.y : (frente ? frente.yC! : FAROL_Y_PADRAO),
      xFrente: aF ? aF.x
        : (frente ? Math.max(0.35, Math.min(1.15, frente.xMeia! * 0.75)) : FAROL_X_PADRAO),
      yTras: aT ? aT.y : yT,
      xTras: aT ? aT.x : xT,
      xMeio: xM / n,
      farolMedido: !!frente || !!aF,
    });
  }
  return out;
}

/** Para o console e para a bancada. */
export function getVehicleLights() {
  let mats = 0, acesas = 0;
  const raizes: string[] = [];
  const nomes: string[] = [];
  const detalhe: Record<string, string> = {};
  for (const [raiz, reg] of porRaiz) {
    if (!raiz.parent) continue;
    mats += reg.lista.length;
    raizes.push((raiz.name || '(sem nome)') + ':' + reg.lista.length);
    const span = Math.max(0.01, reg.z1 - reg.z0);
    for (const l of reg.lista) {
      if (l.mat.emissiveIntensity > 0.01) acesas++;
      const n = l.mat.name || '(sem nome)';
      nomes.push(n);
      const z = Number.isFinite(l.z0!) ? (l.z0! + l.z1!) / 2 : reg.z0;
      detalhe[n] = `escala ${Math.round(l.escala * 10) / 10}`
        + ` · picoMapa ${Math.round((l.picoMapa || 0) * 1000) / 1000}`
        + ` · zRel ${Math.round(((z - reg.z0) / span) * 100) / 100}`
        + ` · faixa ${Math.round(((l.z1! - l.z0!) / span) * 100) / 100}`
        + ` · cor ${(l.cor || 0).toString(16).padStart(6, '0')}`
        + (l.uFixa.value.r + l.uFixa.value.g + l.uFixa.value.b > 1e-4
          ? ' (fixa)' : ' (posição)')
        + ` · emiInt ${Math.round(l.mat.emissiveIntensity * 10) / 10}`;
    }
  }
  return {
    nivel, materiais: mats, acesas, raizes, nomes: nomes.sort(), detalhe, pico: PICO,
  };
}

/** Reservado para diagnóstico: a cor média do emissivo de uma lâmpada. */
export function lampColorOf(mat: THREE.MeshStandardMaterial) {
  return _c.copy(mat.emissive).getHexString();
}
