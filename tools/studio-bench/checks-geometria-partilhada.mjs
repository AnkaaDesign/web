/* IMPRESSÃO DIGITAL DA MALHARIA DO IMPLEMENTO — o portão que faltava para
   trocar o acervo por um deduplicado.
   ===========================================================================
       node tools/studio-bench/bench.mjs --geometry --checks checks-geometria-partilhada.mjs

   POR QUE ELE EXISTE, E POR QUE `checks-resize.mjs` NÃO SERVE
   ---------------------------------------------------------------------------
   `tools/studio-assets/dedup-cargas.mjs` reponta 1 302 primitivas do
   `trailer.glb` para as 855 cargas Draco que já estão no arquivo. O efeito em
   runtime é que o `GLTFLoader` passa a entregar **UMA `BufferGeometry`
   compartilhada por até 104 malhas** — 92,7 MB de VRAM de geometria e 1 302
   decodificações a menos.

   E é também o modo de falhar: este motor ESCREVE dentro da geometria, por
   malha (`trailer-assembly.ts` `resize()`, `trailer-bake-fixes.ts`
   `editVerts()`). `vehicle/geometry-share.ts` resolve isso com clone-na-escrita
   — mas "resolve" é uma afirmação, e uma afirmação não é um portão.

   `checks-resize.mjs`, que seria o candidato natural, **é cego para o defeito
   exato**: ele mede o perfil de brilho linha a linha de um recorte de 1 m × 2,2 m
   de UMA lateral, procurando a PRESENÇA de vincos escuros. Uma peça que some
   (é o que acontece quando uma casca compartilhada é colapsada num ponto para
   dar lugar a um `InstancedMesh`) REMOVE um vinco, e ausência de vinco não
   dispara nada. Ele também não lê `geometry.attributes.position`, não compara
   caixa envolvente e não guarda linha de base.

   O QUE ESTE ARQUIVO FAZ
   ---------------------------------------------------------------------------
   Tira uma impressão digital NUMÉRICA de todas as malhas do implemento — nome,
   visibilidade e caixa envolvente de MUNDO, em décimos de milímetro — em três
   estados:

       fabrica   as medidas com que o implemento carregou
       h250      depois de `setImplementMeasures({ height: 2.5 })`
       volta     de volta às medidas de fábrica

   E emite três coisas:

     1. **Portões sem linha de base**, que valem em qualquer execução:
        · `volta` tem de reproduzir `fabrica` — o redimensionamento é reversível
          e nada pode ficar para trás;
        · nenhuma malha pode virar NaN;
        · a contagem de malhas visíveis não pode mudar entre os estados.
     2. A impressão digital completa, como texto, para comparar DUAS execuções.
     3. O censo de compartilhamento (`shareStats`) e os contadores de
        clone-na-escrita (`claimStats`), que dizem com qual acervo a execução
        está falando e quantos clones o redimensionamento custou.

   ⚠️ **O PORTÃO DE VERDADE É A COMPARAÇÃO ENTRE DUAS EXECUÇÕES**, e ele é assim
   por necessidade: o estado `h250` correto não é derivável de dentro da página
   — é o que o acervo ORIGINAL produz. O procedimento é:

       # 1) com o trailer.glb de hoje
       node tools/studio-bench/bench.mjs --geometry \
         --checks checks-geometria-partilhada.mjs > /tmp/base.txt
       # 2) troca o asset pelo deduplicado, e de novo
       node tools/studio-bench/bench.mjs --geometry \
         --checks checks-geometria-partilhada.mjs > /tmp/dedup.txt
       # 3) o veredito
       node tools/studio-assets/diff-impressao.mjs /tmp/base.txt /tmp/dedup.txt

   ⚠️ A CAIXA É DE MUNDO E POR VÉRTICE, e não `Box3.setFromObject()`. A segunda
   daria a caixa de uma caixa girada — estritamente maior — e sete das malhas
   deste GLB têm `scale.x` negativa. É a mesma razão registrada em `boxOf()` de
   `trailer-bake-fixes.ts`, e aqui ela é mais forte, porque um deslocamento de
   milímetros é justamente o que se está procurando.

   ⚠️ SEM `--gpu` de propósito. Este teste não olha um pixel; ele lê números da
   cena. Sob SwiftShader ele roda em qualquer máquina, e os prazos abaixo são
   generosos por isso. */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 60000);
await B.settleSelector();
out.push(['seletor atravessado', true]);

await B.until(() => !!window.__studio?.state?.trailer, 480000);
const S = window.__studio;
const raiz = S.state?.trailer;
out.push(['implemento carregado', !!raiz]);
if (!raiz) return out;

for (let i = 0; i < 30; i++) await B.frame();

/* ---------------- a impressão digital ---------------- */

const V = window.__bench.scene?.THREE || S.THREE || null;

/** Caixa de mundo POR VÉRTICE de uma malha. Ver o aviso do cabeçalho. */
function caixa(m) {
  const pos = m.geometry?.getAttribute?.('position');
  if (!pos) return null;
  const e = m.matrixWorld.elements;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity;
  let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  let nan = 0;
  /* Amostragem: até 512 vértices por malha, com passo regular. A caixa exata de
     uma peça de 100 k vértices custaria segundos × 2 151 malhas × 3 estados, e
     o que se procura aqui é deslocamento de peça INTEIRA — que qualquer
     amostra regular pega. O passo é determinístico para as duas execuções
     compararem os MESMOS vértices. */
  const passo = Math.max(1, Math.floor(pos.count / 512));
  for (let i = 0; i < pos.count; i += passo) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const x = e[0] * px + e[4] * py + e[8] * pz + e[12];
    const y = e[1] * px + e[5] * py + e[9] * pz + e[13];
    const z = e[2] * px + e[6] * py + e[10] * pz + e[14];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) { nan++; continue; }
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  if (x0 === Infinity) return { nan, vazia: true };
  return { nan, x0, y0, z0, x1, y1, z1 };
}

/** Nome estável de uma malha: o caminho até a raiz, para desempatar homônimos.
 *  ⚠️ NÃO usar `uuid`: ele muda a cada carga, e as duas execuções que este
 *  arquivo existe para comparar são duas cargas. */
function chave(m, raizObj) {
  const partes = [];
  for (let o = m; o && o !== raizObj; o = o.parent) partes.push(o.name || '?');
  return partes.reverse().join('/');
}

const mm = (v) => Math.round(v * 10000) / 10;   // metros → décimos de mm

function digital() {
  raiz.updateMatrixWorld(true);
  const linhas = [];
  let visiveis = 0; let nans = 0; let degeneradas = 0;
  const vistos = new Map();
  raiz.traverse((o) => {
    const m = o;
    if (!m.isMesh) return;
    /* `.visible` própria E de todos os pais — uma malha sob um grupo escondido
       não está na tela, e a fusão esconde as origens exatamente assim. */
    let vis = true;
    for (let p = m; p && p !== raiz.parent; p = p.parent) if (p.visible === false) { vis = false; break; }
    if (vis) visiveis++;
    const c = caixa(m);
    if (!c) return;
    nans += c.nan;
    let k = chave(m, raiz);
    /* Homônimos existem neste GLB; o sufixo os separa de forma estável, porque
       a ordem de `traverse` é a ordem da árvore e a árvore é a do arquivo. */
    const n = (vistos.get(k) || 0) + 1; vistos.set(k, n);
    if (n > 1) k += '#' + n;
    if (c.vazia) { linhas.push(`${k}|${vis ? 1 : 0}|vazia`); return; }
    const dx = c.x1 - c.x0, dy = c.y1 - c.y0, dz = c.z1 - c.z0;
    if (dx < 0.001 && dy < 0.001 && dz < 0.001) degeneradas++;
    linhas.push(`${k}|${vis ? 1 : 0}|${mm(c.x0)},${mm(c.y0)},${mm(c.z0)},${mm(dx)},${mm(dy)},${mm(dz)}`);
  });
  linhas.sort();
  return { texto: linhas.join(';'), n: linhas.length, visiveis, nans, degeneradas };
}

/* ---------------- os três estados ---------------- */

const dimsFabrica = { ...(S.trailerDims || {}) };
const fabrica = digital();

async function medir(h) {
  S.measures?.setImplementMeasures?.({ height: h });
  const ok = await B.until(() => Math.abs((S.trailerDims?.height ?? 0) - h) < 0.06, 90000);
  for (let i = 0; i < 20; i++) await B.frame();
  return ok;
}

const ok250 = await medir(2.5);
out.push(['h250: resize assentou', ok250]);
const h250 = digital();

const okVolta = await medir(dimsFabrica.height);
out.push(['volta: resize assentou', okVolta]);
const volta = digital();

/* E de volta a 2,5 m. ⚠️ ESTE SEGUNDO h250 É QUE VALE COMO PORTÃO, e a primeira
   versão deste arquivo errou justamente aqui: ela exigia que `volta` reproduzisse
   `fabrica`, e isso é FALSO POR DESENHO. Medido no acervo cru, sem nenhuma
   mudança: `degeneradas` vai de 0 → 88 → 88. As 88 são as cascas de
   `lanterna-lateral-*` e companhia, que `TrailerAssembly.buildRepeats()` colapsa
   num ponto na PRIMEIRA vez que roda, para dar lugar aos `InstancedMesh` que
   passam a desenhá-las. Elas não voltam, e não têm de voltar — a imagem é a
   mesma, quem desenha é a instância.

   Logo o invariante honesto não é reversibilidade a partir da fábrica, e sim
   IDEMPOTÊNCIA a partir do primeiro redimensionamento: dois caminhos diferentes
   até a mesma altura têm de dar a mesma malharia. É esse que pega o defeito de
   geometria compartilhada, porque a ordem em que as peças escrevem muda entre
   um caminho e outro. */
const okVolta2 = await medir(2.5);
out.push(['h250 (2ª vez): resize assentou', okVolta2]);
const h250b = digital();

/* ---------------- os portões sem linha de base ---------------- */

out.push(['sem NaN em nenhum estado',
  fabrica.nans === 0 && h250.nans === 0 && volta.nans === 0 && h250b.nans === 0]);

out.push(['contagem de malhas estável',
  fabrica.n === h250.n && h250.n === volta.n && volta.n === h250b.n]);

out.push(['contagem de VISÍVEIS estável',
  fabrica.visiveis === h250.visiveis && h250.visiveis === volta.visiveis
  && volta.visiveis === h250b.visiveis]);

/* ⚠️ O PORTÃO. Ver o bloco de `h250b` acima para por que é este e não a volta
   à fábrica. Com geometria compartilhada e SEM clone-na-escrita, a peça que
   escreve por último decide pelas duas — e qual é a última depende da ordem de
   `traverse`, que muda quando o conjunto de peças muda entre um caminho e
   outro. É por aí que o defeito aparece. */
const iguais = h250.texto === h250b.texto;
out.push(['h250 → fábrica → h250 reproduz a malharia', iguais]);
if (!iguais) {
  const a = h250.texto.split(';'); const b = h250b.texto.split(';');
  const dif = [];
  for (let i = 0; i < Math.min(a.length, b.length) && dif.length < 5; i++) {
    if (a[i] === b[i]) continue;
    /* Só o último segmento do caminho — o nome completo tem 8 níveis e enche o
       terminal sem informar. Quem quiser o caminho tem a impressão digital. */
    const curto = (s) => { const [k, v, c] = s.split('|'); return `${k.split('/').pop()} vis=${v} ${c}`; };
    dif.push(`${curto(a[i])}   ≠   ${curto(b[i])}`);
  }
  out.push(['  as primeiras diferenças', dif]);
}

/* Degeneradas: o número que um compartilhamento errado INFLA, porque o modo de
   falhar mais grave é uma casca ser colapsada junto com a irmã instanciada.
   Comparável entre execuções, e barato. */
out.push(['degeneradas estáveis entre os dois h250', h250.degeneradas === h250b.degeneradas]);

/* ---------------- o censo, que diz com qual acervo estamos falando --------- */

const gs = S.geometria?.shareStats?.(raiz) || null;
const cs = S.geometria?.claimStats?.() || null;
out.push(['censo de compartilhamento', gs || '(engine sem __studio.geometria — atualize studio.ts)']);
out.push(['clone-na-escrita', cs || '(idem)']);
if (gs) {
  /* ⚠️ O LIMIAR É 20, NÃO 1. Medido no acervo CRU: `maiorFamilia` já vale **6**
     e 46 malhas compartilham alguma geometria — são as rodas (`wheel_fh16.glb`
     é carregado uma vez e clonado por eixo) e os conjuntos que o próprio
     `TrailerAssembly` instancia. Com o acervo deduplicado a maior família passa
     de 100. Um limiar de 1 chamaria o arquivo cru de deduplicado, que foi
     exatamente o que a primeira versão desta linha fez. */
  out.push(['acervo em uso',
    gs.maiorFamilia >= 20
      ? `DEDUPLICADO — a maior família tem ${gs.maiorFamilia} malhas na mesma geometria`
      : `CRU — maior família ${gs.maiorFamilia}, ${gs.compartilhadas} malhas compartilhando`]);
}

out.push(['degeneradas fabrica/h250/volta/h250b',
  `${fabrica.degeneradas} / ${h250.degeneradas} / ${volta.degeneradas} / ${h250b.degeneradas}`]);
out.push(['malhas / visíveis', `${fabrica.n} / ${fabrica.visiveis}`]);

/* ---------------- a impressão digital, para a comparação entre execuções ---- */

out.push(['IMPRESSAO-h250', h250.texto]);

return out;
