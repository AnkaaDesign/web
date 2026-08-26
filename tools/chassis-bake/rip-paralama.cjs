/* O PARA-LAMA DO 2º EIXO DIRECIONAL — extraído do Scania P para servir aos três.
   ===========================================================================
       node tools/chassis-bake/rip-paralama.cjs [--ensaio]

   > *"no volvo bitruck, em vez de usar o para-lamas da cabine para a segunda
   >  roda, deve usar o da segunda roda do scania mesmo, ficará melhor"* —
   >  Kennedy, 2026-08-23.

   POR QUE O DO SCANIA, E NÃO O DA PRÓPRIA CABINE
   ---------------------------------------------------------------------------
   A 1ª tentativa clonou o arco do 1º direcional do VM (três componentes de
   `cabin_p0` mais o para-barro de `chs_base_0_p7`) e deslocou 2 220 mm. Ela
   funciona no sentido de existir, e falha em dois:

     1. **O arco do VM é PARTE DA CASCA DA CABINE.** Ele nasce colado à porta e
        à caixa de roda; recortado e mudado de lugar, o que chega ao 2º eixo é
        um pedaço de cabine solto no meio do chassi — e ele ATRAVESSA o que
        estiver lá. Medido por `probe-sobreposicao.cjs`: 6 sobreposições novas,
        com a caixa de bateria (151 × 195 × 95 mm) e com a ferragem do flanco
        direito (110 × 118 × 20 mm).
     2. O Scania P **é um bitruck de fábrica** e traz a peça certa: um para-lama
        de 2º direcional inteiro, com aba, suporte e para-barro, desenhado para
        viver solto no meio do quadro. É o que `t_paralama_0_p0…p7` são.

   É a mesma doutrina de `wheel_vm_v1.glb` e `tank_vm_v1.glb`: a peça boa de um
   rip vira ASSET e serve os outros. Aqui ela vale para o VM e para o VW, que
   são bitrucks DERIVADOS e por definição não têm a peça.

   O DATUM
   ---------------------------------------------------------------------------
   O asset sai no espaço CRU do glTF (os três rígidos apontam para −Z, então não
   há giro a aplicar), transladado para que a origem seja o **centro do eixo**:

       x = 0 (a peça é dos DOIS lados e fica simétrica)
       y = centro do pneu
       z = centro do eixo

   e o `_meta.json` guarda o pneu do DOADOR — diâmetro e meia-bitola. Quem monta
   escala `y`/`z` pela razão de diâmetro e `x` pela razão de meia-bitola, que é
   a única forma de a peça casar com pneu e bitola de outro caminhão sem
   distorcer o arco. Ver `vehicle/front-fender.ts`.
*/
const fs = require('fs');
const path = require('path');
const S = require('./glb-surgery.cjs');

const WEB = path.resolve(__dirname, '..', '..');
const FONTE = path.join(WEB, 'public', 'models', 'trucks', 'scania_p_8x2r.glb');
const DESTINO = path.join(WEB, 'public', 'models', 'vehicles', 'paralama_dir2_v1.glb');
const META = path.join(WEB, 'public', 'models', 'vehicles', 'paralama_dir2_v1_meta.json');
const GROUND_Y = -0.0607;              // `mounts.json`, scania-p-8x2r
const EIXO2_ZN = -0.5745;              // idem, `axles.steerZ[1]`
const ENSAIO = process.argv.includes('--ensaio');
const PECA_RE = /^t_paralama_0_p\d+$/;
/** O pneu do 2º direcional, para o datum e para a régua do meta. */
const PNEU_RE = /^wheel_f_[23]_0_f_tire/;

const mm = (v) => (v * 1000).toFixed(0);

/* ---------- matrizes de nó, compostas pela árvore (igual a probe-eixo.cjs) ---------- */
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

/* Os três rígidos têm `orientYaw = π` e `centerX = 0`: o cru aponta para −Z e
   a conversão é só de sinal. Aqui basta ela. */
const zn = (zg) => -zg;
const yn = (yg) => yg - GROUND_Y;

(async () => {
  const D = await S.decoder();
  const { g, bin } = S.lerGlb(FONTE);
  S.verificaSuporte(g);

  /* ⚠️ OS NÓS NÃO ESTÃO NA IDENTIDADE, e neste acervo isso é a REGRA (189 dos
     228 nós do Scania carregam transformação — ver `probe-eixo.cjs`). Mede-se
     em MUNDO, compondo a árvore, e o datum sai daí: a translação do nó-raiz
     novo é escrita no espaço da CENA, que é justamente onde a medida está. */
  const M = matrizesDeMundo(g);
  const alvos = [];
  g.nodes.forEach((n, i) => { if (PECA_RE.test(n.name || '')) alvos.push(i); });
  if (!alvos.length) throw new Error('nenhum nó ' + PECA_RE + ' em ' + path.basename(FONTE));

  /* O PNEU DO DOADOR, medido: diâmetro e meia-bitola (o |x| do centro da
     banda). São as duas réguas com que a peça se ajusta a outro caminhão. */
  let py0 = Infinity, py1 = -Infinity, pxi = Infinity, pxo = -Infinity, pz = 0, pzn = 0;
  {
    let z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < g.nodes.length; i++) {
      const n = g.nodes[i];
      if (n.mesh === undefined || !PNEU_RE.test(n.name || '')) continue;
      for (const prim of g.meshes[n.mesh].primitives) {
        const d = S.decodifica(g, bin, prim, D);
        const pos = emMundo(d.attrs.POSITION.arr, M[i]);
        for (let k = 0; k < pos.length; k += 3) {
          const ax = Math.abs(pos[k]);
          if (pos[k + 1] < py0) py0 = pos[k + 1];
          if (pos[k + 1] > py1) py1 = pos[k + 1];
          if (ax < pxi) pxi = ax;
          if (ax > pxo) pxo = ax;
          if (pos[k + 2] < z0) z0 = pos[k + 2];
          if (pos[k + 2] > z1) z1 = pos[k + 2];
        }
      }
    }
    pz = (z0 + z1) / 2; pzn = zn(pz);
  }
  const diametro = py1 - py0;
  const meiaBitola = (pxi + pxo) / 2;
  const centroY = (py0 + py1) / 2;
  if (Math.abs(pzn - EIXO2_ZN) > 0.03) {
    throw new Error(`o pneu medido está em Zn ${mm(pzn)} e o manifesto diz ${mm(EIXO2_ZN)}`);
  }

  console.log(`── doador: ${path.basename(FONTE)}`);
  console.log(`   pneu do 2º direcional  Ø ${mm(diametro)} mm · face externa ${mm(pxo)} mm`
    + ` · interna ${mm(pxi)} · meia-bitola ${mm(meiaBitola)}`);
  console.log(`   centro do eixo         Zn ${mm(pzn)} mm · Yn ${mm(yn(centroY))} mm`);

  /* A peça, componente a componente, só para o relatório e para o meta. */
  let tri = 0, comps = 0;
  const caixa = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const i of alvos) {
    const n = g.nodes[i];
    for (const prim of g.meshes[n.mesh].primitives) {
      const d = S.decodifica(g, bin, prim, D);
      tri += d.idx.length / 3;
      const pos = emMundo(d.attrs.POSITION.arr, M[i]);
      comps += S.componentes(pos, d.idx).length;
      for (let k = 0; k < pos.length; k += 3) {
        if (pos[k] < caixa.x0) caixa.x0 = pos[k]; if (pos[k] > caixa.x1) caixa.x1 = pos[k];
        if (pos[k + 1] < caixa.y0) caixa.y0 = pos[k + 1]; if (pos[k + 1] > caixa.y1) caixa.y1 = pos[k + 1];
        if (pos[k + 2] < caixa.z0) caixa.z0 = pos[k + 2]; if (pos[k + 2] > caixa.z1) caixa.z1 = pos[k + 2];
      }
    }
    console.log(`   ${n.name.padEnd(18)} ${g.materials[g.meshes[n.mesh].primitives[0].material].name}`);
  }
  console.log(`   ${alvos.length} nós · ${comps} componentes · ${tri} triângulos`);
  console.log(`   caixa (Zn/Yn) x ${mm(-caixa.x1)}…${mm(-caixa.x0)}`
    + ` · y ${mm(yn(caixa.y0))}…${mm(yn(caixa.y1))}`
    + ` · z ${mm(zn(caixa.z1))}…${mm(zn(caixa.z0))}`);

  if (ENSAIO) return;

  /* ══ AS TEXTURAS PRIMEIRO, e sem isto o asset sai com 19,73 MB ══
     `poda()` repacota GEOMETRIA, e de propósito preserva TODA imagem: ela não
     sabe qual material sobrevive. Aqui sabe-se — são quatro —, então a lista de
     materiais, texturas, imagens e amostradores é reduzida ANTES, e aí a poda
     recolhe as bufferViews de imagem que ficaram órfãs junto com o resto.

     ⚠️ E É AQUI QUE OS MATERIAIS SÃO RENOMEADOS, não numa varredura por
     substring sobre os 114 do rip: `plastic_hard` aparece em 30 materiais deste
     arquivo, e renomear por nome renomeava metade da cabine. Renomeia-se pelo
     ÍNDICE que o para-lama usa. */
  const usados = [];
  const mapaMat = new Map();
  for (const i of alvos) {
    for (const prim of g.meshes[g.nodes[i].mesh].primitives) {
      if (prim.material === undefined) continue;
      if (!mapaMat.has(prim.material)) { mapaMat.set(prim.material, usados.length); usados.push(prim.material); }
    }
  }
  const renomeia = [
    [/pintura/, 'ts_paralama_pintura'],
    [/pretobrilhoso|preto/, 'ts_paralama_preto'],
    [/brushed_metal|metal/, 'ts_paralama_metal'],
    [/plastic|plastico/, 'ts_paralama_plastico'],
  ];
  const matsNovos = usados.map((mi) => {
    const m = JSON.parse(JSON.stringify(g.materials[mi]));
    for (const [re, nome] of renomeia) if (re.test(m.name || '')) { m.name = nome; break; }
    return m;
  });
  /* Texturas e imagens que esses quatro materiais alcançam. */
  const texUsada = [], mapaTex = new Map();
  const colheTex = (o) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o.index === 'number' && o.texCoord !== undefined) {
      if (!mapaTex.has(o.index)) { mapaTex.set(o.index, texUsada.length); texUsada.push(o.index); }
      o.index = mapaTex.get(o.index);
      return;
    }
    for (const v of Object.values(o)) colheTex(v);
  };
  for (const m of matsNovos) colheTex(m);
  const texNovas = texUsada.map((ti) => JSON.parse(JSON.stringify(g.textures[ti])));
  const imgUsada = [], mapaImg = new Map();
  const samUsado = [], mapaSam = new Map();
  for (const t of texNovas) {
    const fonte = t.source !== undefined ? t.source
      : (t.extensions && t.extensions.EXT_texture_webp && t.extensions.EXT_texture_webp.source);
    if (fonte !== undefined) {
      if (!mapaImg.has(fonte)) { mapaImg.set(fonte, imgUsada.length); imgUsada.push(fonte); }
      if (t.source !== undefined) t.source = mapaImg.get(fonte);
      if (t.extensions && t.extensions.EXT_texture_webp) {
        t.extensions.EXT_texture_webp.source = mapaImg.get(fonte);
      }
    }
    if (t.sampler !== undefined) {
      if (!mapaSam.has(t.sampler)) { mapaSam.set(t.sampler, samUsado.length); samUsado.push(t.sampler); }
      t.sampler = mapaSam.get(t.sampler);
    }
  }
  const imgNovas = imgUsada.map((i) => g.images[i]);
  const samNovos = samUsado.map((i) => g.samplers[i]);
  /* Toda primitiva do arquivo tem de apontar para um índice VÁLIDO da lista
     nova — as das malhas condenadas somem na poda, mas o glTF é validado
     inteiro antes disso. */
  for (const malha of g.meshes) {
    for (const prim of malha.primitives) {
      prim.material = mapaMat.has(prim.material) ? mapaMat.get(prim.material) : 0;
    }
  }
  g.materials = matsNovos;
  g.textures = texNovas;
  g.images = imgNovas;
  g.samplers = samNovos;
  console.log(`   materiais ${matsNovos.length} · texturas ${texNovas.length}`
    + ` · imagens ${imgNovas.length} — ${matsNovos.map((m) => m.name).join(', ')}`);

  /* ══ a poda: fica só o para-lama ══ */
  const manter = new Set(alvos);
  const r = S.poda(g, bin, (n, i) => manter.has(i));

  /* ══ o datum: um nó raiz que translada tudo para o centro do eixo ══ */
  const cena = r.g.scenes[r.g.scene || 0];
  const raiz = {
    name: 'PARALAMA_DIR2',
    translation: [0, -centroY, -pz],
    children: (cena.nodes || []).slice(),
  };
  r.g.nodes.push(raiz);
  cena.nodes = [r.g.nodes.length - 1];

  const bytes = S.escreverGlb(DESTINO, r.g, r.bin);
  fs.writeFileSync(META, JSON.stringify({
    _nota: 'Para-lama do 2º eixo direcional, extraído do Scania P 8x2 (t_paralama_0_p0…p7) '
      + 'por tools/chassis-bake/rip-paralama.cjs. O VM e o VW são bitrucks DERIVADOS e '
      + 'não têm a peça; o Scania é bitruck de fábrica e tem. Montado por '
      + 'engine/vehicle/front-fender.ts.',
    origem: 'models/trucks/scania_p_8x2r.glb',
    datum: {
      x: 'linha de centro do caminhão (a peça é dos dois lados)',
      y: 'CENTRO DO PNEU',
      z: 'CENTRO DO EIXO',
      espaco: 'cru do glTF (os três rígidos apontam para -Z; orientYaw = PI)',
    },
    doador: {
      pneuDiametro: +diametro.toFixed(4),
      pneuFora: +pxo.toFixed(4),
      pneuDentro: +pxi.toFixed(4),
      meiaBitola: +meiaBitola.toFixed(4),
      _reguaDeX: 'front-fender.ts escala x por pneuFora, e nao por meiaBitola: a '
        + 'varredura de runtime apanha pneu, aro, cubo e porca, e o |x| MINIMO entre '
        + 'eles muda de rip para rip. Medido, a meia-bitola punha o arco do VW em '
        + '1 355 mm de meia-largura — mais largo que o bau (1 335).',
      eixoZn: +pzn.toFixed(4),
      centroPneuYn: +yn(centroY).toFixed(4),
    },
    caixa: {
      x: [+(-caixa.x1).toFixed(4), +(-caixa.x0).toFixed(4)],
      yRelativoAoCentro: [+(caixa.y0 - centroY).toFixed(4), +(caixa.y1 - centroY).toFixed(4)],
      zRelativoAoEixo: [+zn(caixa.z1 - pz).toFixed(4), +zn(caixa.z0 - pz).toFixed(4)],
    },
    materiais: (r.g.materials || []).map((m) => m.name),
    nos: alvos.map((i) => g.nodes[i].name),
    componentes: comps,
    triangulos: tri,
    medidoEm: '2026-08-23',
  }, null, 2) + '\n');
  console.log(`   ESCRITO ${path.basename(DESTINO)} — ${(bytes / 1048576).toFixed(2)} MB`
    + ` · ${r.g.nodes.length} nós · ${r.g.materials.length} materiais`);
})();
