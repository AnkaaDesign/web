/* O CONJUNTO TRASEIRO — tandem, para-barro e estepe, movidos em z.
   ===========================================================================
   > *"agora no truck, mova os tanques para próximo da cabine, e as rodas e
   > estepe também mas apenas um pouco"* · *"o bitruck agora o conjunto de rodas
   > e estepe deve mover 40 cm para trás, o truck 30 cm para frente"* ·
   > *"o toco não precisa de nenhuma mudança de roda, este, cuidado com isso"*
   > — Kennedy, 2026-08-24.

   POR QUE ISTO EXISTE. Os quatro rígidos do Scania saem do MESMO arquivo: o
   8x2 é o rip e o 6x4/6x2/4x2 são recortes dele (`cut-scania.cjs`), e a cirurgia
   só APAGA. O entre-eixos continua o do bitruck em todos — 6 572 mm do
   direcional ao trativo no 6x2, contra ~4 900 de um truck de fábrica —, e o que
   se vê é um caminhão esticado, com buraco no meio.

   ═══════════════════════════════════════════════════════════════════════════
   A RÉGUA: **O NÓ QUE É DO TANDEM ANDA INTEIRO; O QUE É DO CAMINHÃO FICA.**

   E ela é MEDIDA, não uma lista de nomes. Para cada malha, conta-se quantos
   vértices caem na janela do conjunto; passando de `PUREZA`, o nó inteiro anda
   por matriz. Foi assim que a medição separou, no Scania 6x2:

       chassis_p34   76 830 de 76 911 na janela (99,9 %)   → ANDA (suspensão)
       chassis_p36 / p37             100 %                 → ANDA (amortecedor)
       lameiro_0_p0 / p1             100 %                 → ANDA (para-barro)
       VM_WHEEL_DUAL_* (nossos)      100 %                 → ANDAM
       chassis_p14   23 028 de 51 135 (45 %)               → FICA (longarina)
       chassis_p12    4 308 de 34 738 (12 %)               → FICA (longarina)

   ⚠️ POR NÓ, E NÃO POR COMPONENTE CONEXO — e aqui a unidade de §46 é a errada.
   Medido: `chassis_p14` devolve CENTENAS de componentes de 19 mm em |x| 408…440
   (a rebitagem da alma, que está em 425) e todos CABEM na janela do tandem.
   Quem move a rebitagem da longarina move o caminhão. A pureza do nó separa as
   duas coisas sem lista de exceção.

   ⚠️ E O `mounts.json` ANDA JUNTO. `axles.driveZ`/`liftZ` são a régua da grade
   lateral (que nasce ENTRE os eixos), do para-barro e do teto de balanço
   traseiro da CONTRAN 882/2021. Mover a geometria e deixar os números seria o
   defeito clássico desta base: tudo continua "certo" e nada bate. Ver
   `shiftRearBogie()`, que devolve o delta aplicado para o chamador reescrever
   as cotas. */
import * as THREE from 'three';
import type { RigidMount } from './mounting';
import { claimGeometry } from './geometry-share';
import { componentesSoldados } from './truck-wheels';

/**
 * Quanto o conjunto traseiro anda, por configuração — em Zn, POSITIVO para a
 * FRENTE.
 *
 * ⚠️ O TOCO É ZERO, e isso é ordem direta: *"o toco não precisa de nenhuma
 * mudança de roda, este, cuidado com isso"*. Ele já tem o entre-eixos que o
 * recorte deixou e o dono o aprovou como está.
 */
export const BOGIE_SHIFT: Record<string, number> = {
  '8x2': -0.40,      // bitruck: o tandem recua
  '6x2': +0.30,      // truck: avança
  '6x4': +0.30,      // truck traçado
  '4x2': 0,          // toco: NÃO MEXE (menos o do VM — ver BOGIE_POR_CAMINHAO)
};

/**
 * ▶▶ …E O DESLOCAMENTO POR CAMINHÃO, quando a configuração não basta.
 *
 * *"pegue todo o conjunto das rodas traseiras e estepe do VM bitruck e mova
 * mais para trás, está muito no centro, veja o bitruck do Scania para ver mais
 * ou menos o posicionamento"* — Kennedy, 2026-08-25.
 *
 * ⚠️ `BOGIE_SHIFT` é por CONFIGURAÇÃO, e os dois bitrucks deste acervo não
 * partem do mesmo lugar: o Scania é bitruck DE FÁBRICA e o VM é um 6x2 com um
 * eixo enxertado por `cut-chassi.cjs`. Medido, com o recuo de 400 já aplicado:
 *
 *                        último eixo   traseira do chassi   BALANÇO
 *     Scania 8x2            −6 690          −9 072           2 382
 *     VM 8x2                −5 189          −8 693           3 504
 *
 * ou seja **1 122 mm de balanço a mais** — o tandem no meio do caminhão, que é
 * a queixa. A conta fecha por dois caminhos independentes: igualar o balanço
 * pede −1 122, e igualar o chassi que sobra atrás do pneu do último eixo
 * (Scania 1 874 mm) pede −1 120. Adotado **−1 120 sobre os −400**, ou −1,52 m.
 *
 * Depois disso o VM fica com 4 640 mm entre o 2º direcional e o trativo, contra
 * 4 759 do Scania — o mesmo caminhão, aos olhos.
 */
const BOGIE_POR_CAMINHAO: {
  id: RegExp; dz: number; suspensao?: boolean; dyEstepe?: number; carda?: boolean;
}[] = [
  { id: /^volvo-vm-2015-8x2r$/i, dz: -1.52, suspensao: true, dyEstepe: 0.040, carda: true },
  /* ▶ E O TRUCK DO VM TAMBÉM ESTAVA NO MEIO. *"as rodas no truck também estão
     muito pro centro, deveria mover levemente mais para trás cerca de 40 cm –
     60 cm"* — Kennedy, 2026-08-25. Ele saía em +300 (a ordem de 24/08, que era
     do Scania e valia por CONFIGURAÇÃO); 500 mm para trás deixam o total em
     −200, no meio da faixa pedida. Leva a suspensão e o cardã pela mesma razão
     do bitruck: no rip do VM nenhum dos dois é nó. */
  { id: /^volvo-vm-2015-6x2r$/i, dz: -0.20, suspensao: true, carda: true },
  /* ▶ E O TOCO DO VM — ⚠️ ISTO SUBSTITUI UMA ORDEM ANTERIOR, e por isso está
     escrito aqui em vez de mudar `BOGIE_SHIFT`. *"o toco não precisa de nenhuma
     mudança de roda, este, cuidado com isso"* era de 2026-08-24 e vale para o
     Scania, que é toco DE FÁBRICA; o do VM é recorte, e o dono o viu depois:
     *"o toco também, a roda traseira deve mover uns 40 – 50 cm também"* —
     Kennedy, 2026-08-25. `BOGIE_SHIFT['4x2']` continua ZERO para todo o resto. */
  { id: /^volvo-vm-2015-4x2r$/i, dz: -0.45, suspensao: true, carda: true },
];

/** Meio-vão que a janela do conjunto abre além do primeiro e do último eixo.
 *  950 mm cobre o pneu (raio ~510) com o para-barro, que no Scania fica 870 mm
 *  atrás do eixo auxiliar. */
const JANELA = 0.95;
/** …e a fração do nó que precisa estar dentro dela para o nó ser do conjunto.
 *  98 % passa a suspensão (99,9 % medidos) e recusa a longarina (45 %). */
const PUREZA = 0.98;
/** Abaixo disto o nó não tem voz: um punhado de vértices na janela é ruído. */
const MIN_VERT = 40;
/** O estepe tem janela própria — ele mora entre o tanque e o tandem, e o vão
 *  dele é medido a partir da roda que `swapSpareWheel()` pendurou. */
const ESTEPE_FOLGA = 0.35;
/** O nó do estepe NO SCANIA, posto por `swapSpareWheel()`. */
const ESTEPE_NO = 'VM_WHEEL_SPARE';

/* ═══════════════════════════════════════════════════════════════════════════
   ▶▶▶ O ESTEPE DO RIP — achado por FORMA, porque ele não tem nó nosso
   ═══════════════════════════════════════════════════════════════════════════

   > *"e também veja que o estepe está atravessando uma das rodas"* · *"fora que
   >  o estepe do VM está sem suporte conectando no chassi"* — Kennedy,
   >  2026-08-25.

   AS DUAS FRASES SÃO O MESMO DEFEITO, e ele é o desta função. Só o Scania
   recebe `swapSpareWheel()`, então só ele tem o nó `VM_WHEEL_SPARE`; no VM o
   estepe é do rip e se chama `step_0_p*`. Sem âncora, o relato dizia "SEM
   estepe" e a janela do conjunto ficava só nos eixos — e aí a pureza do nó
   cortou a família do estepe **ao meio**, medido no VM 8x2 com a janela em
   Zn −6 139…−2 943:

       step_0_p2  berço   −6 049…−5 683   100 % dentro   → ANDOU −400 mm
       step_0_p1  aro     −6 156…−5 574    97 % dentro   → ficou
       step_0_p0  pneu    −6 336…−5 400    79 % dentro   → ficou

   O berço foi para trás sozinho (o "sem suporte conectando no chassi") e o pneu
   parado entrou 317 mm dentro do pneu do eixo auxiliar (o "atravessando uma das
   rodas"). Não é cota errada: é a família partida.

   ACHAR POR NOME NÃO SERVE — `step` num rip inglês tanto é "estepe" quanto
   "degrau", e o VW usa outro nome. O que não depende de idioma é a FORMA: um
   estepe é um DISCO (as duas maiores dimensões iguais), do tamanho de uma roda,
   e **não toca o chão** — é a mesma régua que `truck-wheels.ts` usa para não
   trocar o estepe junto com a rodagem. */

/** Diâmetro possível de uma roda guardada. */
const ESTEPE_D = [0.60, 1.60];
/** …e a espessura dela. */
const ESTEPE_ESP = [0.12, 0.70];
/** As duas maiores dimensões de um disco são quase iguais. */
const ESTEPE_REDONDO = 0.85;
/** …e a terceira é claramente menor. */
const ESTEPE_CHATO = 0.75;
/** Acima desta fração do diâmetro, a peça não toca o chão: é peça guardada. */
const ESTEPE_CHAO = 0.15;
/** Meia-largura da busca: nada de estepe fora do envelope do caminhão. */
const ESTEPE_X = 1.45;

/**
 * A caixa do estepe, em Zn — pelo nó nosso, ou por forma no rip.
 *
 * Devolve `null` quando o caminhão não tem estepe (é o caso legítimo do VW).
 */
function caixaDoEstepe(
  cab: THREE.Object3D, N: THREE.Matrix4, cabInv: THREE.Matrix4, mount: RigidMount,
): { caixa: THREE.Box3; quem: string } | null {
  const v = new THREE.Vector3();
  const L2N = new THREE.Matrix4();
  const medeNo = (o: THREE.Object3D) => {
    const b = new THREE.Box3();
    o.traverse((n) => {
      const m = n as THREE.Mesh;
      const pos = m.isMesh ? m.geometry?.getAttribute('position') as THREE.BufferAttribute : null;
      if (!pos) return;
      L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
      for (let i = 0; i < pos.count; i += 3) {
        b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N));
      }
    });
    return b;
  };
  const nosso = cab.getObjectByName(ESTEPE_NO);
  if (nosso) {
    const b = medeNo(nosso);
    if (!b.isEmpty()) return { caixa: b, quem: ESTEPE_NO };
  }
  /* ▶ E, se não houver, o do rip — por forma, ATRÁS DA CABINE. À frente dela o
     acervo tem rodas de reserva de outra coisa (o VM traz `chs_base_0_p16`,
     299 × 647 × 671 em Zn 2 402…3 072, que é peça de para-choque). */
  const busca = new THREE.Box3(
    new THREE.Vector3(-ESTEPE_X, 0.05, -20),
    new THREE.Vector3(ESTEPE_X, 1.60, mount.cabRearZ));
  let achado: { caixa: THREE.Box3; quem: string } | null = null;
  let melhor = 0;
  const cx = new THREE.Box3();
  cab.traverse((node) => {
    const m = node as THREE.Mesh;
    if (!m.isMesh || !m.visible || !m.geometry || nossa(m)) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const idx = m.geometry.getIndex();
    if (!pos || !idx || pos.count > 260000) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
    const bb = m.geometry.boundingBox as THREE.Box3;
    cx.makeEmpty();
    for (let k = 0; k < 8; k++) {
      cx.expandByPoint(v.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y,
        k & 4 ? bb.max.z : bb.min.z).applyMatrix4(L2N));
    }
    if (!cx.intersectsBox(busca)) return;
    const px = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
    }
    const pai = componentesSoldados(px, idx, pos.count);
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
    for (const b of caixas.values()) {
      if (!busca.containsBox(b)) continue;
      const d = b.getSize(new THREE.Vector3());
      const dd = [d.x, d.y, d.z].sort((p, q) => q - p);
      if (dd[0] < ESTEPE_D[0] || dd[0] > ESTEPE_D[1]) continue;
      if (dd[2] < ESTEPE_ESP[0] || dd[2] > ESTEPE_ESP[1]) continue;
      if (dd[1] / dd[0] < ESTEPE_REDONDO || dd[2] / dd[0] > ESTEPE_CHATO) continue;
      if (b.min.y < ESTEPE_CHAO * dd[0]) continue;              // toca o chão: é rodagem
      if (dd[0] <= melhor) continue;
      melhor = dd[0];
      achado = { caixa: b.clone(), quem: `${m.name} (disco de ${(dd[0] * 1000).toFixed(0)} mm por forma)` };
    }
  });
  return achado;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ▶▶▶ O CONJUNTO DO ESTEPE — E POR QUE ELE ANDAVA PARTIDO

   > *"pedi para você mover o estepe do p360 … mas ficou dois conjuntos de peças
   > separadas … deveria ir do verde para o vermelho · analise o modelo toco que
   > não teve mudança · garanta que não irá mover novamente componentes que são
   > um conjunto separadamente para não quebrar mais as coisas"*
   > — Kennedy, 2026-08-25.

   ⚠️⚠️ A CAUSA NÃO ERA A RÉGUA, ERA A UNIDADE DE MEDIDA. Cinco rodadas de
   filtro (tamanho, espessura, forma, costura, contato) tentaram separar "o que é
   do berço" de "o que é da longarina" sobre uma lista de componentes CRUS — e
   componente cru não é peça:

     `componentes()` une triângulo que compartilha ÍNDICE de vértice. O rip parte
     o vértice em toda quina viva (normal por canto), então uma barra é dezenas
     de tiras soltas. E a fragmentação é POR ARQUIVO: o `scania_p_8x2r.glb` é o
     rip, e `_6x2r`/`_4x2r`/`_6x4r` saem dele por `cut-scania.cjs`, que reescreve
     a malha e passa por **Draco — que deduplica vértice**.

   Medido na mesma vizinhança do estepe, com a mesma região:

       toco (4x2, recorte)      464 componentes crus  →   **20** soldados
       bitruck (8x2, rip)     1 279 componentes crus  →   **52** soldados

   Ou seja: o tirante que no toco é UM componente de 578 × 55 × 54, no bitruck
   são TRINTA E DUAS tiras de 513 × 1 × 6. Qualquer filtro de tamanho, espessura
   ou forma aceita algumas tiras e recusa outras — e aceitar metade de uma peça é
   exatamente "mover componentes que são um conjunto separadamente". Era isso na
   foto: o miolo do berço tinha andado 400 mm e as tiras finas da mesma peça
   tinham ficado.

   ⚠️ E ELE ANDAVA CERTO NO TRUCK. O 6x2 é recorte, ou seja soldado por Draco:
   lá a peça já chegava inteira e a mesma régua parecia funcionar. Só o bitruck
   quebrava, e por isso dez rodadas de foto não acharam a causa.

   ───────────────────────────────────────────────────────────────────────────
   A RÉGUA NOVA, e ela é uma só: **PERTENCER, NÃO PARECER.**

   1. os componentes saem de `componentesSoldados()` — peça física, um
      componente, no rip e no recorte;
   2. só entra o que cabe INTEIRO na LAJE do estepe (a caixa da roda inflada).
      A longarina tem 8,3 m em z e nunca cabe; a travessa atravessa em x e nunca
      cabe. Isso descarta o chassi sem lista de nomes;
   3. dentro da laje, anda o que está LIGADO POR CONTATO à roda, propagando.
      Sem propagar, o primeiro grau alcança a cesta e para nela (foi a queixa
      *"o suporte que segura eles não andou junto"*); propagando dentro da laje
      não há para onde escapar, porque tudo o que sai da laje já foi descartado.

   Medido no TOCO, que é onde o conjunto está intacto, a laje devolve 20
   componentes soldados e a régua leva estes:

       chassis_p18  555×169×555   a CESTA (com as chapas e os grampos dentro)
       chassis_p12  578× 55× 54   o TIRANTE que amarra na longarina
       chassis_p12  412×241× 85   os dois SUPORTES (um por z)
       chassis_p12  319× 10×151   a chapa sobre o estepe
       chassis_p12  121×239×147   a orelha junto à alma
       chassis_p12   10×102×101   o prato do GUINCHO
       chassis_p14   19× 29× 28   os 5 parafusos que prendem o suporte na alma
                                  (4 em quina + 1 no meio — padrão de flange, e
                                  não a rebitagem corrida da longarina)

   e deixa de fora os 6 parafusos de `chassis_p14` que moram 600 mm à frente:
   eles não cabem na laje e não encostam em nada do conjunto.

   ⚠️ FECHA-SE POR FALTA, NUNCA POR EXCESSO. Se a propagação passar de
   `TETO_PECAS`, ela escapou da laje por algum contato que não se previu — e
   então NADA anda por vértice, com o relato dizendo o número. Meio conjunto na
   tela é pior que um conjunto parado: o dono vê a peça partida e não sabe o que
   confiar.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A LAJE do estepe — a caixa da roda, inflada.
 *
 * Medida no toco, em Zn relativo ao centro da roda: a peça mais alta do
 * conjunto é o suporte, que sobe a +487 (a alma da longarina); a mais funda vai
 * a −174, que é o próprio estepe. Em x o conjunto vai de −218 (encosta na alma)
 * a +400 (a ponta do tirante), dentro do diâmetro da roda (±496). Em z ele não
 * passa de ±155, muito dentro do disco.
 *
 * Então: em z e x a laje quase não infla (a roda já é maior que o conjunto) e
 * em y ela sobe até a longarina. O que a laje precisa é ser MENOR que a menor
 * peça de chassi que passa por ali — e a longarina tem 8,3 m em z.
 */
const LAJE = { x: 0.16, yBaixo: 0.10, yAlto: 0.42, z: 0.25 };
/**
 * Folga do contato — 60 mm.
 *
 * ⚠️ NÃO É ARBITRÁRIA: as peças deste conjunto não se tocam de caixa em caixa.
 * Medido no toco, a maior emenda é entre o SUPORTE (z −145…−61) e o TIRANTE
 * (z −24…+30): **37 mm de vão**. Com 20 mm o tirante fica para trás; com 60 mm
 * a corrente fecha roda → cesta → suporte → tirante → prato do guincho.
 *
 * O risco de afrouxar seria alcançar o chassi — e não alcança, porque só
 * participa da corrente quem já cabe inteiro na laje.
 */
const CONTATO = 0.06;
/**
 * Teto de peças do conjunto — o freio de "fecha por falta".
 *
 * Medido: o conjunto tem 9 componentes soldados no toco e 21 no bitruck (o rip
 * ainda parte algumas peças mesmo depois da solda). 60 dá três vezes o pior
 * caso; passar disso quer dizer que a laje vazou, e aí nada anda.
 */
const TETO_PECAS = 60;

/* ═══════════════════════════════════════════════════════════════════════════
   ▶▶▶ E O TANDEM TAMBÉM TEM CONJUNTO — feixes, mãos e cubos

   > *"os amortecedores, suportes não moveram junto com as rodas, garanta de
   >  corrigir isso"* — Kennedy, 2026-08-25.

   ⚠️ A PUREZA DE NÓ SÓ ALCANÇA QUEM É NÓ. No Scania a suspensão traseira tem
   nós próprios (`chassis_p34`, `p36`, `p37`) e por isso o passo 2 a levava; no
   VM ela está DENTRO de `chassis_p0`/`p1`, malhas de caminhão inteiro que a
   pureza recusa com razão. Medido no VM 8x2, na janela dos eixos:

       chassis_p0   89×237×1292 (×2)   os FEIXES do eixo auxiliar
       chassis_p0   89×229×1295 (×2)   os feixes do trativo
       chassis_p0  140×391× 263 (×4)   as MÃOS-DE-MOLA
       chassis_p0 1324×445× 154        o CUBO do eixo
       chassis_p0  202×215× 215 (×4)   os tambores
       chassis_p1  144× 59×  59 (×6)   as buchas

   nenhuma delas é nó, e todas ficaram para trás. A máquina que resolve já
   existia — laje + solda + contato, a do berço do estepe —, e o que faltava era
   apontá-la para a roda. */

/** Meia-largura da laje do tandem: o envelope do caminhão e nada além. */
const TANDEM_X = 1.45;
/**
 * ▶▶ O PISO DE TAMANHO DA SUSPENSÃO — 100 mm, e ele é o que salva a longarina.
 *
 * ⚠️ MEDIDO, E SEM ELE A PASSADA ARRASTA A REBITAGEM. Contato encadeado a
 * partir da roda chega ao feixe, do feixe à mão-de-mola e da mão à ALMA em que
 * ela é aparafusada — e ali mora a rebitagem corrida. Sem piso, o Scania (que
 * nem precisa desta passada) levava **77 componentes de `chassis_p14` de
 * 6 × 18 × 18 e 77 de `chassis_p35` de 3 × 42 × 41**: a rebitagem inteira,
 * andando 400 mm. É o defeito que o cabeçalho deste arquivo já proíbe pelo
 * outro lado — "quem move a rebitagem da longarina move o caminhão".
 *
 * A suspensão é feita de peça GRANDE (feixe 1 292, mão-de-mola 391, cubo 1 324,
 * tambor 215, bucha 144) e a rebitagem, de peça de 42 mm para baixo. 100 mm
 * passa entre as duas com folga de 40 % de um lado e 44 % do outro.
 */
const TANDEM_MIN = 0.10;
/**
 * ▶▶ …E O PISO NÃO EXPULSA A PEÇA PEQUENA: ELE SÓ A IMPEDE DE PROPAGAR.
 *
 * *"cuidado com essas peças flutuando que eram ligadas as rodas"* — Kennedy,
 * 2026-08-25.
 *
 * ⚠️ O PISO SOZINHO DEIXOU LIXO NO AR. Recusar de saída tudo abaixo de 100 mm
 * tirou a rebitagem, mas tirou junto o que é MIÚDO E DO CONJUNTO — medido pelo
 * detector de peça flutuante no VM, sobraram no ar os grampos do feixe
 * (`chassis_p0` 91 × 26 × 27, quatro deles), o bloco de 77 × 79 × 79 e os
 * calços de 30 × 50 × 44.
 *
 * A distinção certa não é "entra ou não entra", é **"pode ou não pode
 * ESTENDER a corrente"**. Peça grande é elo: entra e propaga. Peça pequena é
 * FOLHA: entra se encostar no que já está dentro, e para ali. Com isso o rebite
 * que encosta na mão-de-mola vem junto (é um rebite), mas não puxa o rebite
 * seguinte, e a fileira inteira da alma continua onde estava.
 */
/**
 * ▶ E O MIOLO ENTRE AS LONGARINAS TEM TOLERÂNCIA PRÓPRIA — 300 mm.
 *
 * ⚠️ MEDIDO: a cruzeta do cardã (`chassis_p0` 85 × 85 × 21 mais quatro caps de
 * 44 mm) fica a **130 mm** do cubo do eixo, e o rip não modela o que há entre
 * os dois. Com 60 mm ela não entra e fica boiando no meio do vão; com 300 ela
 * vem junto com o diferencial, que é a peça de que ela é o encaixe.
 *
 * Afrouxar assim é seguro porque a folga só vale para |x| ≤ `MIOLO_X`: entre as
 * longarinas (|x| 342…552 no VM) não existe rebitagem — existem cardã,
 * diferencial e travessa, e travessa já sai por `ehTravessa()`.
 */
const MIOLO_X = 0.30;
const CONTATO_MIOLO = 0.30;
/**
 * ▶ O QUE SEPARA A TRAVESSA DA SUSPENSÃO — a ALTURA.
 *
 * As duas cruzam a linha de centro, então o filtro de travessa que serve em
 * `truck-tanks.ts` ("cruza o eixo, é travessa") aqui apagaria o cubo do eixo,
 * que tem 1 324 mm de ponta a ponta. O que separa é a cota: medido no VM,
 * travessa de `chassis_p3` 816 × 182 × 152 em y 868…1123 contra cubo de
 * `chassis_p0` 1 324 × 445 × 154 em y 338…784. 600 mm abaixo do topo da mesa
 * (1 189 → 589) passa entre as duas com folga dos dois lados.
 */
const TANDEM_MESA = 0.60;
/** …e a largura mínima para ser travessa. Ver `ehTravessa()`. */
const TRAVESSA_LARGA = 0.30;
/**
 * Teto de peças do conjunto do tandem.
 *
 * Medido no VM, a suspensão dos dois eixos fecha em algumas dezenas de
 * componentes soldados. 240 dá margem larga e ainda é um freio: passar disso
 * quer dizer que a corrente escapou da laje, e aí NADA anda por vértice.
 */
const TETO_TANDEM = 240;

/**
 * ▶▶ O ESTEPE SOBE PARA ENCOSTAR — `dyEstepe`.
 *
 * *"o estepe no bitruck, já que está mais pra trás, deve subir um pouco porque
 * não está tocando na parte do chassi"* — Kennedy, 2026-08-25.
 *
 * ⚠️ O NÚMERO É MEDIDO, e a medida é a folga VERTICAL: para cada vértice do
 * conjunto do estepe, quanto falta até o primeiro vértice de chassi que está
 * ACIMA dele na mesma prumada (janela de 30 mm em x e z). No VM 8x2 depois do
 * recuo isso dá **40 mm** contra `chassis_p3`.
 *
 * ⚠️ E A TRAVESSA DE PONTE NÃO SOBE. Ela é a peça em que o berço se aparafusa e
 * corre APOIADA nas longarinas; subi-la 40 mm a descolaria delas — o defeito
 * que se está consertando, do outro lado. Sobe quem pende: os nós `step_0_*` e
 * a ferragem do berço.
 */
/**
 * ▶▶ …E O CARDÃ ESTICA.
 *
 * *"essa barra embaixo do chassi que vai no bitruck não está sendo esticada, e
 * deveria já que as rodas foram mais pra trás"* — Kennedy, 2026-08-25.
 *
 * O diferencial andou 1 520 mm e o eixo de transmissão não: ele acabava no ar,
 * no meio do vão. Um cardã é a única peça do caminhão que MUDA DE COMPRIMENTO
 * quando o entre-eixos muda — é para isso que ele tem luva deslizante —, então
 * ele não anda: ele estica.
 *
 * Achar por forma, e a régua é apertada de propósito: componente soldado a
 * |x| ≤ `CARDA_X` da linha de centro, com pelo menos `CARDA_LONGO` em z e no
 * máximo `CARDA_FINO` em x e y, que ATRAVESSA a fronteira dianteira da âncora
 * do tandem (ponta de trás dentro, ponta da frente fora). Medido no VM, isso
 * devolve **exatamente um**: `chassis_p0` 103 × 189 × 1 673 em Zn −3 134…−1 462.
 *
 * ⚠️ `CARDA_X` É 150 mm E NÃO 300, e o número tem dono: a 300 entra também
 * `chassis_p6` 39 × 103 × 1 146 em |x| 243…282, que é conduíte de flanco e
 * morre no meio do vão — esticá-lo o levaria 1,5 m para além de onde ele acaba.
 *
 * O esticamento é uma RAMPA ancorada na ponta da frente: `f` vai de 0 na ponta
 * fixa a 1 na ponta que anda, então a ponta de trás TRANSLADA inteira (a cruzeta
 * não deforma) e quem estica é o tubo. Medido: a ponta de trás do cardã fica
 * a 41 mm da cruzeta, que é a mesma folga que ela tinha de fábrica.
 */
const CARDA_X = 0.15;
const CARDA_LONGO = 0.80;
const CARDA_FINO = 0.35;
/** Quanto a ponta de trás pode estar além da âncora e ainda ser do conjunto. */
const CARDA_ALCANCE = 0.15;

/**
 * Move o conjunto traseiro (tandem + para-barro + estepe) em z.
 *
 * Devolve o relato e o delta REALMENTE aplicado, em Zn — o chamador usa o delta
 * para reescrever `axles.driveZ`/`liftZ`, que é o que mantém a grade lateral, o
 * para-barro e o teto de balanço falando do mesmo caminhão.
 */
/** A peça é NOSSA (kit posto pelo motor)? ⚠️ Pelo ANCESTRAL: as malhas dentro
 *  do kit trazem o nome do ASSET, não o do nó — testar `mesh.name` deixa o kit
 *  inteiro passar, e foi o que fez a roda andar duas vezes. */
function nossa(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (/^(VM_WHEEL|TS_)/.test(p.name || '')) return true;
  }
  return false;
}

/** Um componente soldado, já medido em Zn. */
interface Peca {
  malha: THREE.Mesh;
  raiz: number;
  caixa: THREE.Box3;
  faces: number;
  /** Quanto esta peça sobe, em Zn. Só o conjunto do estepe usa — ver
   *  `dyEstepe`; a travessa de ponte e o tandem ficam em zero. */
  dy?: number;
}

/**
 * Os componentes SOLDADOS que cabem inteiros numa laje.
 *
 * ⚠️ "CABE INTEIRO" é o freio que dispensa lista de nomes: a longarina tem
 * 11,6 m em z e a travessa a largura toda em x — nenhuma das duas cabe numa
 * laje do tamanho de um conjunto. Ver o cabeçalho.
 */
function pecasNaLaje(
  cab: THREE.Object3D, N: THREE.Matrix4, cabInv: THREE.Matrix4,
  laje: THREE.Box3, raizes: Set<THREE.Object3D>,
  recusa: ((b: THREE.Box3) => boolean) | null,
): Peca[] {
  const pecas: Peca[] = [];
  const v = new THREE.Vector3();
  const L2N = new THREE.Matrix4();
  const cxMalha = new THREE.Box3();
  cab.traverse((node) => {
    const m = node as THREE.Mesh;
    if (!m.isMesh || !m.visible || !m.geometry) return;
    /* ⚠️⚠️ O TESTE É NO ANCESTRAL, E NÃO NO NOME DA MALHA — e este foi o bug
       que fez "um monte de componentes voando". As malhas DENTRO do kit da
       roda carregam o nome do ASSET (`wheel_f_0_0_f_disc_p0001`); só o NÓ se
       chama `VM_WHEEL_SPARE`. Testando `m.name`, o kit inteiro escapava do
       filtro: a roda andava por MATRIZ e pedaços dela andavam DE NOVO por
       vértice aqui — deslocamento duplo, peça partida na tela. */
    if (nossa(m)) return;
    if (raizes.has(m) || (m.parent && raizes.has(m.parent))) return;   // já andou por nó
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const idx = m.geometry.getIndex();
    if (!pos || !idx || pos.count > 260000) return;
    /* Peneira barata antes da cara: a caixa da malha inteira tem de encostar
       na laje. Sem ela, soldar o caminhão todo custaria o dobro do orçamento
       desta função para descartar 99 % logo depois. */
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    if (!bb) return;
    L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
    cxMalha.makeEmpty();
    for (let k = 0; k < 8; k++) {
      cxMalha.expandByPoint(v.set(
        k & 1 ? bb.max.x : bb.min.x,
        k & 2 ? bb.max.y : bb.min.y,
        k & 4 ? bb.max.z : bb.min.z).applyMatrix4(L2N));
    }
    if (!cxMalha.intersectsBox(laje)) return;

    const px = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
    }
    const pai = componentesSoldados(px, idx, pos.count);
    const caixas = new Map<number, Peca>();
    for (let q = 0; q < idx.count; q += 3) {
      const r = pai[idx.getX(q)];
      let p = caixas.get(r);
      if (!p) { p = { malha: m, raiz: r, caixa: new THREE.Box3(), faces: 0 }; caixas.set(r, p); }
      p.faces++;
      for (let k = 0; k < 3; k++) {
        const i = idx.getX(q + k);
        p.caixa.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]));
      }
    }
    for (const p of caixas.values()) {
      if (!laje.containsBox(p.caixa)) continue;
      if (recusa && recusa(p.caixa)) continue;
      pecas.push(p);
    }
  });
  return pecas;
}

/**
 * A corrente de contato a partir de uma âncora, dentro de uma lista fechada.
 *
 * Propagar aqui é seguro porque tudo o que sai da laje já ficou de fora — não
 * há caminho para o chassi. Devolve `null` quando passa do teto: **fecha por
 * falta**, porque meio conjunto na tela é pior que um conjunto parado.
 */
function correnteDe(
  pecas: Peca[], semente: THREE.Box3, teto: number,
  propaga: ((p: Peca) => boolean) | null = null,
): Set<Peca> | null {
  const dentro = new Set<Peca>();
  const folga = (p: Peca) => (Math.max(Math.abs(p.caixa.min.x), Math.abs(p.caixa.max.x)) <= MIOLO_X
    ? CONTATO_MIOLO : CONTATO);
  /* ⚠️ O TETO CONTA ELO, NÃO FOLHA — e contar folha reprovou um conjunto são.
     Medido no VM: 52 elos e 422 folhas, e o teto de 240 sobre o TOTAL fez a
     função fechar por falta com a suspensão inteira parada. Quem pode fugir é o
     elo (é ele que estende a corrente); a folha é limitada pela superfície dos
     elos que já entraram, e portanto não é sinal de vazamento. */
  let elos = 0;
  let fronteira: THREE.Box3[] = [semente];
  while (fronteira.length && elos <= teto) {
    const nova: THREE.Box3[] = [];
    for (const p of pecas) {
      if (dentro.has(p)) continue;
      const inflada = p.caixa.clone().expandByScalar(folga(p));
      if (!fronteira.some((f) => f.intersectsBox(inflada))) continue;
      dentro.add(p);
      /* ▶ SÓ O ELO ESTENDE. A folha entra e para — ver `TANDEM_MIN`. */
      if (!propaga || propaga(p)) { nova.push(p.caixa); elos++; }
    }
    fronteira = nova;
  }
  return elos > teto ? null : dentro;
}

export function shiftRearBogie(
  cab: THREE.Object3D, mount: RigidMount,
): { linhas: string[]; dzNorm: number } {
  const ajuste = BOGIE_POR_CAMINHAO.find((b) => b.id.test(mount.id)) ?? null;
  const dzNorm = ajuste?.dz ?? (BOGIE_SHIFT[mount.axles.config] ?? 0);
  if (!dzNorm) {
    return { linhas: [`conjunto traseiro: ${mount.axles.config} não anda (por decisão)`],
      dzNorm: 0 };
  }
  cab.updateWorldMatrix(true, true);
  const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const L2N = new THREE.Matrix4();
  const v = new THREE.Vector3();
  /* O sinal que leva um deslocamento de Zn para o z LOCAL da cabine. Com
     `orientYaw` = π (os três rígidos deste acervo) ele é −1; a conta não
     assume, mede. */
  const N2L = N.clone().invert();
  const p0 = new THREE.Vector3(0, 0, 0).applyMatrix4(N2L);
  const p1 = new THREE.Vector3(0, 0, 1).applyMatrix4(N2L);
  const sinal = Math.sign(p1.z - p0.z) || 1;
  const dzLocal = dzNorm * sinal;

  const eixos = [...mount.axles.driveZ, ...mount.axles.liftZ];
  if (!eixos.length) return { linhas: ['conjunto traseiro: sem eixo traseiro no manifesto'], dzNorm: 0 };
  const zA = Math.min(...eixos) - JANELA, zB = Math.max(...eixos) + JANELA;

  /* 1 · A CAIXA DO ESTEPE, medida na roda que o motor pendurou. Ela serve a
        duas coisas: à janela que faz o estepe andar com o tandem (ele vive fora
        da janela dos eixos) e à LAJE do conjunto, mais abaixo.

        ⚠️ Medida AGORA, antes de qualquer translação — o passo 4 move a roda. */
  const estepe = caixaDoEstepe(cab, N, cabInv, mount);
  const cxE = estepe ? estepe.caixa : new THREE.Box3();
  const temEstepe = !!estepe;
  const zE = temEstepe ? [cxE.min.z - ESTEPE_FOLGA, cxE.max.z + ESTEPE_FOLGA] : null;

  /* 2 · QUEM ANDA POR NÓ — por PUREZA, e a conta é por vértice. */
  const anda: THREE.Object3D[] = [];
  const relato: string[] = [];
  const raizes = new Set<THREE.Object3D>();
  cab.traverse((node) => {
    const m = node as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
    const passo = pos.count > 60000 ? 4 : 1;
    let dentro = 0, total = 0;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      total++;
      if ((v.z >= zA && v.z <= zB) || (zE && v.z >= zE[0] && v.z <= zE[1])) dentro++;
    }
    if (dentro < MIN_VERT || dentro / total < PUREZA) return;
    /* ⚠️⚠️ ANDA A PEÇA, E NUNCA A CENA. A primeira versão subia "até o último
       ancestral abaixo da cabine" para não desmontar a roda que
       `swapTruckWheels()` pendura (um clone com filhos) — e o rip do Scania
       pendura TUDO sob um nó `Scene`, então o que subiu foi o CAMINHÃO INTEIRO:
       o corpo andou 400 mm e a rodagem ficou, que é a foto sem rodas traseiras.

       A régua certa é nominal e curta: sobe-se só enquanto o ancestral for um
       KIT NOSSO (`VM_WHEEL_*`, `TS_*`), que é justamente o caso do clone da
       roda; qualquer outra coisa move o próprio nó da malha. */
    let raiz: THREE.Object3D = m;
    for (let p: THREE.Object3D | null = m.parent; p && p !== cab; p = p.parent) {
      if (/^(VM_WHEEL|TS_)/.test(p.name || '')) raiz = p;
    }
    raizes.add(raiz);
  });
  for (const r of raizes) {
    anda.push(r);
    relato.push(r.name || '(sem nome)');
  }
  if (!anda.length) {
    return { linhas: ['conjunto traseiro: nenhum nó passou na pureza — nada andou'], dzNorm: 0 };
  }

  /* 3 · OS CONJUNTOS QUE ANDAM POR VÉRTICE — o do estepe e o do TANDEM.
        ------------------------------------------------------------------------
        ⚠️ MEDIDOS ANTES DO PASSO 4, com tudo ainda na cota antiga: é a única
        forma de a caixa da âncora e a caixa das peças falarem do mesmo
        instante. */
  const conjunto: Peca[] = [];
  const relatoConj: string[] = [];
  let vazou = 0;

  /* ▶ A ÂNCORA DO TANDEM: a caixa do que já vai andar por nó, dentro da janela
     dos eixos. São as rodas — e é delas que a corrente parte. */
  const ancoraTandem = new THREE.Box3();
  /* …e, no mesmo passe, quem dos nós é do ESTEPE — são eles que SOBEM. */
  const noDoEstepe = new Set<THREE.Object3D>();
  const dyEstepe = ajuste?.dyEstepe ?? 0;
  for (const r of anda) {
    const b = new THREE.Box3();
    r.traverse((n) => {
      const m = n as THREE.Mesh;
      const pos = m.isMesh ? m.geometry?.getAttribute('position') as THREE.BufferAttribute : null;
      if (!pos) return;
      L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
      for (let i = 0; i < pos.count; i += 5) {
        b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N));
      }
    });
    if (b.isEmpty()) continue;
    const cz = (b.min.z + b.max.z) / 2;
    if (cz < zA || cz > zB) { noDoEstepe.add(r); continue; }   // é do estepe, não do tandem
    ancoraTandem.union(b);
  }

  /* ▶ A LAJE DO TANDEM. Em z é a própria janela dos eixos; em y vai do chão ao
     topo da mesa. A longarina tem 11,6 m e nunca cabe; o cardã idem. */
  const lajeTandem = new THREE.Box3(
    new THREE.Vector3(-TANDEM_X, 0, zA),
    new THREE.Vector3(TANDEM_X, mount.frameTopY + 0.15, zB));
  /* ▶ …e a TRAVESSA fica. Ela cruza a linha de centro E mora na altura da mesa;
     a suspensão, que também cruza (o cubo do eixo tem 1 324 mm), mora ABAIXO
     dela. Medido no VM: travessas de `chassis_p3` 816 × 182 × 152 em y 868…1123
     contra o cubo de `chassis_p0` 1 324 × 445 × 154 em y 338…784. */
  const pisoMesa = mount.frameTopY - TANDEM_MESA;
  /* ⚠️ E UMA TRAVESSA É LARGA. Sem este terceiro termo, o cap da cruzeta do
     cardã (`chassis_p0` 44 × 10 × 44 em |x| 22, y 615) passa nos dois primeiros
     — cruza a linha de centro e está acima do piso da mesa — e era recusado
     como se fosse estrutura. Ficava sozinho no ar, e foi o último flutuante que
     o detector acusou. Travessa deste acervo tem 621 e 816 mm; 300 separa. */
  const ehTravessa = (b: THREE.Box3) => b.min.x * b.max.x <= 0 && b.min.y >= pisoMesa
    && b.max.x - b.min.x >= TRAVESSA_LARGA;

  /* ⚠️ E A PASSADA DO TANDEM SÓ RODA ONDE FAZ FALTA. No Scania a suspensão
     traseira tem nós próprios e o passo 2 já a levou inteira; ligar isto lá
     seria procurar por vértice o que já andou por nó — e a única coisa que a
     busca acharia de novo é a rebitagem. É por rip, não por configuração. */
  if (ajuste?.suspensao && !ancoraTandem.isEmpty()) {
    const pecas = pecasNaLaje(cab, N, cabInv, lajeTandem, raizes, ehTravessa);
    const grupo = correnteDe(pecas, ancoraTandem.clone().expandByScalar(CONTATO), TETO_TANDEM,
      (p) => Math.max(...p.caixa.getSize(new THREE.Vector3()).toArray()) >= TANDEM_MIN);
    if (!grupo) {
      vazou = pecas.length;
      relatoConj.push(`tandem: NADA por vértice — a corrente passou do teto de ${TETO_TANDEM}`);
    } else {
      conjunto.push(...grupo);
      relatoConj.push(`tandem: ${grupo.size} peça(s) soldada(s) de ${pecas.length} na laje`);
    }
  }

  if (temEstepe) {
    const laje = new THREE.Box3(
      new THREE.Vector3(cxE.min.x - LAJE.x, cxE.min.y - LAJE.yBaixo, cxE.min.z - LAJE.z),
      new THREE.Vector3(cxE.max.x + LAJE.x, cxE.max.y + LAJE.yAlto, cxE.max.z + LAJE.z));
    const pecas = pecasNaLaje(cab, N, cabInv, laje, raizes, null);
    /* ▶ MESMA DOUTRINA DA FOLHA do tandem: peça grande é elo, peça pequena é
       folha. Sem isso, afundar a laje em z (de 100 para 250 mm, para alcançar a
       travessa em que o berço se aparafusa) abriria caminho para a rebitagem
       encadear. */
    const grupo = correnteDe(pecas, cxE.clone().expandByScalar(CONTATO), TETO_PECAS,
      (p) => Math.max(...p.caixa.getSize(new THREE.Vector3()).toArray()) >= TANDEM_MIN);
    if (!grupo) {
      vazou = pecas.length;
      relatoConj.push(`estepe: NADA por vértice — a corrente passou do teto de ${TETO_PECAS}`);
    } else {
      /* ▶▶ A PONTE — a TRAVESSA em que o berço se aparafusa.
         ------------------------------------------------------------------------
         *"o estepe continua flutuando"* — Kennedy, 2026-08-25.

         ⚠️ A LAJE DO ESTEPE ABRAÇA UM FLANCO SÓ, e é isso que deixava o
         conjunto no ar. Medido no VM depois do recuo: o vizinho mais próximo do
         conjunto é `chassis_p3` a **54 mm** — e `chassis_p3` é a LONGARINA, que
         tem 11,6 m e por construção nunca cabe numa laje de conjunto. Quem
         segurava o berço não era ela: era a travessa, que atravessa o caminhão
         de flanco a flanco e portanto também não cabe numa laje que vai de
         x −68 a x 1 185.

         Uma travessa que anda com o estepe continua apoiada, porque ela desliza
         SOBRE as longarinas — é literalmente o que se faz para remontar um
         suporte de estepe noutra cota. Então a ponte é uma segunda passada, com
         a laje aberta na largura toda, e ela leva só o que ATRAVESSA a linha de
         centro e encosta no grupo.

         ⚠️ E ELA SÓ DISPARA ONDE FAZ FALTA: no Scania o conjunto já fecha a
         2 mm da ferragem do próprio berço, então não há vão para pontear e a
         passada não acha nada a acrescentar que já não esteja lá. */
      for (const p of grupo) {
        if (conjunto.some((q) => q.malha === p.malha && q.raiz === p.raiz)) continue;
        p.dy = dyEstepe;
        conjunto.push(p);
      }
      const envG = cxE.clone();
      for (const p of grupo) envG.union(p.caixa);
      const larga = new THREE.Box3(
        new THREE.Vector3(-TANDEM_X, laje.min.y, laje.min.z),
        new THREE.Vector3(TANDEM_X, laje.max.y, laje.max.z));
      const sonda = envG.clone().expandByScalar(CONTATO);
      let pontes = 0;
      for (const p of pecasNaLaje(cab, N, cabInv, larga, raizes, null)) {
        if (p.caixa.min.x * p.caixa.max.x > 0) continue;                 // não atravessa: não é travessa
        if (Math.max(...p.caixa.getSize(new THREE.Vector3()).toArray()) < TANDEM_MIN) continue;
        if (!sonda.intersectsBox(p.caixa)) continue;
        if (conjunto.some((q) => q.malha === p.malha && q.raiz === p.raiz)) continue;
        conjunto.push(p); pontes++;
      }
      relatoConj.push(`estepe: ${grupo.size} peça(s) soldada(s) de ${pecas.length} na laje`
        + (pontes ? ` + ${pontes} travessa(s) de ponte` : ''));
    }
  }
  /* 4 · A TRANSLAÇÃO DOS NÓS, no espaço do PAI (que é a cabine, para todos). */
  const t = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Vector3();
  for (const o of anda) {
    /* ⚠️⚠️ NADA DE `updateMatrix()` AQUI. Estes nós vêm de `freezeMatrices()`
       com `matrixAutoUpdate = false` e a pose ASSADA na `matrix`; chamar
       `updateMatrix()` a RECOMPÕE a partir de `position`/`quaternion`/`scale`,
       que ali são identidade — a peça vai para a origem. Foi o que apagou a
       rodagem traseira inteira do bitruck na primeira tentativa: as rodas não
       "sumiram", foram todas para o centro do caminhão.

       A matriz corrente já é a verdade; decompõe-se ELA, soma-se o z e
       recompõe. `position` acompanha para o nó que ainda esteja com
       `matrixAutoUpdate` ligado. */
    o.matrix.decompose(t, q, e);
    t.z += dzLocal;
    /* ▶ …E O CONJUNTO DO ESTEPE SOBE `dyEstepe`. O eixo y não é tocado pelo
       giro de `orientYaw` (é giro EM TORNO de y), então +y normalizado é +y
       local — a conta não precisa do sinal que o z precisa. */
    if (noDoEstepe.has(o)) t.y += dyEstepe;
    o.matrix.compose(t, q, e);
    o.position.copy(t);
    o.quaternion.copy(q);
    o.scale.copy(e);
    o.updateMatrixWorld(true);
  }

  /* 5 · …E A DO CONJUNTO DO ESTEPE, por vértice — peça inteira, sempre. */
  let vertices = 0;
  const quem: string[] = [];
  /* ⚠️ AGRUPADO POR MALHA **E POR dy**: o conjunto do estepe sobe e o do tandem
     não, e uma mesma malha de chassi tem peça dos dois. Agrupar só por malha
     daria a todas o passo da primeira. */
  const porMalha = new Map<string, { malha: THREE.Mesh; dy: number; lista: Peca[] }>();
  for (const p of conjunto) {
    const dy = p.dy ?? 0;
    const k = `${p.malha.uuid}#${dy}`;
    const l = porMalha.get(k);
    if (l) l.lista.push(p); else porMalha.set(k, { malha: p.malha, dy, lista: [p] });
  }
  const passoLocal = new THREE.Vector3();
  for (const { malha, dy, lista } of porMalha.values()) {
    /* ⚠️ O PASSO É CONVERTIDO PARA O ESPAÇO DA MALHA, e não copiado do da
       cabine. `dzLocal` é um deslocamento em z DA CABINE; uma malha com
       rotação ou escala própria (e o rip tem 123 nós com matriz) andaria numa
       diagonal, ou de mais, se recebesse esse número cru. Aqui a conta mede a
       diferença entre dois pontos, e por isso não assume nada sobre o nó. */
    const m2c = new THREE.Matrix4().copy(cabInv).multiply(malha.matrixWorld);
    const c2m = m2c.clone().invert();
    const a = new THREE.Vector3(0, 0, 0).applyMatrix4(c2m);
    const b = new THREE.Vector3(0, dy, dzLocal).applyMatrix4(c2m);
    passoLocal.copy(b).sub(a);

    const geo = claimGeometry(malha);
    const gpos = geo.getAttribute('position') as THREE.BufferAttribute;
    const gidx = geo.getIndex();
    if (!gidx) continue;
    /* A raiz de cada vértice é recontada na geometria RECLAMADA — `claimGeometry`
       pode ter devolvido um clone, e um clone tem a mesma ordem de vértice mas
       não é o mesmo objeto. Recontar custa uma passada e elimina a classe de bug
       "índice de uma geometria aplicado em outra". */
    const px = new Float32Array(gpos.count * 3);
    const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(malha.matrixWorld);
    for (let i = 0; i < gpos.count; i++) {
      v.set(gpos.getX(i), gpos.getY(i), gpos.getZ(i)).applyMatrix4(M);
      px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
    }
    const pai = componentesSoldados(px, gidx, gpos.count);
    const alvos = new Set(lista.map((p) => p.raiz));
    let n = 0;
    for (let i = 0; i < gpos.count; i++) {
      if (!alvos.has(pai[i])) continue;
      gpos.setXYZ(i, gpos.getX(i) + passoLocal.x, gpos.getY(i) + passoLocal.y,
        gpos.getZ(i) + passoLocal.z);
      n++;
    }
    if (!n) continue;
    gpos.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    vertices += n;
    /* ⚠️ O RELATO LISTA A PEÇA, e não só a contagem: quando a régua escapa, é
       o TAMANHO do componente que denuncia — foi assim que se viu o kit da
       roda entrando duas vezes. */
    const amostra = lista.slice(0, 8).map((p) => {
      const d = p.caixa.getSize(new THREE.Vector3());
      return `${(d.x * 1000).toFixed(0)}×${(d.y * 1000).toFixed(0)}×${(d.z * 1000).toFixed(0)}`;
    });
    quem.push(`${malha.name}: ${lista.length} [${amostra.join(' ')}]`);
  }

  /* 6 · O CARDÃ ESTICA — ver `CARDA_X`. Ele não anda: uma ponta fica no câmbio
        e a outra segue o diferencial, e o tubo entre as duas cresce. */
  let cardaRel = '';
  if (ajuste?.carda && !ancoraTandem.isEmpty()) {
    const frente = ancoraTandem.max.z;
    const corredor = new THREE.Box3(
      new THREE.Vector3(-CARDA_X, 0.15, frente - CARDA_ALCANCE),
      new THREE.Vector3(CARDA_X, mount.frameTopY, frente + 4));
    const alvos: { malha: THREE.Mesh; raiz: number; caixa: THREE.Box3 }[] = [];
    const cxM = new THREE.Box3();
    cab.traverse((node) => {
      const m = node as THREE.Mesh;
      if (!m.isMesh || !m.visible || !m.geometry || nossa(m)) return;
      if (raizes.has(m) || (m.parent && raizes.has(m.parent))) return;
      const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      const idx = m.geometry.getIndex();
      if (!pos || !idx || pos.count > 260000) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      if (!bb) return;
      L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
      cxM.makeEmpty();
      for (let k = 0; k < 8; k++) {
        cxM.expandByPoint(v.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y,
          k & 4 ? bb.max.z : bb.min.z).applyMatrix4(L2N));
      }
      if (!cxM.intersectsBox(corredor)) return;
      const px = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
        px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
      }
      const pai = componentesSoldados(px, idx, pos.count);
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
      for (const [r, b] of caixas) {
        const d = b.getSize(new THREE.Vector3());
        if (d.z < CARDA_LONGO) continue;                          // curto: não é eixo
        if (Math.max(d.x, d.y) > CARDA_FINO) continue;            // gordo: não é eixo
        if (Math.max(Math.abs(b.min.x), Math.abs(b.max.x)) > CARDA_X) continue;
        /* ▶ E TEM DE ATRAVESSAR A FRONTEIRA: ponta de trás no conjunto que
           andou, ponta da frente fora dele. Quem está inteiro de um lado ou do
           outro não estica — ou anda, ou fica. */
        if (b.min.z > frente + CARDA_ALCANCE || b.max.z <= frente) continue;
        alvos.push({ malha: m, raiz: r, caixa: b.clone() });
      }
    });
    const quemC: string[] = [];
    for (const alvo of alvos) {
      const geo = claimGeometry(alvo.malha);
      const gpos = geo.getAttribute('position') as THREE.BufferAttribute;
      const gidx = geo.getIndex();
      if (!gidx) continue;
      const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(alvo.malha.matrixWorld);
      const Minv = M.clone().invert();
      const px = new Float32Array(gpos.count * 3);
      for (let i = 0; i < gpos.count; i++) {
        v.set(gpos.getX(i), gpos.getY(i), gpos.getZ(i)).applyMatrix4(M);
        px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
      }
      const pai = componentesSoldados(px, gidx, gpos.count);
      /* A raiz é reencontrada pela CAIXA, e não pelo número: `claimGeometry()`
         pode ter clonado a malha entre a varredura e agora. */
      let raiz = -1;
      const cx2 = new THREE.Box3();
      const vistos = new Set<number>();
      for (let i = 0; i < gpos.count; i++) {
        const r = pai[i];
        if (vistos.has(r)) continue;
        vistos.add(r);
        cx2.makeEmpty();
        for (let j = 0; j < gpos.count; j++) {
          if (pai[j] !== r) continue;
          cx2.expandByPoint(v.set(px[j * 3], px[j * 3 + 1], px[j * 3 + 2]));
        }
        if (cx2.min.distanceTo(alvo.caixa.min) < 1e-3 && cx2.max.distanceTo(alvo.caixa.max) < 1e-3) {
          raiz = r; break;
        }
      }
      if (raiz < 0) continue;
      const zF = alvo.caixa.max.z, L = alvo.caixa.max.z - alvo.caixa.min.z;
      let n = 0;
      for (let i = 0; i < gpos.count; i++) {
        if (pai[i] !== raiz) continue;
        v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
        const f = Math.min(1, Math.max(0, (zF - v.z) / L));
        v.z += dzNorm * f;
        v.applyMatrix4(Minv);
        gpos.setXYZ(i, v.x, v.y, v.z);
        n++;
      }
      if (!n) continue;
      gpos.needsUpdate = true;
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      const d = alvo.caixa.getSize(new THREE.Vector3());
      quemC.push(`${alvo.malha.name} ${(d.x * 1000).toFixed(0)}×${(d.y * 1000).toFixed(0)}×${(d.z * 1000).toFixed(0)}`
        + ` (${(L * 1000).toFixed(0)} → ${((L + Math.abs(dzNorm)) * 1000).toFixed(0)} mm)`);
    }
    cardaRel = quemC.length
      ? `cardã esticado: ${quemC.join(' · ')}`
      : 'cardã: nenhuma peça longa atravessa a fronteira do conjunto';
  }

  return {
    linhas: [`conjunto traseiro ${mount.axles.config}: ${(dzNorm * 1000).toFixed(0)} mm`
      + ` (${dzNorm > 0 ? 'para a FRENTE' : 'para TRÁS'}) · ${anda.length} nó(s) · `
      + `janela Zn ${(zA * 1000).toFixed(0)}…${(zB * 1000).toFixed(0)}`
      + (temEstepe ? ` + estepe ${(cxE.min.z * 1000).toFixed(0)}…${(cxE.max.z * 1000).toFixed(0)}`
        + ` [${estepe!.quem}]` : ' · SEM estepe')
      + ` · pureza ${(PUREZA * 100).toFixed(0)} %`,
    `andaram: ${relato.slice(0, 14).join(' · ')}${relato.length > 14 ? ` (+${relato.length - 14})` : ''}`,
    `por vértice: ${conjunto.length} peça(s) soldada(s) · ${vertices} vértices`
      + (relatoConj.length ? ` · ${relatoConj.join(' · ')}` : '')
      + (vazou ? ` ⚠ vazou (${vazou})` : ''),
    quem.length ? `peças: ${quem.join(' · ')}` : 'peças: nenhuma',
    ...(cardaRel ? [cardaRel] : [])],
    dzNorm,
  };
}
