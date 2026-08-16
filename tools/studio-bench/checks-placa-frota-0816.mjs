/* A FROTA INTEIRA, um retrato da placa por chassi.
   ===========================================================================
       DISPLAY= STUDIO_BENCH_GPU_ARGS='--use-gl=angle --use-angle=gles-egl --enable-gpu --ignore-gpu-blocklist' \
         node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-placa-frota-0816.mjs

   `checks-placa-0816.mjs` é o PORTÃO: ele prova as propriedades e olha seis
   chassis. Este é a COBERTURA: carrega os 49, confere que cada um recebeu a
   placa no sítio do manifesto, e tira um retrato apertado da dianteira de cada
   um. O pedido era *"garanta que ira cobrir todos os modelos"*, e a única forma
   de garantir isso é carregar todos os modelos.

   ⚠️ **NÃO CABE NUMA CORRIDA SÓ.** Medido: ~50 s por cabine (download de 9 a
   28 MB, parse Draco sob ANGLE, troca de cena e foto), ou seja ~40 min para as
   47 — e duas tentativas foram mortas pelo prazo antes de escrever uma linha,
   porque a bancada só imprime o relatório no FIM. Rode por fabricante:

       for m in scania volvo daf iveco mb man; do
         DISPLAY= STUDIO_BENCH_GPU_ARGS='...' node tools/studio-bench/bench.mjs \
           --gpu --geometry --checks checks-placa-frota-0816.mjs --marca $m
       done
       python3 tools/placa/contato.py

   Sem `--marca` ele tenta a frota inteira, que é o modo honesto e o que não
   termina. O filtro chega pela linha de comando via `window.__benchArgv` — ver
   `evalIn()` em `bench.mjs`.

   As fotos saem em `shots/frota-<n>-<arquivo>.png`; `tools/placa/contato.py`
   as recorta em volta da placa e monta a folha de contato, que é o que se olha
   de fato. */
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
await new Promise((r) => setTimeout(r, 2000));

const THREE = S.THREE;
const r3 = (v) => Math.round(v * 1000) / 1000;

/* Só o CAVALO no quadro: com o implemento engatado a câmera não chega perto da
   dianteira sem atravessar o baú, e o retrato é da dianteira. */
S.models.setVehicleView?.('cab');
await B.frame();

const argv = window.__benchArgv || [];
const marca = argv.includes('--marca') ? argv[argv.indexOf('--marca') + 1] : null;
out.push(['fabricante pedido', marca || '(todos)']);

const alvos = [];
const semCard = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  if (marca && mk.id !== marca) continue;
  for (const m of (mk.models || [])) {
    for (const c of (m.chassis || [])) {
      if (!c.file) continue;
      /* ⚠️ UM CHASSI "Em breve" NÃO SE CARREGA — o card dele nasce `disabled` e
         `applyChoice()` não tem por onde entrar. Ele continua tendo entrada no
         manifesto (o dia em que for liberado, a placa já está medida), mas
         mandá-lo para o laço custava **300 s de espera cada um** e foi o que
         estourou a primeira corrida desta bancada. São dois:
         `scania-r-2016/6x2t` e `vw-constellation/6x2-tl`. */
      if (c.available === false) { semCard.push(c.file.split('/').pop()); continue; }
      alvos.push({ mk, m, c });
    }
  }
}
out.push(['chassis no catálogo', alvos.length + semCard.length]);
out.push(['fotografáveis', alvos.length]);
out.push(['"Em breve" (só manifesto)', semCard.length ? semCard.join(' | ') : 'nenhum']);
/* A cobertura DELES é estática: o manifesto tem de conhecer os dois. */
out.push(['"Em breve" no manifesto',
  semCard.every((f) => !!S.placa.sitio('models/trucks/' + f))]);

/**
 * Põe a placa no MEIO do quadro.
 *
 * ⚠️ MIRAR NÃO BASTA, e foi assim que a primeira folha de contato saiu com
 * quatro fotos de grade e nenhuma placa. O estúdio recusa câmera colada: há
 * `minDistance` (uma esfera de ~1 raio do rig em volta da mira) e a expulsão de
 * corpo, que reposicionam a câmera a cada `controls.update()`. Pedir 1,15 m da
 * placa devolve ~4 m, e o alvo pedido escorrega para fora do centro — em quatro
 * modelos a placa saiu inteira por baixo da borda.
 *
 * Então em vez de pedir, VERIFICA: projeta a placa, mede o quanto ela está fora
 * do centro em NDC e translada mira e câmera JUNTAS (o que é um PAN, não um
 * zoom, e por isso não briga com `minDistance`). Três iterações bastam; se a
 * caixa de órbita segurar o alvo, o laço para no cap em vez de oscilar.
 */
function mirar(mundo) {
  const t = S.controls.target;
  t.set(mundo.x, mundo.y, mundo.z);
  /* De frente e um pouco de cima: é a pose em que se vê ao mesmo tempo se a
     placa está no lugar E se ela está encostada (uma placa flutuando aparece
     pela sombra e pela fresta do berço). */
  S.camera.position.set(mundo.x + 0.10, mundo.y + 0.22, mundo.z - 1.15);
  S.camera.lookAt(t);
  S.controls.update();

  const alvo = new THREE.Vector3(mundo.x, mundo.y, mundo.z);
  const dir = new THREE.Vector3(), cima = new THREE.Vector3();
  for (let k = 0; k < 3; k++) {
    S.camera.updateMatrixWorld();
    S.camera.updateProjectionMatrix();
    const p = alvo.clone().project(S.camera);
    if (Math.abs(p.x) < 0.02 && Math.abs(p.y) < 0.02) break;
    const d = S.camera.position.distanceTo(S.controls.target);
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(S.camera.fov) / 2) * d;
    const w = h * S.camera.aspect;
    dir.setFromMatrixColumn(S.camera.matrixWorld, 0).multiplyScalar(p.x * w / 2);
    cima.setFromMatrixColumn(S.camera.matrixWorld, 1).multiplyScalar(p.y * h / 2);
    S.controls.target.add(dir).add(cima);
    S.camera.position.add(dir).add(cima);
    S.controls.update();
  }
  S.lighting.invalidate();
}

async function foto(nome, mundo) {
  await B.frame();
  await new Promise((r) => setTimeout(r, 450));
  /* ⚠️ MIRA DE NOVO ANTES DE DISPARAR. Trocar de MODELO (não só de chassi) faz
     o estúdio reenquadrar a cena, e o reenquadramento chega DEPOIS da pose que
     este check pediu — ele acontece durante o assentamento acima. O sintoma na
     folha de contato: em seis quadros, todos o primeiro chassi de um modelo
     novo, a foto saiu na grade e a placa ficou fora do quadro. */
  if (mundo) mirar(mundo);
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

let n = 0, semPlaca = [], foraDoManifesto = [];
for (const a of alvos) {
  n++;
  const nome = a.c.file.split('/').pop();
  const escolha = {
    envId: 'estudio',
    manufacturerId: a.mk.id, modelId: a.m.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  };
  const ok = await S.applyChoice(escolha, { curtain: false });
  if (!ok) { semPlaca.push(nome + ' (applyChoice)'); continue; }
  /* 120 s e não 300: o maior `.glb` do acervo tem 28 MB e vem do disco local.
     O prazo generoso existia para o caso que não existe mais — um chassi que
     nunca carrega —, e ele custava cinco minutos de espera por engano. */
  const chegou = await B.until(() => (S.models.state.cabDef?.file || '') === a.c.file, 120000);
  if (!chegou) { semPlaca.push(nome + ' (não carregou)'); continue; }
  await B.frame();
  const info = S.placa.info();
  const st = S.placa.sitio(a.c.file);
  if (!info.cavalo || !st) { semPlaca.push(nome); continue; }
  const d = info.cavalo.local.map((v, k) => Math.abs(v - st.pos[k]));
  if (!d.every((v) => v < 1e-4)) foraDoManifesto.push(nome);
  out.push([`${String(n).padStart(2, '0')} ${nome}`,
    `y=${r3(st.alturaSolo)} vão=${Math.round((st.vao || 0) * 1000)}mm ${st.fonte}`
    + ` · mundo ${info.cavalo.mundo.x.toFixed(3)}, ${info.cavalo.mundo.y.toFixed(3)}`]);
  mirar(info.cavalo.mundo);
  await foto(`frota-${String(n).padStart(2, '0')}-${nome.replace(/\.glb$/, '')}`, info.cavalo.mundo);
}

out.push(['cavalos com placa', n - semPlaca.length]);
out.push(['sem placa', semPlaca.length ? semPlaca.join(' | ') : 'nenhum']);
out.push(['fora do manifesto', foraDoManifesto.length ? foraDoManifesto.join(' | ') : 'nenhum']);
return out;
