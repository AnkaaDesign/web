/* PEÇAS QUE O RIP NÃO TEM — a proteção lateral e o suporte do para-barro.
   ===========================================================================

   `cab-bake-fixes.ts` é a tabela do que está ERRADO num rip: esconder, mover,
   trocar acabamento. Este arquivo é o que está AUSENTE — geometria que o
   caminhão real tem e o arquivo não —, e por isso ele constrói em vez de
   corrigir.

   POR QUE PROCEDURAL, E NÃO ASSADO NO `.glb`
   ---------------------------------------------------------------------------
   1. As duas peças dependem de onde os EIXOS estão, e a família Scania tem
      quatro configurações do mesmo caminhão (`cut-scania.cjs`). Assar quatro
      versões de cada peça é assar a mesma peça quatro vezes.
   2. O balanço traseiro é esticado em runtime (`chassis-tail.ts`), então a
      geometria do rabo não é fixa nem dentro de um arquivo.
   3. E `/studio-assets/v1/` sai com `Cache-Control: immutable`: acrescentar
      peça ao `scania_p_8x2r.glb` — que está NO AR — é sobrescrever um asset
      que navegador nenhum vai repuxar por um ano.

   ⚠️ TUDO É MEDIDO DO PRÓPRIO ARQUIVO. Nenhuma cota abaixo é do Scania: o
   plano da grade sai do envelope do caminhão, a face da longarina sai da malha
   e a caixa do para-barro sai da peça. É o que faz o módulo servir ao Volvo VM
   e ao VW sem uma linha nova — e é a mesma razão de `measureSill()` medir em
   vez de tabelar.
*/
import * as THREE from 'three';
import type { RigidMount } from './mounting';
import { claimGeometry } from './geometry-share';
import { tailBaseFor } from './chassis-tail';

/* --------------------------------------------------------------------------
   AS RÉGUAS, e de onde cada número veio
   -------------------------------------------------------------------------- */

/* ⚠️ AS RÉGUAS DA PROTEÇÃO LATERAL SAÍRAM DAQUI JUNTO COM ELA.
   Elas viveram neste arquivo por duas rodadas — a faixa de altura, o número de
   lâminas, o recuo da pele, as folgas de eixo — e foram todas apagadas quando
   a peça mudou de dono. Ficam registradas em `vehicle/side-guard.ts`, agora
   medidas na peça de verdade e não em cotas copiadas. */

/**
 * Até onde a aba do para-barro pode descer, em metros do SOLO.
 *
 * A proteção lateral do implemento tem a barra de baixo em y 510…610, e a aba
 * traseira do Scania desce a 447 com |x| até 1 230 — contra a barra em
 * 1 216…1 248. São 14 mm de interpenetração em x e 100 em y, e o resultado é a
 * placa SCANIA atravessando a grade. Medido: `lameiro_0` cai em z −3 475 do
 * implemento, dentro do corrido traseiro (−4 059…−3 356).
 *
 * *"precisa encurtar a placa scania, para ficar mais próxima do chassi, porque
 * está entrando dentro da grade"* — Kennedy. 630 mm deixam 20 mm de folga
 * sobre a barra.
 */

/**
 * A BARRA DO PARA-BARRO — reescrita em 2026-08-22.
 *
 * *"agora encurte e corrija a barra que segura a placa 'Scania'; essa barra foi
 * fabricada e não está bem posicionada nem desenhada, está muito quadrada e
 * atravessando uma parte do chassi"* — Kennedy.
 *
 * As três coisas são a mesma coisa: ela era **um bloco só, de ponta a ponta**.
 * `bloco()` fazia uma `BoxGeometry` de `c.x0 − 10` a `c.x1 + 10`, ou seja
 * 2 480 mm atravessando a linha de centro — e no meio dessa linha moram a
 * travessa do rabo, o painel das lanternas e o próprio quadro. Medido:
 * a caixa dela cruzava SEIS malhas de chassi.
 *
 * Um suporte de para-barro de verdade não é uma barra de ponta a ponta: são
 * **dois braços**, um por lobo, que saem da estrutura e vão até a ponta da aba.
 * É o que se faz aqui, e as duas outras queixas caem junto — cada braço tem
 * menos de meio metro (encurtou) e é um TUBO (deixou de ser quadrado).
 *
 * ⚠️ ONDE CADA BRAÇO COMEÇA É MEDIDO, não arbitrado: no |x| em que a estrutura
 * do caminhão ACABA, dentro da faixa de y e z do próprio braço. É isso que o
 * tira de dentro do chassi sem uma cota escrita à mão — e é o que faz o módulo
 * servir ao VM e ao VW, que têm outra traseira.
 */
/** Raio do tubo do braço, e quanto ele sobrepõe o topo da aba. */
const BARRA_R = 0.022, BARRA_SOBRE = 0.012;
/** Folga entre a ponta de dentro do braço e a estrutura em que ele nasce. */
const BARRA_FOLGA = 0.012;
/** Quanto o braço passa da ponta da aba, para fechar a borda dela. */
const BARRA_ALEM = 0.010;
/** Braço menor que isto não é braço — a aba já está apoiada ali. */
const BARRA_MIN = 0.08;

/* --------------------------------------------------------------------------
   Medição
   -------------------------------------------------------------------------- */

/** Nó de roda ou estepe — nunca é aba de para-barro. */
const RODA_RE = /^wheel_|^step_|_tire|_disc|_rim/i;

interface Caixa { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; }
const vazia = (): Caixa => ({
  x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity,
});

/**
 * Varre a malha do caminhão UMA vez e devolve o que as duas peças precisam.
 *
 * Uma varredura só, e por vértice: `Box3.setFromObject()` de um nó girado dá a
 * caixa da caixa (o estepe deitado do VM devolve 1,99 m de meia-largura contra
 * 1,34 real), e é o mesmo erro que `TrailerAssembly.outerX` documenta.
 */
function medeChassi(cab: THREE.Object3D, mount: RigidMount) {
  cab.updateWorldMatrix(true, true);
  /* N leva do espaço da RAIZ para o normalizado — a mesma álgebra de
     `chassis-tail.ts`, e pelo mesmo motivo: a pose da raiz no instante da
     chamada não é a final. */
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const L2N = new THREE.Matrix4();
  const v = new THREE.Vector3();

  /* Só o que a barra do para-barro precisa. O envelope de largura e a régua da
     longarina saíram junto com a proteção lateral — ver o bloco acima. */
  const barros: { caixa: Caixa; nome: string; mesh: THREE.Mesh;
    solidarias: { mesh: THREE.Mesh; nome: string }[];
    /** Os dois lobos da aba em x, e onde a estrutura acaba em cada um. */
    lobos: { x0: number; x1: number; nasce: number }[] }[] = [];
  const apoios: Caixa[] = [];
  /* TUDO, para a segunda passada achar quem VIAJA COM a aba — ver o bloco
     `solidárias` logo abaixo. Guardar a caixa aqui é de graça: a varredura por
     vértice já aconteceu. */
  const todas: { caixa: Caixa; nome: string; mesh: THREE.Mesh }[] = [];

  cab.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry || !m.visible) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const nome = m.name || '';
    const roda = RODA_RE.test(nome);
    L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);

    const c = vazia();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      if (v.x < c.x0) c.x0 = v.x; if (v.x > c.x1) c.x1 = v.x;
      if (v.y < c.y0) c.y0 = v.y; if (v.y > c.y1) c.y1 = v.y;
      if (v.z < c.z0) c.z0 = v.z; if (v.z > c.z1) c.z1 = v.z;
    }
    if (c.x0 === Infinity) return;

    if (!roda) todas.push({ caixa: c, nome, mesh: m });

    /* O PARA-BARRO, por FORMA e não por nome: chapa mais larga que 1,5 m, mais
       fina que 60 mm em Z, inteira abaixo da mesa da longarina. No Scania isso
       casa `lameiro_0_p0` (2 457 × 360 × 6 mm) e nada mais — conferido. */
    const larga = (c.x1 - c.x0) > 1.5;
    const fina = (c.z1 - c.z0) < 0.06;
    if (!roda && larga && fina && c.y1 < mount.frameTopY && (c.y1 - c.y0) > 0.15) {
      barros.push({ caixa: c, nome, mesh: m, solidarias: [], lobos: [] });
    }
    /* E QUEM PODE SER APOIO: qualquer peça larga o bastante para alcançar a
       ponta de uma aba. Guardada para a segunda passada — a aba pode ser lida
       antes do arco que a segura, e decidir na primeira passada dependeria da
       ordem da travessia. */
    if (!roda && Math.max(Math.abs(c.x0), Math.abs(c.x1)) > 0.80) apoios.push(c);
  });

  /* ⚠️ SÓ APOIA QUEM NÃO TEM APOIO. No bitruck a chapa do para-barro do 2º
     direcional pendura sob o ARCO dele, e ali não falta nada: dar-lhe uma
     barra seria acrescentar peça onde a peça existe. O teste é o mesmo que
     `floatprobe.cjs` usa — há geometria larga logo acima, dentro da faixa de z
     da aba? */
  const orfas = barros.filter((b) => {
    const pontaAba = Math.max(Math.abs(b.caixa.x0), Math.abs(b.caixa.x1));
    return !apoios.some((a) => {
      if (a === b.caixa) return false;
      if (a.z1 <= b.caixa.z0 - 0.15 || a.z0 >= b.caixa.z1 + 0.15) return false;
      if (a.y0 <= b.caixa.y1 - 0.02 || a.y0 >= b.caixa.y1 + 0.25) return false;
      /* ⚠️ E TEM DE ALCANÇAR A PONTA DA ABA. Sem isto o nó da lanterna traseira
         "apoia" o para-barro: a CAIXA DA MALHA dele chega a |x| 983 porque ela
         inclui o painel das lanternas, enquanto a viga que de fato passa por
         cima da aba morre em |x| 651. Uma aba de 2 457 mm apoiada nos 1 300 mm
         centrais continua pendurada nos 580 de cada ponta — que é o defeito. */
      const pontaApoio = Math.max(Math.abs(a.x0), Math.abs(a.x1));
      return pontaApoio >= pontaAba * 0.85;
    });
  });

  /* ▶▶ AS SOLIDÁRIAS — o que está EM CIMA da aba e viaja com ela.
     ------------------------------------------------------------------------
     ⚠️ O LETREIRO SCANIA NÃO É A ABA, E ERA ELE QUE ENCOSTAVA NA GRADE.
     `trimFlapsForGuard()` encolhia `lameiro_0_p0` (a chapa) e deixava
     `lameiro_0_p1` (as letras em relevo, material `cor`) do tamanho de fábrica,
     porque a peneira acima pede altura > 150 mm e o letreiro tem **92**. O
     resultado, medido no 6x2 em 2026-08-22:

         aba (encolhida a 62 %)   |x| até 1 105 mm
         letreiro (intocado)      |x| até 1 205 mm
         face interna da grade         1 116 mm   ← o letreiro está DENTRO dela

     ou seja o pedido *"diminua a placa scania, está entrando dentro da grade"*
     foi atendido na chapa e não no letreiro — e o letreiro é o que se vê. Por
     isso ele ainda saía "grande demais" depois de cada rodada: a chapa
     encolhia por baixo dele e as letras transbordavam.

     A regra é de PERTENCIMENTO, não de forma: o que mora INTEIRO dentro da
     caixa da aba (com 20 mm de folga) e é menor que ela é decoração pregada
     nela — letreiro, faixa refletiva, parafusaria. Isso viaja com a aba, na
     mesma âncora e na mesma escala, senão a peça se desmonta ao encolher. */
  /* ▶▶ OS LOBOS DE CADA ABA, E ONDE O BRAÇO PODE NASCER.
     ------------------------------------------------------------------------
     Duas medidas na mesma varredura, e as duas são do braço (ver o bloco de
     `BARRA_R`): o vão de x de cada lobo — que é até onde o braço vai — e o
     |x| em que a estrutura do caminhão ACABA dentro da faixa de y e z do
     braço — que é onde ele começa. Sem a segunda, o braço nasce na linha de
     centro e atravessa travessa, painel de lanterna e quadro; foi o defeito
     que esta rodada conserta.

     ⚠️ A faixa é a do BRAÇO, não a da aba. A aba desce 360 mm e cruza meio
     mundo; o braço ocupa 44 mm em y logo acima do topo dela, e é só nessa
     fatia que a pergunta "o que existe aqui?" tem resposta útil. */
  const v2 = new THREE.Vector3();
  for (const b of orfas) {
    const c = b.caixa;
    const zc = (c.z0 + c.z1) / 2;
    const yLo = c.y1 - BARRA_SOBRE - BARRA_R, yHi = c.y1 - BARRA_SOBRE + BARRA_R;
    const zLo = zc - BARRA_R, zHi = zc + BARRA_R;
    /* Lobo por lobo, na malha da PRÓPRIA aba. */
    let pos0 = Infinity, pos1 = -Infinity, neg0 = Infinity, neg1 = -Infinity;
    {
      const pos = b.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      L2N.copy(N).multiply(cabInv).multiply(b.mesh.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v2.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
        if (v2.x >= 0) { pos0 = Math.min(pos0, v2.x); pos1 = Math.max(pos1, v2.x); }
        else { neg0 = Math.min(neg0, v2.x); neg1 = Math.max(neg1, v2.x); }
      }
    }
    /* E o alcance da estrutura na faixa do braço, por lobo. */
    let nascePos = 0, nasceNeg = 0;
    cab.traverse((o) => {
      const m2 = o as THREE.Mesh;
      if (!m2.isMesh || !m2.geometry || !m2.visible || m2 === b.mesh) return;
      if (RODA_RE.test(m2.name || '')) return;
      if ((m2.name || '').startsWith('TS_CHASSI_')) return;
      /* Peneira barata pela caixa já medida: quem não chega perto da faixa
         não é varrido vértice a vértice. */
      const cc = todas.find((t2) => t2.mesh === m2)?.caixa;
      if (!cc) return;
      if (cc.y1 < yLo - 0.05 || cc.y0 > yHi + 0.05) return;
      if (cc.z1 < zLo - 0.10 || cc.z0 > zHi + 0.10) return;
      const pos = m2.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!pos) return;
      L2N.copy(N).multiply(cabInv).multiply(m2.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v2.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
        if (v2.y < yLo || v2.y > yHi || v2.z < zLo || v2.z > zHi) continue;
        if (v2.x >= 0) { if (v2.x > nascePos) nascePos = v2.x; }
        else if (-v2.x > nasceNeg) nasceNeg = -v2.x;
      }
    });
    if (Number.isFinite(pos1)) b.lobos.push({ x0: pos0, x1: pos1, nasce: nascePos });
    if (Number.isFinite(neg0)) b.lobos.push({ x0: neg0, x1: neg1, nasce: -nasceNeg });
  }

  const FOLGA = 0.020;
  const dentro = (a: Caixa, b: Caixa) =>
    a.x0 >= b.x0 - FOLGA && a.x1 <= b.x1 + FOLGA
    && a.y0 >= b.y0 - FOLGA && a.y1 <= b.y1 + FOLGA
    && a.z0 >= b.z0 - FOLGA && a.z1 <= b.z1 + FOLGA;
  const vol = (c: Caixa) => (c.x1 - c.x0) * (c.y1 - c.y0);
  for (const b of orfas) {
    for (const t of todas) {
      if (t.mesh === b.mesh) continue;
      if (!dentro(t.caixa, b.caixa)) continue;
      if (vol(t.caixa) > vol(b.caixa) * 0.98) continue;   // não é decoração, é a própria
      b.solidarias.push({ mesh: t.mesh, nome: t.nome });
    }
  }
  return { barros: orfas };
}

/* --------------------------------------------------------------------------
   Construção
   -------------------------------------------------------------------------- */

/**
 * UM BRAÇO — tubo ao longo de X, em espaço NORMALIZADO, convertido para a raiz.
 *
 * Cilindro e não caixa: *"está muito quadrada"*. Um suporte de para-barro é
 * tubo ou perfil dobrado, e a 3 m de distância a diferença entre os dois é a
 * quina — que uma caixa tem e um tubo não.
 *
 * ⚠️ 10 LADOS, não 32. A peça tem 44 mm de diâmetro e vive na sombra do
 * assoalho; o que se vê dela é a silhueta. Trinta e dois lados custariam 128
 * triângulos por braço para uma curvatura que ninguém resolve.
 */
function braco(
  nome: string, mat: THREE.Material,
  x0: number, x1: number, y: number, z: number, r: number,
  paraRaiz: THREE.Matrix4,
): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r, Math.abs(x1 - x0), 10, 1);
  g.rotateZ(Math.PI / 2);                       // o eixo do cilindro vira X
  g.translate((x0 + x1) / 2, y, z);
  g.applyMatrix4(paraRaiz);
  g.computeBoundingBox(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat);
  m.name = nome;
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** O preto do chassi, reaproveitado do próprio arquivo quando existe: assim a
 *  barra nova recebe a mesma tinta, o mesmo ambiente e o mesmo molhado que o
 *  resto — e não vira uma peça que destoa quando chove. */
function materialPreto(cab: THREE.Object3D): THREE.Material {
  let achado: THREE.Material | null = null;
  cab.traverse((o) => {
    if (achado) return;
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material])) {
      if (mat && /pretobrilhoso|preto/i.test(mat.name || '')) { achado = mat; return; }
    }
  });
  return achado ?? new THREE.MeshStandardMaterial({
    name: 'suporte-para-barro', color: 0x141414, metalness: 0, roughness: 0.35,
  });
}

/**
 * ACRESCENTA a proteção lateral e o suporte do para-barro.
 *
 * Devolve as linhas de diagnóstico, no padrão de `applyCabBakeFixes()`.
 * Idempotente: remove o que uma chamada anterior tenha criado antes de criar
 * de novo — `placeTrailer()` e o alongamento do quadro podem trazer o fluxo
 * aqui mais de uma vez, e somar peça a cada passagem é o defeito clássico.
 */
export function buildChassisParts(cab: THREE.Object3D, mount: RigidMount): string[] {
  const linhas: string[] = [];

  /* IDEMPOTÊNCIA primeiro. */
  const velhos: THREE.Object3D[] = [];
  cab.traverse((o) => { if (o.name.startsWith('TS_CHASSI_')) velhos.push(o); });
  for (const o of velhos) {
    o.removeFromParent();
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) m.geometry.dispose();
  }

  const med = medeChassi(cab, mount);

  /* O inverso de N: do normalizado de volta ao espaço da RAIZ, que é onde a
     geometria tem de nascer para acompanhar a pose do caminhão. */
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const paraRaiz = N.clone().invert();

  const grupo = new THREE.Group();
  grupo.name = 'TS_CHASSI_PECAS';
  cab.add(grupo);

  /* ───────── 1. A BARRA DO PARA-BARRO ───────── */
  const preto = materialPreto(cab);

  for (const b of med.barros) {
    const c = b.caixa;
    const zc = (c.z0 + c.z1) / 2;
    const i0 = med.barros.indexOf(b);
    const y = c.y1 - BARRA_SOBRE;
    let feitos = 0;
    for (const [j, lobo] of b.lobos.entries()) {
      const sgn = lobo.x1 > 0 ? 1 : -1;
      /* De onde a estrutura acaba até a ponta da aba. O `nasce` já vem com o
         sinal do lobo; a folga afasta o braço do que ele encontra. */
      const dentroX = lobo.nasce + sgn * BARRA_FOLGA;
      const foraX = (sgn > 0 ? lobo.x1 : lobo.x0) + sgn * BARRA_ALEM;
      if (Math.abs(foraX - dentroX) < BARRA_MIN) {
        linhas.push(`braço ${j} do para-barro NÃO entra: a estrutura vai até `
          + `|x| ${(Math.abs(lobo.nasce) * 1000).toFixed(0)} e a aba acaba em `
          + `${(Math.abs(sgn > 0 ? lobo.x1 : lobo.x0) * 1000).toFixed(0)} — `
          + `sobram ${(Math.abs(foraX - dentroX) * 1000).toFixed(0)} mm.`);
        continue;
      }
      grupo.add(braco(`TS_CHASSI_BARRA_${i0}_${j}`, preto,
        dentroX, foraX, y + BARRA_R, zc, BARRA_R, paraRaiz));
      feitos++;
      linhas.push(`braço do para-barro · |x| ${(Math.abs(dentroX) * 1000).toFixed(0)}…`
        + `${(Math.abs(foraX) * 1000).toFixed(0)} mm (${(Math.abs(foraX - dentroX) * 1000)
          .toFixed(0)} mm de vão) · Ø ${(BARRA_R * 2000).toFixed(0)} mm · z `
        + `${(zc * 1000).toFixed(0)} · nasce onde a estrutura acaba.`);
    }
    if (!feitos) {
      linhas.push(`aba ${b.nome}: nenhum braço coube — ela fica como o rip a deixou.`);
    }
    /* ⚠️ OS BRAÇOS SÃO SOLIDÁRIOS DA ABA, e é assim que eles encolhem junto E
       sobrevivem ao rabo. Ver `encolhe()` em `trimFlapsForGuard()`: ela aplica
       o mesmo mapa e escreve na base pristina de `chassis-tail.ts`. Antes havia
       um laço próprio para a barra, com um `kb` escalando sobre x = 0 — que
       para um braço por LOBO estaria errado (puxaria o braço para o centro) e
       que, pior, não escrevia na base do rabo: a barra voltava ao tamanho de
       fábrica no `placeTrailer()` seguinte, como a aba voltava. */
    for (const o of grupo.children) {
      if (o.name.startsWith(`TS_CHASSI_BARRA_${i0}_`)) {
        b.solidarias.push({ mesh: o as THREE.Mesh, nome: o.name });
      }
    }
  }
  /* ⚠️ GUARDA AS ABAS AQUI. `trimFlapsForGuard()` roda depois, e por um bom
     tempo ele chamou `medeChassi()` de novo e voltava de mãos vazias — sem
     erro, sem aviso, e eu fui procurar o defeito em três lugares errados.
     A razão: `medeChassi()` devolve as abas ÓRFÃS, e a barra que este laço
     acabou de criar é exatamente o apoio que faltava a elas. Na segunda
     medição a aba não é mais órfã e some da lista. Uma medida que muda porque
     a própria peça mudou o mundo não pode ser refeita — guarda-se. */
  (grupo.userData as { tsAbas?: unknown }).tsAbas =
    med.barros.map((b, i) => ({ mesh: b.mesh, nome: b.nome, i, solidarias: b.solidarias }));
  for (const b of med.barros) {
    if (b.solidarias.length) {
      linhas.push(`aba ${b.nome} leva junto ${b.solidarias.length} peça(s) solidária(s): `
        + b.solidarias.map((s) => s.nome).join(', '));
    }
  }
  if (!med.barros.length) linhas.push('nenhuma aba de para-barro achada — nada a apoiar.');

  /* ⚠️ A PROTEÇÃO LATERAL NÃO MORA MAIS AQUI.
     ------------------------------------------------------------------------
     Ela esteve neste arquivo por duas rodadas e saiu por um motivo que a foto
     mostrou: presa ao CHASSI, ela fica no plano do caminhão enquanto o baú
     assenta com a inclinação da mesa da longarina (0,912° no Scania P, 1,583°
     no VM). A 8,4 m de corrido isso são 134 mm de desencontro, e some sozinho
     quando a peça muda de dono. *"essa grade deve estar presa no implemento,
     assim como no implemento do semirreboque, não no chassi do truck"* —
     Kennedy.

     Ela agora é `vehicle/side-guard.ts`, filha da raiz do implemento, montada
     em `placeTrailer()` — que é o único lugar em que o baú e os eixos do
     caminhão se conhecem ao mesmo tempo. */
  return linhas;
}

/* --------------------------------------------------------------------------
   A aba do para-barro: tamanho e folga para a proteção lateral
   -------------------------------------------------------------------------- */

/** Quanto a aba encolhe. Ver a nota da função. */
const ABA_ESCALA = 0.62;
/** Folga que a aba guarda para a face INTERNA da proteção lateral. */
const ABA_FOLGA_X = 0.020;

/**
 * Encolhe a aba do para-barro e a mantém FORA do plano da proteção lateral.
 *
 * ⚠️ DUAS COISAS QUE JÁ ERREI AQUI, nesta ordem:
 *
 * 1. A primeira versão encurtava a aba em Y para ela passar por cima da barra
 *    de baixo da grade (510…610). Não resolvia: a barra de CIMA está em
 *    911…1013 e o encaixe é LATERAL — a aba alcança |x| 1 230 e a barra ocupa
 *    1 216…1 248, então elas se cruzam em qualquer altura em que coexistam.
 *    Encurtar a altura só espremeu o letreiro SCANIA e deixou o contato de pé.
 *
 * 2. A aba de fábrica é grande demais para um rígido — *"agora diminua o
 *    tamanho da placa escrito scania, está muito grande"*. Ela encolhe
 *    UNIFORME, senão o letreiro distorce, que foi exatamente o defeito do
 *    item 1.
 *
 * As ÂNCORAS são o que preserva o "posicionamento correto" que o pedido exige:
 * o TOPO (a aba continua pendurada na barra, sem abrir fresta) e o CENTRO DE
 * CADA LOBO em x — não o x = 0. Uma malha só pode conter as duas abas; escalar
 * sobre a origem as puxaria uma para a outra e descobriria os pneus. Por isso
 * o centro é medido por SINAL de x, e vale tanto para uma malha por lado
 * quanto para uma malha com as duas.
 *
 * A BARRA que segura a aba encolhe junto, senão sobra em balanço nas pontas.
 *
 * Roda depois de `attachSideGuard()` porque só lá se conhece `xInterno`: ele
 * sai da pele do implemento, que a cabine não tem como saber sozinha.
 *
 * IDEMPOTENTE por construção, e tem de ser: `placeTrailer()` recorre a cada
 * redimensionamento, e escalar sobre o resultado anterior encolheria a aba a
 * cada quadro. É a doutrina do `piece.base` do `trailer-assembly` e do
 * `tsTailBase` do `chassis-tail` — toda deformação parte de uma cópia intacta.
 */
export function trimFlapsForGuard(
  cab: THREE.Object3D, mount: RigidMount, xInterno: number,
): string[] {
  const linhas: string[] = [];
  const alvo = xInterno - ABA_FOLGA_X;
  /* Memo pelo alvo: `medeChassi()` é uma varredura por vértice do caminhão
     inteiro, e este caminho está no laço de redimensionamento. */
  const memo = cab.userData as { tsAbaAlvo?: number };
  if (memo.tsAbaAlvo !== undefined && Math.abs(memo.tsAbaAlvo - alvo) < 1e-4) return linhas;

  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const grupo = cab.getObjectByName('TS_CHASSI_PECAS');
  const abas = ((grupo?.userData as {
    tsAbas?: { mesh: THREE.Mesh; nome: string; i: number;
      solidarias?: { mesh: THREE.Mesh; nome: string }[] }[]
  })?.tsAbas) ?? [];
  if (!abas.length) return ['⚠ sem abas registradas — `buildChassisParts()` não rodou antes.'];

  for (const b of abas) {
    if (!b.mesh) continue;

    const geo = claimGeometry(b.mesh);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) continue;
    /* A CÓPIA INTACTA. Sem ela a segunda passada escalaria a primeira. */
    const ud = geo.userData as { tsAbaBase?: Float32Array };
    if (!ud.tsAbaBase) ud.tsAbaBase = (pos.array as Float32Array).slice();
    const base = ud.tsAbaBase;

    /* Só de IDA: quem escreve de volta é `encolhe()`, com a inversa da matriz
       DA MALHA que estiver escrevendo — a aba e as solidárias têm matrizes
       diferentes e um `N2L` só serviria à primeira. */
    const L2N = new THREE.Matrix4().copy(N).multiply(
      new THREE.Matrix4().copy(cab.matrixWorld).invert()).multiply(b.mesh.matrixWorld);
    const p = new THREE.Vector3();

    /* Primeira varredura da BASE: topo e os dois lobos em x. */
    let yTopo = -Infinity, yBaixo = Infinity, maxAbs = 0;
    let posX0 = Infinity, posX1 = -Infinity, negX0 = Infinity, negX1 = -Infinity;
    for (let v = 0; v < pos.count; v++) {
      p.set(base[v * 3], base[v * 3 + 1], base[v * 3 + 2]).applyMatrix4(L2N);
      if (p.y > yTopo) yTopo = p.y;
      if (p.y < yBaixo) yBaixo = p.y;
      if (Math.abs(p.x) > maxAbs) maxAbs = Math.abs(p.x);
      if (p.x >= 0) { posX0 = Math.min(posX0, p.x); posX1 = Math.max(posX1, p.x); }
      else { negX0 = Math.min(negX0, p.x); negX1 = Math.max(negX1, p.x); }
    }
    const cPos = Number.isFinite(posX0) ? (posX0 + posX1) / 2 : 0;
    const cNeg = Number.isFinite(negX0) ? (negX0 + negX1) / 2 : 0;

    /* A escala final: a de tamanho, e mais um aperto se ainda cruzar a grade. */
    let k = ABA_ESCALA;
    const depois = Math.max(
      Number.isFinite(posX1) ? cPos + (posX1 - cPos) * k : 0,
      Number.isFinite(negX0) ? Math.abs(cNeg + (negX0 - cNeg) * k) : 0);
    if (depois > alvo && depois > 1e-6) k *= alvo / depois;

    /* ⚠️ O MESMO MAPA VALE PARA AS SOLIDÁRIAS, e é por isso que ele é uma
       função e não um laço solto: a aba e o letreiro só continuam sendo a
       MESMA peça se as duas passarem pela mesma âncora e pela mesma escala.
       Cada malha carrega a própria matriz, então o mapa é aplicado em espaço
       NORMALIZADO e a volta é pela inversa DELA. */
    /**
     * @param soX  só o X é mapeado — para os BRAÇOS.
     *   O mapa de y ancora no topo da aba e a encolhe junto com o x, que é o
     *   certo para uma chapa (ela tem de continuar proporcional). Um braço não:
     *   ele é um tubo de seção circular, e escalar só o y o deixaria elíptico.
     *   O que ele precisa é acompanhar a PONTA da aba, que é x.
     */
    const encolhe = (alvoMesh: THREE.Mesh, soX = false): number => {
      const g2 = claimGeometry(alvoMesh);
      const p2 = g2.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!p2) return 0;
      const u2 = g2.userData as { tsAbaBase?: Float32Array };
      if (!u2.tsAbaBase) u2.tsAbaBase = (p2.array as Float32Array).slice();
      const b2 = u2.tsAbaBase;
      const A = new THREE.Matrix4().copy(N).multiply(
        new THREE.Matrix4().copy(cab.matrixWorld).invert()).multiply(alvoMesh.matrixWorld);
      const Ai = A.clone().invert();
      const q = new THREE.Vector3();
      /* O MAPA, uma vez só — ele é aplicado em DOIS lugares (ver abaixo) e as
         duas aplicações têm de ser literalmente a mesma conta. */
      const mapa = (x: number, y: number, z: number) => {
        q.set(x, y, z).applyMatrix4(A);
        const c = q.x >= 0 ? cPos : cNeg;
        q.x = c + (q.x - c) * k;
        if (!soX) q.y = yTopo - (yTopo - q.y) * k;
        const fora = Math.abs(q.x);
        q.applyMatrix4(Ai);
        return fora;
      };
      let mx = 0;
      for (let v = 0; v < p2.count; v++) {
        const fora = mapa(b2[v * 3], b2[v * 3 + 1], b2[v * 3 + 2]);
        if (fora > mx) mx = fora;
        p2.setXYZ(v, q.x, q.y, q.z);
      }
      p2.needsUpdate = true;
      g2.computeBoundingBox(); g2.computeBoundingSphere();

      /* ▶▶ E A BASE DO RABO ENCOLHE JUNTO — sem isto, nada disto aparece.
         --------------------------------------------------------------------
         ⚠️ A ABA MORA ATRÁS DO PLANO DE CORTE DO RABO (z −7 153 contra o corte
         mais dianteiro em −7 005 no Scania), então `stretchRigidFrame()` é
         co-dono destes mesmos vértices — e ele os REESCREVE da base pristina
         dele a CADA `placeTrailer()`, mesmo quando o deslocamento é zero.
         Medido em 2026-08-22: a aba saía daqui com 1 104 mm e a passada
         seguinte a devolvia para 1 230, com o console dizendo "a 61 %" o tempo
         todo. É o modo de falhar mais caro que existe — o log afirma o
         conserto e a tela mostra o defeito.

         A correção não é ordem nem exclusão: é escrever no snapshot do outro
         dono. A partir daqui a "posição pristina" daquela aba passa a ser a
         ENCOLHIDA, e o rabo continua fazendo o que faz (transladar) sobre ela.

         ⚠️ E PARTE-SE DE UMA CÓPIA DA BASE DO RABO, nunca dela mesma: um
         segundo encolhimento (a grade mudou de |x|) aplicaria o mapa sobre um
         resultado já mapeado e a peça encolheria duas vezes. É a mesma doutrina
         de `tsAbaBase` logo acima, uma camada abaixo. */
      const tb = tailBaseFor(alvoMesh);
      if (tb) {
        const ut = alvoMesh.userData as { tsAbaTailBase?: Float32Array };
        if (!ut.tsAbaTailBase) ut.tsAbaTailBase = tb.base.slice();
        const bt = ut.tsAbaTailBase;
        for (let kk = 0; kk < tb.idx.length; kk++) {
          mapa(bt[kk * 3], bt[kk * 3 + 1], bt[kk * 3 + 2]);
          tb.base[kk * 3] = q.x; tb.base[kk * 3 + 1] = q.y; tb.base[kk * 3 + 2] = q.z;
        }
      }
      return mx;
    };

    let novoMax = encolhe(b.mesh);
    for (const s2 of (b.solidarias ?? [])) {
      const mx = encolhe(s2.mesh, /^TS_CHASSI_BARRA_/.test(s2.nome));
      if (mx > novoMax) novoMax = mx;
    }

    /* MEDE O QUE FICOU, peça por peça — não a caixa das duas juntas. Uma aba
       de caminhão brasileiro tem ~600 × 500 mm; sem imprimir isto eu estava
       ajustando um fator no escuro. */
    const lobo = (x0: number, x1: number) => `${((x1 - x0) * 1000).toFixed(0)}`;
    const larg = Number.isFinite(posX1) ? lobo(posX0, posX1) : '?';
    const alt = ((yTopo - yBaixo) * 1000).toFixed(0);
    linhas.push(`aba ${b.nome} FINAL ${(Number(larg) * k).toFixed(0)} × `
      + `${(Number(alt) * k).toFixed(0)} mm (era ${larg} × ${alt}) · `);
    linhas.push(`aba ${b.nome} a ${(k * 100).toFixed(0)} % — meia-largura de `
      + `${(maxAbs * 1000).toFixed(0)} para ${(novoMax * 1000).toFixed(0)} mm `
      + `(face interna da proteção em ${(xInterno * 1000).toFixed(0)})`
      + `; ${(b.solidarias ?? []).length} peça(s) solidária(s) foram junto.`);
  }
  memo.tsAbaAlvo = alvo;
  return linhas;
}
