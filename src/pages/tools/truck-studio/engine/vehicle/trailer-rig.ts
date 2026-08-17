/* Baú paramétrico — a costura das duas metades, e a ÂNCORA DE ENGATE do lado
   do implemento.
   ---------------------------------------------------------------------------
   Contraparte web de `truck-studio-desktop/src/studio/trailer.ts`. Só a classe
   `TrailerRig` viajou: a `LiverySurface` de lá pinta um canvas único na malha
   branca, e aqui a arte tem outro dono — `vehicle/livery.ts`, com três telas
   fabric e a LiveryUV (TEXCOORD_1) dos painéis recortados. Trazer as duas
   implementações para o mesmo arquivo seria trazer duas verdades sobre onde a
   pintura mora.

   O que este arquivo é: um par. `TrailerBody` regenera o BRANCO;
   `TrailerAssembly` move o que não é branco (teto, cantoneira, frame traseiro,
   varões, dobradiças, lanternas) para acompanhá-lo. Um sem o outro é sempre
   errado — subir a altura só no branco abre um vão embaixo do teto e deixa a
   ferragem das portas amontoada no pé; alongar só o branco deixa as lanternas
   flutuando no meio do vão.

   Fora do baú NADA escala: chassi, rodagem, para-lamas e a quinta roda ficam
   onde estão, que é o pedido. E o comprimento cresce PARA TRÁS — a dianteira
   carrega o pino-rei, e mexer nela desengataria o conjunto (ver `mapZ()` em
   trailer-geometry.ts, comportamento `front`).

   A largura não é editável: é padrão 2,60 m.

   ===========================================================================
   O ACESSOR DE ENGATE — `get hitch()`, e por que ele é CALCULADO e não lido.

   `models/vehicles/hitch.json` traz o lado CAVALO congelado, com `sha256` dos
   bytes em que cada número foi medido. Isso é o certo para o caminhão: o GLB
   dele não muda em runtime.

   O implemento é o oposto. Ele é PARAMÉTRICO: `TrailerBody` + `TrailerAssembly`
   regeneram a geometria a cada medida digitada. Uma entrada estática de
   implemento em `hitch.json` estaria errada no instante seguinte ao primeiro
   resize, e errada EM SILÊNCIO — o pino continuaria "no lugar" segundo o
   manifesto enquanto a geometria andou. Por isso `implements: {}` no manifesto
   é uma decisão, não uma pendência.

   O acessor remede o conjunto vivo em `measureAnchors()`, chamado no construtor
   e no fim de todo `set()`. Repare que ele NÃO assume que o pino fica parado:
   ele OBSERVA onde o pino está. É mais forte que a suposição, e é o que faz o
   engate seguir a geometria em vez de acreditar nela — a sonda
   `verify-coupling.mjs` varre a faixa de medidas justamente para exercitar isso.

   Nada aqui sai de `Box3.setFromObject` como MEDIDA. A caixa de um nó girado é
   a caixa de uma caixa girada, estritamente maior que a real e sem limite de
   quanto — é o que fazia o implemento pairar ~230 mm. Ela aparece uma única
   vez, como REJEIÇÃO barata de malha longe da região de interesse, onde errar
   para mais só custa varrer vértice à toa. */
import * as THREE from 'three';
import { TrailerBody, type TrailerDims, type DoorSpec, type Face } from './trailer-geometry';
import { TrailerAssembly } from './trailer-assembly';
import { applyBakeFixes } from './trailer-bake-fixes';
import {
  deriveImplementHitch,
  type ImplementHitch, type ImplementMeasurements, type KingpinStation,
} from './coupling';
import { invalidateVehicleLightBounds } from './lights';

export type { TrailerDims };
export type { ImplementHitch };
export type { DoorSpec, Face };

/* Os pneus, pelo mesmo critério de `models.ts`: nome OU material. */
const TYRE_RE = /pneu|tire/i;
/** Banda de contato — `defaults.tyreContactBand` do manifesto. */
const CONTACT_BAND = 0.05;
/** Meia-largura da faixa da linha de centro onde o pino-rei cabe. */
const KP_HALF_X = 0.25;
/**
 * Profundidade da busca do pino, MEDIDA DA TESTEIRA PARA TRÁS.
 *
 * O que havia aqui era `zLo = (z0 + z1) / 2` — a metade dianteira inteira,
 * 7,35 m neste baú. Não é uma janela: é quase o modelo todo, e dentro dela o
 * ponto mais baixo da linha de centro abaixo do piso NÃO é o pino. São os
 * `RIVET_LOW_L/R` (`inox-ferragem`), os frisos de rebite que correm rentes ao
 * chão do começo ao fim. Medido no app rodando: o "pino" saía em z 0,000 com
 * chapa 0,986 m e uma saliência de 989 mm — contra 6,4274 m / 1,242 m / 87 mm
 * do pino de verdade. Como o solver encosta ESSE ponto na garganta, o conjunto
 * inteiro engatava 6,43 m fora do lugar, em todo modelo do catálogo.
 *
 * O pino-rei fica a 0,8 m da testeira neste baú, e a prática não passa de
 * ~2,5 m em nenhum semirreboque. 3,0 m é folgado para o que existe e estreito
 * para o que não é pino — e é ancorado na TESTEIRA, que é o datum imóvel do
 * `mapZ()` (o comprimento cresce para trás), então a janela não anda com o
 * resize. Verificado no app: 2, 3 e 4 m dão o mesmo pino.
 */
const KP_SEARCH_DEPTH = 3.0;
/** Uma saliência menor que isto não é o pino, é rebarba de malha. */
const KP_MIN_DROP = 0.04;
/**
 * E uma saliência MAIOR que isto também não é o pino.
 *
 * Um pino de 2" desce ~85 mm; o deste modelo desce 87. O teto existe porque a
 * ausência dele foi metade do defeito acima: com só um piso, um friso que
 * descia 989 mm passou por pino-rei sem uma linha de aviso. Prefira recusar a
 * âncora — o caminho legado é ruim, mas ele DIZ que é.
 */
const KP_MAX_DROP = 0.20;
/** Anel em que a chapa de apoio é votada, medido do eixo do pino. */
const PLATE_RING = [0.08, 0.30] as const;

/* ---------------------------------------------------------------------------
   OS FUROS DA CHAPA — as constantes de `measureKingpinStations()`.

   A chapa do pino deste baú é furada para DUAS posições. As duas são pads
   congruentes na linha de centro, 800 mm entre eixos; uma carrega o pino de 2"
   e a outra, a flange cega. Nada aqui procura NOME: procura-se a FORMA — um
   disco pequeno, na linha de centro, sob a dianteira —, que é a mesma doutrina
   de `measureKingpin()` e pelo mesmo motivo (não existe nó chamado "furo", e um
   re-bake renomeia tudo). */

/** Raio máximo, em planta, de uma flange de pino. Acima disso é chapa, não furo. */
const KP_STATION_MAX_R = 0.22;
/** E abaixo disto é parafuso, não flange. */
const KP_STATION_MIN_R = 0.07;
/** Duas peças a menos que isto em Z são do MESMO furo. */
const KP_STATION_CLUSTER = 0.12;
/** Gêmeas de pads congruentes casam a menos disto na pegada. */
const KP_TWIN_TOL = 0.02;

interface Station {
  /** eixo do furo no referencial da RAIZ do implemento */
  z: number;
  /** a malha do PINO, quando este furo é o que o carrega */
  pin: THREE.Object3D | null;
  /** a gêmea cega deste furo — a peça que troca de lugar com o pino */
  blind: THREE.Object3D | null;
}

interface Anchors {
  contactY: number;
  centerX: number;
  bogieZMin: number;
  bogieZMax: number;
  kingpinX: number;
  kingpinZ: number;
  plateBottomY: number;
  /** diagnóstico: saliência medida do pino abaixo da chapa */
  pinDrop: number;
  /** quantos vértices de pneu caíram na banda de contato */
  contactVerts: number;
}

export class TrailerRig {
  readonly body: TrailerBody;
  readonly assembly: TrailerAssembly;
  /** As medidas de fábrica, para o `reset()` e para a interface se ancorar. */
  readonly base: TrailerDims;

  private readonly root: THREE.Object3D;
  private anchors: Anchors | null = null;
  /** Os furos da chapa, remedidos junto com as âncoras. Ver `Station`. */
  private stations: Station[] = [];

  /**
   * @param root o nó do implemento. As ÂNCORAS DE ENGATE medem no referencial
   *   DESTA RAIZ (ver `rigMatrixOf`), então elas não dependem mais de onde o
   *   conjunto está na cena. `TrailerAssembly`, esse sim, continua decidindo em
   *   espaço de mundo contra números do construtor ("encosta no teto?"), então
   *   todo `set()` ainda tem de rodar na pose de carga — quem garante isso é
   *   `setTrailerDims()` em `vehicle/models.ts`, que é o dono da pose.
   */
  constructor(root: THREE.Object3D) {
    this.root = root;
    this.body = new TrailerBody(root);
    this.base = this.body.profile.base;
    root.add(this.body.group);

    const p = this.body.profile;
    /* AS CORREÇÕES DO BAKE, e a ordem delas é o contrato: depois de
       `TrailerBody` (que é quem mede a grade do friso, régua da ferragem da
       porta) e ANTES de `TrailerAssembly` (que congela `piece.base` no
       construtor e reescreve a partir dela em todo `set()` — corrigir depois
       daria uma correção que o primeiro resize apaga). Ver
       `trailer-bake-fixes.ts`. */
    applyBakeFixes(root, {
      floorY: p.floorY, roofY: p.roofY, z0: p.z0, z1: p.z1,
      halfWidth: p.base.width / 2,
      vale: this.body.valeInfo,
    });

    this.assembly = new TrailerAssembly(root, {
      floorY: p.floorY, roofY: p.roofY, z0: p.z0, z1: p.z1,
      baseHeight: p.base.height, baseLength: p.base.length,
    });

    /* DEPOIS de `TrailerAssembly`: o construtor dele roda `roundOutScales()`,
       que devolve a redondeza aos pneus e SOBE a linha de contato em 25 mm.
       Medir antes disso seria medir um pneu ovalizado — e os 25 mm entrariam
       inteiros na altura de engate. É exatamente essa a diferença entre os
       1,2418 m que `trailer_meta.json` declara e o 1,2170 m medido aqui. */
    this.measureAnchors();
  }

  get current(): TrailerDims { return this.body.current; }
  get profile() { return this.body.profile; }

  /** Proporção do painel lateral — comprimento : altura da parte branca. */
  get sideAspect(): number {
    const d = this.body.current;
    return d.length / d.height;
  }

  /** Frisos na altura corrente, e o passo medido no modelo. */
  get ribs(): { count: number; pitch: number } {
    const { skirtHeight, capHeight, pitch } = this.body.profile;
    return {
      count: Math.round((this.body.current.height - skirtHeight - capHeight) / pitch),
      pitch,
    };
  }

  /** Altura mais próxima que fecha um número inteiro de frisos. */
  snapHeight(h: number) { return this.body.snapHeight(h); }

  /**
   * Quanto o teto subiu em relação ao modelo de fábrica, na altura corrente.
   *
   * Não é `height - base.height`: a chapa lisa grande estica a partir do PISO
   * pela razão `ky`, então a linha do teto anda por essa mesma razão e não pela
   * diferença bruta. Quem depende disso é o Thermo King, pendurado na parede
   * dianteira a uma folga fixa abaixo do teto — se ele não acompanhar por este
   * número exato, sobra ou falta exatamente o erro.
   */
  roofDelta(): number {
    const { floorY, roofY, base } = this.body.profile;
    const ky = this.body.current.height / base.height;
    return (floorY + (roofY - floorY) * ky) - roofY;
  }

  set(patch: { height?: number; length?: number }): TrailerDims {
    /* O branco primeiro: é ele que resolve a altura para um número inteiro de
       frisos (`snapHeight`), e o conjunto tem de seguir a altura EFETIVA, não a
       pedida. Passar `patch` direto para os dois deixaria a ferragem meio friso
       fora do lugar sempre que o pedido caísse entre dois passos. */
    const d = this.body.set(patch);
    this.assembly.set(d.height, d.length);
    /* E o engate remede. Custa uma varredura de vértice numa operação que já
       reescreveu milhões deles — e é o que substitui "o pino fica parado"
       (uma suposição) por "o pino está aqui" (uma medida). */
    this.measureAnchors();
    /* E as LUZES remedem. A cor de cada lanterna sai da distância dela às duas
       faces do baú, em metros, e as duas faces acabaram de se mexer: sem isto um
       baú alongado de 12 para 15 m deixaria as lanternas traseiras a 3 m da face
       que a medida anterior registrou, ou seja âmbar em vez de vermelhas. Só
       marca; quem remede é a próxima escrita, dentro de applyRig(). */
    invalidateVehicleLightBounds();
    return d;
  }

  reset() { return this.set({ height: this.base.height, length: this.base.length }); }

  /* -------------------------------------------------------------- portas */

  /**
   * As portas laterais de uma face — o método que `livery-structure.ts` procura.
   *
   * Ele detecta a existência deste método antes de chamar (`typeof
   * rig.setDoors === 'function'`), e enquanto ele não existia as portas
   * cadastradas viravam só a camada 2D do editor. Agora elas viram vão recortado
   * na chapa, folha frisada, moldura, borracha e ferragem — ver
   * `trailer-door.ts`.
   *
   * Só o BRANCO tem porta. `TrailerAssembly` não é avisado de propósito: nada do
   * que ele move (teto, cantoneira, frame traseiro, varões, lanternas) cruza o
   * retângulo de uma porta lateral, e mandá-lo recortar seria dar a ele uma
   * segunda verdade sobre onde a porta está.
   *
   * NÃO chama `measureAnchors()`. Uma porta não move pino-rei nem pneu, e a
   * medição custa uma varredura de vértice inteira — que aqui aconteceria a cada
   * tecla digitada no campo de largura da porta.
   */
  setDoors(face: Face, doors: DoorSpec[]): this {
    this.body.setDoors(face, doors);
    return this;
  }

  /**
   * Idem, sem reconstruir — ver `TrailerBody.stageDoors()`.
   *
   * É por aqui que `models.setTrailerDoors()` entra: ele guarda as portas e
   * deixa o rebuild para a sequência de `setTrailerDims()`, que é a única que
   * também descarta e recorta de novo as chapas de livery. Reconstruir sem
   * recortar duplica os painéis.
   */
  stageDoors(face: Face, doors: DoorSpec[]): this {
    this.body.stageDoors(face, doors);
    return this;
  }

  getDoors(face: Face): DoorSpec[] { return this.body.getDoors(face); }

  /* ------------------------------------------------------------- o engate */

  /**
   * O lado IMPLEMENTO do contrato de engate, na medida CORRENTE.
   *
   * `null` só se o construtor não conseguiu achar pneu nem pino — nesse caso
   * `models.ts` cai no engate legado e diz por quê, em vez de acoplar no vazio.
   */
  get hitch(): ImplementHitch | null {
    const a = this.anchors;
    if (!a) return null;
    const p = this.body.profile;
    const d = this.body.current;
    /* O teto acompanha a altura pela razão `ky` a partir do PISO — a mesma
       conta de `roofDelta()`. Ler `p.roofY` cru daria a linha de fábrica e o
       perfil da testeira ficaria curto em todo baú mais alto. */
    const roofY = p.roofY + this.roofDelta();
    const m: ImplementMeasurements = {
      contactY: a.contactY,
      centerX: a.centerX,
      bogieZMin: a.bogieZMin,
      bogieZMax: a.bogieZMax,
      kingpinX: a.kingpinX,
      kingpinZ: a.kingpinZ,
      plateBottomY: a.plateBottomY,
      floorY: p.floorY,
      roofY,
      /* A testeira NÃO anda: o comprimento cresce para trás (`front` em
         `mapZ()`), justamente para não desengatar. `z1` é o datum imóvel. */
      frontWallZ: p.z1,
      halfWidth: d.width / 2,
      dims: { ...d },
      landingGear: null,   // não existe nó de patola neste GLB; ver measureAnchors()
      profileBands: 12,
      kingpinStations: this.kingpinStations,
    };
    return deriveImplementHitch(m);
  }

  /** Diagnóstico das âncoras cruas, para a HUD e para a sonda. */
  get anchorsDebug(): Readonly<Anchors> | null { return this.anchors; }

  /* ------------------------------------------------ os furos da chapa */

  /**
   * Os furos de pino da chapa, do mais dianteiro para o mais traseiro.
   *
   * Medidos da geometria a cada `measureAnchors()`, como tudo mais deste lado —
   * um baú que voltar do bake com três furos passa a ter três aqui sem uma linha
   * de mudança, e um com furo único devolve um item só.
   */
  get kingpinStations(): KingpinStation[] {
    return this.stations.map((s) => ({ z: s.z, hasPin: !!s.pin }));
  }

  /** Onde o pino está AGORA, ou `null` se não há pino medido. */
  get kingpinStationZ(): number | null {
    const s = this.stations.find((x) => x.pin);
    return s ? s.z : null;
  }

  /**
   * Aparafusa o pino no furo mais próximo de `z` — e devolve a flange cega de lá
   * para o furo que vagou, que é o que um mecânico faz com as duas peças.
   *
   * Move MALHA, não um número: o pino é a âncora do conjunto e quem a lê é
   * `measureKingpin()`, que OBSERVA onde ele está. Deslocar só a medida deixaria
   * o pino pendurado no vazio a 800 mm da quinta roda — visível de qualquer
   * ângulo baixo, e exatamente o defeito que a medição por forma existe para
   * impedir.
   *
   * ⚠️ CHAME COM A FUSÃO SOLTA. `vehicle/merge.ts` assa os triângulos num balde
   * por material e esconde as origens; mexer numa origem depois disso não muda
   * um pixel. Quem cuida disso é `placeTrailer()`, pelo guarda de geometria.
   *
   * ⚠️ E NA POSE DE CARGA, pelo mesmo motivo de `set()`: a remedição no fim roda
   * `measureKingpin()`, cujos limiares vivem no referencial da raiz.
   *
   * @returns `true` se alguma coisa se moveu.
   */
  setKingpinStation(z: number): boolean {
    const from = this.stations.find((s) => s.pin);
    if (!from || !from.pin) return false;
    let to = from;
    for (const s of this.stations) {
      if (Math.abs(s.z - z) < Math.abs(to.z - z)) to = s;
    }
    const d = to.z - from.z;
    if (Math.abs(d) < 1e-4) return false;

    this.shiftAlongRigZ(from.pin, d);
    /* A gêmea cega do destino volta para o furo que vagou. Sem isso o furo
       novo ganharia pino E tampa sobrepostos, e o antigo ficaria aberto. */
    if (to.blind) this.shiftAlongRigZ(to.blind, -d);

    console.info('[engate] pino-rei aparafusado no furo z', to.z.toFixed(4),
      `(${d > 0 ? '+' : ''}${(d * 1000).toFixed(0)} mm),`,
      'balanço até a testeira', (this.body.profile.z1 - to.z).toFixed(3), 'm');

    this.measureAnchors();
    return true;
  }

  /**
   * Translada `o` de `d` metros ao longo do Z DA RAIZ do implemento.
   *
   * A conta passa pela matriz pai→raiz e volta porque a direção tem de ser
   * expressa em espaço LOCAL do nó: um `position.z += d` cru só está certo
   * enquanto nenhum pai girar ou escalar, e essa é a suposição que
   * `rigMatrixOf()` já pagou caro para não ter. Dois pontos transformados em vez
   * de uma direção normalizada — `transformDirection()` normaliza, e aqui o
   * comprimento É o dado.
   */
  private shiftAlongRigZ(o: THREE.Object3D, d: number): void {
    const parent = o.parent;
    const delta = new THREE.Vector3(0, 0, d);
    if (parent) {
      parent.updateWorldMatrix(true, false);
      const toLocal = new THREE.Matrix4()
        .multiplyMatrices(this.rigInverse(), parent.matrixWorld).invert();
      const a = new THREE.Vector3(0, 0, 0).applyMatrix4(toLocal);
      const b = new THREE.Vector3(0, 0, d).applyMatrix4(toLocal);
      delta.copy(b).sub(a);
    }
    o.position.add(delta);
    /* Nó CONGELADO — `freezeMatrices()` desliga `matrixAutoUpdate` no implemento
       inteiro, então quem escreve `position` escreve a matriz também. */
    o.updateMatrix();
    o.updateWorldMatrix(false, true);
  }

  /* --------------------------------------------------------------- medição */

  /**
   * Matriz que leva os vértices de `o` ao referencial DA RAIZ DO IMPLEMENTO.
   *
   * Era `o.matrixWorld` cru, e isso é uma armadilha viva: os limiares contra os
   * quais os vértices são comparados (`profile.z0/z1/floorY`) vivem no
   * referencial da raiz, então a medida só fechava enquanto a raiz estivesse na
   * identidade dentro de uma cadeia na identidade. Com o conjunto engatado
   * (`rigGroup` a 22 m e girado 180°, mais a inclinação de engate em X) TODO
   * vértice cai fora da janela e `measureAnchors()` devolve `null` em silêncio —
   * medido: um `set()` fora de `setTrailerDims()` derruba o engate inteiro para
   * o caminho legado. `setTrailerDims()` desfaz a pose antes de chamar, e por
   * isso o app escapava; a porta seguinte não escaparia.
   *
   * Com a inversa da raiz na conta o resultado é o MESMO na pose de carga (a
   * inversa é a identidade ali) e passa a ser o mesmo em qualquer outra.
   */
  private rigMatrixOf(o: THREE.Object3D, inv: THREE.Matrix4): THREE.Matrix4 {
    return new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
  }

  /** A inversa da matriz de mundo da raiz, recalculada a cada medição. */
  private rigInverse(): THREE.Matrix4 {
    this.root.updateWorldMatrix(true, true);
    return this.root.matrixWorld.clone().invert();
  }

  private measureAnchors(): void {
    this.root.updateWorldMatrix(true, true);
    const tyres = this.measureTyres();
    if (!tyres) {
      console.warn('[engate] nenhum pneu encontrado no implemento — '
        + 'sem plano de contato, o engate cai no caminho legado.');
      this.anchors = null;
      return;
    }
    const kp = this.measureKingpin(tyres.contactY);
    if (!kp) {
      console.warn('[engate] pino-rei não encontrado sob a dianteira — '
        + 'sem âncora de implemento, o engate cai no caminho legado.');
      this.anchors = null;
      this.stations = [];
      return;
    }
    this.anchors = { ...tyres, ...kp };
    /* DEPOIS do pino: as estações precisam da chapa para saber qual delas está
       com o pino (a que desce abaixo dela) e quais estão cegas. */
    this.stations = this.measureKingpinStations(kp.plateBottomY);
    if (this.stations.length > 1) {
      console.info('[engate] chapa do pino com', this.stations.length, 'furos —',
        this.stations.map((s) => `${s.z.toFixed(3)}${s.pin ? '*' : ''}`).join(' · '),
        '(* = pino)');
    }
    console.info('[engate] implemento medido — pino x', kp.kingpinX.toFixed(4),
      'z', kp.kingpinZ.toFixed(4), '· chapa', kp.plateBottomY.toFixed(4),
      `(${((kp.plateBottomY - tyres.contactY) * 1000).toFixed(0)} mm do solo)`,
      '· saliência do pino', (kp.pinDrop * 1000).toFixed(0), 'mm',
      '· bogie z', tyres.bogieZMin.toFixed(3), '…', tyres.bogieZMax.toFixed(3),
      `(halfSpan ${((tyres.bogieZMax - tyres.bogieZMin) / 2).toFixed(3)})`);
  }

  /**
   * Plano de contato e bogie, POR VÉRTICE E POR ALTURA.
   *
   * Não por malha — e esta é a correção que o caminho antigo não tinha. Neste
   * bake os catorze pneus E o estepe estão soldados numa ÚNICA primitiva, então
   * o filtro por malha de `runningTyres()` não descarta nada: ele devolve o vão
   * inteiro, 2,622 m de meio-vão contra os 1,468 m reais, e o centro 819 mm
   * fora do lugar. Como é sobre esse centro que a inclinação de engate gira, o
   * erro entra direto na altura do prato.
   *
   * Quem separa o estepe do bogie é a ALTURA do vértice: o estepe fica
   * pendurado no chassi e nenhum vértice dele entra na banda de contato. O
   * critério vale em qualquer bake e não depende de nome de nó.
   */
  private measureTyres(): Pick<Anchors, 'contactY' | 'centerX' | 'bogieZMin' | 'bogieZMax' | 'contactVerts'> | null {
    const meshes: THREE.Mesh[] = [];
    this.root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (TYRE_RE.test(o.name) || mats.some((mm) => !!mm && TYRE_RE.test(mm.name || ''))) meshes.push(o);
    });
    if (!meshes.length) return null;

    const inv = this.rigInverse();               // ver rigMatrixOf()
    const mat = new Map<THREE.Mesh, THREE.Matrix4>();
    for (const o of meshes) mat.set(o, this.rigMatrixOf(o, inv));

    const v = new THREE.Vector3();
    let contactY = Infinity;
    for (const o of meshes) {
      const pos = o.geometry.attributes.position;
      const m = mat.get(o) as THREE.Matrix4;
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(m);
        if (v.y < contactY) contactY = v.y;
      }
    }
    if (!Number.isFinite(contactY)) return null;

    const cut = contactY + CONTACT_BAND;
    let zMin = Infinity, zMax = -Infinity, xSum = 0, n = 0;
    for (const o of meshes) {
      const pos = o.geometry.attributes.position;
      const m = mat.get(o) as THREE.Matrix4;
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(m);
        if (v.y > cut) continue;
        if (v.z < zMin) zMin = v.z;
        if (v.z > zMax) zMax = v.z;
        xSum += v.x; n++;
      }
    }
    if (!n) return null;
    return { contactY, centerX: xSum / n, bogieZMin: zMin, bogieZMax: zMax, contactVerts: n };
  }

  /**
   * TODOS os furos de pino da chapa, medidos PELA FORMA.
   *
   * O que se procura é o que um furo de pino É na malha: um DISCO PEQUENO na
   * linha de centro, sob a dianteira — flange de 70 a 220 mm de raio. Neste baú
   * cada pad devolve três peças (a face da chapa, o degrau do pad e a flange),
   * então as candidatas são AGRUPADAS por z: cada grupo é um furo, e o eixo do
   * furo é o centro do grupo. Os dois grupos deste modelo caem em 6,427 e 5,627,
   * 800 mm exatos entre eles, que é a distância entre furos que a chapa tem.
   *
   * O PINO é a candidata que desce abaixo da chapa (o mesmo `KP_MIN_DROP` de
   * `measureKingpin()`); o resto do grupo é o pad em volta. A GÊMEA CEGA de cada
   * furo é a peça do outro grupo com a MESMA PEGADA da flange do pino — os pads
   * são congruentes, então a pegada casa em milímetros e é o que identifica a
   * peça que troca de lugar com ele sem depender de nome nem de contagem de
   * vértice.
   *
   * Um baú de furo único devolve UM item e `pickKingpinStation()` não tem o que
   * escolher; o caminho continua o de sempre.
   */
  private measureKingpinStations(plateBottomY: number): Station[] {
    const p = this.body.profile;
    const zHi = p.z1;
    const zLo = Math.max(p.z0, zHi - KP_SEARCH_DEPTH);
    const inv = this.rigInverse();

    interface Cand {
      o: THREE.Object3D;
      cz: number; yMin: number;
      sx: number; sz: number;
      /** desce abaixo da chapa? então é o pino */
      isPin: boolean;
    }
    const cands: Cand[] = [];
    const box = new THREE.Box3();
    this.root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const gb = o.geometry.boundingBox;
      if (!gb) return;
      /* Caixa no referencial da RAIZ — o mesmo motivo de `rigMatrixOf()`. Aqui
         ela é MEDIDA e não só rejeição, e pode ser: a flange é um cilindro de
         eixo vertical, e a caixa de um cilindro alinhado é o cilindro. */
      box.copy(gb).applyMatrix4(this.rigMatrixOf(o, inv));
      if (box.isEmpty()) return;
      if (box.max.z < zLo || box.min.z > zHi) return;
      if (box.min.y > p.floorY) return;
      const sx = box.max.x - box.min.x;
      const sz = box.max.z - box.min.z;
      const r = Math.max(sx, sz) / 2;
      if (r > KP_STATION_MAX_R || r < KP_STATION_MIN_R) return;
      const cx = (box.min.x + box.max.x) / 2;
      if (Math.abs(cx) > KP_HALF_X) return;
      cands.push({
        o, cz: (box.min.z + box.max.z) / 2, yMin: box.min.y, sx, sz,
        isPin: plateBottomY - box.min.y >= KP_MIN_DROP,
      });
    });
    if (!cands.length) return [];

    /* Agrupa por z. Ordenar primeiro torna o agrupamento uma varredura. */
    cands.sort((a, b) => a.cz - b.cz);
    const groups: Cand[][] = [];
    for (const c of cands) {
      const last = groups[groups.length - 1];
      if (last && Math.abs(c.cz - last[0].cz) <= KP_STATION_CLUSTER) last.push(c);
      else groups.push([c]);
    }

    const pinCand = cands.find((c) => c.isPin) ?? null;
    const stations: Station[] = groups.map((g) => {
      const pin = g.find((c) => c.isPin) ?? null;
      return {
        z: g.reduce((s, c) => s + c.cz, 0) / g.length,
        pin: pin ? pin.o : null,
        blind: null as THREE.Object3D | null,
      };
    });

    /* A gêmea cega: a peça do grupo que tem a pegada da flange do pino. Sem
       pino medido não há gêmea a procurar — e sem gêmea a troca ainda funciona,
       só deixa o furo antigo aberto (ver `setKingpinStation()`). */
    if (pinCand) {
      for (let k = 0; k < groups.length; k++) {
        if (stations[k].pin) continue;
        let best: Cand | null = null, bestD = Infinity;
        for (const c of groups[k]) {
          const d = Math.abs(c.sx - pinCand.sx) + Math.abs(c.sz - pinCand.sz);
          if (d < bestD) { bestD = d; best = c; }
        }
        if (best && bestD <= KP_TWIN_TOL * 2) stations[k].blind = best.o;
      }
    }

    /* Do mais DIANTEIRO para o mais traseiro — a ordem em que se fala deles. */
    return stations.sort((a, b) => b.z - a.z);
  }

  /**
   * O pino-rei e a chapa de apoio, medidos PELA FORMA.
   *
   * Não existe nó chamado "pino" neste GLB — ele está soldado no `stitch_all`
   * do `metal-preto`, junto com 924 mil vértices de estrado. Então mede-se o
   * que ele É: o único sólido da linha de centro, sob a dianteira, que desce
   * mais de 40 mm abaixo de tudo em volta. Um pino de 2" desce ~85 mm; o deste
   * modelo desce 87.
   *
   * A CHAPA é a face plana dominante num anel de 80 a 300 mm do eixo — o disco
   * que a quinta roda de fato toca. A votação é sobre o MÍNIMO DE CADA CÉLULA
   * de 50 mm e não sobre vértices: a densidade de malha varia de peça para peça
   * e uma travessa finamente tesselada ganharia a eleição sem cobrir área
   * nenhuma. (Foi assim que uma primeira medição devolveu 1,244 em vez de
   * 1,222 — a face certa está 22 mm abaixo, e 22 mm é folga de engate.)
   */
  private measureKingpin(
    contactY: number,
  ): Pick<Anchors, 'kingpinX' | 'kingpinZ' | 'plateBottomY' | 'pinDrop'> | null {
    const p = this.body.profile;
    const floorY = p.floorY;
    const zHi = p.z1;                          // a testeira, datum imóvel
    const zLo = Math.max(p.z0, zHi - KP_SEARCH_DEPTH);   // ver KP_SEARCH_DEPTH

    /* Rejeição barata: a caixa de `setFromObject` é grande demais, e é por isso
       que ela serve AQUI — descartar de menos só custa varrer vértice à toa. */
    const inv = this.rigInverse();               // ver rigMatrixOf()
    const box = new THREE.Box3();
    const meshes: THREE.Mesh[] = [];
    const mat = new Map<THREE.Mesh, THREE.Matrix4>();
    this.root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((mm) => !!mm && TYRE_RE.test(mm.name || ''))) return;
      const m = this.rigMatrixOf(o, inv);
      /* A caixa também no referencial da raiz. `setFromObject` traria a de
         MUNDO, e comparar isso com `z0/z1/floorY` é o erro que rigMatrixOf()
         existe para apagar — aqui ele descartaria a malha do pino inteira. */
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const gb = o.geometry.boundingBox;
      if (!gb) return;
      box.copy(gb).applyMatrix4(m);
      if (box.isEmpty()) return;
      if (box.max.z < zLo || box.min.z > zHi) return;
      if (box.min.y > floorY) return;
      if (box.max.x < -KP_HALF_X || box.min.x > KP_HALF_X) return;
      meshes.push(o);
      mat.set(o, m);
    });
    if (!meshes.length) return null;

    const v = new THREE.Vector3();
    const visit = (fn: (x: number, y: number, z: number) => void) => {
      for (const o of meshes) {
        const pos = o.geometry.attributes.position;
        const m = mat.get(o) as THREE.Matrix4;
        for (let k = 0; k < pos.count; k++) {
          v.fromBufferAttribute(pos, k).applyMatrix4(m);
          if (Math.abs(v.x) > KP_HALF_X || v.z < zLo || v.z > zHi || v.y > floorY) continue;
          fn(v.x, v.y, v.z);
        }
      }
    };

    let yMin = Infinity;
    visit((_x, y) => { if (y < yMin) yMin = y; });
    if (!Number.isFinite(yMin)) return null;

    /* O pino: os 20 mm mais baixos da faixa. */
    let pxMin = Infinity, pxMax = -Infinity, pzMin = Infinity, pzMax = -Infinity, pn = 0;
    visit((x, y, z) => {
      if (y > yMin + 0.02) return;
      if (x < pxMin) pxMin = x; if (x > pxMax) pxMax = x;
      if (z < pzMin) pzMin = z; if (z > pzMax) pzMax = z;
      pn++;
    });
    if (!pn) return null;
    const kingpinX = (pxMin + pxMax) / 2;
    const kingpinZ = (pzMin + pzMax) / 2;

    /* A chapa: moda dos mínimos de célula no anel. */
    const cell = new Map<string, number>();
    visit((x, y, z) => {
      const d = Math.hypot(x - kingpinX, z - kingpinZ);
      if (d <= PLATE_RING[0] || d >= PLATE_RING[1]) return;
      const key = `${Math.round(x / 0.05)},${Math.round(z / 0.05)}`;
      const cur = cell.get(key);
      if (cur === undefined || y < cur) cell.set(key, y);
    });
    const hist = new Map<number, number>();
    for (const y of cell.values()) {
      const b = Math.round(y * 500);
      hist.set(b, (hist.get(b) ?? 0) + 1);
    }
    if (!hist.size) return null;
    let bestBin = 0, bestN = -1;
    for (const [b, c] of hist) if (c > bestN || (c === bestN && b < bestBin)) { bestBin = b; bestN = c; }
    const plateBottomY = bestBin / 500;

    const pinDrop = plateBottomY - yMin;
    if (pinDrop < KP_MIN_DROP || pinDrop > KP_MAX_DROP) {
      console.warn('[engate] saliência de', (pinDrop * 1000).toFixed(0),
        'mm sob a dianteira não é o pino-rei (esperado entre',
        (KP_MIN_DROP * 1000).toFixed(0), 'e', (KP_MAX_DROP * 1000).toFixed(0),
        'mm) — âncora recusada.');
      return null;
    }
    /* `contactY` entra só no log; a altura útil é `plateBottomY − groundY` e
       quem faz essa conta é o solver, com o mesmo `groundY` dos dois lados. */
    void contactY;
    return { kingpinX, kingpinZ, plateBottomY, pinDrop };
  }
}
