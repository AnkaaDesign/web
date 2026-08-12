/* AS LÂMPADAS EMITEM LUZ DE VERDADE — os feixes do farol e da lanterna traseira.
   ===========================================================================
   O PEDIDO: *"quero que elas realmente emitam luz"*. Até aqui `lights.ts` só
   acendia o EMISSIVO: a peça brilhava, e nada em volta dela mudava. Um farol que
   não põe uma poça de luz no asfalto lê como um adesivo aceso.

   ===========================================================================
   ⚠️ A RESTRIÇÃO QUE GOVERNA TUDO NESTE ARQUIVO: `NUM_SPOT_LIGHTS`.

   Ela é parte da **chave de cache de programa** de TODO material da cena. Criar
   uma `SpotLight` avulsa no caminhão significaria recompilar o cenário inteiro
   (176 k triângulos), os ~50 materiais do implemento e a cabine — de forma
   síncrona, no quadro em que o relógio cruza as 18:00, no meio de um arrasto do
   controle. É exatamente o travamento que `warmLightPrograms()` existe para
   evitar, e a decisão do Kennedy sobre ele foi *"prefiro ter um pouco mais de
   tempo de carregamento no início do que ter esse travamento na mudança do
   slider"*.

   Então os feixes do veículo NÃO são luzes novas: eles são **quatro posições
   reservadas dentro do pool fixo de `lamps.ts`**, que passou de 8 para 12. O
   número continua sendo uma constante de módulo, `warmLightPrograms()` continua
   pré-compilando exatamente duas configurações (0 e 12), e trocar de cenário ou
   de hora continua sem recompilar nada.

   E POR ISSO O POOL ACENDE JUNTO. `lampsWanted()` em scene.ts passou a olhar
   `vehLights` além de `lampIntensity`: sem isso o preset `ciclorama` — que tem
   `lampIntensity: 0` — deixaria as 12 invisíveis e o farol do caminhão não
   emitiria nada às 21h. Duas condições, UM interruptor: ou as doze estão na cena,
   ou nenhuma está. Um terceiro estado seria uma terceira configuração de shader,
   que é o que não se pode ter.

   ===========================================================================
   QUATRO, E QUAIS.

   Um caminhão real tem faroletes, faróis de milha, lanterna de placa, luz de
   posição — dezenas de fontes. Quase todas são pequenas demais para render como
   LUZ: o que elas fazem na foto é brilhar, e disso o emissivo de `lights.ts` já
   dá conta. As que mudam o que está EM VOLTA são duas, e são as duas que o olho
   procura numa foto noturna:

     2 FARÓIS — o par de cones brancos no asfalto à frente do cavalo. É o que faz
       o caminhão parecer ligado, e é o que finalmente tira o farol do escuro: a
       lente continua atrás de uma capa que transmite 20 % (ver PICO_FAROL em
       lights.ts), mas o FEIXE não passa por capa nenhuma.
     2 LANTERNAS TRASEIRAS — dois cones vermelhos, curtos e fracos, atrás da
       última peça do comboio. Sem eles a traseira fica com duas manchas vermelhas
       flutuando no preto; com eles o para-choque, o chão e a fita refletiva de
       baixo recebem o vermelho, e o conjunto ganha profundidade.
     2 TRASEIRAS DO CAVALO, que é outro caso e virou vaga própria depois do
       relato *"a da traseira do cavalo nao afeta o implemento"*. Com uma carreta
       engatada, as lanternas traseiras do cavalo têm a PAREDE DIANTEIRA DO BAÚ a
       cerca de dois metros — uma superfície branca, grande e perto, que é
       exatamente onde uma luz vermelha aparece. E elas não são a cauda: a cauda
       joga no asfalto, longe; estas jogam numa parede, perto. Com o cavalo
       sozinho ficam apagadas, porque aí a traseira dele JÁ é a cauda.

   ONDE ELAS FICAM sai de `getVehicleLightSpans()`, ou seja das lâmpadas medidas —
   não de números cravados. O cavalo é a raiz que TEM farol declarado; a traseira é
   a raiz de maior z (o implemento quando há um, o próprio cavalo quando não há).
   Isso vale para os 58 chassis e para o implemento em qualquer medida, sem tabela.

   ===========================================================================
   OS NÚMEROS SÃO DE COMPOSIÇÃO. Um farol H7 real tem ~1 200 000 cd no ponto
   quente, o que num renderizador com exposição de foto de produto queimaria a
   pista inteira em branco. O que se quer é a POÇA reconhecível, então a
   intensidade é escolhida contra as luminárias do cenário (que trabalham na casa
   dos 95 cd depois do ganho de feixe) e não contra a folha de dados de uma
   lâmpada. */
import * as THREE from 'three';
import { vehBeams, VEH_BEAM_COUNT } from '../scene/lamps';
import { getVehicleLightSpans } from './lights';

/* ---------------- FAROL: A POÇA PRECISA DE UMA BORDA LONGE ----------------
   O relato foi *"possui o feixo de luz, mas nao indica na propria lanterna"*, e
   ele tem duas metades. A primeira — de ONDE o cone nasce — foi consertada em
   `lights.ts`, e era grave: medido ao vivo no Scania R 2009, os dois faróis
   nasciam em y = 2,98 m, no quebra-sol. A segunda é a FORMA da poça, e é este
   bloco.

   ⚠️ **UM CUTOFF DE VERDADE É IMPOSSÍVEL COM `SpotLight`, e a conta prova.** O
   facho baixo de um carro tem borda superior porque a óptica corta o feixe acima
   da horizontal. Aqui o cone é simétrico em torno do eixo, então a borda de cima
   só fica abaixo da horizontal se o meio-ângulo for MENOR que a inclinação do
   eixo. Com a fonte a 0,88 m (a altura medida do conjunto do FH) mirando o chão a
   D metros, a inclinação é atan(0,88/D): para ela passar de 20° seria preciso
   D < 2,4 m — ou seja um facho que morre a dois metros do para-choque, que não é
   farol nenhum. A alavanca certa seria uma TEXTURA de projeção (`SpotLight.map`),
   e ela está barrada pela mesma restrição de sempre: `NUM_SPOT_LIGHT_MAPS` é
   define de programa, então ligá-la recompila a cena inteira e `warmLightPrograms()`
   passaria a ter três configurações em vez de duas.

   Então a borda vem de onde ela PODE vir: da queda por distância. O termo de
   janela do three é (1 − (d/D)⁴)², e ele é o que desenha a ponta da poça —
   `distance` 32 põe a extinção em 32 m e ainda deixa 0,72 aos 20 m, o que dá uma
   poça que clareia até ~12 m, sustenta até ~22 m e apaga. Com os 46 anteriores a
   janela valia 0,996 a 20 m e 0,93 a 32: não havia ponta, o feixe lavava até o
   horizonte — a poça enorme e sem forma da foto.

   `alcance` 14 em vez de 22 pelo mesmo motivo: inclina mais o eixo, o que
   concentra a energia no trecho que a janela deixa vivo em vez de espalhá-la num
   rasante. E o ângulo fecha de 0,42 para 0,38 rad com a penumbra subindo de 0,45
   para 0,55 — o cone mais fechado devolve a lateral da poça, e a penumbra maior
   impede que ela vire um disco de borda dura no asfalto.

   A INTENSIDADE CAI JUNTO, e é a mesma aritmética de `getLampBeamGain()` em
   lamps.ts: fechar concentra. A razão de ângulo sólido entre 0,38 e 0,42 é
   (1 − cos 0,38)/(1 − cos 0,42) = 0,0713/0,0868 = 0,82, então manter 240 deixaria
   a poça 22 % mais forte do que a calibrada. 200 empata. */
/* ⚠️ ABERTURA: 0,50 rad, E A INTENSIDADE SOBE JUNTO. Relato: *"o mesmo para a
   abertura do feixe"* — a 0,38 rad os dois cones caíam como duas manchas
   separadas com asfalto escuro entre elas (foto de 15:56). 0,50 rad põe as bordas
   internas a menos de meio metro uma da outra a 14 m e elas fundem numa poça só.
   E ABRIR ESCURECE, a mesma aritmética de `getLampBeamGain()` em lamps.ts: a razão
   de ângulo sólido é (1 − cos 0,50)/(1 − cos 0,38) = 0,1224/0,0713 = 1,72, então
   manter 200 deixaria a poça 42 % mais fraca. 380 empata (344) e dá o pouco a mais
   de presença que o pedido tem embutido. */
const FAROL_ANGULO = 0.50;
const FAROL_PENUMBRA = 0.60;
const FAROL_DISTANCIA = 32;
const FAROL_INTENSIDADE = 380;
/* Quantos metros à frente o feixe encontra o chão. Ver o bloco acima. */
const FAROL_ALCANCE = 14;
/* A cor: a MESMA do emissivo do farol (`COR_FRENTE` em lights.ts). Um facho de
   LED de caminhão é branco levemente quente, não branco de escritório — e a poça
   no chão tem de combinar com a lente que a produziu, senão a lente lê como
   apagada ao lado de uma luz que não é dela. */
const FAROL_COR = 0xfff4e2;

/* LANTERNA TRASEIRA. Curta, larga e fraca: ela não ilumina a pista, ela derrama
   vermelho sobre o para-choque, a fita refletiva e os dois metros de chão atrás.
   `distance` 7 é o que impede a mancha de subir pela carreta do vizinho. */
/* Mesma abertura a pedido, e a mesma compensação:
   (1 − cos 0,88)/(1 − cos 0,72) = 0,3631/0,2513 = 1,44 ⇒ 9 x 1,44 ≈ 13. */
const TRAS_ANGULO = 0.88;
const TRAS_PENUMBRA = 0.85;
const TRAS_DISTANCIA = 6.0;
/* 9 e não 14, e o número caiu depois de olhar a foto `n5_2100_traseira`: em 14 a
   poça vermelha tinha ~5 m de largura e a saturação de uma luz de FREIO, ou seja
   a foto passava a dizer "o caminhão está freando" — o mesmo erro de leitura que
   fez o pisca ser apagado em lights.ts. Em 9, com o alcance encurtado, ela vira o
   derrame vermelho que uma lanterna de posição faz no para-choque e nos dois
   metros de asfalto atrás dele. */
const TRAS_INTENSIDADE = 14;
const TRAS_ALCANCE = 2.4;
const TRAS_COR = 0xff1608;

/* ---------------- TRASEIRA DO CAVALO: A PAREDE NÃO ESTÁ ATRÁS ----------------
   ⚠️ **A PREMISSA ANTERIOR ESTAVA FACTUALMENTE ERRADA, e está medida.** Este
   bloco dizia "a parede dianteira do baú a ~2 m dela" e mirava o cone na ALTURA
   da lanterna, para pintar uma parede vertical. Medido no comboio real (FH 2021
   4x2 + implemento, bancada de 2026-08-12):

       lanternas traseiras do cavalo .... z 5,12 … 5,20   (y 0,67 … 0,80)
       fonte, com o recuo .............. z 5,32
       alvo antigo ..................... z 7,80, y 0,74   (horizontal)
       PAREDE DIANTEIRA DO BAÚ ......... z 2,71

   A parede está **2,61 m À FRENTE da fonte**, não atrás: uma carreta engatada
   avança POR CIMA do cavalo, e as lanternas traseiras dele ficam debaixo do nariz
   do baú. O cone apontava para o vão — acertava o trem de pouso a centímetros
   (a mancha pequena e dura do relato *"muito focal"*) e o resto caía no asfalto
   longe de qualquer lanterna visível (*"no chao, ela muito longe de onde deveria
   estar"*).

   O que existe de verdade atrás daquelas lâmpadas é CHÃO, a 0,74 m abaixo. Então
   o alvo desce: a mira vai para o asfalto, `CAVALO_TRAS_ALCANCE` metros atrás, o
   que dá uma inclinação de atan(0,74/2,2) = 19° e um derrame vermelho no piso sob
   o nariz do baú — que é o que uma lanterna de posição faz ali.

   E o resto segue disso: `distance` 4,0 punha a extinção a 4 m de uma fonte cujo
   alvo está a 2,3 m, ou seja a poça morria antes de se abrir; 6,5 deixa a janela
   em 0,98 no alvo. O ângulo abre de 0,80 para 0,95 rad porque agora há área a
   cobrir, e a intensidade acompanha pela razão de ângulo sólido —
   (1 − cos 0,95)/(1 − cos 0,80) = 0,4185/0,3033 = 1,38, então 5 × 1,38 ≈ 7. */
/* (1 − cos 1,05)/(1 − cos 0,95) = 0,5024/0,4185 = 1,20 ⇒ 6 x 1,20 ≈ 7. */
const CAVALO_TRAS_ANGULO = 1.05;
const CAVALO_TRAS_PENUMBRA = 0.90;
const CAVALO_TRAS_DISTANCIA = 3.2;
const CAVALO_TRAS_INTENSIDADE = 8;
const CAVALO_TRAS_ALCANCE = 1.1;
/* ⚠️ O ALCANCE CAIU DE 2,2 PARA 1,1 E A DISTÂNCIA DE 6,5 PARA 3,2, e o relato que
   obrigou foi *"o feixe esta completamente errado em relacao onde seria a luz da
   lanterna traseira do cavalo"*: a poça aparecia a metros da lanterna, sem nada
   ligando uma à outra. A conta explica. Com a fonte a 0,73 m mirando o chão a
   2,2 m, o eixo desce 18° e a borda de cima do cone (meio-ângulo 54°) aponta para
   CIMA — então quem desenha a ponta da poça não é o cone, é a janela de
   distância, e com `distance` 6,5 essa ponta ficava a seis metros. Mirando a
   1,1 m o eixo desce 34°, a poça começa a 3 cm atrás da lâmpada e o brilho fica
   onde a lanterna está; `distance` 3,2 fecha a cauda logo depois. */

/* Um palmo à frente da face, para a fonte não nascer DENTRO da lataria: uma
   `SpotLight` no meio de uma malha ilumina o interior dela e deixa o para-choque
   com uma auréola pelo lado errado. 12 cm é menor que qualquer folga de
   para-choque e maior que qualquer erro da medida. */
const RECUO = 0.12;

const _cFarol = new THREE.Color(FAROL_COR);
const _cTras = new THREE.Color(TRAS_COR);

let ligados = 0;

/**
 * Põe os quatro feixes onde as lâmpadas estão e acende na intensidade de `nivel`.
 *
 * Chamado por `applyRig()`, logo depois de `setVehicleLightsLevel()` — a mesma
 * ordem e o mesmo laço, porque é o mesmo número que manda nos dois. `nivel` é
 * `rig.vehLights`, 0..1.
 *
 * NUNCA mexe em `visible`: quem escreve isso é `setLampsEnabled()` em scene.ts,
 * que continua sendo o único escritor da bandeira no pool inteiro. Aqui só se
 * escreve `intensity`, que é uniforme e não custa recompilação.
 *
 * @returns quantos feixes ficaram acesos.
 */
export function updateVehicleBeams(nivel: number) {
  const n = THREE.MathUtils.clamp(nivel, 0, 1);
  ligados = 0;
  if (vehBeams.length < VEH_BEAM_COUNT) return 0;

  const spans = getVehicleLightSpans();
  /* Apaga tudo primeiro: um comboio que perdeu o implemento tem de perder o feixe
     traseiro dele no mesmo quadro, e o laço abaixo só escreve o que existe. */
  for (const s of vehBeams) s.intensity = 0;
  if (!spans.length || n <= 0.001) return 0;

  /* O CAVALO é quem tem farol declarado. Sem nenhum (um implemento sozinho na
     cena, ou um bake cujo farol não foi achado), cai para a raiz mais dianteira —
     que é a definição geométrica da mesma coisa. */
  const cavalo = spans.find((s) => s.temFarol)
    || spans.reduce((a, b) => (b.z0 < a.z0 ? b : a));
  /* A TRASEIRA é a raiz de maior z: o implemento quando há um, o próprio cavalo
     quando ele está sozinho. */
  const cauda = spans.reduce((a, b) => (b.z1 > a.z1 ? b : a));

  mirar(vehBeams[0], vehBeams[1], {
    x: cavalo.xMeio, meia: cavalo.xFrente, y: cavalo.yFrente,
    z: cavalo.z0 - RECUO, alvoZ: cavalo.z0 - FAROL_ALCANCE,
    cor: _cFarol, intensidade: FAROL_INTENSIDADE * n,
    angulo: FAROL_ANGULO, penumbra: FAROL_PENUMBRA, distancia: FAROL_DISTANCIA,
  });
  mirar(vehBeams[2], vehBeams[3], {
    x: cauda.xMeio, meia: cauda.xTras, y: cauda.yTras,
    z: cauda.z1 + RECUO, alvoZ: cauda.z1 + TRAS_ALCANCE,
    cor: _cTras, intensidade: TRAS_INTENSIDADE * n,
    angulo: TRAS_ANGULO, penumbra: TRAS_PENUMBRA, distancia: TRAS_DISTANCIA,
  });
  /* A TRASEIRA DO CAVALO, só quando há implemento — com o cavalo sozinho ele É a
     cauda, e o par acima já está exatamente aqui. A comparação é por RAIZ e não
     por z: duas raízes distintas é a definição de "há um implemento engatado". */
  if (cauda.root !== cavalo.root) {
    mirar(vehBeams[4], vehBeams[5], {
      x: cavalo.xMeio, meia: cavalo.xTras, y: cavalo.yTras,
      z: cavalo.z1 + RECUO, alvoZ: cavalo.z1 + CAVALO_TRAS_ALCANCE,
      cor: _cTras, intensidade: CAVALO_TRAS_INTENSIDADE * n,
      angulo: CAVALO_TRAS_ANGULO, penumbra: CAVALO_TRAS_PENUMBRA,
      distancia: CAVALO_TRAS_DISTANCIA,
      /* NO CHÃO, e `alvoY` fica omitido de propósito — era ele que punha o cone
         na horizontal mirando uma parede que está do outro lado. Ver o bloco
         TRASEIRA DO CAVALO. */
    });
  }
  return ligados;
}

interface Mira {
  x: number; meia: number; y: number; z: number; alvoZ: number;
  cor: THREE.Color; intensidade: number;
  angulo: number; penumbra: number; distancia: number;
  /** Altura do alvo. Omitida = 0, o chão. Ver a traseira do cavalo. */
  alvoY?: number;
}

/**
 * Um par de feixes simétricos em x.
 *
 * O ALVO FICA NO CHÃO (y = 0) e não na altura da fonte, e é isso que produz a
 * poça: um cone horizontal atravessa o asfalto rasante e não desenha nada. O
 * afastamento lateral do alvo é METADE do da fonte, então os dois cones convergem
 * de leve ao longe — que é como um par de faróis se cruza, e o que evita duas
 * poças separadas e paralelas que leem como dois holofotes.
 */
function mirar(a: THREE.SpotLight | undefined, b: THREE.SpotLight | undefined, m: Mira) {
  const lados: [THREE.SpotLight | undefined, number][] = [[a, -1], [b, 1]];
  for (const [luz, lado] of lados) {
    if (!luz) continue;
    luz.color.copy(m.cor);
    luz.intensity = m.intensidade;
    luz.angle = m.angulo;
    luz.penumbra = m.penumbra;
    luz.distance = m.distancia;
    luz.position.set(m.x + lado * m.meia, m.y, m.z);
    luz.target.position.set(m.x + lado * m.meia * 0.5, m.alvoY ?? 0, m.alvoZ);
    /* `target` é um `Object3D` que só entra na conta depois de a matriz de mundo
       dele ser atualizada, e ele NÃO está na lista de filhos de ninguém que o
       renderer percorra por conta própria a tempo — `lamps.ts` o pendura no
       mesmo grupo, mas a atualização acontece antes desta escrita no quadro em
       que o rig muda. Atualizar aqui é o que garante que o feixe aponte para o
       alvo NOVO já neste quadro, e não no seguinte. */
    luz.target.updateMatrixWorld(true);
    if (m.intensidade > 0.001) ligados++;
  }
}

/** Para o console e para a bancada. */
export function getVehicleBeams() {
  return {
    reservados: VEH_BEAM_COUNT,
    criados: vehBeams.length,
    acesos: ligados,
    detalhe: vehBeams.map((s: THREE.SpotLight) => ({
      cor: s.color.getHexString(),
      intensidade: Math.round(s.intensity * 10) / 10,
      pos: [s.position.x, s.position.y, s.position.z].map((v) => Math.round(v * 100) / 100),
      alvo: [s.target.position.x, s.target.position.y, s.target.position.z]
        .map((v) => Math.round(v * 100) / 100),
      visivel: s.visible,
    })),
  };
}
