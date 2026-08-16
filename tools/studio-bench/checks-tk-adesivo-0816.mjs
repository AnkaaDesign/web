/* O HALO BRANCO DOS ADESIVOS DO THERMO KING — antes e depois, na placa.
   ===========================================================================
       DISPLAY= STUDIO_BENCH_GPU_ARGS='--use-gl=angle --use-angle=gles-egl --enable-gpu --ignore-gpu-blocklist' \
         node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-tk-adesivo-0816.mjs

   Relato de 2026-08-16: *"as bordas ficam brancas, fica estranho"*. O conserto é
   de ASSET (`tools/glb-texopt/sangra_alfa.py`), e o juiz tem de ser o
   renderizador de verdade: a orla nasce da filtragem, e nenhuma leitura do PNG
   a mostra.

   Duas medidas, e as duas são de pixel:

     1. a FOTO do emblema, para olhar;
     2. o CENSO da orla — quantos pixels do quadro são claros (≥ 200 nos três
        canais) dentro da região do emblema. A carcaça é cinza-escura e o logo é
        preto e ciano; pixel claro ali é halo, e o número tem de cair. */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio?.state?.tk, 180000);
for (let i = 0; i < 30; i++) await B.frame();

const S = window.__studio;
const THREE = S.THREE;
const tk = S.state.tk;
if (!tk) { out.push(['⚠️ ABORTADO', 'sem Thermo King em cena']); return out; }

/* O CAVALO SAI: ele fica encostado na testeira e entraria no quadro. */
S.models.setVehicleView('trailer');
/* ⚠️ E A CARCAÇA VAI PARA O PRETO, que é a condição do relato. Na chapa BRANCA
   de fábrica o halo é invisível por construção — ele É branco. A captura do
   usuário mostrava a unidade pintada de escuro, e é só ali que a orla aparece;
   um teste sobre o branco passaria com o defeito de pé. */
S.trim.set('thermoking', { color: '#141414' });
for (let i = 0; i < 10; i++) await B.frame();

const R = S.renderer, cena = S.scene;
const W = R.domElement.width, H = R.domElement.height;

tk.updateWorldMatrix(true, true);
const b = new THREE.Box3().setFromObject(tk);
const c = b.getCenter(new THREE.Vector3());
const tam = b.getSize(new THREE.Vector3());

/* Ortográfica de frente, enquadrando a carcaça inteira: a mesma vista da
   captura do usuário, sem depender de distância nem de lente. */
const meiaA = Math.max(tam.y, tam.x / (W / H)) * 0.52;
const cam = new THREE.OrthographicCamera(
  -meiaA * (W / H), meiaA * (W / H), meiaA, -meiaA, 0.01, 40);
cam.position.copy(c).add(new THREE.Vector3(0, 0, 6).transformDirection(tk.matrixWorld));
cam.up.copy(new THREE.Vector3(0, 1, 0).transformDirection(tk.matrixWorld));
cam.lookAt(c);
cam.updateMatrixWorld(true);

/* ⚠️ `toDataURL`/`readPixels` TÊM de vir na MESMA tarefa síncrona do
   `render()`: depois de um `await` o buffer volta limpo. Ver a nota da bancada
   em `studio-estudio-quina-fita-0816`. */
R.render(cena, cam);
const url = R.domElement.toDataURL('image/png');

/* O CENSO SAI DO MESMO PNG, e não de `readPixels`: o buffer do WebGL é de baixo
   para cima e a janela abaixo é dada nas coordenadas da IMAGEM, que é o que se
   olha. Um `flipY` a mais ou a menos aqui mediria o céu. */
const bmp = await createImageBitmap(await (await fetch(url)).blob());
const cnv = document.createElement('canvas');
cnv.width = bmp.width; cnv.height = bmp.height;
const ctx = cnv.getContext('2d', { willReadFrequently: true });
ctx.drawImage(bmp, 0, 0);

/* A JANELA É O EMBLEMA, e não o quadro inteiro. O quadro traz as chapas
   BRANCAS do baú nas duas bordas, e elas sozinhas são ~22 % de pixel claro —
   um número que não se move com o conserto e afogaria o que se move. */
const jx = Math.round(bmp.width * 0.21), jw = Math.round(bmp.width * 0.19);
const jy = Math.round(bmp.height * 0.23), jh = Math.round(bmp.height * 0.22);
const d = ctx.getImageData(jx, jy, jw, jh).data;
/* O HALO É CINZA CLARO, e a métrica tem de dizer isso nas duas metades.
   ---------------------------------------------------------------------------
   "Claro" sozinho não serve: o ciano do logo tem luminância 146, mais alta que
   boa parte da orla, e contá-lo faria o número não se mover. "Neutro" sozinho
   também não: a carcaça preta é neutra. O halo é o que é CLARO **e** NEUTRO —
   o branco do vazio da textura sangrando por cima do traço preto do emblema.
   Medido na foto de antes: 0,78 % da janela, contra 3,0 % de ciano. */
let halo = 0, ciano = 0, escuros = 0, total = 0;
for (let i = 0; i < d.length; i += 4) {
  total++;
  const r = d[i], g = d[i + 1], b2 = d[i + 2];
  const lum = (r + g + b2) / 3;
  const gama = Math.max(r, g, b2) - Math.min(r, g, b2);
  if (lum >= 125 && gama < 45) halo++;
  else if (gama >= 80) ciano++;
  else if (lum < 30) escuros++;
}
out.push(['janela do emblema (px)', total]);
out.push(['HALO — claro e neutro (lum ≥125, gama <45)', halo]);
out.push(['fração de halo %', +((halo / Math.max(1, total)) * 100).toFixed(3)]);
out.push(['ciano do logo (gama ≥80) — não pode cair', ciano]);
out.push(['preto do traço (lum <30)', escuros]);
out.push(['tk-emblema', url]);
out.push(['tk-emblema-zoom', (() => {
  const z = document.createElement('canvas');
  z.width = jw * 4; z.height = jh * 4;
  const zc = z.getContext('2d');
  zc.imageSmoothingEnabled = false;
  zc.drawImage(bmp, jx, jy, jw, jh, 0, 0, z.width, z.height);
  return z.toDataURL('image/png');
})()]);

return out;
