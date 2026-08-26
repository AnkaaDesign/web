/* FOTOS DO ESTÚDIO — as poses das queixas de 2026-08-16.
   ===========================================================================
   Companheiro de `diag/checks-diag-0816.mjs`, que MEDE; este OLHA. Cada pose vira um
   PNG em `shots/`, e o par antes/depois é o que fecha um pedido de aparência —
   as três queixas daquele dia eram todas de leitura, não de fato.

       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-foto-0816.mjs

   AS POSES, e o que cada uma existe para mostrar:

     `rasante`      câmera baixa e longe, de frente — é a captura que veio com o
                    pedido. É a pose em que os painéis do teto sumiam (o difusor
                    sobrava 3 cm da moldura; ver ceiling.ts) e em que a junta
                    piso/parede virava uma barra acesa de 85 px (ver a rampa em
                    cyclorama.ts). As duas coisas aparecem no mesmo quadro.
     `quina`        câmera na diagonal, olhando o canto oposto: é a única pose em
                    que a quina VERTICAL entra no quadro inteira.
     `teto-rasante` a 3° de elevação — o pior caso para a luminária, porque a
                    lente é vista quase de lado.
     `fita`         colada na lateral do implemento, encarando a chave: é onde a
                    faixa refletiva estourava para laranja. Medida no pixel, o
                    par foi (255, 97, 70) antes e (241, 57, 47) depois — ver o
                    bloco do TETO MACIO em vehicle/retroreflect.ts. */
const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
await B.settleSelector();
await B.until(() => !!window.__studio, 300000);
const S = window.__studio;
if (!S) return [['sem __studio', false]];
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 300000)]);
out.push(['entrou no cenário estúdio', await B.enterStudio()]);
await new Promise((r) => setTimeout(r, 3500));

const THREE = S.THREE;
const camera = S.camera;
const controls = S.controls;

function poseAt(azDeg, elDeg, dist, ty) {
  const t = controls.target;
  const a = THREE.MathUtils.degToRad(azDeg);
  const e = THREE.MathUtils.degToRad(elDeg);
  t.y = ty;
  camera.position.set(
    t.x + Math.sin(a) * Math.cos(e) * dist,
    t.y + Math.sin(e) * dist,
    t.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(t);
  controls.update();
  S.lighting.invalidate();
}

async function foto(nome) {
  await B.frame();
  await new Promise((r) => setTimeout(r, 700));
  await B.frame();
  const r = await B.captureViewport({ quality: 'baixa', background: 'cena' });
  const blob = r && r.blob ? r.blob : r;
  if (!(blob instanceof Blob)) { out.push([nome, 'sem blob']); return; }
  out.push([nome, await new Promise((ok) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.readAsDataURL(blob);
  })]);
}

const base = S.lighting.getCameraPose();
out.push(['pose base', base]);
const D = Math.min(controls.maxDistance, 42);

poseAt(base.azimuthDeg, 7, D, 2.4);
await foto('0816-rasante');

poseAt(45, 6, D, 2.6);
await foto('0816-quina');

poseAt(135, 3, D, 3.4);
await foto('0816-teto-rasante');

poseAt(base.azimuthDeg - 92, 4, 14, 2.0);
await foto('0816-fita');

return out;
