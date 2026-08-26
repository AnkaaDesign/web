/* AS CONFIGURAÇÕES DE EIXO DO VOLVO VM E DO VW — toco, truck e bitruck.
   ===========================================================================
       node tools/chassis-bake/cut-chassi.cjs --ensaio         # só imprime
       node tools/chassis-bake/cut-chassi.cjs --ensaio --so vm-4x2
       node tools/chassis-bake/cut-chassi.cjs                  # escreve os GLBs

   Irmão de `cut-scania.cjs`, e a razão de ser um arquivo NOVO em vez de uma
   generalização daquele está na primeira linha do que ele assume: **os seis nós
   que o Scania corta estão na identidade.** Medido aqui, isso é a exceção —
   189 dos 228 nós do Scania, 123 dos 139 do VM e 39 dos 55 do VW carregam
   `translation`/`rotation`/`scale`. Este arquivo compõe a matriz de mundo
   subindo a árvore de nós e mede em MUNDO; o corte continua sendo por face, em
   espaço local, que é onde a geometria vive.

   ===========================================================================
   ⚠️ POR QUE O TOCO DO VM NÃO É O TOCO DO SCANIA

   O Scania tem suspensão A AR no tandem: quatro bolsas por eixo, e cada eixo é
   um conjunto independente. Tirar o auxiliar é tirar o conjunto dele e pronto —
   é o que `CORTE_AUX` faz lá.

   O VM tem **feixe de molas com balancim**: os dois eixos dividem UM molejo que
   pivota num suporte central. Tirar metade de um bogie deixa mola no ar. Medido
   na foto do flanco (`tools/studio-bench/shots/`), o conjunto é
   mão-de-mola → feixe → suporte central → feixe → mão-de-mola.

   A regra aqui, então, é outra: tira-se o eixo auxiliar, o feixe DELE e a
   mão-de-mola DELE, e o SUPORTE CENTRAL FICA — com o eixo trativo pendurado no
   feixe da frente, ele passa a ler como a mão-de-mola traseira de um eixo
   simples, que é o que um toco tem. Isso é uma decisão de OLHO, e por isso o
   `--ensaio` e o render de conferência são parte do procedimento, não enfeite.

   ===========================================================================
   O ESPAÇO é o NORMALIZADO de `mounts.json` (`forward = +Z`, pneu em `y = 0`):

       Xn = −Xg · Yn = Yg − groundY · Zn = −Zg
*/
const fs = require('fs');
const path = require('path');
const S = require('./glb-surgery.cjs');

const WEB = path.resolve(__dirname, '..', '..');
const TRUCKS = path.join(WEB, 'public', 'models', 'trucks');

const mm = (v) => (v * 1000).toFixed(0);

/* ---------- matrizes de nó, compostas pela árvore ---------- */
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
        + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}
function trs(n) {
  if (n.matrix) return n.matrix.slice();
  const t = n.translation || [0, 0, 0];
  const q = n.rotation || [0, 0, 0, 1];
  const s = n.scale || [1, 1, 1];
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
function matrizesDeMundo(g) {
  const M = new Array(g.nodes.length).fill(null);
  const visita = (i, pai) => {
    const m = mul(pai, trs(g.nodes[i]));
    M[i] = m;
    for (const c of (g.nodes[i].children || [])) visita(c, m);
  };
  const cena = (g.scenes && g.scenes[g.scene || 0]) || { nodes: [] };
  for (const r of (cena.nodes || [])) visita(r, I4());
  for (let i = 0; i < M.length; i++) if (!M[i]) M[i] = trs(g.nodes[i]);
  return M;
}
/** Inversa geral de uma 4x4 coluna-maior. */
function inv4(m) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) throw new Error('matriz de nó singular');
  det = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det,
    (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det,
    (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det,
    (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det,
    (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ];
}
/** Uma DIREÇÃO (w = 0) levada por uma matriz — sem a translação. */
function direcao(m, d) {
  return [
    m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
    m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
    m[2] * d[0] + m[6] * d[1] + m[10] * d[2],
  ];
}
/** O pai de cada nó (−1 = raiz da cena). */
function paisDe(g) {
  const pai = new Array(g.nodes.length).fill(-1);
  g.nodes.forEach((n, i) => { for (const c of (n.children || [])) pai[c] = i; });
  return pai;
}

function emMundo(pos, m) {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    out[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  return out;
}

function fazCaixaNorm(groundY) {
  return (cru) => {
    const b = {
      x0: -cru.x1, x1: -cru.x0,
      y0: cru.y0 - groundY, y1: cru.y1 - groundY,
      z0: -cru.z1, z1: -cru.z0,
    };
    b.dx = b.x1 - b.x0; b.dy = b.y1 - b.y0; b.dz = b.z1 - b.z0;
    b.xc = (b.x0 + b.x1) / 2; b.yc = (b.y0 + b.y1) / 2; b.zc = (b.z0 + b.z1) / 2;
    return b;
  };
}

/* ══════════════════════ VOLVO VM 2015 ══════════════════════ */

const VM = {
  fonte: 'volvo_vm_2015_6x2r.glb',
  groundY: -0.0042,
  eixo: { dir: 1.8475, trativo: -3.4933, auxiliar: -4.7892 },
};

/**
 * O EIXO AUXILIAR DO VM — e o que dele fica.
 *
 * MEDIDO com `probe-eixo.cjs` na faixa de ±0,70 m em torno de Zn −4,7892:
 * 283 componentes cabem inteiros nela e 13 a cruzam. Mas "caber na faixa" não
 * basta: a faixa apanha travessa de quadro e reforço de longarina, que são do
 * CHASSI e ficam em qualquer configuração.
 *
 * O que separa um do outro é a ALTURA. Medido no VM: a mesa da longarina está
 * em y 1,189 e a alma dela desce até ~0,87. Tudo que é do EIXO mora abaixo
 * disso — feixe, mão-de-mola, amortecedor, cubo. Tudo que é do QUADRO mora na
 * faixa da alma ou acima: a travessa de 816 mm em y 0,907…1,089, os rebites
 * dela, os reforços de 1 292 mm que correm sobre o eixo.
 *
 * ⚠️ E O SUPORTE CENTRAL DO BALANCIM FICA — ver o bloco do cabeçalho.
 */
const VM_TETO_EIXO = 0.87;
/**
 * ⚠️ A FAIXA DO EIXO AUXILIAR NÃO É SIMÉTRICA, e a primeira versão errou nisso.
 *
 * Num bogie as três peças de apoio estão em z −4 197 (suporte central),
 * −4 789 (o eixo) e −5 457 (mão-de-mola traseira). Uma banda simétrica de
 * ±620 mm em torno do eixo pega a de −4 197 e NÃO pega a de −5 457 — ou seja
 * faz exatamente o contrário do que se quer: tira o apoio que o eixo trativo
 * vai herdar e deixa pendurada a mão-de-mola do eixo que saiu.
 *
 * Os limites abaixo saem das três medidas: começa depois do suporte central e
 * acaba depois da mão-de-mola traseira.
 */
const VM_AUX_Z = [-5.60, -4.45];

const VM_CORTE_AUX = {
  nome: 'eixo auxiliar do VM',
  nos: [/^wheel_r_2_1_/, /^wheel_r_3_1_/],
  comps: {
    chassis_p0: vmDoEixo,
    chassis_p1: vmDoEixo,
    chassis_p3: vmDoEixo,
  },
};

/**
 * ⚠️ ALTURA NÃO BASTA — a mão-de-mola tem metade ACIMA da linha do eixo.
 *
 * A 2ª versão desta regra tirava só o que estivesse abaixo de y 0,87, e no
 * render sobrou exatamente o que se esperaria: a chapa de fixação e o PINO da
 * mão-de-mola traseira, no nível da alma da longarina, com nada pendurado
 * neles. Medido no que sobrou: `320 tri` em y 948…1008, `168 tri` em
 * y 936…1131 e `140 tri` em y 1064…1108, todos a |x| 0,44…0,53.
 *
 * O que separa a ferragem do EIXO da ferragem do QUADRO nessa janela não é a
 * altura, é o **|x|**: travessa de quadro é larga e CENTRADA (|x| ≤ 10 mm no
 * VM), enquanto mão-de-mola, chapa e rebite moram na FACE da longarina, a
 * |x| 0,44…0,53. Então: na janela do eixo cai fora tudo que esteja abaixo da
 * alma OU fora do miolo.
 */
const VM_MIOLO = 0.35;

function vmDoEixo(b) {
  if (b.zc < VM_AUX_Z[0] || b.zc > VM_AUX_Z[1]) return false;
  return b.y0 < VM_TETO_EIXO || Math.abs(b.xc) > VM_MIOLO;
}

/**
 * ▶▶ O BITRUCK DO VM — a cota que faltava, e por que ela muda tudo.
 *
 * ⚠️ A DISTÂNCIA ENTRE OS DOIS EIXOS DIRECIONAIS É **2 220 mm**, e é cota de
 * fábrica: `Ficha-Técnica-VM-8x2R.pdf`, linha `D Distância entre os eixos
 * direcionais`, igual nos quatro entre-eixos oferecidos (4 800 · 5 150 · 5 900
 * · 6 700) e igual na ficha do 8x4R. O VM 8x4 e o VW usam a mesma faixa
 * (2 220 e 2 348 mm), e o Scania P do próprio acervo mede **2 215 mm** — é por
 * isso que ele é o único dos três que o dono olhou e achou certo.
 *
 * A 1ª versão deste arquivo pôs o eixo em Zn 0,755, ou seja a **1 092 mm** do
 * direcional. Não é uma imprecisão: é METADE da cota, e o que se vê na foto são
 * dois pneus quase encostados logo atrás do para-choque. O número não saiu de
 * ficha nenhuma — saiu do VÃO QUE SOBRAVA depois de recuar a fila de
 * equipamento, e é a lição desta rodada: **vão disponível não é cota de
 * projeto**. Quem manda é a ficha; o equipamento que se ajeite.
 *
 * E ele se ajeita — melhor do que antes, aliás. Com o eixo no lugar certo abre
 * um vão de **1 164 mm entre os dois pneus dianteiros** (2 220 − 1 056 de pneu),
 * e é exatamente ali que o caminhão real leva o silencioso de um lado e a caixa
 * de bateria do outro. Medido no rip, os dois JÁ ESTÃO nesse vão:
 *
 *     pneu do 1º direcional   2 375…1 320      (Ø 1 056 mm)
 *     DPF/silencioso (dir.)   1 012…467        chs_base_0_p3 · _p6   ← não anda
 *     caixa de bateria (esq.) 1 043…147        chs_base_0_p13 · _p12 ← não anda
 *     pneu do 2º direcional     155…−900       (o enxerto, em Zn −372,5)
 *
 * ⚠️ ISTO INVERTE A REGRA ANTERIOR: a fila NÃO recua mais em bloco. O DPF
 * recuava 822 mm e a caixa de bateria não recuava nada — e com o eixo velho a
 * caixa ficava DENTRO do pneu novo (147 contra 225). Agora o que anda é só o
 * que o pneu novo desalojou de verdade:
 *
 *     tanques   188…−1 230  →  −1 162…−2 580   (+1 350 mm)
 *     estepe  −1 623…−2 559 →  −5 400…−6 336   (+3 777 mm, para o balanço)
 *
 * ⚠️ E O ESTEPE MUDA DE CASA, não de lugar. Atrás do 2º direcional sobram
 * 2 065 mm (de −900 ao pneu do trativo, em −2 965) e a conta não fecha:
 * tanque 1 418 + estepe 936 = 2 354. Não é folga de montagem que falta, é
 * ENTRE-EIXOS: a Volvo só vende o 8x2 com 5 900 ou 6 700 mm, e este rip é um
 * 6x2 de 5 341. Como o balanço traseiro está VAZIO — medido, nada entre
 * Zn −5 300 e −7 131 além do para-choque —, o estepe vai para lá, que é onde
 * metade dos rígidos brasileiros o carrega. O preço está registrado em
 * `mounts.json`: a baia de −6 003 deixa de existir no 8x2 porque o estepe a
 * cruza, e a capacidade de encurtamento do rabo cai de 949 para 594 mm.
 *
 * ⚠️ E O DOADOR DA RODAGEM É O PRÓPRIO CAMINHÃO. Os seis nós do 1º direcional
 * são clonados com deslocamento — o nó novo aponta para a MESMA malha, então o
 * bitruck não paga um único triângulo a mais de rodagem. Quem põe a roda do VM
 * ali é `swapTruckWheels()`, que acha o eixo novo sozinho: ele mede o ARO, e há
 * um aro novo em Zn −0,3725.
 *
 * ⚠️ O PARA-LAMA DO 2º DIRECIONAL era a pendência conhecida desta família («o
 * arco do dianteiro é parte da casca da cabine e não existe como componente
 * isolável»). ELE EXISTE — a casca é `cabin_p0`, mas ela decompõe, e o arco são
 * três componentes conexos com assinatura própria (|x| > 850, y 803…1 240,
 * 852 mm de vão em z). O para-barro que fecha o arco por baixo é outro
 * componente, em `chs_base_0_p7`. Os dois são clonados como a rodagem. Ver
 * `VM_ARCO` e `VM_BARRO`.
 */
/** Cota de fábrica entre os dois direcionais do VM 8x2R — `D` da ficha. */
const VM_DIRECIONAIS = 2.220;
const VM_EIXO2 = VM.eixo.dir - VM_DIRECIONAIS;   // Zn -0,3725

/**
 * ⚠️ O PARA-LAMA DO 2º DIRECIONAL NÃO É FEITO AQUI — e a 1ª versão desta rodada
 * tentou, clonando o arco do 1º direcional (`cabin_p0`) mais o para-barro
 * (`chs_base_0_p7`) 2 220 mm para trás.
 *
 * O clone FUNCIONA e está ERRADO, pelo motivo que o dono viu na foto antes de
 * qualquer sonda: *"em vez de usar o para-lamas da cabine para a segunda roda,
 * deve usar o da segunda roda do scania mesmo, ficará melhor"*. O arco do VM é
 * pedaço da CASCA DA CABINE — ele nasce colado à porta e à caixa de roda, e
 * solto no meio do quadro atravessa o que estiver lá. Medido por
 * `probe-sobreposicao.cjs` sobre o arquivo que aquela versão escreveu: SEIS
 * sobreposições novas, a maior de 151 × 195 × 95 mm contra a caixa de bateria.
 *
 * A peça certa vem do Scania P, que é bitruck DE FÁBRICA e traz um para-lama de
 * 2º direcional inteiro (`t_paralama_0_p0…p7`). Ela é extraída por
 * `tools/chassis-bake/rip-paralama.cjs` e montada em runtime por
 * `engine/vehicle/front-fender.ts`, que a escala pelo pneu e pela bitola do
 * caminhão que a recebe — é o que faz a MESMA peça servir ao VM e ao VW.
 */

/* ══════════════════════ VW TITAN ══════════════════════ */

const VW = {
  fonte: 'vw_titan_6x2_tl.glb',
  groundY: -0.0036,
  eixo: { dir: 1.6302, trativo: -4.0272, auxiliar: -5.2815 },
};

/**
 * O EIXO AUXILIAR DO VW — mesmo bogie, mesma doutrina, outros números.
 *
 * O VW é o rip mais cru do acervo: **cabine e quadro estão fundidos** em
 * `truck_p4` (186 518 tri) e `truck_p5` (60 488), e a rodagem inteira mora em
 * quatro malhas compartilhadas. Nada disso impede o corte, porque ele é por
 * COMPONENTE CONEXO — `truck_p4` decompõe em 1 021 componentes.
 *
 * MEDIDO no flanco: também é feixe com balancim. As três peças de apoio estão
 * em z −4 612 (suporte central, as quatro chapas de 378×365 que CRUZAM a
 * faixa), −5 282 (o eixo) e ≈−5 850 (mão-de-mola traseira).
 *
 * ⚠️ AS RODAS TÊM DE SAIR DO ARQUIVO, e não basta escondê-las no motor.
 * `swapTruckWheels()` MEDE a rodagem original para saber onde pôr a roda nova:
 * deixar o pneu do eixo auxiliar no arquivo faria o toco nascer com três eixos,
 * agora com rodas do VM. Elas são componentes de malha compartilhada, então
 * saem pela mesma regra de janela — sem filtro de altura nem de |x|, porque uma
 * roda é uma roda.
 */
const VW_TETO_EIXO = 0.95;
const VW_MIOLO = 0.35;
/** Começa depois do suporte central (−4 612) e acaba antes da fileira de
 *  rebites da travessa de −6 050. */
const VW_AUX_Z = [-6.00, -4.85];

const VW_CORTE_AUX = {
  nome: 'eixo auxiliar do VW',
  nos: [],
  comps: {
    truck_p4: vwDoEixo,
    truck_p5: vwDoEixo,
    wheel_f_0_0_f_tire_p0: vwDaRoda,
    wheel_f_0_0_f_disc_p1: vwDaRoda,
    wheel_f_0_0_f_nuts_p0: vwDaRoda,
    wheel_r_0_2_r_disc_p1: vwDaRoda,
    wheel_r_0_2_r_hub_p1: vwDaRoda,
  },
};

function vwDoEixo(b) {
  if (b.zc < VW_AUX_Z[0] || b.zc > VW_AUX_Z[1]) return false;
  return b.y0 < VW_TETO_EIXO || Math.abs(b.xc) > VW_MIOLO;
}
function vwDaRoda(b) {
  return b.zc >= VW_AUX_Z[0] && b.zc <= VW_AUX_Z[1];
}

/**
 * ▶▶ O BITRUCK DO VW — mesma correção de cota do VM, outro número e outra fila.
 *
 * ⚠️ **2 348 mm entre os direcionais** — `VW Constellation 30.320 8x2,
 * Especificações Técnicas`, linha `R Distância entre-eixos: 1º ao 2º`. A ficha
 * fecha por soma (`D = B + (A+E) + C`: 1 514 + 7 324 + 1 855 = 10 693), então
 * as letras estão lidas certas. A 1ª versão punha o eixo a **1 050 mm**, e o
 * defeito é o mesmo do VM pela mesma razão: a cota saiu do vão, não da ficha.
 *
 * O QUE MUDA EM RELAÇÃO AO VM: aqui a fila NÃO é simétrica, e por isso ela não
 * anda em bloco nem anda com um número só. Medido por componente conexo:
 *
 *   ESQUERDA  secador de ar   824…375     truck_p5 (17 231 tri)   ← fica
 *             tanque          190…−1 119  tanque_p0 (nó)          → recua
 *   DIREITA   caixa/disco     941…619     truck_p4                ← fica
 *             reservatórios   459…−193    truck_p4 (dois bancos)  ← fica
 *             reserv. transv.−523…−908    truck_p4                → muda de casa
 *             caixa/bateria−1 459…−2 037  truck_p4                ← fica
 *             estepe       −2 026…−2 987  truck_p4                ← fica
 *
 * Com o eixo em Zn −0,7178 o pneu ocupa −211…−1 224, e a conta do vão fica:
 *
 *     vão dianteiro (entre os dois pneus)   1 124 … −211   = 1 335 mm
 *     vão traseiro (até o pneu do trativo) −1 224 … −3 517 = 2 293 mm
 *
 * ⚠️ E QUEM MANDA NO VÃO TRASEIRO NÃO É O PNEU, É O PARA-BARRO CLONADO.
 * `vwSuspDirecional` clona também a saia do 1º direcional (|x| 969,
 * y 486…1 230, 345 mm de vão), que cai em −1 076…−1 421. Encostar o tanque no
 * pneu (−1 284) o enfiaria dentro dela — daí 1 750 mm de recuo, e não os 1 474
 * que a conta do pneu sozinho daria.
 */
const VW_EIXO2 = VW.eixo.dir - 2.348;    // Zn -0,7178

/**
 * ⚠️ O QUE ANDA NO VW É POUCO, e isso se descobre MEDINDO INTERFERÊNCIA.
 *
 * A 1ª versão recuava **180 componentes (62 030 tri) em bloco**, e a régua era
 * "peça curta, abaixo da mesa, fora do miolo" — uma régua de CAIXA. Com a sonda
 * de volume (quanto de cada componente cai dentro do CILINDRO do pneu novo, e
 * não da caixa dele) sobra outra lista, muito menor:
 *
 *     tanque_p0 (nó)          504 mm de penetração   ESQ  → recua 1 750 mm
 *     truck_p4 reservatório   240 mm                 DIR  → vai para o balanço
 *     truck_p4 gusset         157 mm                 DIR  → sai (ver abaixo)
 *     truck_p5 grade lateral  133 mm                      → sai de qualquer jeito
 *     truck_p4 gusset ESQ       5 mm                      → fica
 *
 * ⚠️ E AS CHAPAS DE 696 × 706 NÃO SÃO BERÇO DE TANQUE — são GUSSET DE QUADRO.
 * A régua antiga as apanhava (curtas, abaixo da mesa, fora do miolo) e as
 * recuava 826 mm junto com o equipamento. Elas se REPETEM ao longo da
 * longarina — medidas em Zn 206, −340, −1 231, −1 375 e −6 135 —, e recuar
 * gusset de quadro é deformar o chassi em silêncio. A única que sai é a de
 * −340, porque é a estação que o pneu novo passa a ocupar; um travessamento a
 * menos onde entra um eixo é o que a fábrica faz.
 *
 * O RESERVATÓRIO DE AR TRANSVERSAL (403 mm de diâmetro, eixo em x, Zn −715)
 * fica exatamente no sítio do 2º direcional e não tem para onde ir no
 * entre-eixos: à frente o vão dianteiro já leva caixa e reservatórios
 * (949 mm dentro de 1 335) e atrás vem gusset, caixa de bateria e estepe em
 * fila contínua até −2 987. O balanço traseiro, esse sim, está livre — medido,
 * entre o gusset de −6 167 e o plano de corte do rabo em −6 936 sobram 769 mm —
 * e é para lá que ele vai.
 */
/** Quanto o tanque do flanco ESQUERDO recua. Ele tem 1 309 mm e o vão traseiro
 *  começa depois do para-barro clonado (−1 421), não do pneu (−1 224). */
const VW_RECUO_TANQUE = 1.750;
/** E quanto anda o reservatório transversal, até o balanço traseiro. */
const VW_RECUO_RESERVATORIO = 5.727;

/** Os três testes que separam EQUIPAMENTO de QUADRO. Peça CURTA (a longarina e
 *  o chicote atravessam e são prismáticos), ABAIXO da mesa e FORA do miolo. */
function vwEquipamento(b) {
  if ((b.z1 - b.z0) >= 1.5) return false;
  if (b.y0 >= 1.05) return false;
  if (Math.abs(b.xc) <= 0.45) return false;
  return true;
}
/** O reservatório transversal do flanco direito e a ferragem dele. */
function vwReservatorio(b) {
  return b.xc > 0 && b.zc >= -1.00 && b.zc <= -0.35 && vwEquipamento(b);
}
/**
 * O gusset de quadro que fica na CAIXA DE RODA do 2º direcional.
 *
 * Chapa LARGA, ALTA e FINA — é o que a distingue de qualquer equipamento; as
 * cinco deste caminhão estão em Zn 206, −340, −1 231, −1 375 e −6 135.
 *
 * ⚠️ SÃO DUAS, E NÃO UMA. A 1ª versão tirava só a de −340, que o pneu novo
 * ocupa. A de **−1 231** também sai, e por medida: o para-lama montado em
 * runtime vai de Zn −23 a −1 434 e o portão de bancada mede **35 mm** de chapa
 * dentro do arco ali — a maior sobreposição que sobrou no VW. Um travessamento
 * a menos onde entra um eixo é o que a fábrica faz; dois, onde entra eixo E
 * para-lama, também.
 *
 * A janela para em −1,30 de propósito: a gusset de −1 375 fica ATRÁS do
 * para-barro (que acaba em −1 416) e não encosta em nada.
 */
function vwGussetDoEixo(b) {
  return b.zc > -1.30 && b.zc < -0.20
    && (b.x1 - b.x0) > 0.60 && (b.y1 - b.y0) > 0.65 && (b.z1 - b.z0) < 0.10;
}

const VW_CORTE_GUSSET = {
  nome: 'gusset de quadro na estação do 2º direcional',
  nos: [],
  comps: { truck_p4: vwGussetDoEixo },
};

/**
 * ▶▶ A GRADE LATERAL DE FÁBRICA DO VW — a peça que estava DUPLICADA.
 *
 * *"o vw precisa remover a grade lateral que na verdade pertence ao implemento,
 * então está ficando duplicada"* — Kennedy, com a foto do flanco.
 *
 * E está: o VW é o ÚNICO dos três rígidos cujo rip traz para-ciclista assado.
 * Conferido nos outros dois com a mesma varredura (componente com vão em z
 * maior que 1,2 m na faixa |x| 1,00…1,45 e y 0,40…1,15): o VM tem zero, o
 * Scania P tem zero, o VW tem OITO — dois corridos por lado, um dianteiro e um
 * traseiro, partidos pelo tandem, que é a mesma forma que `side-guard.ts`
 * constrói a partir do implemento.
 *
 *     truck_p5   432 tri   16×557×3 087   |x| 1 141   y 532…1 089   z −2 789…  299
 *     truck_p5   330 tri   16×155×3 080   |x| 1 141   y 524…  679   z −2 790…  290
 *     truck_p5    60 tri   10×150×2 691   |x| 1 194   y 538…  688   z −2 950… −260
 *     truck_p5   110 tri   37×541×2 696   |x| 1 180   y 560…1 100   z −2 954… −259
 *     truck_p5    60 tri   10×147×1 359   |x| 1 194   y 511…  658   z −7 435…−6 076
 *     truck_p5   110 tri   15×547×1 364   |x| 1 196   y 521…1 068   z −7 439…−6 075
 *     truck_p5   432 tri   16×559×1 377   |x| 1 141   y 514…1 073   z −7 447…−6 070
 *     truck_p5   330 tri   16×157×1 370   |x| 1 141   y 506…  663   z −7 448…−6 079
 *
 * CONFERIDO NA FOTO antes de cortar, e não depois: na régua do print do flanco
 * (0,1212 px/mm, tirada do vão 1º direcional → trativo) a grade bege começa em
 * Zn −235 e acaba em −2 916; as cotas medidas são −260 e −2 950. 25 e 34 mm de
 * erro de leitura de pixel — é a mesma peça.
 *
 * ⚠️ E ELA SAI DOS QUATRO ARQUIVOS, o 6x2 inclusive. Como o 6x2 de origem já
 * está NO AR sob `Cache-Control: immutable`, ele não pode ser sobrescrito: a
 * saída limpa é um arquivo NOVO, `vw_titan_6x2r.glb`, e é ele que o catálogo
 * passa a apontar. O rip continua na árvore, intacto, como fonte das quatro
 * derivações.
 *
 * O teste é de FORMA: chapa fina (menos de 50 mm), longa (mais de 1,2 m), no
 * flanco (|x| > 1,10) e na altura da barra (base entre 0,50 e 0,60 m). Nenhum
 * outro componente do caminhão casa os quatro.
 */
/**
 * ⚠️ A JANELA DE ALTURA SAIU DAQUI, e ela era o defeito. *"os suportes da grade
 * do VW continuam lá, até uma FACE da grade"* — Kennedy, com a foto.
 *
 * O corrido tem DOIS níveis, e a 1ª versão pediu `y0` entre 0,50 e 0,60: isso
 * apanha as chapas da barra de BAIXO (y 506…689) e deixa as da barra de CIMA
 * (y 922…1 099) inteiras no arquivo. O que se via na foto era exatamente isso —
 * uma fita cinza contínua logo acima da barra branca do implemento, ao longo de
 * todo o vão.
 *
 * A assinatura que basta são TRÊS testes, e nenhum é de altura: chapa no
 * FLANCO (|x| > 1,10), LONGA (mais de 1,2 m de vão em z) e FINA (menos de
 * 50 mm). Varrido o caminhão inteiro, nada além do para-ciclista casa os três —
 * a saia da cabine (`clima_p2`) tem 158 mm de espessura e mora noutra malha.
 */
function vwGradeLateral(b) {
  if (Math.abs(b.xc) <= 1.10) return false;
  if ((b.z1 - b.z0) <= 1.20) return false;
  return (b.x1 - b.x0) < 0.05;
}

/**
 * ⚠️ E OS SUPORTES DELA TAMBÉM SAEM — a 1ª versão tirou o corrido e deixou a
 * ferragem. *"você removeu as grades, mas não removeu os suportes"* — Kennedy,
 * com a foto: chapinhas brancas penduradas na longarina, sem nada nelas.
 *
 * São OITO componentes, dois por ponta de corrido e por flanco, com assinatura
 * própria: chapa de 277 mm de altura, quase sem espessura (0 a 9 mm), 88 a
 * 97 mm de vão em z, em |x| 1 139…1 196 — exatamente a linha da grade. Elas
 * ficam nas pontas TRASEIRAS de cada corrido (Zn −2 685…−2 782, −2 861…−2 952 e
 * −7 343…−7 440); as dianteiras já saíram junto com as chapas do corrido, que
 * subiam a y 1 089 e levavam o flange de fixação.
 */
function vwSuporteDaGrade(b) {
  if (Math.abs(b.xc) <= 1.10) return false;
  if ((b.x1 - b.x0) >= 0.02) return false;
  const dy = b.y1 - b.y0;
  if (dy < 0.25 || dy > 0.32) return false;
  if ((b.z1 - b.z0) > 0.15) return false;
  return b.y0 > 0.60 && b.y0 < 0.72;
}

/**
 * ⚠️ E AINDA FALTAVAM AS LÂMINAS. *"os suportes da antiga grade que era ligada
 * no chassi ainda está mostrando"* · *"suporte da antiga grade atravessando o
 * estepe"* — Kennedy, 2026-08-23, com a foto do VW montado.
 *
 * `vwSuporteDaGrade()` pediu `dy` entre 250 e 320 mm e `y0` entre 600 e 720:
 * isso apanha as chapinhas de PONTA de corrido e deixa as LÂMINAS de apoio, que
 * são mais altas e sobem acima da mesa da longarina. Medido no rip, quatro por
 * flanco, em duas formas:
 *
 *     35 × 245 × 33 mm   |x| 963…998   y 846…1 092   Zn −2 013 e −1 525
 *     13 × 344 × 34 mm   |x| 586…849   y 832…1 179   Zn −2 047 e −1 479
 *
 * Vistas de cima elas são LÂMINAS DE PONTA no bordo externo da longarina, e as
 * de |x| 586…849 passam POR DENTRO do estepe — que é a foto do dono.
 *
 * A assinatura são quatro testes e nenhum é de nome: chapa FINA (< 50 mm),
 * ALTA (200…400 mm), CURTA em z (< 60 mm) e que SOBE acima da mesa (topo além
 * de 1,05 m). Varrido o caminhão inteiro, só elas casam os quatro.
 */
function vwLaminaDaGrade(b) {
  const ax = Math.abs(b.xc);
  if (ax < 0.50 || ax > 1.10) return false;
  if ((b.x1 - b.x0) >= 0.05) return false;
  const dy = b.y1 - b.y0;
  if (dy < 0.20 || dy > 0.40) return false;
  if ((b.z1 - b.z0) >= 0.06) return false;
  return b.y1 > 1.05;
}

const VW_CORTE_GRADE = {
  nome: 'grade lateral de fábrica do VW e os suportes dela',
  nos: [],
  comps: {
    truck_p5: (b) => vwGradeLateral(b) || vwSuporteDaGrade(b),
    truck_p4: (b) => vwLaminaDaGrade(b),
  },
};

/** O que é do 1º DIRECIONAL do VW — a roda, por posição. */
function vwDoDirecional(b) {
  return Math.abs(b.zc - VW.eixo.dir) <= 0.62;
}
/** …e a suspensão dele: mesma faixa, abaixo da mesa e fora do miolo, e CURTA
 *  (a longarina e a cabine cruzam a faixa e não podem ser clonadas). */
function vwSuspDirecional(b) {
  if (Math.abs(b.zc - VW.eixo.dir) > 0.55) return false;
  if ((b.z1 - b.z0) >= 1.2) return false;
  if (b.y0 >= 1.05) return false;
  if (Math.abs(b.xc) <= 0.30) return false;
  /* ⚠️ E A SAIA DA CABINE NÃO É SUSPENSÃO. `truck_p4` traz, 530 mm atrás do 1º
     direcional, uma chapa de 521 × 744 × 345 que é o forro da caixa de roda da
     CABINE (o gêmeo dela está em `clima_p2`, a casca pintada). Clonada, ela
     caía em Zn −1 076…−1 421 — exatamente onde o para-lama do 2º direcional é
     montado em runtime, e as duas se atravessavam. Suspensão de eixo não passa
     de 600 mm de altura; forro de caixa de roda passa. */
  if ((b.y1 - b.y0) > 0.60) return false;
  return true;
}

/* ══════════════════════ as saídas ══════════════════════ */

const SAIDAS = [
  {
    id: 'vm-8x2',
    truck: VM,
    arquivo: 'volvo_vm_2015_8x2r.glb',
    rotulo: 'Volvo VM · bitruck 8x2',
    /* ⚠️ O DPF E A CAIXA DE BATERIA NÃO ESTÃO AQUI, e é o conserto desta
       rodada: com o eixo na cota de ficha eles caem sozinhos no vão de
       1 164 mm entre os dois direcionais, que é onde o caminhão real os leva.
       Só anda quem o pneu novo — e o para-barro clonado dele — desalojou. */
    /* ⚠️ 1 550 mm, e quem manda não é o pneu.
       O pneu novo sozinho pediria 1 148; o PARA-BARRO do para-lama montado em
       runtime desce até Zn −1 139 e o TUBO DE ESCAPE cruza o flanco direito em
       −1 076…−1 284 (x −251…661, contra a face interna do tanque em 530). O
       tanque tem de passar dos dois, com 60 mm de folga. Medido por
       `probe-sobreposicao.cjs`: com 1 350 mm o escapamento entrava 132 × 523 ×
       122 mm dentro do tanque. */
    mover: [
      { nos: [/^tanque_0_p\d+$/], dz: 1.550 },   // tanques → −1 362…−2 780
      { nos: [/^step_0_p\d+$/], dz: 3.777 },     // estepe → o balanço traseiro
      /* ⚠️ 10 mm PARA A FRENTE, e são os últimos milímetros que a sonda de
         sobreposição achou. A caixa de bateria do flanco esquerdo começa em
         Zn 147 e o pneu novo (Ø 1 056 centrado em −372,5) acaba em 155: 8 mm
         de peça dentro de pneu.

         ⚠️ E O VÃO É DE 12 mm, NÃO DE 276. A primeira correção mandou a caixa
         60 mm para a frente e a sonda devolveu OUTRA sobreposição, do mesmo
         tamanho, contra `chs_base_0_p17` (o compartimento do motor, que começa
         em 1 047 — 4 mm à frente da caixa). Ela está encaixada entre o pneu e o
         motor com 12 mm de sobra no total, e 10 é o que zera o lado do pneu
         deixando 6 mm do outro — bem no miolo do chassi, entre as longarinas,
         onde o rip já tem 1 121 pares assim. Foi a sonda que mostrou os dois; o
         olho não mostraria nenhum. */
      { nos: [/^chs_base_0_p1[23]$/, /^chs_base_0_p18$/], dz: -0.010 },
    ],
    clonarNos: [
      { nos: [/^wheel_f_[01]_0_/], dz: VM.eixo.dir - VM_EIXO2, sufixo: '_dir2' },
    ],
    cortes: [],
    eixos: { config: '8x2', steerZ: [VM.eixo.dir, VM_EIXO2],
      driveZ: [VM.eixo.trativo], liftZ: [VM.eixo.auxiliar] },
  },
  {
    id: 'vm-4x2',
    truck: VM,
    arquivo: 'volvo_vm_2015_4x2r.glb',
    rotulo: 'Volvo VM · toco 4x2',
    cortes: [VM_CORTE_AUX],
    eixos: { config: '4x2', steerZ: [VM.eixo.dir], driveZ: [VM.eixo.trativo], liftZ: [] },
  },
  {
    id: 'vw-6x2',
    truck: VW,
    arquivo: 'vw_titan_6x2r.glb',
    rotulo: 'VW Titan · truck 6x2 (sem a grade de fábrica)',
    /* A ÚNICA CIRURGIA É A GRADE. O 6x2 é o próprio rip; ele só não pode ser
       sobrescrito, porque já está servido como `immutable`. Ver
       `vwGradeLateral`. */
    cortes: [VW_CORTE_GRADE],
    eixos: { config: '6x2', steerZ: [VW.eixo.dir], driveZ: [VW.eixo.trativo],
      liftZ: [VW.eixo.auxiliar] },
  },
  {
    id: 'vw-8x2',
    truck: VW,
    arquivo: 'vw_titan_8x2_tl.glb',
    rotulo: 'VW Titan · bitruck 8x2',
    moverComps: [
      { malha: 'truck_p4', pega: vwReservatorio, dz: VW_RECUO_RESERVATORIO },
    ],
    mover: [
      { nos: [/^tanque_p\d+$/], dz: VW_RECUO_TANQUE },   // o tanque é do flanco esquerdo
    ],
    clonarNos: [],
    /* A rodagem do 1º direcional, clonada no sítio do 2º. No VW ela não é nó:
       as quatro malhas de roda são COMPARTILHADAS entre todos os eixos, e o
       que identifica o direcional é a posição. */
    clonarComps: [
      { malha: 'wheel_f_0_0_f_tire_p0', pega: vwDoDirecional, dz: VW.eixo.dir - VW_EIXO2 },
      { malha: 'wheel_f_0_0_f_disc_p1', pega: vwDoDirecional, dz: VW.eixo.dir - VW_EIXO2 },
      { malha: 'wheel_f_0_0_f_nuts_p0', pega: vwDoDirecional, dz: VW.eixo.dir - VW_EIXO2 },
      { malha: 'wheel_f_0_0_f_hub_p1', pega: vwDoDirecional, dz: VW.eixo.dir - VW_EIXO2 },
      { malha: 'truck_p4', pega: vwSuspDirecional, dz: VW.eixo.dir - VW_EIXO2 },
    ],
    cortes: [VW_CORTE_GRADE, VW_CORTE_GUSSET],
    eixos: { config: '8x2', steerZ: [VW.eixo.dir, VW_EIXO2],
      driveZ: [VW.eixo.trativo], liftZ: [VW.eixo.auxiliar] },
  },
  {
    id: 'vw-4x2',
    truck: VW,
    arquivo: 'vw_titan_4x2_tl.glb',
    rotulo: 'VW Titan · toco 4x2',
    cortes: [VW_CORTE_AUX, VW_CORTE_GRADE],
    eixos: { config: '4x2', steerZ: [VW.eixo.dir], driveZ: [VW.eixo.trativo], liftZ: [] },
  },
];

/* ══════════════════════ a cirurgia ══════════════════════ */

/**
 * MOVE nós inteiros em Zn, escrevendo a translação LOCAL correspondente.
 *
 * ⚠️ A TRANSLAÇÃO DE UM NÓ É NO ESPAÇO DO PAI, e no VM 123 dos 139 nós têm
 * matriz. Somar o delta direto em `translation` só estaria certo se o pai
 * estivesse na identidade — e não está. O delta é de MUNDO e vira local pela
 * inversa da matriz do PAI, tratado como DIREÇÃO (w = 0), que é o que ignora a
 * translação do pai e respeita rotação e escala dele.
 *
 * ⚠️ E O SINAL: Zn = −Zg, então recuar Δ no normalizado é AVANÇAR Δ no cru.
 */
function moveNos(g, M, pai, alvos, dzNorm, relato) {
  const dMundo = [0, 0, dzNorm];        // cru: +z = para trás (Zn = −Zg)
  let n = 0;
  g.nodes.forEach((no, i) => {
    if (!alvos.some((re) => re.test(no.name || ''))) return;
    const mPai = pai[i] >= 0 ? M[pai[i]] : I4();
    const dLocal = direcao(inv4(mPai), dMundo);
    const t = no.translation || [0, 0, 0];
    no.translation = [t[0] + dLocal[0], t[1] + dLocal[1], t[2] + dLocal[2]];
    if (no.matrix) throw new Error(`nó ${no.name} usa \`matrix\`; mover exigiria decompor`);
    n++;
  });
  relato.push(`  MOVE ${n} nó(s) em Zn ${(dzNorm > 0 ? '-' : '+')}${mm(Math.abs(dzNorm))} mm `
    + `· ${alvos.map((r) => String(r)).join(' ')}`);
  return n;
}

/**
 * CLONA nós inteiros deslocados em Zn — é assim que o 2º eixo direcional ganha
 * rodagem sem duplicar um único triângulo: o nó novo aponta para a MESMA malha.
 */
function clonaNos(g, M, pai, alvos, dzNorm, sufixo, relato) {
  const dMundo = [0, 0, dzNorm];
  const novos = [];
  const base = g.nodes.length;
  for (let i = 0; i < base; i++) {
    const no = g.nodes[i];
    if (!alvos.some((re) => re.test(no.name || ''))) continue;
    if (no.matrix) throw new Error(`nó ${no.name} usa \`matrix\`; clonar exigiria decompor`);
    const mPai = pai[i] >= 0 ? M[pai[i]] : I4();
    const dLocal = direcao(inv4(mPai), dMundo);
    const t = no.translation || [0, 0, 0];
    const copia = {
      name: (no.name || 'no') + sufixo,
      mesh: no.mesh,
      translation: [t[0] + dLocal[0], t[1] + dLocal[1], t[2] + dLocal[2]],
    };
    if (no.rotation) copia.rotation = no.rotation.slice();
    if (no.scale) copia.scale = no.scale.slice();
    const idx = g.nodes.length;
    g.nodes.push(copia);
    novos.push({ idx, pai: pai[i] });
  }
  for (const { idx, pai: p } of novos) {
    if (p >= 0) (g.nodes[p].children = g.nodes[p].children || []).push(idx);
    else {
      const cena = g.scenes[g.scene || 0];
      (cena.nodes = cena.nodes || []).push(idx);
    }
  }
  relato.push(`  CLONA ${novos.length} nó(s) em Zn ${(dzNorm > 0 ? '-' : '+')}${mm(Math.abs(dzNorm))} mm`);
  return novos.length;
}

async function fazer(saida, ensaio) {
  const D = await S.decoder();
  const E = ensaio ? null : S.encoder();
  const SRC = path.join(TRUCKS, saida.truck.fonte);
  const { g, bin } = S.lerGlb(SRC);
  S.verificaSuporte(g);
  const M = matrizesDeMundo(g);
  const caixaNorm = fazCaixaNorm(saida.truck.groundY);

  const pai = paisDe(g);
  const relatoOps = [];

  /* 0. MOVER e CLONAR nós — antes de tudo, porque mexem na árvore. */
  for (const m of (saida.mover || [])) moveNos(g, M, pai, m.nos, m.dz, relatoOps);
  for (const c of (saida.clonarNos || [])) clonaNos(g, M, pai, c.nos, c.dz, c.sufixo, relatoOps);

  /* 1. NÓS INTEIROS. */
  const padroes = saida.cortes.flatMap((c) => c.nos);
  const foraNo = new Set();
  g.nodes.forEach((n, i) => { if (padroes.some((re) => re.test(n.name || ''))) foraNo.add(i); });

  /* 2. COMPONENTES, malha a malha. */
  const regras = new Map();
  for (const m of (saida.moverComps || [])) {
    if (!regras.has(m.malha)) regras.set(m.malha, []);
  }
  for (const c of (saida.clonarComps || [])) {
    if (!regras.has(c.malha)) regras.set(c.malha, []);
  }
  for (const c of saida.cortes) {
    for (const [malha, pega] of Object.entries(c.comps)) {
      const lista = regras.get(malha) || [];
      lista.push(pega); regras.set(malha, lista);
    }
  }

  const cortes = [];
  const relato = [];
  for (const nome of regras.keys()) {
    const iNo = g.nodes.findIndex((n) => n.name === nome);
    if (iNo < 0) { relato.push(`  ⚠️ nó ${nome} não existe`); continue; }
    const no = g.nodes[iNo];
    const prim = g.meshes[no.mesh].primitives[0];
    const d = S.decodifica(g, bin, prim, D);
    const posLocal = d.attrs.POSITION.arr;
    const posMundo = emMundo(posLocal, M[iNo]);
    const comps = S.componentes(posMundo, d.idx);

    /* MOVER componentes dentro da malha, antes de decidir o que sai. Ver
       `moverComps` nas saídas: é o que reposiciona equipamento que NÃO é nó. */
    const mvs = (saida.moverComps || []).filter((m) => m.malha === nome);
    if (mvs.length) {
      const mInv = inv4(M[iNo]);
      let movidos = 0, triMov = 0;
      for (const mv of mvs) {
        const dLocal = direcao(mInv, [0, 0, mv.dz]);
        for (const faces of comps) {
          const b = caixaNorm(S.caixaDeFaces(posMundo, d.idx, faces));
          if (!mv.pega(b)) continue;
          const vistos = new Set();
          for (const f of faces) {
            for (let k = 0; k < 3; k++) {
              const vi = d.idx[f * 3 + k];
              if (vistos.has(vi)) continue;
              vistos.add(vi);
              posLocal[vi * 3] += dLocal[0];
              posLocal[vi * 3 + 1] += dLocal[1];
              posLocal[vi * 3 + 2] += dLocal[2];
            }
          }
          movidos++; triMov += faces.length;
        }
      }
      relato.push(`  MOVE-COMP ${nome}: ${movidos} componente(s) · ${triMov} tri`
        + ` · Zn ${(mvs[0].dz > 0 ? '-' : '+')}${mm(Math.abs(mvs[0].dz))} mm`);
      /* ⚠️ O CORTE QUE VEM DEPOIS DECIDE PELA POSIÇÃO NOVA. Recomputa-se o
         mundo, senão uma peça movida para dentro da janela de corte escaparia
         (ou uma movida para fora seria cortada). */
      const novoMundo = emMundo(posLocal, M[iNo]);
      posMundo.set(novoMundo);
    }

    const pegas = regras.get(nome) || [];
    const fica = [], sai = [];
    for (const faces of comps) {
      const b = caixaNorm(S.caixaDeFaces(posMundo, d.idx, faces));
      if (pegas.some((f) => f(b))) sai.push({ faces, b }); else fica.push({ faces, b });
    }
    /* CLONAR componentes deslocados — o enxerto. Mesma mecânica do
       `ENXERTO_DIF` de `cut-scania.cjs`: recorta as faces do doador, concatena
       os atributos e desloca só as posições novas. Serve para rip em que a
       peça a duplicar não é um nó (no VW a rodagem inteira mora em quatro
       malhas compartilhadas). */
    const cls = (saida.clonarComps || []).filter((c) => c.malha === nome);
    const base = S.recorta(d.attrs, d.idx, fica.flatMap((c) => c.faces));
    let attrs = base.attrs, idx = base.idx, triClonados = 0;
    for (const cl of cls) {
      const alvo = comps.filter((faces) => {
        const b = caixaNorm(S.caixaDeFaces(posMundo, d.idx, faces));
        return cl.pega(b);
      });
      if (!alvo.length) { relato.push(`  ⚠️ CLONA-COMP ${nome}: nenhum componente casou`); continue; }
      const dLocal = direcao(inv4(M[iNo]), [0, 0, cl.dz]);
      const clone = S.recorta(d.attrs, d.idx, alvo.flatMap((f) => f));
      const nvB = attrs.POSITION.arr.length / 3;
      const nvC = clone.attrs.POSITION.arr.length / 3;
      const juntos = {};
      for (const k of Object.keys(attrs)) {
        const a = attrs[k], c2 = clone.attrs[k];
        if (!c2) { juntos[k] = a; continue; }
        const arr = new Float32Array(a.arr.length + c2.arr.length);
        arr.set(a.arr, 0); arr.set(c2.arr, a.arr.length);
        if (k === 'POSITION') {
          for (let i2 = nvB; i2 < nvB + nvC; i2++) {
            arr[i2 * 3] += dLocal[0]; arr[i2 * 3 + 1] += dLocal[1]; arr[i2 * 3 + 2] += dLocal[2];
          }
        }
        juntos[k] = { arr, n: a.n, acessor: a.acessor };
      }
      const idxJ = new Uint32Array(idx.length + clone.idx.length);
      idxJ.set(idx, 0);
      for (let i2 = 0; i2 < clone.idx.length; i2++) idxJ[idx.length + i2] = clone.idx[i2] + nvB;
      attrs = juntos; idx = idxJ; triClonados += clone.idx.length / 3;
    }
    if (triClonados) relato.push(`  CLONA-COMP ${nome}: ${triClonados} tri`
      + ` · Zn ${(cls[0].dz > 0 ? '-' : '+')}${mm(Math.abs(cls[0].dz))} mm`);
    cortes.push({ malha: no.mesh, attrs, idx });

    const triSai = sai.reduce((s, c) => s + c.faces.length, 0);
    relato.push(`  ${nome.padEnd(14)} ${String(comps.length).padStart(4)} comp `
      + `· tira ${String(sai.length).padStart(4)} (${String(triSai).padStart(7)} tri) `
      + `· fica ${String(fica.length).padStart(4)}`);
    if (ensaio) {
      for (const c of sai.sort((a, b) => b.faces.length - a.faces.length).slice(0, 10)) {
        relato.push(`       SAI  ${String(c.faces.length).padStart(6)} tri  `
          + `${mm(c.b.dx)}×${mm(c.b.dy)}×${mm(c.b.dz)} mm  |x|=${mm(Math.abs(c.b.xc))}  `
          + `y ${mm(c.b.y0)}…${mm(c.b.y1)}  zc=${mm(c.b.zc)}`);
      }
      /* O QUE FICA na faixa é a metade mais informativa da conferência: é aí
         que se vê peça de eixo esquecida. */
      const naFaixa = fica.filter((c) => Math.abs(c.b.zc - saida.truck.eixo.auxiliar) < 0.7);
      for (const c of naFaixa.sort((a, b) => b.faces.length - a.faces.length).slice(0, 10)) {
        relato.push(`       fica ${String(c.faces.length).padStart(6)} tri  `
          + `${mm(c.b.dx)}×${mm(c.b.dy)}×${mm(c.b.dz)} mm  |x|=${mm(Math.abs(c.b.xc))}  `
          + `y ${mm(c.b.y0)}…${mm(c.b.y1)}  zc=${mm(c.b.zc)}`);
      }
    }
  }

  console.log(`\n══ ${saida.rotulo} → ${saida.arquivo}`);
  for (const l of relatoOps) console.log(l);
  console.log(`  nós removidos: ${foraNo.size}`
    + (foraNo.size ? ` (${[...foraNo].map((i) => g.nodes[i].name).slice(0, 6).join(', ')}…)` : ''));
  for (const l of relato) console.log(l);
  if (ensaio) return null;

  const bin2 = S.aplicaCorte(g, bin, cortes, E, D);
  const r = S.poda(g, bin2, (n, i) => !foraNo.has(i));
  const destino = path.join(TRUCKS, saida.arquivo);
  const bytes = S.escreverGlb(destino, r.g, r.bin);
  const orig = fs.statSync(SRC).size;
  console.log(`  ESCRITO ${saida.arquivo} — ${(bytes / 1048576).toFixed(2)} MB `
    + `(fonte ${(orig / 1048576).toFixed(2)} MB) · ${r.g.nodes.length} nós · `
    + `${r.g.meshes.length} malhas`);
  return { arquivo: saida.arquivo, bytes, eixos: saida.eixos };
}

(async () => {
  const ensaio = process.argv.includes('--ensaio');
  const iSo = process.argv.indexOf('--so');
  const so = iSo >= 0 ? process.argv[iSo + 1] : null;
  for (const s of SAIDAS) {
    if (so && s.id !== so) continue;
    await fazer(s, ensaio);
  }
})();
