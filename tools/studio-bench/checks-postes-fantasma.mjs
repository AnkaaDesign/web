/* OS POSTES FANTASMA — a trava do defeito de 2026-08-17.
   ---------------------------------------------------------------------------
   O relato: *"às vezes do nada aparece alguns postes de iluminação perto do
   truck, precisa ser analisado e corrigido, não importa a cena que esteja, às
   vezes acontece, até parece estar atrelado ao modelo e não à cena"*.

   A CAUSA, e por que ela era intermitente. `applyLampLayout()` (scene/lamps.ts)
   abria com

       if (o.layout === 'set' && lampSiteGeo && lampSites.length) { … return; }

   e caía no ramo de baixo quando a condição falhava. Só que ela falha SEMPRE por
   um instante: em `applyToScene()` (scene/environment.ts) o `setLamps()` roda na
   linha 663 e o `applySet()` só na 697, e quem entrega as torres é o
   `scenery.ts` — depois de o `set.glb` (18 MB no distrito) baixar e ser medido.
   Nessa janela `lampSites` está vazio, a guarda falha, e o ramo `roadside`
   distribui OITO POSTES PROCEDURAIS em x = ±7,9 m e z = −87,5…+87,5 m. Os de
   índice 3 e 4 caem a 12,5 m da origem: em cima do caminhão.

   Os três sintomas do relato saem daí, um a um:
     · "às vezes" — com o cache quente a janela fecha antes de um quadro sair;
     · "não importa a cena" — vale para TODA cena que declare `layout: 'set'`;
     · "parece atrelado ao modelo" — um cavalo mais pesado disputa banda com o
       `set.glb` e ALARGA a janela. O modelo não causa o defeito; ele o expõe.

   E havia o caso PERMANENTE, que é o que este arquivo trava: `setLampSites(null,
   null)` — o set falhou, ou o cenário não tem torre nenhuma (ver scene/set.ts e
   scene/scenery.ts, que chamam exatamente isso) — deixava a fileira procedural
   em cena para sempre.

   ---------------------------------------------------------------------------
   POR QUE A JANELA NÃO É TESTADA AQUI, e é uma decisão e não uma omissão. Ela
   dura o download de um asset; um check que tentasse amostrar dentro dela
   passaria ou falharia conforme o cache e a rede, e um teste que erra sozinho é
   pior do que nenhum — ele ensina a ignorar a bancada. O que é DETERMINÍSTICO é
   o estado permanente, e ele é produzido aqui à mão com o mesmo
   `setLampSites(null, null)` que a produção usa. Se a regressão voltar, ela volta
   pelos dois caminhos ao mesmo tempo: os dois saem do mesmo `if`.

   A MEDIDA É DUPLA de propósito — ver `getLampInfo()`:
     `lampActive`           o que `applyLampLayout()` DECIDIU
     `lampFixturesVisible`  o que `updateLampFixtures()` DESENHOU
   Num cenário `set` os dois divergem legitimamente (a unidade fica ativa para
   levar o refletor à torre do cenário, e o mastro nosso fica invisível porque
   quem o desenha é o `.glb`). Uma medida só não separaria isso de um defeito. */
const out = [];
const B = window.__bench;

async function settle() {
  const overlay = document.getElementById('ts-selector');
  if (!overlay) return true;
  await B.until(() => overlay.classList.contains('hidden'), 480000);
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;

const L = S.lighting;
const info = () => (L.getLampInfo ? L.getLampInfo() : null);

out.push(['medida de poste no handle', !!info()]);
out.push(['  campos novos presentes',
  !!info() && typeof info().lampFixturesVisible === 'number'
  && typeof info().lampActive === 'number']);

/* ============ 1. O CENÁRIO QUE TRAZ AS PRÓPRIAS TORRES ============ */
out.push(['— distrito-industrial (layout: set) —', '']);
const env = S.catalog.getEnvironment('distrito-industrial');
if (env) await S.environment.applyEnvironment(env);
out.push(['set na cena', await B.until(() => !!S.scene.getObjectByName('ts-set'), 180000)]);
await B.frame(); await B.frame();

const carregado = info();
out.push(['  layout', carregado.lampLayout.layout]);
out.push(['  torres entregues pelo cenário', carregado.lampSites]);
out.push(['  unidades ativas', carregado.lampActive]);
out.push(['  fixtures NOSSOS visíveis', carregado.lampFixturesVisible]);
/* A trava do estado normal: com as torres no lugar, quem desenha o mastro é o
   `.glb` e nenhum poste nosso pode estar em cena. */
out.push(['nenhum poste procedural com o set carregado',
  carregado.lampFixturesVisible === 0]);
out.push(['  …e os refletores foram para as torres', carregado.lampActive > 0]);

/* ============ 2. O ESTADO PERMANENTE — a regressão de verdade ============
   `setLampSites(null, null)` é literalmente o que `scene/set.ts` e
   `scene/scenery.ts` chamam quando o cenário não entrega torre nenhuma. Antes da
   correção, esta chamada devolvia a fileira procedural em volta do caminhão e
   ela ficava lá. */
out.push(['— sem torres entregues (set falhou / não tem) —', '']);
if (typeof L.setLampSites === 'function') {
  L.setLampSites(null, null);
  await B.frame(); await B.frame();
  const vazio = info();
  out.push(['  layout continua', vazio.lampLayout.layout]);
  out.push(['  torres', vazio.lampSites]);
  out.push(['  unidades ativas', vazio.lampActive]);
  out.push(['  fixtures NOSSOS visíveis', vazio.lampFixturesVisible]);
  /* ⚠️ ESTA É A TRAVA. Antes da correção dava 8. */
  out.push(['ZERO postes com layout=set e nenhuma torre',
    vazio.lampFixturesVisible === 0]);
  out.push(['  e nenhuma unidade ativa (sem torre, sem refletor)',
    vazio.lampActive === 0]);
  /* Devolve o cenário ao estado bom para os checks seguintes da bateria. */
  if (env) await S.environment.applyEnvironment(env);
  await B.frame();
} else {
  out.push(['setLampSites alcançável pelo handle', false]);
}

/* ============ 3. O ESTÚDIO — enabled:false não pode acender nada ============ */
out.push(['— estúdio (lamps desabilitados) —', '']);
const estudio = S.catalog.getEnvironment('estudio');
if (estudio) {
  await S.environment.applyEnvironment(estudio);
  await B.frame(); await B.frame();
  const e = info();
  out.push(['  unidades ativas', e.lampActive]);
  out.push(['  fixtures NOSSOS visíveis', e.lampFixturesVisible]);
  out.push(['nenhum poste dentro do ciclorama', e.lampFixturesVisible === 0]);
} else {
  out.push(['cenário estúdio no catálogo', false]);
}

return out;
