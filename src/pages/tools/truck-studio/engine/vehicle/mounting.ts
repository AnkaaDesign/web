/* MONTAGEM SOBRE CHASSI RÍGIDO — a contraparte de `coupling.ts`.
   ---------------------------------------------------------------------------
   `coupling.ts` resolve um CAVALO MECÂNICO e um SEMIRREBOQUE: a garganta da
   quinta roda recebe o pino-rei, o conjunto ganha inclinação de nariz, e o
   solver tem de provar folga de perfil numa curva. Nada disso existe aqui.

   Um SOBRECHASSI é aparafusado no quadro de um caminhão rígido. Não há junta,
   não há grau de liberdade e não há inclinação: a carroceria é solidária ao
   chassi. O contrato inteiro são três números por caminhão, medidos uma vez:

       frameTopY   a mesa da longarina — onde o sub-chassi da carroceria assenta
       cabRearZ    até onde a cabine vai; a carroceria começa depois de uma folga
       frameEndZ   a ponta do quadro, que só serve para RELATAR balanço traseiro

   Eles moram em `models/vehicles/mounts.json` e são medidos por
   `tools/trailer-bench/mountprobe.ts`. O cabeçalho daquele manifesto explica
   por que `frameTopY` é um percentil e não um máximo.

   ===========================================================================
   O DATUM DA CARROCERIA É MEDIDO AQUI, E NÃO PODE SER O PONTO MAIS BAIXO.

   `groundAndCenter()` assenta o implemento pelo ponto mais baixo dele — o que é
   certo para um semirreboque, cujo ponto mais baixo é o pneu. No sobrechassi o
   ponto mais baixo são as DUAS MANGUEIRAS TRASEIRAS, que penduram 800 mm abaixo
   do sub-chassi: assentar por elas põe a carroceria 0,8 m alta, e o erro é
   grande demais para passar por "quase".

   O datum certo é o fundo do SUB-CHASSI, e ele se acha por FORMA e não por
   nome: um membro do sub-chassi ATRAVESSA o baú, uma mangueira não. Medido no
   sobrechassi gancheiro, as duas longarinas auxiliares têm 8,450 m de vão em Z
   (contra 8,63 m de baú), estão em |x| 0,374…0,439 e o fundo delas é
   y = 0,001 — praticamente o zero do arquivo, que é onde o modelador o pôs. As
   mangueiras têm 0,334 m de vão. O corte em metade do comprimento cai num vazio
   de 8,1 m: não é um limiar escolhido, é o único lugar em que ele cabe.

   E o |x| das longarinas auxiliares fecha com a ALMA DA LONGARINA DOS DOIS
   CAMINHÕES, que está em 0,425: o sub-chassi monta a cavalo sobre o quadro,
   como tem de ser. Isso não é usado no cálculo — é a conferência de que os dois
   lados da montagem falam do mesmo objeto. */
import * as THREE from 'three';

/** Uma entrada de `mounts.json`, já validada. */
export interface RigidMount {
  id: string;
  /** Giro que leva o GLB ao espaço normalizado (`axes.forward = +Z`). */
  orientYaw: number;
  /** Y do contato do pneu NO GLB CRU — subtraí-lo põe o caminhão no chão. */
  groundY: number;
  centerX: number;
  /** A mesa da longarina, acima do solo. */
  frameTopY: number;
  /** Inclinação da mesa no espaço normalizado (dy/dz). NEGATIVA: ela cai para
   *  a frente. Ver o bloco `frameSlope` de `mounts.json`. */
  frameSlope: number;
  /** Menor z da cabine (ela fica no +Z). */
  cabRearZ: number;
  /** Menor z do quadro. Só relatório: o balanço traseiro é consequência. */
  frameEndZ: number;
  cabTopY: number;
  /**
   * ⚠️ AS COTAS DE EIXO ERAM DADO MORTO. `mounts.json` traz `steerZ`/`driveZ`/
   * `liftZ` medidos pelo ARO desde 18/08, e este parser as descartava: só
   * `config` atravessava, e `config` é lido num `console.info` e em mais lugar
   * nenhum. Quem precisa delas é geometria — a proteção lateral tem de nascer
   * ENTRE os eixos e o para-barro atrás do último.
   */
  axles: { config: string; steerZ: number[]; driveZ: number[]; liftZ: number[] };
  /** Alma da longarina, em |x|. 0,425 nos três rígidos, medido. */
  railX: number;
  /** O rabo do quadro, quando medido. `null` = este caminhão não estica. */
  tail: RigidTail | null;
}

/**
 * O RABO DO QUADRO — o que permite o balanço traseiro seguir o comprimento do
 * baú. Medido por `tools/trailer-bench/tailprobe.cjs`; ver `_tailNote` em
 * `mounts.json`, que traz a medida de cada número.
 */
export interface RigidTail {
  /** Onde a LONGARINA acaba. ⚠️ NÃO é `frameEndZ` — a diferença é 89 / 173 /
   *  50 mm, e `frameEndZ` é a fita do para-choque ou a lanterna. */
  railEndZ: number;
  /** O plano mais traseiro do cacho: a fita no VM e no Scania, a LANTERNA no
   *  VW (ela passa 15 mm atrás do para-choque). É contra ele que a traseira do
   *  baú se alinha. */
  tailEndZ: number;
  /** O plano de corte da baia mais traseira — o padrão de `stretchRigidFrame`. */
  cutZ: number;
  /** As baias, da traseira para a frente. `z` é o plano de corte de cada uma e
   *  `cap` a capacidade de ENCURTAMENTO dela, em metros. Alongar não consome
   *  baia nenhuma: estica a quad da longarina, que é extrusão pura ali. */
  bays: { z: number; cap: number }[];
}

interface RawRigid {
  sourceFile?: string;
  orientYaw?: number;
  groundY?: number;
  centerX?: number;
  frameTopY?: number;
  frameSlope?: number;
  cabRearZ?: number;
  frameEndZ?: number;
  cabTopY?: number;
  railX?: number;
  axles?: { config?: string; steerZ?: number[]; driveZ?: number[]; liftZ?: number[] };
  tail?: {
    railEndZ?: number;
    tailEndZ?: number;
    cutZ?: number;
    bays?: { z?: number; cap?: number }[];
  };
}

/**
 * O bloco `tail`, validado — ou `null`.
 *
 * MEIA MEDIDA É PIOR QUE NENHUMA, a mesma regra de `findRigid()`: um rabo sem
 * `railEndZ` ou sem baia nenhuma põe o para-choque num lugar plausível e
 * errado. Sem o bloco, `stretchRigidFrame()` não roda e o quadro fica com o
 * comprimento de fábrica — que é exatamente o comportamento de antes desta
 * medida existir.
 */
function parseTail(t: RawRigid['tail']): RigidTail | null {
  if (!t) return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const railEndZ = num(t.railEndZ);
  const tailEndZ = num(t.tailEndZ);
  const cutZ = num(t.cutZ);
  if (railEndZ === null || tailEndZ === null || cutZ === null) return null;
  const bays = (t.bays ?? [])
    .map((b) => ({ z: num(b?.z), cap: num(b?.cap) }))
    .filter((b): b is { z: number; cap: number } => b.z !== null && b.cap !== null && b.cap > 0)
    /* Da traseira para a frente: é a ordem em que o encurtamento as consome, e
       não se pode confiar na ordem do arquivo para uma decisão de geometria. */
    .sort((a, b) => a.z - b.z);
  if (!bays.length) return null;
  return { railEndZ, tailEndZ, cutZ, bays };
}

export interface MountManifest {
  rigids?: Record<string, RawRigid>;
  defaults?: { cabGap?: number };
}

/** Folga entre a traseira da cabine e a testeira da carroceria, quando o
 *  manifesto não diz. 150 mm é o que a bancada usou e o que a foto aprovou. */
export const FALLBACK_CAB_GAP = 0.15;

export const cabGapOf = (man: MountManifest | null): number =>
  (typeof man?.defaults?.cabGap === 'number' ? man.defaults.cabGap : FALLBACK_CAB_GAP);

/**
 * ▶▶ O BALANÇO TRASEIRO QUE ESTE CHASSI PODE TER — e é lei, não estética.
 * ---------------------------------------------------------------------------
 * CONTRAN 882/2021, art. 2º: o balanço traseiro não pode passar de **60 % da
 * distância entre os eixos EXTREMOS** nem de **3,50 m**. Ele é medido do último
 * eixo até o ponto mais traseiro do conjunto — que num rígido é a traseira da
 * CARROCERIA, e não a ponta do quadro (o quadro segue o baú, ver
 * `chassis-tail.ts`).
 *
 * ⚠️ POR QUE ISTO PASSOU A EXISTIR: o toco derivado herda o quadro do 6x2. O
 * VM 4x2 nasce com 5 341 mm entre os eixos e o baú de fábrica punha a traseira
 * a **4 050 mm** do eixo trativo — 550 mm acima do teto absoluto e 846 acima
 * dos 60 %. Com isso o eixo cai a 49 % do comprimento da carroceria; num VM 4x2
 * de catálogo (entre-eixos 5 150, balanço 2 570) ele fica a 67 %. É literalmente
 * a queixa: *"a segunda roda está muito ao centro, baú parece muito grande para
 * um toco"*.
 *
 * ⚠️ E NÃO É UM NÚMERO POR CAMINHÃO, É POR CONFIGURAÇÃO. O que muda entre o
 * toco, o truck e o bitruck do MESMO chassi é a posição do último eixo e o vão
 * entre os extremos — e é só disso que a conta depende. Medido nas dez
 * configurações do catálogo, só os dois tocos derivados são cortados; o do
 * Scania já cabia, e é por isso que ele nunca pareceu errado.
 */
export interface LimiteBalanco {
  /** Z do último eixo, no espaço normalizado. */
  ultimoEixoZ: number;
  /** Balanço traseiro máximo, em metros. */
  maximo: number;
  /** O z mais traseiro que a carroceria pode ter. */
  traseiraMinZ: number;
  /** Distância entre os eixos extremos — o que a norma manda usar. */
  vaoExtremos: number;
}

export function rearOverhangLimit(m: RigidMount): LimiteBalanco | null {
  const eixos = [...m.axles.steerZ, ...m.axles.driveZ, ...m.axles.liftZ]
    .filter((z) => Number.isFinite(z));
  if (eixos.length < 2) return null;
  const ultimoEixoZ = Math.min(...eixos);
  const vaoExtremos = Math.max(...eixos) - ultimoEixoZ;
  const maximo = Math.min(3.50, 0.60 * vaoExtremos);
  return { ultimoEixoZ, maximo, traseiraMinZ: ultimoEixoZ - maximo, vaoExtremos };
}

const norm = (s: string) => s.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();

/**
 * Acha o caminhão rígido pelo ARQUIVO (e, em último caso, pelo id).
 *
 * Mesma junção de `findTractor()` e pelo mesmo motivo: o catálogo aponta para o
 * `.glb`, não para a chave legível do manifesto. Uma entrada sem `frameTopY` ou
 * sem `cabRearZ` é recusada inteira — meia montagem põe a carroceria num lugar
 * plausível e errado, que é pior que o caminho que diz "não sei".
 */
export function findRigid(
  man: MountManifest | null, key: { id?: string | null; file?: string | null },
): RigidMount | null {
  if (!man?.rigids) return null;
  const wantFile = key.file ? norm(key.file) : null;
  let hit: [string, RawRigid] | null = null;
  if (wantFile) {
    for (const e of Object.entries(man.rigids)) {
      if (e[1].sourceFile && norm(e[1].sourceFile) === wantFile) { hit = e; break; }
    }
  }
  if (!hit && key.id && man.rigids[key.id]) hit = [key.id, man.rigids[key.id]];
  if (!hit) return null;

  const [id, r] = hit;
  if (typeof r.frameTopY !== 'number' || typeof r.cabRearZ !== 'number') return null;
  return {
    id,
    orientYaw: r.orientYaw ?? 0,
    groundY: r.groundY ?? 0,
    centerX: r.centerX ?? 0,
    frameTopY: r.frameTopY,
    /* Ausente = ZERO, e zero é o comportamento de antes: um manifesto que ainda
       não foi medido monta a carroceria nivelada, como sempre montou. */
    frameSlope: typeof r.frameSlope === 'number' ? r.frameSlope : 0,
    cabRearZ: r.cabRearZ,
    frameEndZ: typeof r.frameEndZ === 'number' ? r.frameEndZ : r.cabRearZ,
    cabTopY: typeof r.cabTopY === 'number' ? r.cabTopY : 0,
    /* Ordenadas da FRENTE para trás em cada papel: quem consome quer "o último
       direcional" e "o primeiro trativo", e depender da ordem do arquivo para
       uma decisão de geometria é confiar em quem editou o JSON à mão. */
    axles: {
      config: r.axles?.config ?? '?',
      steerZ: [...(r.axles?.steerZ ?? [])].sort((a, b) => b - a),
      driveZ: [...(r.axles?.driveZ ?? [])].sort((a, b) => b - a),
      liftZ: [...(r.axles?.liftZ ?? [])].sort((a, b) => b - a),
    },
    railX: typeof r.railX === 'number' ? r.railX : 0.425,
    tail: parseTail(r.tail),
  };
}

/**
 * A pose da RAIZ do caminhão que o leva do espaço cru para o normalizado.
 *
 * `world = R_y(yaw)·p + t`, e o normalizado é `N(p) = R_y(orientYaw)·(p − o)`
 * com `o = [centerX, groundY, 0]`. Igualando os dois: `yaw = orientYaw` e
 * `t = −R_y(orientYaw)·o`. É a mesma álgebra que `solveCoupling()` faz para o
 * cavalo — escrita aqui de novo porque lá ela sai dentro de uma solução de
 * engate que não existe neste caso.
 */
export function rigidCabPose(m: RigidMount) {
  const c = Math.cos(m.orientYaw), s = Math.sin(m.orientYaw);
  return {
    yaw: m.orientYaw,
    x: -(c * m.centerX),
    y: -m.groundY,
    z: (s * m.centerX),
  };
}

/**
 * O fundo do SUB-CHASSI da carroceria — ver o bloco do cabeçalho.
 *
 * Devolve `null` quando nenhuma malha atravessa metade do baú, que é o caso de
 * um bake sem sub-chassi. Quem chama cai no ponto mais baixo de sempre e diz
 * que caiu: é melhor uma carroceria alta e um aviso do que um datum inventado.
 */
export function measureMountDatum(root: THREE.Object3D): number | null {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const b = new THREE.Box3();
  const parts: { y: number; dz: number }[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (!bb) return;
    b.copy(bb).applyMatrix4(o.matrixWorld);
    box.union(b);
    parts.push({ y: b.min.y, dz: b.max.z - b.min.z });
  });
  if (!parts.length) return null;
  const half = (box.max.z - box.min.z) / 2;
  let datum = Infinity;
  for (const p of parts) if (p.dz >= half && p.y < datum) datum = p.y;
  return Number.isFinite(datum) ? datum : null;
}

/** Faixa de z, em bandas desta espessura, para o histograma de área. */
const REAR_WALL_BIN = 0.02;
/** Quanto acima da mesa da longarina a parede da cabine começa a valer. */
const REAR_WALL_FROM_FRAME = 0.30;
/** Abaixo disto, uma banda é respingo de malha e não superfície: ela não entra
 *  no agrupamento (senão duas superfícies distantes viram uma). */
const REAR_WALL_NOISE = 0.06;
/** Quantas bandas vazias ainda contam como a MESMA superfície. Uma parede de
 *  cabine real ocupa várias bandas — no Scania P a dela cobre 220 mm. */
const REAR_WALL_GAP = 3;

/**
 * A PAREDE TRASEIRA DA CABINE, por ÁREA — e não o menor z da malha.
 *
 * `mounts.json` traz `cabRearZ` como o menor z do modelo, e isso é uma medida
 * honesta de "até onde o caminhão vai" e uma medida ruim de "onde a carroceria
 * encosta": no Volvo VM a chaminé, o suporte do para-lama e a mangueira do
 * escapamento passam 200 mm ATRÁS da parede. Somando a folga de 150 mm, o
 * resultado é o vão de ~350 mm que o dono fotografou — *"precisa encontrar o
 * ponto e angulação correta pra cada um dos 3 modelos de chassi pra não ficar
 * esse vão em nenhum deles"*.
 *
 * A parede é uma superfície GRANDE virada para −Z; uma chaminé não é. Então a
 * medida é um histograma de ÁREA por banda de z, restrito ao que está acima da
 * mesa da longarina (abaixo dela é chassi, tanque e escapamento, que não fazem
 * parede). É a mesma técnica que achou o plano de montagem do Thermo King
 * pequeno — 0,881 m² numa banda contra milésimos nas vizinhas.
 *
 * ===========================================================================
 * ⚠️ "A MAIOR BANDA DO CAMINHÃO" NÃO É A PAREDE — foi o defeito do Scania P.
 *
 * Duas coisas erravam juntas, e cada uma sozinha já bastava para pôr a
 * carroceria 1,89 m dentro da cabine (medido em 2026-08-20):
 *
 * 1. O TRIÂNGULO ENTRAVA INTEIRO SE UM VÉRTICE PASSASSE DO LIMIAR. A banda de z
 *    é escolhida pelo CENTRÓIDE; o corte em y era por vértice. O carenagem do
 *    para-choque do P (`parachoque_0_p2`, |x| ≤ 0,98, y até 1,29) encosta 13 mm
 *    acima do limiar de 1,277 e entrou com **1,43 m² inteiros** — mais que a
 *    parede de verdade em qualquer banda isolada. Agora os dois cortes olham
 *    para o CENTRÓIDE, que é a mesma pergunta feita do mesmo jeito.
 *
 * 2. A PAREDE É A SUPERFÍCIE DE TAMANHO DE PAREDE MAIS ATRÁS, e não a maior do
 *    caminhão. À frente dela existem outras legitimamente grandes — a face
 *    interna do para-brisa, o painel, a carenagem do capô —, e num rip
 *    qualquer uma pode ganhar de uma parede que a malha reparte. A do Scania P
 *    se espalha por 220 mm de z (0,80…1,04) em bandas de 0,89 · 0,54 · 0,73 …
 *    e nenhuma delas sozinha alcança o para-choque.
 *
 *    Então as bandas viram GRUPOS (vizinhas, com até `REAR_WALL_GAP` bandas
 *    vazias entre elas), o grupo escolhido é o MAIS TRASEIRO que junte
 *    `minArea`, e o z devolvido é a banda de maior área DENTRO dele.
 *
 * MEDIDO nos três rígidos, a régua nova não mexe em quem já estava certo:
 *
 *   | | régua velha | régua nova |
 *   |---|---|---|
 *   | Volvo VM   | 1,20 | **1,20** |
 *   | Scania P   | 2,78 (o para-choque) | **0,82** |
 *   | VW Titan   | 1,30 | **1,30** |
 *
 * `null` quando nenhum grupo junta ao menos `minArea` — aí quem chama volta
 * para o manifesto, que é o comportamento conhecido.
 */
export function measureCabRearWall(
  cab: THREE.Object3D, m: RigidMount, minArea = 0.6,
): number | null {
  cab.updateWorldMatrix(true, true);
  /* ⚠️ NO ESPAÇO LOCAL DA RAIZ DO CAMINHÃO, e não em mundo. `norm()` abaixo é a
     transformação CRU → NORMALIZADO, a mesma que `rigidCabPose()` escreve na
     pose; medir em mundo com a pose já aplicada normalizaria duas vezes. Assim
     a medida vale em qualquer instante, esteja o caminhão posto ou não. */
  const paraRaiz = cab.matrixWorld.clone().invert();
  const m4 = new THREE.Matrix4();
  const cos = Math.cos(m.orientYaw), sin = Math.sin(m.orientYaw);
  /* `frameTopY` é acima do SOLO e `norm()` não mexe em y, então o limiar no
     espaço cru é ele mais `groundY`. */
  const yLim = m.groundY + m.frameTopY + REAR_WALL_FROM_FRAME;
  const bandas = new Map<number, number>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const u = new THREE.Vector3(), v = new THREE.Vector3(), n = new THREE.Vector3();
  /* NORMALIZAÇÃO POR VÉRTICE, a mesma de `measureCabRearProfiles()`: o GLB cru
     aponta para −Z e `orientYaw` é quem o vira. Girar a caixa depois seria a
     caixa de uma caixa girada. */
  const norm = (p: THREE.Vector3) => {
    const dx = p.x - m.centerX;
    const nz = -dx * sin + p.z * cos;
    p.set(dx * cos + p.z * sin, p.y, nz);
  };
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position as THREE.BufferAttribute;
    const idx = o.geometry.index;
    const tri = idx ? idx.count / 3 : pos.count / 3;
    for (let t = 0; t < tri; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      m4.multiplyMatrices(paraRaiz, o.matrixWorld);
      a.fromBufferAttribute(pos, i0).applyMatrix4(m4); norm(a);
      b.fromBufferAttribute(pos, i1).applyMatrix4(m4); norm(b);
      c.fromBufferAttribute(pos, i2).applyMatrix4(m4); norm(c);
      /* POR CENTRÓIDE, como a banda de z — ver o item 1 do cabeçalho. */
      if ((a.y + b.y + c.y) / 3 < yLim) continue;
      u.subVectors(b, a); v.subVectors(c, a); n.crossVectors(u, v);
      const len = n.length();
      if (len < 1e-9) continue;
      if (n.z / len > -0.7) continue;                 // não olha para trás
      const zc = (a.z + b.z + c.z) / 3;
      const k = Math.round(zc / REAR_WALL_BIN);
      bandas.set(k, (bandas.get(k) || 0) + len / 2);
    }
  });
  if (!bandas.size) return null;

  /* O GRUPO MAIS TRASEIRO QUE JUNTE `minArea` — ver o item 2 do cabeçalho.
     As bandas de respingo saem antes de agrupar: sem isso um fio de área
     costura a parede à carenagem do capô e o grupo vira o caminhão inteiro. */
  const ks = [...bandas.entries()]
    .filter(([, ar]) => ar >= REAR_WALL_NOISE)
    .map(([k]) => k)
    .sort((p, q) => p - q);                            // crescente: o 1º é o mais TRASEIRO
  if (!ks.length) return null;
  let i = 0;
  while (i < ks.length) {
    let j = i;
    while (j + 1 < ks.length && ks[j + 1] - ks[j] <= REAR_WALL_GAP) j++;
    let soma = 0, melhor = ks[i], area = 0;
    for (let t = i; t <= j; t++) {
      const ar = bandas.get(ks[t]) as number;
      soma += ar;
      if (ar > area) { area = ar; melhor = ks[t]; }
    }
    if (soma >= minArea) return melhor * REAR_WALL_BIN;
    i = j + 1;
  }
  return null;
}

export interface MountSolution {
  /** pose da raiz do caminhão, em coordenadas locais do `rigGroup` */
  cab: { yaw: number; x: number; y: number; z: number };
  /** pose da raiz da carroceria — sem giro e sem inclinação: ela é solidária */
  body: { yaw: number; x: number; y: number; z: number; pitchX: number };
  /** quanto de quadro sobra atrás da carroceria (negativo = ela passa dele) */
  rearOverhang: number;
  /** teto da carroceria acima do solo */
  roofY: number;
}

/**
 * Assenta a carroceria no quadro.
 *
 * ⚠️ AS MEDIDAS DE `body` SÃO NO REFERENCIAL DA PRÓPRIA CARROCERIA, e isso é
 * contrato — não "a pose em que ela estiver".
 *
 * A pose que sai daqui é ABSOLUTA (`applyRootPose()` escreve `position.set()`,
 * não soma), então uma medida tirada em espaço de MUNDO só fecharia enquanto a
 * raiz do implemento estivesse na origem. Ela não está: `groundAndCenter()`
 * desloca X (centra o baú) e Y (assenta o datum), e a própria montagem escreve
 * Z. Misturar os dois referenciais é a classe de defeito que este bloco existe
 * para fechar — o sintoma é a carroceria nascer metros atrás da cabine, com
 * TODOS os números do relatório corretos, porque o erro está entre a medida e a
 * escrita e não em nenhuma das duas.
 *
 * `centerX` fecha a outra metade: a carroceria deste bake **não é simétrica**
 * (pele direita +1,3105, esquerda −1,3024), e devolver `x = 0` jogaria fora o
 * centramento que `groundAndCenter()` tinha calculado — 4 mm de desalinhamento
 * entre o baú e a linha de centro do chassi.
 *
 * A carroceria não gira: os dois GLB já concordam em direção depois de o
 * caminhão ser normalizado (a testeira do implemento é o maior z dele, e a zona
 * de carroceria do caminhão corre do maior para o menor z).
 */
export function solveRigidMount(
  m: RigidMount,
  body: { bottom: number; frontZ: number; rearZ: number; roofY: number; centerX?: number },
  cabGap: number,
): MountSolution {
  const dz = (m.cabRearZ - cabGap) - body.frontZ;
  const dx = m.centerX - (body.centerX ?? 0);

  /* ---- A INCLINAÇÃO ----
     *"a parte da frente do chassi é mais baixa, o implemento deve ficar
     levemente inclinado"* — Kennedy, 2026-08-20, com print do vão.

     A mesa da longarina não é horizontal: ela CAI para a frente. Assentar a
     carroceria numa cota só (`frameTopY`) a deixa nivelada sobre um quadro que
     não é, e o que sobra é uma CUNHA — medida no VM, 200 mm de vão na frente
     contra 6 mm atrás, com 0,1 mm de resíduo num ajuste de reta. Não é folga
     mal calculada: é a carroceria fora de paralelo.

     `Rx(θ)` leva (0, y, z) a `y·cosθ − z·sinθ`, então a inclinação do fundo
     passa a ser `−sinθ`. Igualá-la a `frameSlope` dá `θ = asin(−frameSlope)` —
     positivo, porque a mesa cai para +z e o nariz tem de descer com ela.

     E O PIVÔ É A TRASEIRA, não a origem. Hoje a carroceria ENCOSTA no quadro na
     ponta de trás (6 mm) e abre para a frente; girar em torno de qualquer outro
     ponto a enterraria ou a levantaria inteira. Com o pivô em `body.rearZ` o
     contato de trás não se mexe e o nariz desce os 232 mm que fecham o vão. */
  const pitchX = Math.asin(Math.max(-0.2, Math.min(0.2, -m.frameSlope)));
  const sin = Math.sin(pitchX), cos = Math.cos(pitchX);
  /* `y` tal que o fundo em `body.rearZ` continue em `frameTopY`. */
  const dy = m.frameTopY - body.bottom * cos + body.rearZ * sin;

  return {
    cab: rigidCabPose(m),
    body: { yaw: 0, x: dx, y: dy, z: dz, pitchX },
    rearOverhang: (body.rearZ + dz) - m.frameEndZ,
    /* O TETO TAMBÉM GIRA, e é ele que a câmera enquadra: medi-lo sem a
       inclinação daria um teto que não existe em nenhum ponto do baú. O ponto
       mais alto de um baú inclinado com o nariz para baixo é a TRASEIRA. */
    roofY: dy + body.roofY * cos - body.rearZ * sin,
  };
}
