/* OS TANQUES DE COMBUSTÍVEL DO SCANIA P — trocados pelo tanque do Volvo VM.
   ===========================================================================
   *"troque os tanques de gasolina do modelo do Scania p360 pelo VOlvo VM que é
   melhor desenhado, mas faça com que ele seja de inox, e também remova o texto
   Volvo dele"* — Kennedy, 2026-08-22.

   Irmão de `truck-wheels.ts`, e a doutrina é a mesma: o asset (`tank_vm_v1.glb`,
   assado por `tools/tank-bake/bake_tank_vm.py`) carrega só GEOMETRIA
   NORMALIZADA e NOME DE MATERIAL; o acabamento e a colocação moram aqui, com o
   número ao lado do porquê.

   O QUE ESTAVA ERRADO, MEDIDO
   ---------------------------------------------------------------------------
   O rip do Scania entrega o tanque como um CILINDRO de revolução liso com duas
   cintas e um selo — `tanques_0_p3`, material `crome`, 0,683 × 0,702 × 0,986 m.
   O VM entrega um tanque de seção retangular arredondada com nervura, tampa de
   enchimento, respiro e cintas com braço de fixação. É a diferença que o dono
   chamou de "melhor desenhado", e ela é de MODELAGEM: não há acabamento que
   transforme um cilindro naquilo.

   ===========================================================================
   ⚠️⚠️ POR QUE O TANQUE NOVO É ENCOLHIDO EM z, E POR QUE ISSO É DELIBERADO

   O tanque do VM tem **1,344 m** de comprimento e o do Scania **1,008 m** — ou
   seja o doador é 336 mm mais longo que o buraco. Há três saídas e duas são
   piores:

     · **escala uniforme** — 0,75 em tudo deixaria a seção em 0,54 × 0,49 m
       contra os 0,68 × 0,70 do Scania. Um tanque de caminhonete pendurado num
       bitruck;
     · **1:1, crescendo para trás** — MEDIDO, não cabe. No flanco esquerdo os
       dois RESERVATÓRIOS DE AR começam em z 2,275 e o tanque acaba em 2,265:
       **10 mm de vão**. Para a frente o caminho também é curto — há tubulação
       cruzando a faixa do tanque em z 1,175…1,375. Sobrariam 1,150 m dos
       1,344 necessários, e para caber mesmo seria preciso engolir a tubulação;
     · **encolher só em z, e o mesmo fator nos dois lados** — é o que este
       módulo faz. O tanque novo ocupa o VÃO EM z do velho, então nada mais no
       caminhão precisa se mexer: o tanque de ARLA continua à frente do direito,
       os reservatórios de ar atrás do esquerdo, o estepe no lugar, e as quebras
       do corrido da proteção lateral — que `truckObstacles()` recalcula lendo a
       malha VISÍVEL — caem onde já caíam.

   (Em z e em x o envelope é o do tanque velho. Em Y não: desde 2026-08-22 a
   cota vertical vem do tanque de ARLA e não do tanque de fábrica — ver o bloco
   de `ARLA_RE`, que é onde o porquê está medido.)

   O preço está dito por inteiro: com fator 0,75 a tampa de enchimento, que é um
   cilindro de 90 mm, sai 67 mm em z e lê como uma elipse vista de cima. Em
   troca a SEÇÃO — que é o que se vê de perfil, e é o que o dono apontou — sai
   1:1. E a proporção resultante (1,008 × 0,718) é a mesma do tanque que o
   Scania já trazia (0,986 × 0,683): um tanque curto é uma peça de catálogo,
   não um defeito.

   O fator é o MENOR dos dois lados, e não um por lado: dois tanques de
   comprimento diferente no mesmo caminhão é defeito que ninguém pediu.

   ===========================================================================
   O CONTRATO COM O ASSET (`models/vehicles/tank_vm_v1.glb`)

     · dois nós, `TANK_R` (do lado x > 0 do rip) e `TANK_L` (do lado x < 0);
     · cada um com a ORIGEM na face EXTERNA / no TOPO / na FRENTE da CASCA,
       crescendo para a linha de centro, para baixo e para trás. `TANK_R` ocupa
       x ≤ 0 e `TANK_L` ocupa x ≥ 0;
     · em METROS de verdade — não há normalização de tamanho, porque a seção sai
       1:1 e só o comprimento é ajustado.

   Isso é conferido em `moldeValido()`, e um asset fora do contrato faz a troca
   degradar para "o tanque original fica" — nunca para um tanque no lugar
   errado.

   ===========================================================================
   ⚠️ OS DOIS LADOS SÃO ASSETS DIFERENTES, e não um espelhado

   Medido no rip: a tampa de enchimento do tanque de x > 0 fica na ponta
   TRASEIRA e a do tanque de x < 0 na DIANTEIRA. Espelhar um deles poria as duas
   tampas no mesmo canto — e ainda inverteria o enrolamento, que é o erro que
   `bake_wheel_vm.py` e o `espelha()` de `side-guard.ts` registram por extenso.
   Por isso a colocação aqui é TRANSLAÇÃO PURA: não há giro nem espelho no
   caminho, e portanto não há sinal para errar. */
import * as THREE from 'three';
import { claimGeometry } from './geometry-share';
import { GRADE_DENTRO, GRADE_FACE } from './side-guard';
import { componentes, componentesSoldados } from './truck-wheels';
import type { RigidMount } from './mounting';

/** A família que recebe a troca. Mesma chave de `cab-bake-fixes.ts` e pelo
 *  mesmo motivo: o id do catálogo é editorial, o ARQUIVO é o sujeito. Os quatro
 *  derivam do bitruck por recorte (`tools/chassis-bake/cut-scania.cjs`) e os
 *  quatro trazem o mesmo tanque. */
export const TANK_SWAP_RE = /scania_p_[468]x[24]r\.glb$/i;

/**
 * Teto do |x| da face EXTERNA do equipamento de flanco.
 *
 * ⚠️ MEDIDO NA GRADE, e não arbitrado — foi 1 150 e estava 30 mm DENTRO dela.
 * `protecao_lateral_v1.glb` ocupa de 0 a 135 mm para dentro da própria face
 * (o mais fundo é `ESTACAO__metal-preto`), e a face vive em |x| 1 275 — ver o
 * ⚠️⚠️ de `GRADE_FACE`: a face MEDIDA é 1 251, e baixar a constante para ela
 * empurra o tanque do VM para dentro da longarina. Logo o conjunto da grade É
 * **1 140…1 275**, e equipamento nenhum pode passar de 1 140. Com 40 mm de
 * ar: **1 100**.
 *
 * É o outro lado de `FOLGA_LATERAL` em `side-guard.ts` (155 = 135 + 20): uma
 * diz o que é obstáculo, esta diz para onde o obstáculo é empurrado. As duas
 * saem da MESMA medida e têm de andar juntas.
 *
 * ⚠️⚠️ E ANDAVAM SEPARADAS POR 24 mm ATÉ 2026-08-24 — o tamanho do erro de
 * `GRADE_FACE`, que diz 1 275 onde a peça montada está em 1 251. Com o teto em
 * 1 100 contra um limiar de suporte que, na face REAL, cai em 1 096, o
 * equipamento recuado parava 4 mm ACIMA dele e continuava sendo parede para a
 * estação. O sintoma: o corrido do Scania 8x2 morria 493 mm antes do ARLA e,
 * quando passou a alcançá-lo, avançava 1 499 mm sem um único apoio.
 *
 * ⚠️ O CONSERTO NÃO VEIO DAQUI — a tentativa está registrada no ⚠️⚠️ de
 * `GRADE_FACE`. Baixar o teto empurra `TS_TANQUE_VM`, que é POSTO com a face no
 * teto e não encolhido, 24 mm mais para dentro, e o berço dele entra na
 * longarina. Quem cedeu os 10 mm foi `FOLGA_LATERAL`, do lado da GRADE, que é
 * quem tem ar sobrando. Ver `FOLGA_BARRA` em `side-guard.ts` e o portão
 * `checks-grade-flanco-0824.mjs`.
 */
const TETO_FLANCO = GRADE_FACE - GRADE_DENTRO - 0.040;   // 1,100 m

/* ⚠️ 40 mm, E NÃO 20 — o teto tem de ficar ABAIXO do limiar de obstáculo, não
   em cima dele. `FOLGA_LATERAL` marca como obstáculo tudo além de
   `GRADE_FACE − GRADE_DENTRO − 0,020` = 1 096; com o teto em 1 096 o tanque
   recuado cairia exatamente no limiar (o teste é estrito) e voltaria a ser
   obstáculo: o corrido do Scania encurtava 700 mm e deixava tanque e ARLA de
   fora — o defeito que este recuo existe para tirar. 40 mm põem o equipamento
   20 mm dentro do limiar e 40 dentro da grade. */
/**
 * E quanto a SEÇÃO do tanque encolhe, ancorada no TOPO.
 *
 * *"diminua o tamanho do tanque do Scania e do Volvo"* — Kennedy, 2026-08-23.
 * Medido no VM, o tanque tem 619 mm de altura contra 500 mm de vão da grade
 * (as barras vivem em y 510…610 e 910…1 010): ele transborda 105 mm por baixo
 * e 14 por cima, e é isso que faz a grade parecer embutida nele. 0,90 tira
 * 62 mm de altura e 34 de largura sem deixar o tanque pequeno demais para o
 * caminhão — e a âncora é o TOPO porque é por cima que ele se prende à
 * longarina; encolher pelo centro o descolaria da mesa.
 */
const ENCOLHE_SECAO = 0.90;

/** Os nós de tanque do rip. `tanques_0_p0…p5` no Scania; o `s` é opcional para
 *  o dia em que outro rip chamar o grupo de `tanque_0`. */
/* ⚠️ O `_\d+_` É OPCIONAL: o VW batiza o tanque de `tanque_p0`, sem o índice
   de grupo que o VM e o Scania têm. Com o regex antigo ele nunca entrava no
   recuo de flanco. */
const TANK_NODE_RE = /^tanques?(_\d+)?_p\d+$/i;

const NO_R = 'TANK_R';
const NO_L = 'TANK_L';
/** O nó que este módulo cria — o mesmo prefixo `TS_` das outras peças nossas. */
const RAIZ = 'TS_TANQUE_VM';

/** Um lado com menos que isto de vértice não é um tanque: é sobra de rip. */
const MIN_VERT = 200;
/** Envelope de tanque menor que isto em qualquer eixo não é tanque. */
const MIN_DIM = 0.30;

/**
 * O TANQUE DE ARLA — a régua de altura, e ela é do próprio caminhão.
 *
 * *"coloque ambos tanque e esse outro menor na mesma altura"* — Kennedy,
 * 2026-08-22, com a captura do flanco direito.
 *
 * ⚠️ **SÓ UMA DAS DUAS BORDAS PODE CASAR**, porque as duas caixas não têm a
 * mesma altura: o tanque de combustível tem 658 mm e o de ARLA 593 — 65 mm de
 * diferença. O que existia era o FUNDO alinhado (306 contra 302 mm, ou seja
 * 4 mm) e o TOPO em degrau de 69 mm, e é o degrau de cima que aparece na foto:
 * a borda de baixo recorta contra a sombra do asfalto e a de cima contra a
 * saia clara do baú.
 *
 * Então a régua é o TOPO, e por dois motivos além do que se vê: é por cima que
 * as duas peças se prendem à mesma longarina, e alinhar por baixo empurraria o
 * ARLA 65 mm para cima, para dentro de um vão que não foi medido.
 *
 * Quem desce é o tanque de combustível, e não o ARLA que sobe — o ARLA é peça
 * DO RIP e o corpo dele mora em `chassis_p19`, mas o berço e os suportes estão
 * fundidos em `chassis_p15` e `chassis_p18`, que atravessam o caminhão inteiro:
 * movê-lo custaria a mesma cirurgia por componente conexo do estepe, com o
 * risco de deixar um suporte para trás. O tanque novo é nosso e desce de graça.
 *
 * MEDIDO, e é o que autoriza a descida: com o topo na régua do ARLA o fundo do
 * tanque cai para y 237 mm, ou **298 mm do solo** — e o tanque que o Scania já
 * trazia descia a y 225 (286 mm do solo) com a ferragem das cintas. Não há
 * regressão de altura livre; a faixa abaixo dos dois flancos foi varrida e está
 * vazia (o único vizinho é o rabo do próprio ARLA, em z 1,575…1,675, à frente
 * do tanque, que começa em 1,705).
 *
 * ⚠️ E A RÉGUA VALE PARA OS DOIS LADOS. O ARLA existe só no flanco direito;
 * usar o topo dele à direita e o do tanque velho à esquerda poria os dois
 * tanques do caminhão em alturas diferentes — que é justamente o defeito que
 * este bloco existe para tirar. De quebra isso conserta uma assimetria que já
 * estava no rip: os tanques de fábrica tinham topos a 964 e 972 mm.
 */
const ARLA_RE = /arla|adblue/i;
/** Uma peça com menos que isto de vértice não é o tanque de ARLA. */
const ARLA_MIN_VERT = 500;
/** …nem uma cuja caixa esteja fora desta faixa em qualquer eixo. */
const ARLA_DIM = [0.15, 1.20];

const materialsOf = (o: THREE.Mesh) =>
  (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean) as THREE.Material[];

/**
 * O INOX, e ele é aplicado ao ASSET — uma vez, antes de qualquer cópia.
 *
 * ⚠️ **NUM METAL A COR-BASE É A REFLETÂNCIA**, e é por isso que os dois números
 * abaixo andam juntos. O rip entrega a casca do tanque assim:
 *
 *   `Cinza_84`  metalicidade **0** · rugosidade 0,196 · base **0,1033** linear
 *
 * ou seja plástico cinza-escuro, que é o que o VM tem de fábrica (tanque com
 * capa plástica). Subir só a metalicidade para 0,90 e deixar a base em 0,1033
 * daria um metal que devolve 10 % do céu — um tanque de CHUMBO, mais escuro que
 * o plástico de que se partiu. O par certo é metalicidade alta COM refletância
 * alta.
 *
 * 0,56 linear é a refletância de aço/inox polido, e é o mesmo número que a
 * correção do letreiro SCANIA usa em `cab-bake-fixes.ts` — a régua de inox
 * desta base é uma só. A rugosidade sobe de 0,196 para 0,25 porque 0,196 num
 * metal é espelho de vitrine: um tanque de inox de caminhão é ESCOVADO, tem
 * lóbulo largo.
 *
 * ⚠️ E O MAPA DE NORMAIS FICA, MAS NO QUARTO DA FORÇA. `plastic_n` é pedra
 * batida de 512², e ele existe para dar granulação ao plástico. Num dielétrico
 * isso é textura; num metal de rugosidade 0,25 cada grão vira um ponto de
 * brilho, e o tanque inteiro cintila como purpurina. Em 0,25 de força ele vira
 * o grão fino do inox escovado, que é o que se quer — e apagá-lo deixaria uma
 * casca de plástico perfeitamente lisa, que também não é inox.
 *
 * ⚠️ `envMapIntensity` NÃO É TOCADO. Num metal o ambiente é TODA a luz que ele
 * recebe, e mexer nisso é o erro que `tuneVmWheelMaterials()` documenta ter
 * custado duas rodadas com a mesma frase do dono. Fica o 1,35 de
 * `setupCommon()`.
 */
export function tuneVmTankMaterials(asset: THREE.Object3D): string[] {
  const feitos: string[] = [];
  const vistos = new Set<THREE.Material>();
  asset.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    for (const raw of materialsOf(o)) {
      if (vistos.has(raw)) continue;
      vistos.add(raw);
      const m = raw as THREE.MeshStandardMaterial;
      const nome = m.name || '';
      if (/^tanque-inox-vm/.test(nome)) {
        m.color?.setRGB(0.56, 0.56, 0.56);
        m.metalness = 0.90;
        m.roughness = 0.25;
        if (m.normalScale) m.normalScale.set(0.25, 0.25);
        feitos.push(`${nome} → inox: base 0,56 linear · m 0,90 · r 0,25`
          + (m.normalMap ? ' · normal a 25 %' : ''));
      } else if (/^tanque-cinta-vm/.test(nome)) {
        /* AS CINTAS, no piso de preto da frota. O rip as entrega em 0,0039
           linear — abaixo dos 0,030 que `normalizeBlackPlastic()` estabelece
           como o piso do preto externo. E elas NÃO passam por aquela função:
           ela roda sobre a cabine, antes de este asset existir. Sem esta linha
           as cintas seriam a única peça preta do caminhão fora da régua. */
        m.color?.setRGB(0.030, 0.030, 0.030);
        feitos.push(`${nome} → preto da frota: base 0,030 linear (era 0,0039)`);
      } else {
        continue;
      }
      m.needsUpdate = true;
    }
  });
  return feitos;
}

interface Lado {
  min: THREE.Vector3;
  max: THREE.Vector3;
  n: number;
}

/** A caixa do molde, no espaço LOCAL dele. O contrato manda o datum na origem,
 *  então esta caixa também diz onde a ferragem passa do datum. */
function caixaMolde(mold: THREE.Object3D): THREE.Box3 {
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  const inv = new THREE.Matrix4().copy(mold.matrixWorld).invert();
  const m = new THREE.Matrix4();
  mold.traverse((node) => {
    const o = node as THREE.Mesh;
    const pos = o.isMesh ? o.geometry?.getAttribute('position') as THREE.BufferAttribute : null;
    if (!pos) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m));
  });
  return b;
}

/** O molde chegou no contrato? Devolve o motivo da recusa, ou `null`. */
function moldeValido(caixa: THREE.Box3, sinal: number): string | null {
  if (caixa.isEmpty()) return 'sem geometria';
  const fora = sinal > 0 ? caixa.max.x : caixa.min.x;   // a face EXTERNA, que é o datum
  if (Math.abs(fora) > 0.02) {
    return `a face externa está em x ${fora.toFixed(3)} e o datum manda 0`;
  }
  if (Math.abs(caixa.max.y) > 0.05) return `o topo está em y ${caixa.max.y.toFixed(3)} e o datum manda 0`;
  if (Math.abs(caixa.min.z) > 0.05) return `a frente está em z ${caixa.min.z.toFixed(3)} e o datum manda 0`;
  const dentro = sinal > 0 ? caixa.min.x : caixa.max.x;
  if (Math.sign(dentro) === Math.sign(fora) || Math.abs(dentro) < MIN_DIM) {
    return `o corpo cresce para o lado errado (x ${caixa.min.x.toFixed(3)}…${caixa.max.x.toFixed(3)})`;
  }
  return null;
}

/**
 * Troca os tanques de um chassi rígido pelo tanque do VM.
 *
 * `asset` é a raiz já carregada de `tank_vm_v1.glb`, já passada por
 * `setupCommon()` e por `tuneVmTankMaterials()`. Devolve quantos tanques foram
 * colocados; 0 significa que nada foi tocado e o tanque original continua
 * visível — a degradação é sempre "fica como estava".
 */
export function swapTruckTanks(cab: THREE.Object3D, asset: THREE.Object3D): number {
  cab.updateWorldMatrix(true, true);
  asset.updateWorldMatrix(true, true);

  const moldes: Record<string, { no: THREE.Object3D; caixa: THREE.Box3 }> = {};
  for (const [chave, nome, sinal] of [['D', NO_R, +1], ['E', NO_L, -1]] as const) {
    const no = asset.getObjectByName(nome);
    if (!no) {
      console.warn('[tanque] tank_vm_v1.glb sem', nome, '— o tanque original fica.');
      return 0;
    }
    const caixa = caixaMolde(no);
    const mal = moldeValido(caixa, sinal);
    if (mal) {
      console.warn('[tanque]', nome, 'fora do contrato —', mal, '· o tanque original fica.');
      return 0;
    }
    moldes[chave] = { no, caixa };
  }

  /* --- 1. o tanque DO CAMINHÃO, por lado e no referencial da cabine ---
     ⚠️ NO LOCAL DA CABINE, e não em mundo. O sinal de x que separa os lados é o
     do ESPAÇO CRU DO RIP, que é onde o molde também foi medido; em mundo ele
     depende de `orientYaw`, que ainda nem foi escrito quando esta função roda.
     Ler local faz os dois falarem a mesma língua por construção. */
  const toLocal = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const L2C = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const condenados: THREE.Mesh[] = [];
  const lados = new Map<string, Lado>();
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !TANK_NODE_RE.test(o.name)) return;
    const pos = o.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    condenados.push(o);
    L2C.multiplyMatrices(toLocal, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(L2C);
      const chave = v.x >= 0 ? 'D' : 'E';
      let g = lados.get(chave);
      if (!g) {
        g = { min: new THREE.Vector3(Infinity, Infinity, Infinity),
          max: new THREE.Vector3(-Infinity, -Infinity, -Infinity), n: 0 };
        lados.set(chave, g);
      }
      g.min.min(v); g.max.max(v); g.n++;
    }
  });
  if (!condenados.length) {
    console.warn('[tanque] nenhuma malha sob', TANK_NODE_RE, '— nada a trocar.');
    return 0;
  }

  /* --- 1b. A RÉGUA DE ALTURA: o topo do tanque de ARLA. Ver `ARLA_RE`. --- */
  let arlaTopo: number | null = null;
  let arlaRelato = 'não achado — a altura fica na do tanque de fábrica';
  {
    const c = new THREE.Box3();
    let n = 0;
    cab.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.visible) return;
      if (!materialsOf(o).some((m) => ARLA_RE.test(m.name || '')) && !ARLA_RE.test(o.name)) return;
      const pos = o.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!pos) return;
      L2C.multiplyMatrices(toLocal, o.matrixWorld);
      for (let i = 0; i < pos.count; i++) c.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(L2C));
      n += pos.count;
    });
    if (!c.isEmpty()) {
      const d = c.getSize(new THREE.Vector3());
      const cabe = n >= ARLA_MIN_VERT
        && Math.min(d.x, d.y, d.z) >= ARLA_DIM[0] && Math.max(d.x, d.y, d.z) <= ARLA_DIM[1];
      if (cabe) {
        arlaTopo = c.max.y;
        arlaRelato = `topo y ${c.max.y.toFixed(3)} · caixa ${d.x.toFixed(3)} × ${d.y.toFixed(3)}`
          + ` × ${d.z.toFixed(3)} · ${n} vértices`;
      } else {
        arlaRelato = `achado mas descartado (${n} vértices, caixa ${d.x.toFixed(3)} ×`
          + ` ${d.y.toFixed(3)} × ${d.z.toFixed(3)}) — não parece um tanque`;
      }
    }
  }

  const bons = [...lados.entries()].filter(([, g]) => {
    const d = g.max.clone().sub(g.min);
    return g.n >= MIN_VERT && Math.min(d.x, d.y, d.z) >= MIN_DIM;
  });
  if (!bons.length) {
    console.warn('[tanque] nenhum lado tem envelope de tanque —',
      [...lados.entries()].map(([k, g]) => `${k}: ${g.n} vért.`).join(' · '));
    return 0;
  }

  /* --- 2. O FATOR EM z É UM SÓ, e é o menor dos lados. Ver o cabeçalho. --- */
  let fator = 1;
  for (const [chave, g] of bons) {
    const molde = moldes[chave].caixa;
    const cabe = (g.max.z - g.min.z) / (molde.max.z - molde.min.z);
    if (cabe < fator) fator = cabe;
  }

  /* --- 3. um tanque por lado, por TRANSLAÇÃO pura --- */
  const postos: THREE.Object3D[] = [];
  const relatos: string[] = [];
  const at = new THREE.Vector3();
  const escala = new THREE.Vector3(ENCOLHE_SECAO, ENCOLHE_SECAO, fator);
  const q = new THREE.Quaternion();
  for (const [chave, g] of bons) {
    const { no, caixa } = moldes[chave];
    const sinal = chave === 'D' ? 1 : -1;
    /* A face EXTERNA do envelope do molde vai para a face externa do envelope do
       tanque velho — e não a casca para o barril. É o envelope que define a
       silhueta do caminhão naquela faixa, que é o que a proteção lateral mede e
       o que o olho vê de fora. */
    /* ⚠️ A FACE DO MOLDE ENTRA JÁ ENCOLHIDA. `at.x` alinha a face externa do
       molde com o alvo, e o molde vai escalado por `ENCOLHE_SECAO`: usar a
       face crua poria o tanque `(1 − k) · foraMolde` para dentro do alvo. */
    const foraMolde = (sinal > 0 ? caixa.max.x : caixa.min.x) * ENCOLHE_SECAO;
    /* ▶▶ E A FACE EXTERNA TEM TETO — a grade lateral passa POR FORA do tanque.
       --------------------------------------------------------------------
       *"esses tanques, até mesmo do Scania, deveriam estar mais recuados,
       porque a grade lateral deve passar sobre eles"* — Kennedy, 2026-08-23,
       com a foto do baú Ibiporã: o corrido é CONTÍNUO da cabine ao tandem e o
       tanque vive atrás dele.

       O tanque de fábrica do Scania tem a face em |x| 1 204 e a face da grade
       fica em 1 275 (2 600 mm de largura legal menos os 60 mm de
       `RECUO_DA_PELE`): 71 mm de recuo contra os 95 que o suporte precisa.
       O resultado é `truckObstacles()` marcar o tanque e o corrido dianteiro
       nascer com um terço do tamanho — que é a foto que o dono mandou.

       ⚠️ O TETO É DA GRADE, e por isso é uma constante e não uma medida do
       implemento: `swapTruckTanks()` roda em `loadCab()`, antes de o baú ter
       pose, e a largura do baú é a mesma para qualquer um (a CONTRAN 882/2021
       fecha em 2 600 mm). Amarrar isto ao `bb.max.x` do implemento seria uma
       dependência circular sem ganho de precisão. */
    const foraTanqueCru = sinal > 0 ? g.max.x : g.min.x;
    const foraTanque = Math.abs(foraTanqueCru) > TETO_FLANCO
      ? sinal * TETO_FLANCO : foraTanqueCru;
    /* A COTA VERTICAL É A DA CASCA, e o datum do molde É o topo da casca — daí
       `at.y` ser o alvo direto, sem desconto. Com ARLA no caminhão o alvo é o
       topo dele (ver `ARLA_RE`); sem ARLA, é o topo do envelope do tanque
       velho, e aí desconta-se a saliência da ferragem do molde para que os dois
       ENVELOPES coincidam, que é o que preserva a silhueta. */
    const topo = arlaTopo !== null ? arlaTopo : g.max.y - caixa.max.y;
    at.set(
      foraTanque - foraMolde,
      topo,
      (g.min.z + g.max.z) / 2 - fator * (caixa.min.z + caixa.max.z) / 2,
    );
    /* ⚠️ NÃO ENTRA `toLocal` AQUI, e a razão é que já não falta nada a
       converter: `caixaMolde()` mediu no espaço LOCAL do molde, `at` saiu do
       espaço LOCAL da cabine, e `unit` vai ser FILHO da cabine. A matriz local
       do clone é a composição direta entre os dois. Meter `toLocal` de novo
       aplicaria a inversa da pose da cabine uma segunda vez — e como ela é
       identidade neste ponto do carregamento, o erro não apareceria aqui e sim
       no primeiro caminhão que chegasse já posado. */
    const unit = no.clone(true);
    unit.name = `${RAIZ}_${chave}`;
    unit.matrixAutoUpdate = false;
    unit.matrix.compose(at, q, escala);
    postos.push(unit);
    relatos.push(`${chave}: ${(fator * (caixa.max.z - caixa.min.z)).toFixed(3)} m`
      + ` em ${(g.max.z - g.min.z).toFixed(3)} de vão`
      + ` · face externa |x| ${Math.abs(foraTanque).toFixed(3)}`
      + (Math.abs(foraTanqueCru) > TETO_FLANCO
        ? ` (recuado ${((Math.abs(foraTanqueCru) - TETO_FLANCO) * 1000).toFixed(0)} mm`
          + ' para a grade passar por fora)' : '')
      + ` · topo da casca y ${topo.toFixed(3)}`
      + ` (o do tanque de fábrica era ${(g.max.y - caixa.max.y).toFixed(3)})`
      + ` · fundo y ${(topo + caixa.min.y).toFixed(3)}`
      + ` · seção ${(caixa.max.x - caixa.min.x).toFixed(3)} × ${(caixa.max.y - caixa.min.y).toFixed(3)}`
      + ` (era ${(g.max.x - g.min.x).toFixed(3)} × ${(g.max.y - g.min.y).toFixed(3)})`);
  }

  /* Só depois de tudo colocado: uma exceção no meio do laço acima deixaria o
     caminhão sem tanque nenhum em vez de com o tanque velho. */
  for (const u of postos) cab.add(u);
  for (const o of condenados) o.visible = false;

  console.info('[tanque] tanque do VM em', postos.length, 'lado(s) ·',
    condenados.length, 'malhas originais ocultas ·',
    `fator em z ${fator.toFixed(3)}`, '· régua de altura:', arlaRelato,
    '·', relatos.join(' · '));
  return postos.length;
}


/* ===========================================================================
   O RECUO DO FLANCO — para a grade lateral passar POR FORA do equipamento
   ===========================================================================
   *"esses tanques, até mesmo do Scania, deveriam estar mais recuados, porque a
   grade lateral deve passar sobre eles"* · *"precisa recuar um pouco o tanque e
   esse elemento ao lado dele … para que a grade cubra o segundo elemento ao
   lado do tanque"* — Kennedy, 2026-08-23, com a foto do baú Ibiporã: o corrido
   é CONTÍNUO da cabine ao tandem e o que é do chassi vive atrás dele.

   `swapTruckTanks()` resolve isso no tanque que ELE põe (o do Scania). Quem não
   passa por lá continua com o tanque de fábrica, e medido:

       VM   `tanque_0_p0` / `_p2`      |x| 1 200 e 1 204
       VW   `tanque_p0`                |x| 1 112   ← já cabia
       Scania  ARLA `chassis_p19`      |x| 1 233 · bocal `chassis_p21` 1 239

   Contra os 1 180 que `truckObstacles()` aceita (1 275 da face da grade menos os
   95 do suporte), o VM e o ARLA do Scania AMPUTAM o corrido — no Scania são
   670 mm, e é exatamente onde a foto mostra a grade morrendo.

   ⚠️ O RECUO É EM X, E NÃO EM Z, e isso é medida e não preferência. O berço e
   os suportes do ARLA estão fundidos em `chassis_p15`/`chassis_p18`, que
   atravessam o caminhão inteiro (−3 932…2 824): empurrá-lo para trás deixaria o
   berço no lugar. Recuar em X resolve o que se quer resolver — a grade passa
   por fora — e de quebra alinha as faces do tanque e do ARLA, que no rip estão
   em 1 204 e 1 233.

   ⚠️ E O GRUPO ANDA JUNTO. O bocal do ARLA é um NÓ à parte e não carrega o
   material dele; achá-lo por nome seria amarrar ao rip. Ele entra por FORMA:
   nó CURTO (menos de 1,5 vez o vão do corpo em z — o que exclui as malhas de
   caminhão inteiro), que ENCOSTA na caixa do corpo e que passa do teto. Os dois
   recuam o MESMO tanto, senão a peça se desmonta.

   ⚠️⚠️ …E O BERÇO ANDAVA JUNTO COISA NENHUMA — 2026-08-23, §46. É a outra
   ponta do parágrafo acima: o teste "malha CURTA" existe para não engolir o
   caminhão inteiro, e é justamente dentro de `chassis_p15`/`chassis_p18` que o
   berço mora. Medido, o corpo recuava e a ferragem ficava: **123 mm de
   degrau**, com as duas chapas de topo e as duas tiras de inox penduradas no
   vazio. Quem pesca o berço agora é `pegaOBerco()`, por COMPONENTE CONEXO, e
   com ele o mapa do ARLA deixou de ser translação — ver `encolheERecua()`.
*/
function caixaLocal(o: THREE.Mesh, toLocal: THREE.Matrix4, out: THREE.Box3): boolean {
  const pos = o.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return false;
  const M = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
  const v = new THREE.Vector3();
  out.makeEmpty();
  for (let i = 0; i < pos.count; i++) out.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(M));
  return !out.isEmpty();
}

/**
 * Encolhe, recua e reancora as malhas de um grupo, **por vértice**.
 *
 * ⚠️ NÃO DÁ PARA TRANSLADAR O NÓ, e a 1ª versão desta função tentou. O tanque
 * de um caminhão é UM nó com os DOIS flancos dentro (`tanque_0_p2` do VM vai de
 * x −1 197 a 1 204): transladar o nó 54 mm para dentro põe um lado em 1 150 e o
 * OUTRO em 1 258 — que foi exatamente o que a bancada mediu depois da primeira
 * tentativa, com o defeito piorando em vez de sumir.
 *
 * O mapa, em espaço da CABINE e por vértice:
 *
 *     y' = topo − (topo − y) · ky           a seção encolhe ancorada no TOPO
 *     x' = sign(x) · (|x| · ax + bx)        e a face vai parar no teto
 *
 * A reta em x é dada PELO CHAMADOR porque os dois grupos a querem diferente, e
 * a diferença é medida — ver `recessFlankEquipment()`:
 *
 *   · TANQUE DE COMBUSTÍVEL — `ax = ENCOLHE_SECAO`, `bx ≤ 0`. Ele é um corpo
 *     solto no flanco, encolhe em torno da linha de centro e recua o que faltar.
 *   · ARLA — `ax < 1` ancorado na face INTERNA (`bx > 0`), `ky = 1`. Ele não é
 *     um corpo solto: o berço dele nasce na longarina, e a face interna do
 *     conjunto está a 2 mm dela. Recuar por translação enfiaria a peça DENTRO
 *     da longarina; o que o conserto quer é um conjunto mais RASO, com a mesma
 *     silhueta de perfil (a seção que se vê de fora é a de y × z, e ela não é
 *     tocada).
 *
 * `mascara` diz QUAIS vértices da malha andam: `null` é a malha inteira, e um
 * `Uint8Array` é o berço recortado por componente conexo de dentro de uma malha
 * de caminhão inteiro (ver `pegaOBerco()`).
 *
 * Roda DEPOIS de `markShared()`: ela escreve geometria, e nos rips de rígido a
 * malha é compartilhada (139 nós para 125 malhas no VM). Sem a posse, o aperto
 * vazaria para as irmãs. É a mesma regra do estepe em `truck-wheels.ts`.
 */
function encolheERecua(
  cab: THREE.Object3D, malhas: Map<THREE.Mesh, Uint8Array | null>,
  ax: number, bx: number, ky: number, topo: number, dz = 0,
): number {
  const toLocal = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const L2C = new THREE.Matrix4();
  const C2L = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let mexidos = 0;
  for (const [o, mascara] of malhas) {
    const geo = claimGeometry(o);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) continue;
    L2C.multiplyMatrices(toLocal, o.matrixWorld);
    C2L.copy(L2C).invert();
    for (let i = 0; i < pos.count; i++) {
      if (mascara && !mascara[i]) continue;
      v.fromBufferAttribute(pos, i).applyMatrix4(L2C);
      const s = v.x >= 0 ? 1 : -1;
      v.x = s * (Math.abs(v.x) * ax + bx);
      v.y = topo - (topo - v.y) * ky;
      /* ▶ E O AVANÇO EM z, que anda com o mesmo mapa — ver `avancoDeFlanco()`.
         Zero em quase todo caminhão: só o rígido DERIVADO de um bitruck tem o
         vão sobrando. */
      v.z += dz;
      v.applyMatrix4(C2L);
      pos.setXYZ(i, v.x, v.y, v.z);
      mexidos++;
    }
    pos.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  }
  return mexidos;
}

/* ===========================================================================
   ▶▶ O BERÇO DO ARLA — a peça que a malha do caminhão inteiro escondia
   ===========================================================================
   *"esse componente com tampa azul foi reduzido, mas o suporte dele nao"* —
   Kennedy, 2026-08-23, com a foto do flanco direito do Scania P.

   O recuo do ARLA nasceu (§43.5) pegando o CORPO (`chassis_p19`) e o bocal
   (`chassis_p21`), que é nó curto e entra pela vizinhança. O BERÇO não entrava
   por lá porque ele não é nó nenhum: ele está fundido em `chassis_p15` e
   `chassis_p18`, que atravessam o caminhão de ponta a ponta e são recusadas
   pela regra "vizinho tem de ser malha CURTA". Medido na bancada, o resultado
   era um degrau de **123 mm** entre o corpo (|x| 1 094) e a ferragem (1 217) —
   as duas chapas de topo e as duas tiras de inox penduradas no vazio, que é o
   que a foto mostra.

   O QUE ELE É, medido em `scania_p_4x2r.glb` (espaço local da cabine, mm):

       chassis_p15   576…1 217 × 273…900 × 1 352…1 441   chapa de topo, frente
       chassis_p15   576…1 217 × 278…900 × 1 572…1 672   chapa de topo, trás
       chassis_p15  1 190…1 216 × 415…474 × 1 363…1 666   barra externa
       chassis_p18  1 200…1 211 × 422…468 × 1 356…1 673   duas tiras de inox
       chassis_p21  1 164…1 239 × 813…903 × 1 467…1 562   bocal (já entrava)

   E O CRITÉRIO É DE DUAS PERNAS, porque uma só erra:

     1. o componente CABE INTEIRO na região do ARLA (a caixa do corpo com
        120 mm de folga em y e z, e |x| ≥ 250 para que nenhuma TRAVESSA — que
        cruza a linha de centro — caiba nela);
     2. e ele PASSA DO TETO DE FLANCO. É esta perna que carrega o peso, porque
        `componentes()` não solda por posição e a chapa de topo sai em 90
        fragmentos: a região sozinha pegaria também rebite de longarina,
        abraçadeira de chicote e presilha de tanque. Medido no motor, com as
        duas pernas sobram exatamente as peças da tabela acima e nada mais.

   ⚠️ E ELE NÃO ENCOSTA NO QUE É NOSSO. `TS_TANQUE_VM` tem componente a |x|
   1 098 — dois milímetros do teto — dentro da região. Ele já nasce colocado
   por `swapTruckTanks()`, e deixá-lo elegível seria arrancar um pedaço do
   tanque novo no dia em que o teto mudar de 1 100 para 1 099. */
/* ===========================================================================
   ▶▶ O AVANÇO DO FLANCO — o buraco que o rígido DERIVADO herda do bitruck
   ===========================================================================
   *"agora no truck, mova os tanques para próximo da cabine, e as rodas e
   estepe também mas apenas um pouco"* — Kennedy, 2026-08-24.

   O 6x2 e o 4x2 deste acervo são o 8x2 com eixo direcional REMOVIDO
   (`cut-scania.cjs`), e a cirurgia só apaga: o entre-eixos continua o do
   bitruck (6 572 mm do direcional ao trativo contra ~4 900 de um truck de
   fábrica) e o equipamento de flanco continua onde estava. Medido na bancada,
   no Scania 6x2 (Zn, frente positiva):

       traseira da cabine        688
       ————— 1 945 mm de NADA —————
       tanques + ARLA        −1 257 … −2 712

   Um caminhão real não tem esse buraco: o tanque começa logo atrás do estribo.

   ⚠️ E O NÚMERO NÃO É POR CAMINHÃO — é MEDIDO, e a mesma conta se protege
   sozinha no bitruck. O limite da frente é o que vier primeiro: a traseira da
   cabine ou a baia do eixo direcional MAIS TRASEIRO. No 8x2 o 2º direcional
   está em Zn −575, ou seja DENTRO do vão, e a conta dá negativo — ninguém anda.
   No VM e no VW, cujos tanques já nascem perto da cabine, ela fica abaixo de
   `AVANCO_MIN` e também não anda. */
/**
 * Quanto o equipamento de flanco fica atrás da cabine depois de avançar.
 *
 * ⚠️ 900 mm, e os primeiros 400 eram DEMAIS: *"os itens foram muito para
 * frente, o tanque e esse mini tanque com tampa azul, volte um pouco para trás,
 * cerca de 50 cm"* — Kennedy, 2026-08-24, com o avanço de 1 545 mm na tela. O
 * número não sai de norma nenhuma; sai do olho do dono, que é quem monta o
 * caminhão, e por isso está aqui em vez de diluído numa conta.
 */
const FOLGA_CABINE = 0.90;
/** …e o meio-vão que se reserva à roda do eixo direcional. 900 mm cobre o pneu
 *  (raio ~510) com o para-lama e o para-barro, que é o que o §43.9 mediu no 2º
 *  direcional (±730) com folga. */
const BAIA_DIRECIONAL = 0.90;
/** Abaixo disto não vale mexer: o caminhão já está montado como o de fábrica. */
const AVANCO_MIN = 0.30;

/* ===========================================================================
   ▶▶ OS RESERVATÓRIOS DE AR — os dois cilindros pretos empilhados
   ===========================================================================
   *"no truck, esses 2 tanques estacados devem estar perto do tanque prata"* —
   Kennedy, 2026-08-25.

   Eles ficam entre o tanque de combustível e o estepe e, com o tanque 1 045 mm
   à frente, sobraram sozinhos no meio do vão. Medidos no Scania 6x2, por
   componente conexo dentro de `chassis_p29` (não são nó nenhum):

       de baixo   Zn −2 592…−2 317 · |x| 931…1 141 · y 340…615 · 210×275×274
       de cima    Zn −2 586…−2 330 · |x| 931…1 141 · y 651…917 · 210×265×256
       a cinta    Zn −2 458…−2 411 · |x| 397…532  · y 474…852 · 136×378×47

   ⚠️ ELES NÃO ANDAM O MESMO QUE O TANQUE. Com o `dz` do conjunto (1 045 mm)
   iriam parar DENTRO dele — o tanque do flanco direito ocupa Zn −1 667…−660. O
   alvo é ENCOSTAR ATRÁS: o avanço deles é o que falta para a frente do grupo
   chegar à traseira do conjunto, com `FOLGA_RESERVA` de ar. */
/** O |x| a partir do qual a peça é do FLANCO — o cilindro chega a 1 141. */
const RESERVA_X = 0.90;
/** A caixa de um reservatório, com folga: nem chapa, nem travessa. */
const RESERVA_DIM = [0.15, 0.50];
/** …e o ar entre ele e a traseira do conjunto de tanques. */
const FOLGA_RESERVA = 0.10;
/** Quanto a região se abre em torno dos cilindros para pescar a cinta e os
 *  suportes que os seguram. */
const RESERVA_FOLGA = 0.15;
/** O |x| mínimo do que anda junto com eles — a cinta cruza a alma (397…532) e
 *  por isso o piso aqui é mais baixo que `BERCO_X_FLANCO`. */
const RESERVA_X_MIN = 0.35;
/**
 * Folga do contato entre as peças do grupo dos reservatórios — 60 mm, o mesmo
 * de `rear-bogie.ts` e pela mesma razão: as peças de um conjunto de rip não se
 * tocam de caixa em caixa, encostam com vão.
 */
const CONTATO_RESERVA = 0.06;
/**
 * Teto de peças do grupo — o freio de "fecha por falta".
 *
 * Medido no 6x2: dois corpos soldados por reservatório mais a cinta e os
 * suportes, ou seja menos de dez peças. 40 dá quatro vezes o pior caso; passar
 * disso quer dizer que a laje vazou, e aí NADA anda — meio conjunto na tela é
 * pior que um conjunto parado.
 */
const RESERVA_TETO = 40;

/** Folga da região do berço em y e em z, em torno da caixa do corpo. */
const FOLGA_BERCO = 0.120;
/** …e o |x| mínimo dela: abaixo disto a peça é travessa, não é berço. */
const BERCO_X_MIN = 0.250;
/**
 * ▶ O PISO DO |x| NA PESCA DO AVANÇO — 600 mm.
 *
 * O recuo em x usa `TETO_FLANCO` como piso ("só interessa quem passa do plano
 * da grade"), e para o AVANÇO em z esse critério deixa para trás metade do
 * berço. Mas ZERO é guloso demais: medido, com teto zero o grupo do tanque
 * pescou **273 componentes de `chassis_p12` e 27 de `chassis_p14` em |x| até
 * 484** — a REBITAGEM DA ALMA (railX 425), que andou 1 045 mm junto. É o mesmo
 * erro que `rear-bogie.ts` documenta pelo outro lado.
 *
 * 600 mm fica acima da rebitagem e abaixo de tudo o que é equipamento de
 * flanco: berço (1 069…1 217), corpo do ARLA (1 090), bocal (1 239).
 */
const BERCO_X_FLANCO = 0.600;
/** O prefixo das peças que este motor coloca. Elas já nascem no lugar. */
const NOSSA_RE = /^TS_/;

/** A peça é nossa (colocada pelo motor) e não do rip? */
function nossa(o: THREE.Object3D, cab: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p && p !== cab.parent; p = p.parent) {
    if (NOSSA_RE.test(p.name || '')) return true;
  }
  return false;
}

/**
 * Acrescenta ao grupo o berço fundido em malha de caminhão inteiro, por
 * COMPONENTE CONEXO. Devolve o relato do que pegou.
 */
function pegaOBerco(
  cab: THREE.Object3D, toLocal: THREE.Matrix4,
  alvo: { malhas: Map<THREE.Mesh, Uint8Array | null>; caixa: THREE.Box3 },
  tomados: Set<THREE.Mesh>, teto: number,
): string {
  const sinal = alvo.caixa.max.x + alvo.caixa.min.x >= 0 ? 1 : -1;
  const reg = new THREE.Box3(
    new THREE.Vector3(sinal > 0 ? BERCO_X_MIN : -1e3,
      alvo.caixa.min.y - FOLGA_BERCO, alvo.caixa.min.z - FOLGA_BERCO),
    new THREE.Vector3(sinal > 0 ? 1e3 : -BERCO_X_MIN,
      alvo.caixa.max.y + FOLGA_BERCO, alvo.caixa.max.z + FOLGA_BERCO));
  const L2C = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const cx = new THREE.Box3();
  const achados: string[] = [];
  let nComp = 0;
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible || !o.geometry) return;
    if (alvo.malhas.has(o) || tomados.has(o) || nossa(o, cab)) return;
    const pos = o.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const idx = o.geometry.getIndex();
    if (!pos || !idx) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    L2C.multiplyMatrices(toLocal, o.matrixWorld);
    cx.copy(o.geometry.boundingBox as THREE.Box3).applyMatrix4(L2C);
    if (!cx.intersectsBox(reg) || Math.max(Math.abs(cx.min.x), Math.abs(cx.max.x)) <= teto) return;

    /* Os vértices em espaço da CABINE, uma vez só — o union-find e as caixas
       por componente leem daqui. */
    const px = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(L2C);
      px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
    }
    const pai = componentes(idx, pos.count);
    const caixas = new Map<number, THREE.Box3>();
    for (let q = 0; q < idx.count; q += 3) {
      const r = pai[idx.getX(q)];
      let b = caixas.get(r);
      if (!b) { b = new THREE.Box3(); caixas.set(r, b); }
      for (let k = 0; k < 3; k++) {
        const i = idx.getX(q + k);
        b.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]));
      }
    }
    const boas = new Set<number>();
    const juntas = new THREE.Box3();
    for (const [r, b] of caixas) {
      if (!reg.containsBox(b)) continue;
      if (Math.max(Math.abs(b.min.x), Math.abs(b.max.x)) <= teto) continue;
      boas.add(r);
      juntas.union(b);
    }
    if (!boas.size) return;
    const mascara = new Uint8Array(pos.count);
    let n = 0;
    for (let i = 0; i < pos.count; i++) if (boas.has(pai[i])) { mascara[i] = 1; n++; }
    /* Uma malha já tomada INTEIRA continua inteira — a máscara só se aplica a
       quem entrou por aqui. */
    if (!alvo.malhas.has(o)) alvo.malhas.set(o, mascara);
    alvo.caixa.union(juntas);
    nComp += boas.size;
    achados.push(`${o.name}: ${boas.size} componente(s), ${n} vértices,`
      + ` |x| até ${(Math.max(Math.abs(juntas.min.x), Math.abs(juntas.max.x)) * 1000).toFixed(0)}`);
  });
  return nComp ? `berço ${achados.join(' · ')}` : 'berço não achado';
}

/**
 * ▶▶▶ APAGA A FERRAGEM ÓRFÃ que o avanço deixou para trás.
 *
 * *"faltou mover o suporte do componente com a tampa azul"* — e depois de duas
 * pescas ainda sobrava. A razão é estrutural: `pegaOBerco()` exige que o
 * componente CAIBA INTEIRO na região, e o berço do rip tem barras que passam
 * dela. Relaxar a contenção não é o caminho — medido, o critério frouxo pesca a
 * SAIA DA CABINE (`sideskirt_p0`, Zn −1 756…−1 659, |x| 1 248), que é peça fixa.
 *
 * Então o que sobra na cota ANTIGA some. É honesto: aquele berço segurava um
 * tanque que não está mais ali, e a alternativa medida é pior — a varredura
 * geral acusou **301 mm de `TANK_R_1` dentro de `chassis_p15`**, ou seja o
 * tanque avançado atravessando a ferragem parada.
 *
 * O recorte é por ÍNDICE e por COMPONENTE CONEXO, a mesma técnica do estepe
 * (`swapSpareWheel`): a malha fica, o componente sai. E roda DEPOIS de
 * `markShared()` como todo o resto deste módulo — quem escreve vértice ou
 * índice na árvore do caminhão precisa da posse da geometria.
 */
function apagaOrfaosDoFlanco(
  cab: THREE.Object3D, toLocal: THREE.Matrix4, reg: THREE.Box3,
  tetoX: number, poupar: Set<THREE.Mesh>,
): string {
  const L2C = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const cx = new THREE.Box3();
  let nComp = 0, nTri = 0;
  const quem: string[] = [];
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible || !o.geometry || nossa(o, cab)) return;
    const pos = o.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const idx = o.geometry.getIndex();
    if (!pos || !idx) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    L2C.multiplyMatrices(toLocal, o.matrixWorld);
    cx.copy(o.geometry.boundingBox as THREE.Box3).applyMatrix4(L2C);
    if (!cx.intersectsBox(reg)) return;

    const px = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(L2C);
      px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
    }
    const pai = componentes(idx, pos.count);
    const caixas = new Map<number, THREE.Box3>();
    for (let q = 0; q < idx.count; q += 3) {
      const r = pai[idx.getX(q)];
      let b = caixas.get(r);
      if (!b) { b = new THREE.Box3(); caixas.set(r, b); }
      for (let k = 0; k < 3; k++) {
        const i = idx.getX(q + k);
        b.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]));
      }
    }
    const mortos = new Set<number>();
    for (const [r, b] of caixas) {
      /* Cabe na região, chega ao flanco e é PEQUENO — ferragem, não estrutura. */
      if (!reg.containsBox(b)) continue;
      if (Math.max(Math.abs(b.min.x), Math.abs(b.max.x)) <= tetoX) continue;
      if (b.max.z - b.min.z > 1.20 || b.max.y - b.min.y > 0.80) continue;
      /* ⚠️ E NUNCA UM CORPO. Ferragem é chapa ou barra: tem SEMPRE uma
         dimensão fina. Um componente cheio nas três é peça de verdade — e foi
         assim que os dois reservatórios de ar (210 × 275 × 274, dentro de
         `chassis_p29`) saíram cortados ao meio na primeira versão: *"fora que
         eles foram cortados no meio"*. */
      if (Math.min(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) > 0.15) continue;
      mortos.add(r);
    }
    if (!mortos.size) return;
    const geo = claimGeometry(o);
    if (poupar.has(o)) return;                  // já mexido por outro passo
    const gidx = geo.getIndex();
    if (!gidx) return;
    const nT = gidx.count / 3;
    const fica: number[] = [];
    let foram = 0;
    for (let q = 0; q < nT; q++) {
      if (mortos.has(pai[gidx.getX(q * 3)])) { foram++; continue; }
      fica.push(gidx.getX(q * 3), gidx.getX(q * 3 + 1), gidx.getX(q * 3 + 2));
    }
    if (!foram) return;
    const Arr = pos.count > 65535 ? Uint32Array : Uint16Array;
    geo.setIndex(new THREE.BufferAttribute(new Arr(fica), 1));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    nComp += mortos.size; nTri += foram;
    quem.push(`${o.name}: ${mortos.size} comp./${foram} tri`);
  });
  return nComp ? `órfãos apagados — ${quem.join(' · ')}` : 'nenhum órfão na cota antiga';
}

/**
 * Recua para dentro o equipamento de flanco que passa do plano da grade.
 *
 * Roda para TODO rígido, depois de `swapTruckTanks()` — o tanque que aquele
 * põe já nasce no teto, e os que ele não toca passam por aqui.
 */
export function recessFlankEquipment(
  cab: THREE.Object3D, mount?: RigidMount,
): string[] {
  cab.updateWorldMatrix(true, true);
  const toLocal = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const linhas: string[] = [];
  /* Do espaço NORMALIZADO (onde `mounts.json` fala) para o LOCAL da cabine
     (onde esta função mede). ⚠️ NÃO é "z = −z": o giro é `orientYaw` e vale para
     qualquer rip, e é assim que o Scania (yaw π) e um rip sem giro passam pela
     mesma conta. */
  const N2L = mount
    ? new THREE.Matrix4().makeRotationY(mount.orientYaw)
      .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0))
      .invert()
    : null;
  const paraLocalZ = (zn: number) => (N2L
    ? new THREE.Vector3(0, 0, zn).applyMatrix4(N2L).z : zn);
  /** O sentido da FRENTE no espaço local — +1 ou −1. */
  const frente = N2L ? Math.sign(paraLocalZ(1) - paraLocalZ(0)) || 1 : 1;

  /* Os alvos: tanque de fábrica ainda visível, e o corpo do ARLA. */
  const alvos: { nome: string; malhas: Map<THREE.Mesh, Uint8Array | null>;
    caixa: THREE.Box3 }[] = [];
  const cx = new THREE.Box3();
  const porGrupo = new Map<string, { malhas: Map<THREE.Mesh, Uint8Array | null>;
    caixa: THREE.Box3 }>();
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible) return;
    const ehTanque = TANK_NODE_RE.test(o.name || '');
    const ehArla = materialsOf(o).some((m) => ARLA_RE.test(m.name || '')) || ARLA_RE.test(o.name);
    if (!ehTanque && !ehArla) return;
    if (!caixaLocal(o, toLocal, cx)) return;
    const chave = ehTanque ? 'tanque' : 'arla';
    let g = porGrupo.get(chave);
    if (!g) { g = { malhas: new Map(), caixa: new THREE.Box3() }; porGrupo.set(chave, g); }
    g.malhas.set(o, null);
    g.caixa.union(cx);
  });
  for (const [nome, g] of porGrupo) alvos.push({ nome, ...g });
  /* ▶ …e os tanques que ESTE motor já pôs (`TS_TANQUE_VM_*`). Eles não entram
     no recuo — nascem no teto —, mas entram no AVANÇO, e por matriz: são nós
     nossos, com pose própria, e mover vértice ali seria escrever num clone do
     molde sem necessidade. */
  const nossos: THREE.Object3D[] = [];
  cab.traverse((o) => { if (o.name.startsWith(RAIZ)) nossos.push(o); });

  /* ▶▶ QUANTO O CONJUNTO AVANÇA — ver o bloco `AVANÇO DO FLANCO`.
     A conta roda numa coordenada só, `u = frente · z local`, que cresce para a
     FRENTE em qualquer rip: assim o Scania (yaw π) e um rip sem giro usam o
     mesmo `Math.max`. */
  let dz = 0;
  let avancoDiz = 'avanço não avaliado (sem mount)';
  if (mount) {
    let uConj = -Infinity;
    const olha = (b: THREE.Box3) => {
      if (b.isEmpty()) return;
      uConj = Math.max(uConj, frente * (frente > 0 ? b.max.z : b.min.z));
    };
    for (const a of alvos) olha(a.caixa);
    for (const o of nossos) {
      o.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh && caixaLocal(m, toLocal, cx)) olha(cx);
      });
    }
    /* O que vier primeiro: a traseira da cabine ou a baia do direcional mais
       traseiro. É esta segunda parcela que faz o BITRUCK não andar. */
    const znLivre = Math.min(mount.cabRearZ,
      Math.min(...(mount.axles.steerZ.length ? mount.axles.steerZ : [Infinity]))
      - BAIA_DIRECIONAL);
    const uLivre = frente * paraLocalZ(znLivre);
    const bruto = uLivre - FOLGA_CABINE - uConj;
    dz = bruto >= AVANCO_MIN ? frente * bruto : 0;
    avancoDiz = bruto >= AVANCO_MIN
      ? `avanço ${(Math.abs(dz) * 1000).toFixed(0)} mm — o conjunto acabava a `
        + `${(bruto * 1000 + FOLGA_CABINE * 1000).toFixed(0)} mm da cabine`
        + ` (limite Zn ${(znLivre * 1000).toFixed(0)}: `
        + `${mount.cabRearZ <= Math.min(...mount.axles.steerZ) - BAIA_DIRECIONAL
          ? 'traseira da cabine' : 'baia do direcional mais traseiro'})`
        + ` e passa a acabar a ${(FOLGA_CABINE * 1000).toFixed(0)}`
      : `sem avanço — sobravam ${(bruto * 1000).toFixed(0)} mm, abaixo do mínimo `
        + `de ${(AVANCO_MIN * 1000).toFixed(0)}`;
  }
  linhas.push(avancoDiz);

  /* ⚠️ QUEM JÁ ANDOU NÃO ANDA DE NOVO. A marca só é posta depois de o grupo
     MOVER de fato: um grupo que desiste (o decalque `vm_arla` do VM, que mora
     em |x| 1 040 e não passa do teto) não pode confiscar malha do seguinte.
     ⚠️ DECLARADA AQUI EM CIMA desde 2026-08-24: o avanço do flanco pesca o
     berço do tanque ANTES do laço de recuo, e a marca é a mesma — deixá-la lá
     embaixo dava `can't access lexical declaration 'tomados' before
     initialization` no navegador (o `tsc` avisa, o esbuild da bancada não). */
  const tomados = new Set<THREE.Mesh>();

  /* ▶▶▶ PASSO 1 — O AVANÇO, e ele é OUTRA PESCA.
     ------------------------------------------------------------------------
     ⚠️ AQUI O TETO DE FLANCO NÃO VALE. `pegaOBerco()` só aceita componente que
     PASSE de `TETO_FLANCO`, e esse critério é do RECUO EM X: para lá, o que
     está dentro do plano da grade não interessa. Para o AVANÇO EM Z interessa
     tudo — quem fica é quem o tanque atropela. Medido depois do primeiro
     avanço: `chassis_p15` continuava em Zn −2 900…−1 352 com |x| até 1 069 (o
     berço do ARLA abaixo do teto) e a varredura geral acusou **145 mm de
     `TANK_R_1` dentro dele**.

     Por isso o avanço é um passo PRÓPRIO, com teto ZERO, mapa só-dz e alvos
     próprios — e roda ANTES do recuo, cujas regiões passam a ser as NOVAS.
     Fundir os dois numa pesca só faria uma de duas coisas erradas: recuar em x
     o que está dentro do plano da grade, ou mover duas vezes o que as duas
     pescas achassem. */
  if (dz !== 0) {
    const tomadosZ = new Set<THREE.Mesh>();
    const caixa = new THREE.Box3();
    const grupos: { nome: string; caixa: THREE.Box3;
      malhas: Map<THREE.Mesh, Uint8Array | null> }[] = [];
    for (const o of nossos) {
      caixa.makeEmpty();
      o.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh && caixaLocal(m, toLocal, cx)) caixa.union(cx);
      });
      /* Os tanques nossos andam por MATRIZ lá embaixo — aqui eles entram só
         como REGIÃO, para a ferragem deles ser pescada. */
      if (!caixa.isEmpty()) grupos.push({ nome: o.name, caixa: caixa.clone(), malhas: new Map() });
    }
    /* ⚠️ E O GRUPO DO RIP LEVA AS PRÓPRIAS MALHAS. `pegaOBerco()` acha o que
       está EM VOLTA; o corpo do ARLA (`chassis_p19`) e o bocal (`p21`) são as
       malhas DO ALVO, e um passo que só move o que a pesca acha deixa o corpo
       parado — medido, o ARLA ficou em Zn −1 665…−1 365 com o berço já 1 045 mm
       à frente. */
    for (const a2 of alvos) {
      if (a2.caixa.isEmpty()) continue;
      grupos.push({ nome: a2.nome, caixa: a2.caixa.clone(), malhas: new Map(a2.malhas) });
    }
    /* ▶ A TRASEIRA DO EQUIPAMENTO, POR FLANCO — medida AGORA, antes de o grupo
       andar, porque é daqui que sai a âncora dos reservatórios.
       ------------------------------------------------------------------------
       ⚠️ POR FLANCO, e não pelo conjunto. `deixada` une os dois lados, e os dois
       tanques não acabam na mesma cota: medido no 6x2, o do flanco direito
       termina 448 mm mais atrás. Ancorar os reservatórios do flanco esquerdo na
       traseira do direito é o que deixou *"554 mm de vão"* onde se pediram 100.

       ⚠️ E POR VÉRTICE, e não por caixa de malha: o nó de tanque do rip traz os
       DOIS flancos dentro (ver o cabeçalho), então a caixa dele não sabe dizer
       onde acaba cada lado. */
    const trasLado = new Map<number, number>();
    {
      const vv = new THREE.Vector3();
      const L2C3 = new THREE.Matrix4();
      const olhaMalha = (m: THREE.Mesh) => {
        const pos = m.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
        if (!pos) return;
        L2C3.multiplyMatrices(toLocal, m.matrixWorld);
        for (let i = 0; i < pos.count; i++) {
          vv.fromBufferAttribute(pos, i).applyMatrix4(L2C3);
          if (Math.abs(vv.x) < RESERVA_X_MIN) continue;
          const lado = vv.x >= 0 ? 1 : -1;
          const u = frente * vv.z;
          const atual = trasLado.get(lado);
          if (atual === undefined || u < atual) trasLado.set(lado, u);
        }
      };
      for (const o of nossos) {
        o.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && m.visible) olhaMalha(m); });
      }
      for (const a2 of alvos) for (const [m] of a2.malhas) olhaMalha(m);
    }

    for (const g of grupos) {
      const alvoZ = { malhas: g.malhas, caixa: g.caixa.clone() };
      const rel = pegaOBerco(cab, toLocal, alvoZ, tomadosZ, BERCO_X_FLANCO);
      if (!alvoZ.malhas.size) { linhas.push(`avanço · ${g.nome}: ${rel}`); continue; }
      const n = encolheERecua(cab, alvoZ.malhas, 1, 0, 1, alvoZ.caixa.max.y, dz);
      for (const [m] of alvoZ.malhas) tomadosZ.add(m);
      linhas.push(`avanço · ${g.nome}: ${n} vértices andaram · ${rel}`);
    }
    /* A caixa que o conjunto ocupava — é a régua do que vem a seguir. */
    const deixada = new THREE.Box3();
    for (const g of grupos) deixada.union(g.caixa);

    /* ▶▶ OS RESERVATÓRIOS DE AR — SOLDADOS, POR CONTATO, E ANCORADOS NO
       TANQUE DO PRÓPRIO FLANCO.
       ----------------------------------------------------------------------
       *"esses 2 tanques stackados devem ir para próximo ao tanque que foi
       movido"* — Kennedy, 2026-08-25 · *"eles também tiveram partes que foram
       perdidas, além disso eles deveriam ficar próximos do tanque grande"* —
       Kennedy, 2026-08-25, sobre o resultado da primeira versão.

       DUAS COISAS ESTAVAM ERRADAS, e as duas estão medidas:

       1 · A UNIDADE. A primeira versão pescava sobre `componentes()`, que une
           por ÍNDICE de vértice e não solda por posição — e no rip uma peça
           vira dezenas de tiras. Os filtros de FORMA (`RESERVA_DIM` pede corpo
           cheio, mínimo 150 mm nos três eixos) aceitavam o miolo e recusavam as
           tiras: o corpo andava e a casca ficava. É o mesmo defeito de
           `rear-bogie.ts`, e a saída é a mesma — `componentesSoldados()`.
           Medido no 6x2, com solda o reservatório de baixo é **um** componente
           de 393 × 275 × 274 mais **um** de 210 × 275 × 274 (a divisão em
           |x| 932 é do próprio rip); sem solda, dezenas.

       2 · A ÂNCORA. `deixada` é a união dos grupos dos DOIS flancos, e o tanque
           do flanco direito acaba 448 mm mais atrás que o do esquerdo. Os
           reservatórios moram no flanco ESQUERDO e paravam na traseira do
           DIREITO: medido, tanque em Zn −1 219 e reservatório em −1 773, ou
           seja **554 mm de vão** onde se pediram 100. A âncora passa a ser a
           traseira do equipamento DO MESMO FLANCO (`trasLado`), na cota nova.

       ⚠️ E ELES CONTINUAM NÃO ANDANDO O MESMO QUE O TANQUE: com o `dz` do
       conjunto parariam DENTRO dele. O alvo é ENCOSTAR ATRÁS, com
       `FOLGA_RESERVA` de ar. */
    {
      const busca = deixada.clone().expandByScalar(0.30);
      const porMalha = new Map<THREE.Mesh, { pai: Int32Array; caixas: Map<number, THREE.Box3> }>();
      const cxM = new THREE.Box3();
      cab.traverse((node) => {
        const o = node as THREE.Mesh;
        if (!o.isMesh || !o.visible || !o.geometry || nossa(o, cab)) return;
        const pos = o.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        const idx = o.geometry.getIndex();
        if (!pos || !idx || pos.count > 260000) return;
        /* Peneira barata antes da cara — soldar o caminhão todo para descartar
           99 % logo depois custaria mais que todo o resto desta função. */
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const L2C2 = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
        cxM.copy(o.geometry.boundingBox as THREE.Box3).applyMatrix4(L2C2);
        if (!cxM.intersectsBox(busca)) return;
        const vv = new THREE.Vector3();
        const px = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          vv.fromBufferAttribute(pos, i).applyMatrix4(L2C2);
          px[i * 3] = vv.x; px[i * 3 + 1] = vv.y; px[i * 3 + 2] = vv.z;
        }
        const pai = componentesSoldados(px, idx, pos.count);
        const caixas = new Map<number, THREE.Box3>();
        for (let q = 0; q < idx.count; q += 3) {
          const r = pai[idx.getX(q)];
          let b2 = caixas.get(r);
          if (!b2) { b2 = new THREE.Box3(); caixas.set(r, b2); }
          for (let k = 0; k < 3; k++) {
            const i = idx.getX(q + k);
            b2.expandByPoint(vv.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]));
          }
        }
        porMalha.set(o, { pai, caixas });
      });

      /* ▶ AS SEMENTES: corpo CHEIO nas três dimensões, no flanco, dentro do vão
         que o conjunto deixou. Chapa e travessa não são corpo. */
      const corpos: { malha: THREE.Mesh; raiz: number; caixa: THREE.Box3 }[] = [];
      const juntas = new THREE.Box3();
      const uDe = (b: THREE.Box3, ponta: 'frente' | 'tras') => {
        const a2 = frente * b.min.z, b3 = frente * b.max.z;
        return ponta === 'frente' ? Math.max(a2, b3) : Math.min(a2, b3);
      };
      for (const [malha, dados] of porMalha) {
        for (const [r, b2] of dados.caixas) {
          const fx = Math.max(Math.abs(b2.min.x), Math.abs(b2.max.x));
          if (fx < RESERVA_X) continue;
          const d = b2.getSize(new THREE.Vector3());
          if (Math.min(d.x, d.y, d.z) < RESERVA_DIM[0] || Math.max(d.x, d.y, d.z) > RESERVA_DIM[1]) continue;
          if (uDe(b2, 'frente') > uDe(deixada, 'frente')) continue;
          corpos.push({ malha, raiz: r, caixa: b2 });
          juntas.union(b2);
        }
      }
      if (!corpos.length) {
        linhas.push('reservatórios de ar: nenhum corpo no vão');
      } else {
        /* ▶ A LAJE e a CORRENTE — a mesma doutrina de `rear-bogie.ts`: só entra
           quem cabe INTEIRO na laje, e dentro dela a corrente propaga a partir
           dos corpos. A cinta cruza a alma (|x| 397…532) e por isso a laje é
           mais generosa em x que o piso de `RESERVA_X`. */
        const laje = juntas.clone().expandByScalar(RESERVA_FOLGA);
        const alvoR = new Map<THREE.Mesh, Set<number>>();
        const dentro = new Set<string>();
        const marca = (malha: THREE.Mesh, r: number) => {
          let s2 = alvoR.get(malha);
          if (!s2) { s2 = new Set(); alvoR.set(malha, s2); }
          s2.add(r);
        };
        const candidatas: { malha: THREE.Mesh; raiz: number; caixa: THREE.Box3 }[] = [];
        for (const [malha, dados] of porMalha) {
          for (const [r, b2] of dados.caixas) {
            if (!laje.containsBox(b2)) continue;             // atravessa = é chassi
            if (b2.min.x * b2.max.x <= 0) continue;          // travessa: cruza o eixo
            if (Math.max(Math.abs(b2.min.x), Math.abs(b2.max.x)) < RESERVA_X_MIN) continue;
            candidatas.push({ malha, raiz: r, caixa: b2 });
          }
        }
        let fronteira = corpos.map((c) => c.caixa);
        for (const c of corpos) { marca(c.malha, c.raiz); dentro.add(`${c.malha.uuid}#${c.raiz}`); }
        for (let volta = 0; fronteira.length && dentro.size <= RESERVA_TETO; volta++) {
          const nova: THREE.Box3[] = [];
          for (const c of candidatas) {
            const chave = `${c.malha.uuid}#${c.raiz}`;
            if (dentro.has(chave)) continue;
            const inflada = c.caixa.clone().expandByScalar(CONTATO_RESERVA);
            if (!fronteira.some((f) => f.intersectsBox(inflada))) continue;
            dentro.add(chave); marca(c.malha, c.raiz); nova.push(c.caixa);
          }
          fronteira = nova;
        }
        const vizinhos = dentro.size - corpos.length;
        /* ▶ ENCOSTAR ATRÁS DO TANQUE DO PRÓPRIO FLANCO, na cota NOVA. */
        const lado = juntas.getCenter(new THREE.Vector3()).x >= 0 ? 1 : -1;
        const uTras = trasLado.get(lado);
        const uTrasNova = (uTras !== undefined ? uTras : uDe(deixada, 'tras')) + frente * dz;
        const andaU = (uTrasNova - FOLGA_RESERVA) - uDe(juntas, 'frente');
        const anda = frente * Math.max(0, andaU);
        let mexidos = 0;
        if (dentro.size > RESERVA_TETO) {
          /* ▶ FECHA POR FALTA. Meio conjunto na tela é pior que ele parado. */
          linhas.push(`reservatórios de ar: NADA ANDOU — a corrente vazou da laje`
            + ` (${dentro.size} peças, teto ${RESERVA_TETO})`);
        } else {
          if (anda !== 0) {
            for (const [malha, raizes2] of alvoR) {
              const dados = porMalha.get(malha);
              if (!dados) continue;
              const geo = claimGeometry(malha);
              const gpos = geo.getAttribute('position') as THREE.BufferAttribute;
              let n = 0;
              for (let i = 0; i < gpos.count; i++) {
                if (!raizes2.has(dados.pai[i])) continue;
                gpos.setZ(i, gpos.getZ(i) + anda);
                n++;
              }
              if (!n) continue;
              gpos.needsUpdate = true;
              geo.computeBoundingBox();
              geo.computeBoundingSphere();
              mexidos += n;
            }
            juntas.translate(new THREE.Vector3(0, 0, anda));
            deixada.union(juntas);
          }
          linhas.push(`reservatórios de ar: ${corpos.length} corpo(s) + ${vizinhos} vizinho(s)`
            + ` (soldados) · ${mexidos} vértices andaram ${(Math.abs(anda) * 1000).toFixed(0)} mm`
            + ` · âncora: flanco x${lado > 0 ? '+' : '−'} (local)`
            + `${uTras === undefined ? ' (SEM tanque neste flanco — caiu no conjunto todo)' : ''}`
            + ` · folga ${(FOLGA_RESERVA * 1000).toFixed(0)} mm`);
        }
      }
    }

    /* ▶ E O QUE NÃO ANDOU, SOME. A pesca não alcança a barra do berço que passa
       da região, e o tanque avançado passaria por cima dela (medido: 301 mm).
       A região do apagamento é a FAIXA QUE O CONJUNTO DEIXOU — da cota antiga
       até a nova —, no flanco. Ver `apagaOrfaosDoFlanco()`. */
    if (!deixada.isEmpty()) {
      /* Só a fatia que ficou VAZIA: do fundo antigo até onde a peça nova
         começa. Com `dz` positivo em z local, é a ponta de trás. */
      /* ⚠️ A REGIÃO É A CAIXA ANTIGA INTEIRA, e não só a fatia que esvaziou.
         A primeira versão cortava só a ponta vazia (|dz| de espessura), e o
         berço do ARLA não está lá: ele mora em Zn -1 665...-1 365, DENTRO do
         espaço que o tanque avançado passou a ocupar. Quem já andou não é
         atingido — está em outra cota, fora desta caixa. */
      const corte = deixada.clone();
      corte.min.y -= FOLGA_BERCO; corte.max.y += FOLGA_BERCO;
      linhas.push(apagaOrfaosDoFlanco(cab, toLocal, corte, BERCO_X_FLANCO, new Set()));
    }
    /* Os alvos do recuo passam a viver na cota NOVA — a translação é rígida, e
       somar o delta à caixa é exato. */
    for (const a2 of alvos) if (!a2.caixa.isEmpty()) a2.caixa.translate(new THREE.Vector3(0, 0, dz));
  }

  /* ▶▶ PASSO 2 — O RECUO EM X, com as regiões já na cota nova. */
  for (const alvo of alvos) {
    const vaoZ = alvo.caixa.max.z - alvo.caixa.min.z;
    const perto = new THREE.Box3(
      alvo.caixa.min.clone().subScalar(0.10), alvo.caixa.max.clone().addScalar(0.10));
    /* Quem ENCOSTA e é peça local — o bocal do ARLA entra por aqui. */
    cab.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.visible || alvo.malhas.has(o) || tomados.has(o)) return;
      if (!caixaLocal(o, toLocal, cx)) return;
      if ((cx.max.z - cx.min.z) > vaoZ * 1.5) return;           // malha de caminhão inteiro
      if (!cx.intersectsBox(perto)) return;
      if (Math.max(Math.abs(cx.min.x), Math.abs(cx.max.x)) <= TETO_FLANCO) return;
      alvo.malhas.set(o, null);
      alvo.caixa.union(cx);
    });
    /* …e o BERÇO, que é o que sobra dentro da malha de caminhão inteiro. Só
       para o ARLA: o tanque de combustível é um NÓ e traz a ferragem dele
       dentro (85 componentes no VM), e medido no VW a mesma pesca levaria duas
       peças de `truck_p4` que são saia de cabine, não berço. */
    let relatoBerco = '';
    if (alvo.nome === 'arla'
      && Math.max(Math.abs(alvo.caixa.min.x), Math.abs(alvo.caixa.max.x)) > TETO_FLANCO) {
      relatoBerco = ' · ' + pegaOBerco(cab, toLocal, alvo, tomados, TETO_FLANCO);
    }

    const fora = Math.max(Math.abs(alvo.caixa.min.x), Math.abs(alvo.caixa.max.x));
    const dentro = Math.min(Math.abs(alvo.caixa.min.x), Math.abs(alvo.caixa.max.x));
    /* UM LADO SÓ é o que autoriza a âncora interna: num grupo que cruza a linha
       de centro (o tanque do VM é um nó com os dois flancos) a "face interna"
       não existe, e o que vale é o mapa em torno de x = 0. */
    const umLado = alvo.caixa.min.x * alvo.caixa.max.x > 0;
    const topo = alvo.caixa.max.y;
    let ax: number, bx: number, ky: number, comoW: string;
    if (alvo.nome === 'tanque') {
      /* Só o TANQUE encolhe a seção; ele é corpo solto e encolhe em torno de 0. */
      ax = ENCOLHE_SECAO;
      bx = Math.min(0, TETO_FLANCO - fora * ENCOLHE_SECAO);
      ky = ENCOLHE_SECAO;
      comoW = `seção × ${ax.toFixed(2)} ancorada no topo y ${(topo * 1000).toFixed(0)}`
        + (bx < 0 ? ` e recuo de ${(-bx * 1000).toFixed(0)} mm` : ' e sem recuo');
    } else if (fora <= TETO_FLANCO + 1e-4) {
      /* JÁ CABE em x (o decalque `vm_arla` do VM) — mas ainda pode ter de
         ANDAR: o avanço vale para o conjunto todo, e deixar um pedaço para trás
         é o defeito que §46 registra com o berço. */
      continue;                       // já cabe: o avanço do passo 1 bastou
    } else if (umLado && dentro < TETO_FLANCO) {
      /* O ARLA: mais RASO, ancorado na face interna. Ver `encolheERecua()`. */
      ax = (TETO_FLANCO - dentro) / (fora - dentro);
      bx = dentro * (1 - ax);
      ky = 1;
      comoW = `profundidade × ${ax.toFixed(3)} ancorada na face interna`
        + ` |x| ${(dentro * 1000).toFixed(0)} · altura intacta`;
    } else {
      /* Sem face interna utilizável não há o que ancorar: recua e pronto. */
      ax = 1;
      bx = TETO_FLANCO - fora;
      ky = 1;
      comoW = `recuo de ${((fora - TETO_FLANCO) * 1000).toFixed(0)} mm (sem âncora interna)`;
    }
    const mexidos = encolheERecua(cab, alvo.malhas, ax, bx, ky, topo);
    for (const [o] of alvo.malhas) tomados.add(o);
    linhas.push(`${alvo.nome}: ${alvo.malhas.size} malha(s) · ${mexidos} vértices · ${comoW}`
      + ` · face |x| ${(fora * 1000).toFixed(0)} → ${(Math.min(fora * ax + bx, TETO_FLANCO) * 1000).toFixed(0)} mm`
      + ` (grade ocupa 1 140…1 275)${relatoBerco}`);
  }
  /* …e os tanques nossos andam por MATRIZ, que é como eles foram postos. */
  if (dz !== 0) {
    const t = new THREE.Vector3(), q2 = new THREE.Quaternion(), e = new THREE.Vector3();
    for (const o of nossos) {
      o.matrixAutoUpdate = false;
      o.matrix.decompose(t, q2, e);
      t.z += dz;
      o.matrix.compose(t, q2, e);
      o.updateMatrixWorld(true);
    }
  }

  return linhas;
}
