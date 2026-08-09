/* O ENGATE — quinta roda ↔ pino-rei, resolvido em números puros.
   ===========================================================================
   Este módulo NÃO importa nada. Nem `three`, nem `@/`, nem um irmão do engine.
   É deliberado e é o que torna o solver verificável: a sonda headless
   (`scratchpad/verify-coupling.mjs`) transpila ESTE arquivo e chama ESTAS
   funções sobre os 53 cavalos. Uma tabela de verificação que exercita uma
   transcrição do algoritmo não prova nada sobre o algoritmo que roda no app —
   já foi assim que `cabs.json` e o desktop passaram a discordar em silêncio.

   Quem aplica o resultado em `THREE.Object3D` é `vehicle/models.ts`. Aqui só
   entra e sai número.

   ---------------------------------------------------------------------------
   A ASSIMETRIA DELIBERADA DAS DUAS METADES — leia antes de "consertar".

   O lado CAVALO é ESTÁTICO, vem de `models/vehicles/hitch.json`:
   o GLB do caminhão não muda em runtime, e cada entrada carrega um `sha256`
   dos bytes em que foi medida. Congelar ali é o certo — e é o que permite
   apagar todo `Box3.setFromObject` do caminho de posicionamento.

   O lado IMPLEMENTO é CALCULADO, vem de `TrailerRig.hitch`:
   o baú é PARAMÉTRICO. `trailer-assembly.ts` regenera a geometria a cada
   medida que o usuário digita. Uma entrada estática em `hitch.json` para o
   implemento estaria errada no instante seguinte ao primeiro resize, e errada
   em silêncio — que é a pior forma. O acessor remede o conjunto vivo depois de
   cada `set()`, então o engate acompanha a geometria em vez de acreditar nela.

   Isso NÃO é falta de simetria por descuido: é a diferença entre um dado que
   tem impressão digital e um dado que tem dial. Se algum dia alguém assar os
   números do implemento no manifesto, o primeiro usuário que arrastar o
   comprimento desengata o conjunto, e nada no código vai reclamar.
   ---------------------------------------------------------------------------

   REFERENCIAL. Depois de normalizado, cada corpo tem: contato do pneu em
   y = 0, linha de centro em x = 0, FRENTE em +Z. A normalização sai de DADO
   (`orientYaw`, `groundY`, `centerX`), nunca de caixa envolvente — é o que
   fecha a flutuação de 0 a 230 mm que `Box3.setFromObject` produzia nos nós de
   roda girados.

       N(p, h) = R_y(h.orientYaw) · (p − [h.centerX, h.groundY, 0])

   A âncora do conjunto é a GARGANTA DA QUINTA RODA, não "traseira da cabine em
   z = 0". Com ela o alvo do pino é a origem em todo modelo, e a origem
   arbitrária de cada GLB sai da conta no primeiro passo e não volta. */

/* ------------------------------------------------------------------ tipos */

/** Uma banda de perfil: a extremidade em Z na altura `y`. Ver `Profile`. */
export interface ProfileBand {
  /** altura da banda, no referencial normalizado (0 = solo) */
  y: number;
  /**
   * Extremidade em Z nessa altura.
   * - no CAVALO: o z MÍNIMO (a carroceria mais traseira — frente é +Z);
   * - no IMPLEMENTO: o z MÁXIMO (a testeira, o ponto mais dianteiro).
   */
  z: number;
}

/**
 * Um perfil, ordenado por `y` crescente. Bandas de altura constante.
 *
 * Existe porque UM ESCALAR NÃO EXPRESSA A FOLGA. A traseira de uma cabine não
 * é um plano: a longarina do chassi, a parede do leito e o defletor de teto
 * ficam em z diferentes em alturas diferentes. Um baú que passa pela longarina
 * pode raspar o defletor, e um único `rearBodyZ` não tem como dizer isso.
 */
export type Profile = ProfileBand[];

export interface FifthWheel {
  /** garganta do acoplador (o anel de trava), em espaço CRU do GLB */
  x: number; y: number; z: number;
  /** superfície de APOIO do prato, em espaço cru do GLB */
  plateTopY: number;
  rakeDeg?: number;
  /** [zMin, zMax] de quinta roda deslizante; `null` na esmagadora maioria */
  slideRange?: [number, number] | null;
  method?: string;
  confidence?: 'alta' | 'media' | 'baixa';
  needsManualReview?: boolean;
  /** barra de erro declarada, em metros. Só existe onde a confiança é baixa. */
  uncertaintyM?: number;
}

/** O lado CAVALO — estático, de `hitch.json`, em espaço cru do GLB. */
export interface TractorHitch {
  id: string;
  orientYaw: number;
  groundY: number;
  centerX: number;
  fifthWheel: FifthWheel;
  /**
   * Perfil da traseira, JÁ NORMALIZADO (medido do modelo carregado, não do
   * manifesto). O `rearBody.z` de `hitch.json` é a caixa envolvente do modelo
   * inteiro — a ponta do chassi, 1,6 m ATRÁS da quinta roda — e usá-lo como
   * datum de folga empurraria o implemento 2,4 m para trás. Ver §5 do solver.
   */
  rearProfile?: Profile | null;
}

/** O lado IMPLEMENTO — calculado, de `TrailerRig.hitch`, no espaço do rig. */
export interface ImplementHitch {
  orientYaw: number;
  /** plano de contato dos pneus, medido por VÉRTICE na banda de contato */
  groundY: number;
  centerX: number;
  kingpin: {
    x: number; y: number; z: number;
    /** superfície de APOIO da chapa do pino (a que a quinta roda toca) */
    plateBottomY: number;
  };
  bogie: {
    /** centro em Z das manchas de contato — não a caixa das malhas de pneu */
    centerZ: number;
    /** metade do vão das manchas de contato */
    halfSpan: number;
    /** = groundY por construção */
    contactY: number;
  };
  /** z da testeira (parede dianteira do baú branco) */
  frontWallZ: number;
  frontProfile: Profile;
  /** maior distância, em planta, do eixo do pino a um canto DIANTEIRO */
  swingRadius: number;
  /** `null` quando o GLB não modela patola — este é o caso hoje */
  landingGear: { z: number; retractedY: number; extendedY: number } | null;
  /** diagnóstico: as medidas correntes do baú, para a sonda casar as linhas */
  dims?: { width: number; height: number; length: number };
}

export interface CouplingDefaults {
  cabTrailerClearance: number;
  maxCouplingPitchRad: number;
  minPitchArm: number;
  tyreContactBand: number;
}

/** Os `defaults` do manifesto. Duplicados aqui só como degradação. */
export const FALLBACK_DEFAULTS: CouplingDefaults = {
  cabTrailerClearance: 0.15,
  maxCouplingPitchRad: 0.2527,
  minPitchArm: 0.50,
  tyreContactBand: 0.05,
};

export type ReportKind =
  | 'clearance'        // a folga cabine↔testeira ficou abaixo do mínimo
  | 'swing'            // a folga na articulação ficou abaixo do mínimo
  | 'short-arm'        // sem braço para inclinar: a correção virou queda
  | 'pitch-clamped'    // o ângulo bateu no teto e o prato não fechou
  | 'landing-gear'     // patola abaixo do piso
  | 'low-confidence'   // a altura da quinta roda não é confiável
  | 'implement-anchor' // o pino/chapa medidos no implemento são impossíveis
  | 'no-hitch-data';   // sem entrada no manifesto — engate legado

export interface CouplingReport {
  kind: ReportKind;
  /** pt-BR, pronta para a HUD */
  message: string;
  /** o número que falta, em metros (folga) ou radianos (ângulo) */
  amount?: number;
}

export interface CouplingSolution {
  /** pose da RAIZ do cavalo, em coordenadas locais do `rigGroup` */
  tractor: { yaw: number; x: number; y: number; z: number };
  /** pose da RAIZ do implemento; `pitchX` é a inclinação de nariz */
  implement: { yaw: number; x: number; y: number; z: number; pitchX: number };

  /** altura da garganta acima do solo */
  plateY: number;
  /** altura da chapa do pino acima do solo */
  kpPlateY: number;
  /** `plateY − kpPlateY`. Positivo → sobe; negativo → inclina. */
  lift: number;
  /** ângulo resolvido (rad). Sempre ≥ 0: nariz para baixo. */
  pitchRad: number;
  /** braço pino→bogie */
  bogieArm: number;
  /** braço efetivo = bogieArm − halfSpan */
  pitchArm: number;
  halfSpan: number;

  /** resíduo do casamento do prato, em metros. É o número que tem de ser ~0. */
  plateResidual: number;
  /**
   * Resíduo do pino contra a garganta nos TRÊS eixos, em metros.
   *
   * `plateResidual` sozinho é o Y, e verificar só o Y foi como um engate 6,43 m
   * fora do lugar passou por "53/53 dentro de 59,6 µm": em Z o casamento nunca
   * foi conferido. A inclinação também mexe no Z (ela gira sobre a mancha do
   * bogie, e o pino anda junto), então este número não é redundante nem quando
   * o dado está certo — ele media 47 mm no app antes de o passo de travamento
   * abaixo existir.
   */
  kingpinResidual: { x: number; y: number; z: number };
  /** altura da ponta MAIS BAIXA do bogie depois da pose. Tem de ser ~0. */
  lowestTyreY: number;

  clearance: {
    /** menor folga cabine↔testeira, em metros. Negativo = interpenetração. */
    gap: number;
    /** altura onde a menor folga acontece */
    atY: number;
    /** folga na articulação (o canto dianteiro varrendo sobre o pino) */
    swingGap: number;
    required: number;
    ok: boolean;
  };

  /** > 0 quando a quinta roda deste modelo tem barra de erro declarada */
  uncertaintyM: number;
  reports: CouplingReport[];
}

/* --------------------------------------------------------------- primitivas */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** `N(p, h)`: espaço cru do GLB → referencial normalizado. */
export function normalize(
  p: { x: number; y: number; z: number },
  h: { orientYaw: number; groundY: number; centerX: number },
): { x: number; y: number; z: number } {
  const c = Math.cos(h.orientYaw), s = Math.sin(h.orientYaw);
  const dx = p.x - h.centerX, dz = p.z;
  return { x: dx * c + dz * s, y: p.y - h.groundY, z: -dx * s + dz * c };
}

/**
 * A translação da RAIZ que realiza `N`: com `rotation.y = orientYaw`, pôr a
 * raiz em `−R_y(yaw)·[centerX, groundY, 0]` faz todo ponto do GLB cair em
 * `N(p)`. Nenhuma caixa envolvente entra aqui — é o ponto inteiro do contrato.
 */
export function normalizedRootOffset(
  h: { orientYaw: number; groundY: number; centerX: number },
): { x: number; y: number; z: number } {
  const c = Math.cos(h.orientYaw), s = Math.sin(h.orientYaw);
  return { x: -h.centerX * c, y: -h.groundY, z: h.centerX * s };
}

/** Extremidade do perfil na altura `y`, pelo vizinho mais próximo em altura. */
function profileAt(profile: Profile | null | undefined, y: number): number | null {
  if (!profile || !profile.length) return null;
  let best = profile[0], bestD = Math.abs(profile[0].y - y);
  for (let i = 1; i < profile.length; i++) {
    const d = Math.abs(profile[i].y - y);
    if (d < bestD) { best = profile[i]; bestD = d; }
  }
  return best.z;
}

/**
 * O Z mais dianteiro que um canto do baú alcança girando sobre o pino.
 *
 * Em repouso o canto está a `(±halfWidth, +overhang)` do eixo do pino, num
 * ângulo `φ0 = atan2(halfWidth, overhang)` a partir de +Z. Articulando `ψ`,
 * ele passa por `φ0 − ψ`, e o z é `R·cos(φ0 − ψ)`. O máximo é `R` — atingido
 * assim que a articulação chega a `φ0`, o que num conjunto real acontece bem
 * antes do limite de 90°. É esse `R` que a traseira da cabine tem de livrar,
 * e é o teste que nunca existiu: hoje a folga só é medida em linha reta.
 */
export function swingReachZ(
  radius: number, halfWidth: number, overhang: number, maxArticulationRad: number,
): number {
  const phi0 = Math.atan2(Math.abs(halfWidth), overhang);
  const reached = Math.max(0, phi0 - Math.max(0, maxArticulationRad));
  return radius * Math.cos(reached);
}

/* ------------------------------------------------------------------ solver */

export interface SolveOptions {
  /** profundidade do Thermo King, que avança na direção da cabine */
  tkDepth?: number;
  /** limite de articulação considerado no teste de varredura (rad) */
  maxArticulationRad?: number;
  /**
   * O que fazer quando a folga não fecha.
   * - `report` (padrão): mantém o engate CORRETO e denuncia. É o certo:
   *   escorregar o implemento para trás desengata o pino em silêncio, que é o
   *   defeito que este módulo existe para apagar.
   * - `prefer-clearance`: recua o implemento, e AINDA ASSIM denuncia.
   */
  onClearanceFail?: 'report' | 'prefer-clearance';
}

/**
 * Resolve o conjunto. O CAVALO é a âncora; o IMPLEMENTO vai até ele.
 *
 * Ordem, e o motivo de cada passo, em §§ que batem com A2 §8.
 */
export function solveCoupling(
  t: TractorHitch,
  i: ImplementHitch,
  defaults: CouplingDefaults = FALLBACK_DEFAULTS,
  opts: SolveOptions = {},
): CouplingSolution {
  const reports: CouplingReport[] = [];
  const tkDepth = opts.tkDepth ?? 0;
  const maxArt = opts.maxArticulationRad ?? Math.PI / 2;

  /* §1 — normalizar as duas raízes A PARTIR DE DADO. Nenhuma caixa é lida. */
  const tOff = normalizedRootOffset(t);
  const iOff = normalizedRootOffset(i);

  const fw = normalize(t.fifthWheel, t);          // garganta do acoplador
  const kp = normalize(i.kingpin, i);             // eixo do pino

  /* §2 — âncora na GARGANTA. O cavalo recua até a garganta cair na origem. */
  const tractor = { yaw: t.orientYaw, x: tOff.x - fw.x, y: tOff.y, z: tOff.z - fw.z };

  /* §3 — o pino vai exatamente sobre a garganta, em X e em Z. */
  const implement = { yaw: i.orientYaw, x: iOff.x - kp.x, y: iOff.y, z: iOff.z - kp.z, pitchX: 0 };

  /* §4 — altura. Positivo sobe o conjunto; NEGATIVO INCLINA. */
  const plateY = t.fifthWheel.plateTopY - t.groundY;
  const kpPlateY = i.kingpin.plateBottomY - i.groundY;
  const lift = plateY - kpPlateY;

  const bogieZ = normalize({ x: 0, y: 0, z: i.bogie.centerZ }, i).z - kp.z;  // sinalizado
  const bogieArm = Math.abs(bogieZ);
  const halfSpan = i.bogie.halfSpan;
  /* O braço EFETIVO não é o mesmo nos dois sentidos, e é por isso que este
     bloco não tem um `if (lift >= 0) y += lift`.
     -----------------------------------------------------------------------
     Um conjunto real NUNCA translada em Y. Ele está preso no pino e apoiado
     nos próprios pneus, então toda diferença de altura vira ATITUDE:

       prato ACIMA da garganta (lift < 0) → NARIZ BAIXO. Girando sobre o centro
         do bogie, o eixo dianteiro afunda `halfSpan·|senθ|`; o conjunto sobe
         isso de volta, e essa subida também levanta o prato — a queda LÍQUIDA
         no prato é `(braço − halfSpan)·|senθ|`.
       garganta ACIMA do prato (lift > 0) → NARIZ ALTO. Agora quem afunda é o
         eixo TRASEIRO, a compensação empurra o nariz para cima junto, e a
         subida líquida no prato é `(braço + halfSpan)·|senθ|`.

     A2 §8 mandava "lift ≥ 0 → sobe o corpo inteiro". Isso fecha o prato, mas
     tira a rodagem do chão exatamente `lift` — foi o que a sonda mediu nos seis
     Volvo 6x2/6x4 de prato alto: 1,02 mm de pneu no ar. Um milímetro é
     invisível, e é também a diferença entre "resolvido" e "quase". Com o braço
     assinado o mesmo ângulo fecha as duas pontas nos dois sentidos. */
  const pitchArm = lift < 0 ? bogieArm - halfSpan : bogieArm + halfSpan;

  let pitchRad = 0;
  if (Math.abs(lift) < 1e-9) {
    /* nada a fazer: prato e garganta já coincidem */
  } else if (pitchArm > defaults.minPitchArm) {
    const want = -lift / pitchArm;               // < 0 = nariz alto; > 0 = nariz baixo
    const cap = Math.sin(defaults.maxCouplingPitchRad);
    pitchRad = Math.asin(clamp(want, -cap, cap));
    if (Math.abs(want) > cap) {
      reports.push({
        kind: 'pitch-clamped',
        message: `Inclinação de engate no teto (${(defaults.maxCouplingPitchRad * 180 / Math.PI).toFixed(1)}°): `
          + `o prato não fecha por ${((Math.abs(want) - cap) * pitchArm * 1000).toFixed(0)} mm.`,
        amount: (Math.abs(want) - cap) * pitchArm,
      });
    }
    const sin = Math.sin(pitchRad), cos = Math.cos(pitchRad);
    /* Giro sobre a MANCHA DE CONTATO do bogie — ponto (x, 0, bogieZ) em mundo.
       Girar a raiz sobre X e depois recolocar o pivô no lugar de onde saiu. */
    const pivotZ = bogieZ;                       // o pino está em z = 0; o bogie, atrás
    const ly = implement.y - 0, lz = implement.z - pivotZ;
    implement.y = 0 + (ly * cos - lz * sin);
    implement.z = pivotZ + (ly * sin + lz * cos);
    implement.pitchX = pitchRad;
    implement.y += halfSpan * Math.abs(sin);     // a ponta que afundou volta ao chão
  } else {
    /* Sem braço para inclinar. Toma a diferença como QUEDA e DENUNCIA — nunca
       `Math.max(0, lift)`, que é o clamp que produzia 91 mm de luz do dia em
       todo caminhão do desktop e descartava a medida antes de usá-la. */
    implement.y += lift;
    reports.push({
      kind: 'short-arm',
      message: `Braço de engate curto (${pitchArm.toFixed(2)} m): o casamento do pino `
        + `virou queda de ${(lift * 1000).toFixed(0)} mm.`,
      amount: lift,
    });
  }

  /* A ÚNICA conversão normalizado → mundo, e ela reproduz LITERALMENTE o que
     `applyRootPose()` monta em three: `world = R_x(pitch)·R_y(yaw)·p + pos`, e
     `R_y(yaw)·p = N(p) − offset`. Tudo o que este solver afirma sobre o mundo —
     resíduo do prato, altura de pneu, folga de perfil — passa por aqui, porque
     a primeira versão fazia a conta à mão em cada lugar, esqueceu a parcela em
     Z da rotação num deles e reportou 35 mm de erro que não existiam. */
  const sinP = Math.sin(pitchRad), cosP = Math.cos(pitchRad);
  const toWorldI = (n: { x: number; y: number; z: number }) => {
    const qx = n.x - iOff.x, qy = n.y - iOff.y, qz = n.z - iOff.z;
    return {
      x: qx + implement.x,
      y: qy * cosP - qz * sinP + implement.y,
      z: qy * sinP + qz * cosP + implement.z,
    };
  };
  const toWorldT = (n: { x: number; y: number; z: number }) => ({
    x: n.x - tOff.x + tractor.x,
    y: n.y - tOff.y + tractor.y,
    z: n.z - tOff.z + tractor.z,
  });

  /* TRAVAMENTO DO PINO — o passo que faltava.
     -----------------------------------------------------------------------
     Os §§3 e 4 põem o pino na garganta e DEPOIS giram o implemento sobre a
     mancha de contato do bogie. Girar sobre um ponto que não é o pino MOVE o
     pino: no app, 47 mm em Z com 2,5° de inclinação. Um pino de verdade não
     anda — ele é a articulação, e a mancha do bogie é que escorrega (o pneu
     rola). Então a última coisa que a solução faz é recolocar o pino
     exatamente onde ele tem de estar. O ângulo não muda, e é por isso que a
     ponta do bogie continua no chão: `lowestTyreY` logo abaixo é medido DEPOIS
     desta correção e continua sendo a prova. */
  const afterPitch = toWorldI({ x: kp.x, y: kpPlateY, z: kp.z });
  implement.x += 0 - afterPitch.x;
  implement.y += plateY - afterPitch.y;
  implement.z += 0 - afterPitch.z;

  /* Resíduo: onde a chapa do pino ficou contra a garganta. Tem de ser ~0 nos
     três eixos — a garganta está na origem, na altura `plateY`. */
  const pinNow = toWorldI({ x: kp.x, y: kpPlateY, z: kp.z });
  const kingpinResidual = { x: pinNow.x - 0, y: pinNow.y - plateY, z: pinNow.z - 0 };
  const plateResidual = kingpinResidual.y;

  /* §5 — folga: PERFIL + VARREDURA, e ela DENUNCIA em vez de escorregar. */
  const required = defaults.cabTrailerClearance;
  let gap = Infinity, atY = 0;
  const front: { y: number; z: number }[] = [];
  for (const band of i.frontProfile) {
    const w = toWorldI({ x: 0, y: band.y, z: band.z });
    front.push({ y: w.y, z: w.z });
    const rear = profileAt(t.rearProfile, w.y);
    if (rear === null) continue;
    const g = toWorldT({ x: 0, y: w.y, z: rear }).z - w.z - tkDepth;
    if (g < gap) { gap = g; atY = w.y; }
  }
  if (!Number.isFinite(gap)) gap = Infinity;

  /* Varredura: o canto dianteiro girando sobre o pino alcança `reachZ` — e é
     na linha de centro que ele chega lá, bem em frente à traseira da cabine. */
  const halfWidth = i.dims ? i.dims.width / 2 : 0;
  const overhang = normalize({ x: 0, y: 0, z: i.frontWallZ }, i).z - kp.z;
  const reachZ = swingReachZ(i.swingRadius, halfWidth, overhang, maxArt);
  const kingpinWorldZ = toWorldI({ x: kp.x, y: kpPlateY, z: kp.z }).z;
  let swingGap = Infinity;
  for (const w of front) {
    const rear = profileAt(t.rearProfile, w.y);
    if (rear === null) continue;
    const g = toWorldT({ x: 0, y: w.y, z: rear }).z - (kingpinWorldZ + reachZ) - tkDepth;
    if (g < swingGap) swingGap = g;
  }
  if (!Number.isFinite(swingGap)) swingGap = Infinity;

  const worst = Math.min(gap, swingGap);
  const ok = worst >= required;
  if (!ok && Number.isFinite(worst)) {
    const need = required - worst;
    reports.push({
      kind: gap <= swingGap ? 'clearance' : 'swing',
      message: gap <= swingGap
        ? `Folga cabine↔testeira de ${(gap * 1000).toFixed(0)} mm na altura `
          + `${atY.toFixed(2)} m — faltam ${(need * 1000).toFixed(0)} mm.`
        : `Folga de articulação de ${(swingGap * 1000).toFixed(0)} mm — `
          + `faltam ${(need * 1000).toFixed(0)} mm. O canto dianteiro alcança `
          + `z ${reachZ.toFixed(3)} m girando sobre o pino.`,
      amount: need,
    });
    if (opts.onClearanceFail === 'prefer-clearance') implement.z -= need;
  }

  /* Onde as pontas do bogie encostam. Depois da inclinação, a MAIS BAIXA das
     duas tem de estar em y = 0: é o outro lado da equação do ângulo, e é o que
     separa "o prato fechou" de "o prato fechou enterrando a rodagem". */
  const tyreY = (z: number) =>
    toWorldI({ x: 0, y: i.bogie.contactY - i.groundY, z: normalize({ x: 0, y: 0, z }, i).z }).y;
  const lowestTyreY = Math.min(
    tyreY(i.bogie.centerZ - i.bogie.halfSpan),
    tyreY(i.bogie.centerZ + i.bogie.halfSpan),
  );

  /* §6 — patola. Ausente neste GLB: o teste é PULADO, não presumido em zero. */
  if (i.landingGear) {
    const lgY = toWorldI({
      x: 0,
      y: i.landingGear.retractedY - i.groundY,
      z: normalize({ x: 0, y: 0, z: i.landingGear.z }, i).z,
    }).y;
    if (lgY < 0) {
      reports.push({
        kind: 'landing-gear',
        message: `Patola ${(-lgY * 1000).toFixed(0)} mm abaixo do piso.`,
        amount: lgY,
      });
    }
  }

  /* A incerteza do cavalo VIAJA com a solução em vez de virar um número
     confiável no meio do caminho. Ver o trio mercedes_actros_mp3. */
  const uncertaintyM = t.fifthWheel.needsManualReview ? (t.fifthWheel.uncertaintyM ?? 0) : 0;
  if (uncertaintyM > 0) {
    reports.push({
      kind: 'low-confidence',
      message: `Altura da quinta roda de ${t.id} tem barra de erro de `
        + `±${(uncertaintyM * 1000).toFixed(0)} mm (medição derivada, não pelo furo). `
        + `O engate fecha no valor central; confira à mão antes de publicar.`,
      amount: uncertaintyM,
    });
  }

  /* A GUARDA QUE NÃO EXISTIA. O implemento é medido no modelo vivo, e uma
     âncora errada (um friso de rebite tomado por pino-rei — foi o que
     aconteceu) não tem como se denunciar sozinha: o solver casaria os dois
     números errados com precisão de micrômetro. O que ela NÃO pode fazer é
     passar calada. Um pino a mais de 2,5 m da testeira, ou uma chapa fora da
     faixa de altura de sela, é geometria impossível — não um engate ruim. */
  const pinFromFront = normalize({ x: 0, y: 0, z: i.frontWallZ }, i).z - kp.z;
  if (pinFromFront < 0 || pinFromFront > 2.5) {
    reports.push({
      kind: 'implement-anchor',
      message: `Pino-rei a ${pinFromFront.toFixed(2)} m da testeira — fora de qualquer `
        + `semirreboque real. A âncora do implemento está errada, e o engate fecha `
        + `sobre ela: confira measureKingpin() antes de acreditar nesta cena.`,
      amount: pinFromFront,
    });
  }
  if (kpPlateY < 0.8 || kpPlateY > 1.6) {
    reports.push({
      kind: 'implement-anchor',
      message: `Chapa do pino a ${(kpPlateY * 1000).toFixed(0)} mm do solo — fora da faixa `
        + `de altura de sela (800–1600 mm). A âncora do implemento está errada.`,
      amount: kpPlateY,
    });
  }

  return {
    tractor, implement,
    plateY, kpPlateY, lift, pitchRad, bogieArm, pitchArm, halfSpan,
    plateResidual, kingpinResidual, lowestTyreY,
    clearance: { gap, atY, swingGap, required, ok },
    uncertaintyM, reports,
  };
}

/* --------------------------------------------------- derivação do implemento */

/** O que `TrailerRig` mede no conjunto vivo e entrega ao solver. */
export interface ImplementMeasurements {
  /** invariantes, remedidos por `TrailerRig` depois de cada `set()` */
  contactY: number;
  centerX: number;
  bogieZMin: number;
  bogieZMax: number;
  kingpinX: number;
  kingpinZ: number;
  plateBottomY: number;
  /** do `TrailerBody.profile`, que muda com a medida */
  floorY: number;
  roofY: number;
  frontWallZ: number;
  halfWidth: number;
  /** medidas correntes */
  dims: { width: number; height: number; length: number };
  landingGear?: { z: number; retractedY: number; extendedY: number } | null;
  /** nº de bandas do perfil da testeira */
  profileBands?: number;
}

/**
 * Monta o `ImplementHitch` a partir do que foi medido no rig.
 *
 * PURA de propósito: é a mesma função que `TrailerRig.hitch` chama e que a
 * sonda headless chama. Se ela divergir do que o app faz, a tabela de
 * verificação deixa de valer — então não há duas.
 *
 * A testeira é modelada como um retângulo de `floorY` a `roofY` no plano
 * `frontWallZ`. É o que a geometria é: a parede dianteira do baú é plana e
 * vertical, e o único relevo dela (o bojo da testeira) já está dentro de
 * `frontWallZ`, que sai do vértice mais dianteiro das chapas externas.
 */
export function deriveImplementHitch(m: ImplementMeasurements): ImplementHitch {
  const bands = Math.max(2, m.profileBands ?? 12);
  const frontProfile: Profile = [];
  for (let k = 0; k < bands; k++) {
    const y = m.floorY + (m.roofY - m.floorY) * (k / (bands - 1));
    frontProfile.push({ y: y - m.contactY, z: m.frontWallZ });
  }
  const overhang = m.frontWallZ - m.kingpinZ;
  return {
    orientYaw: 0,
    groundY: m.contactY,
    centerX: m.centerX,
    kingpin: {
      x: m.kingpinX, y: m.plateBottomY, z: m.kingpinZ,
      plateBottomY: m.plateBottomY,
    },
    bogie: {
      centerZ: (m.bogieZMin + m.bogieZMax) / 2,
      halfSpan: (m.bogieZMax - m.bogieZMin) / 2,
      contactY: m.contactY,
    },
    frontWallZ: m.frontWallZ,
    frontProfile,
    swingRadius: Math.hypot(m.halfWidth, overhang),
    landingGear: m.landingGear ?? null,
    dims: m.dims,
  };
}

/* --------------------------------------------------------------- manifesto */

export interface HitchManifest {
  schema?: string;
  tractors: Record<string, RawTractor>;
  implements?: Record<string, unknown>;
  defaults?: Partial<CouplingDefaults>;
}

interface RawTractor {
  sourceFile?: string;
  fingerprint?: { bytes?: number; sha256?: string; meshCount?: number };
  orientYaw?: number;
  groundY?: number;
  centerX?: number;
  fifthWheel?: Partial<FifthWheel> & { needsManualReview?: boolean };
  rearBody?: { z?: number; profile?: number[][] | null } | null;
  axles?: { config?: string; steerZ?: number[]; driveZ?: number[]; liftZ?: number[]; wheelbase?: number };
  bbox?: { min: number[]; max: number[] };
  needsManualReview?: boolean;
}

/**
 * Acha a entrada do cavalo. Casa por `sourceFile` PRIMEIRO — é o caminho do
 * GLB, o mesmo que o `fingerprint` atesta, e não depende de como o catálogo
 * compõe ids. O id composto (`<modelId>-<chassisId>`) é o segundo caminho.
 */
export function findTractor(
  man: HitchManifest | null, key: { id?: string | null; file?: string | null },
): TractorHitch | null {
  if (!man || !man.tractors) return null;
  const norm = (s: string) => s.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
  const wantFile = key.file ? norm(key.file) : null;
  let hit: [string, RawTractor] | null = null;
  if (wantFile) {
    for (const e of Object.entries(man.tractors)) {
      const src = e[1].sourceFile;
      if (src && norm(src) === wantFile) { hit = e; break; }
    }
  }
  if (!hit && key.id && man.tractors[key.id]) hit = [key.id, man.tractors[key.id]];
  if (!hit) return null;

  const [id, r] = hit;
  const fw = r.fifthWheel;
  if (!fw || typeof fw.x !== 'number' || typeof fw.y !== 'number'
    || typeof fw.z !== 'number' || typeof fw.plateTopY !== 'number') return null;

  return {
    id,
    orientYaw: r.orientYaw ?? 0,
    groundY: r.groundY ?? 0,
    centerX: r.centerX ?? 0,
    fifthWheel: {
      x: fw.x, y: fw.y, z: fw.z, plateTopY: fw.plateTopY,
      rakeDeg: fw.rakeDeg ?? 0,
      slideRange: fw.slideRange ?? null,
      method: fw.method,
      confidence: fw.confidence,
      needsManualReview: fw.needsManualReview ?? r.needsManualReview ?? false,
      uncertaintyM: fw.uncertaintyM,
    },
    rearProfile: null,      // MEDIDO do modelo carregado; ver TractorHitch.rearProfile
  };
}

/** Os `defaults` do manifesto, com degradação campo a campo. */
export function defaultsOf(man: HitchManifest | null): CouplingDefaults {
  const d = man?.defaults ?? {};
  return {
    cabTrailerClearance: d.cabTrailerClearance ?? FALLBACK_DEFAULTS.cabTrailerClearance,
    maxCouplingPitchRad: d.maxCouplingPitchRad ?? FALLBACK_DEFAULTS.maxCouplingPitchRad,
    minPitchArm: d.minPitchArm ?? FALLBACK_DEFAULTS.minPitchArm,
    tyreContactBand: d.tyreContactBand ?? FALLBACK_DEFAULTS.tyreContactBand,
  };
}
