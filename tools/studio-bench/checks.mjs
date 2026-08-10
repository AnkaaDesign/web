/* As verificações, avaliadas DENTRO da página.
   ===========================================================================
   Este arquivo é lido como TEXTO por bench.mjs e injetado num `Runtime.evaluate`
   assíncrono — por isso ele é um corpo de função, sem `import` e sem `export`, e
   termina num `return`. Ele fala com `window.__bench` (montado por boot.ts) e
   com `window.__studio` (o handle de depuração que o engine já instala).

   Cada linha do relatório é um PAR [nome, valor]. `true` passa, `false` falha,
   e qualquer outra coisa é informação — números que ajudam a entender uma falha
   vizinha, nunca um teste disfarçado. */

const B = window.__bench;
const sc = B.scene;
/* `__studio` só existe DEPOIS do boot, e o boot depende do seletor ser
   atravessado lá embaixo — por isso ele é lido como função e não capturado
   agora numa constante que ficaria eternamente vazia. */
const S = () => window.__studio || {};
const out = [];
const ok = (name, v) => out.push([name, v]);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* O boot passa pelo seletor. Uma primeira visita abre nele e fica esperando um
   clique; a bancada não clica — ela fecha o seletor escolhendo o padrão, que é
   o mesmo caminho de um visitante de volta. */
await B.until(() => !!document.querySelector('.truck-studio-root'), 15000);
const root = document.querySelector('.truck-studio-root');
ok('a subárvore do estúdio montou', !!root);

/* O seletor abre e espera um clique — ver settleSelector(). */
await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
ok('o seletor abriu', true);
ok('o seletor foi atravessado', await B.settleSelector());

/* Espera o engine terminar o boot (o handle de console é a última coisa que
   ele instala). Com `*.glb` bloqueado, `runApply` FALHA e mantém a cena
   anterior de pé — que é o caminho de erro documentado, e é por ele que
   passamos aqui de propósito. */
const booted = await B.until(() => !!window.__studio, 60000);
ok('o engine bootou (window.__studio)', booted);
if (!booted) return out;

const hasStandIn = B.standIn();
ok('caixa substituta no RIG', hasStandIn);
await B.frame();

/* ---------------- bloco 1 · tela cheia ---------------- */
const btnFull = document.getElementById('btn-full');
ok('botão de tela cheia existe', !!btnFull);
ok('botão de tela cheia visível (API presente)', !!btnFull && !btnFull.classList.contains('hidden'));
ok('ordem dos controles de vista',
  [...document.querySelectorAll('#view-controls .ts-vbtn')].map((b) => b.id).join(','));

/* ---------------- bloco 3 · giro de apresentação ---------------- */
const controls = S().controls;
sc.setTurntable(false);
/* Descentra a mira e aproxima a câmera — ou seja, reproduz exatamente os dois
   defeitos relatados — e confere se ligar o giro os desfaz. */
const aim0 = controls.target.clone();
controls.target.x += 3;
const dir = controls.object.position.clone().sub(controls.target).normalize();
controls.object.position.copy(controls.target).addScaledVector(dir, controls.minDistance + 0.1);
const distBefore = controls.object.position.distanceTo(controls.target);
const offBefore = controls.target.distanceTo(aim0);

sc.setTurntable(true, { speed: 1.2 });
ok('pan congelado durante o giro', controls.enablePan === false);
ok('período = 60/velocidade', near(sc.turntablePeriod(), 50, 0.01));
sc.setTurntablePeriod(12);
ok('período ajustável por segundos', near(sc.turntablePeriod(), 12, 0.01));

for (let i = 0; i < 90; i++) await B.frame();
const offAfter = controls.target.distanceTo(aim0);
const distAfter = controls.object.position.distanceTo(controls.target);
ok('mira recentrada', offAfter < offBefore * 0.1);
ok('  desvio da mira antes → depois (m)', [+offBefore.toFixed(2), +offAfter.toFixed(3)]);
ok('câmera recuou até o piso de enquadramento', distAfter > distBefore * 1.5);
ok('  distância antes → depois (m)', [+distBefore.toFixed(2), +distAfter.toFixed(2)]);
ok('o giro andou de verdade', Math.abs(sc.turntableTravel()) > 0.05);

sc.setTurntable(false);
ok('pan devolvido ao desligar', controls.enablePan === true);

/* ---------------- bloco 4 · estúdio, fundo e recorte ----------------
   ENTRA NO CENÁRIO, não só no preset — ver `enterStudio()` em boot.ts. É o que
   constrói a sala e desliga os postes, e sem isso metade dos testes abaixo
   passaria sem ter medido nada. */
ok('entrou no cenário Estúdio', await B.enterStudio());
await B.frame();
ok('preset de estúdio reconhecido', sc.isStudioPreset() === true);

const hud = document.getElementById('ts-hud');
ok('HUD trocou para a face de estúdio', !!hud && hud.classList.contains('is-studio'));
const shown = (sel) => {
  const n = hud && hud.querySelector(sel);
  return !!n && !n.classList.contains('hidden');
};
ok('face estúdio: hora escondida', !shown('.ts-hud-row--hour'));
ok('face estúdio: clima escondido', !shown('.ts-hud-row--weather'));
ok('face estúdio: fundo visível', shown('.ts-hud-row--backdrop'));
ok('face estúdio: preenchimento visível', shown('.ts-hud-row--fill'));
ok('face estúdio: recorte visível', shown('.ts-hud-row--rim'));
ok('face estúdio: difusão visível', shown('.ts-hud-row--soft'));
ok('face estúdio: temperatura visível', shown('.ts-hud-row--temp'));
ok('4 pastilhas de fundo', (hud?.querySelectorAll('.ts-hud-row--backdrop .ts-hud-tile') || []).length === 4);

/* `getRig()` DEVOLVE O MESMO OBJETO SEMPRE — `lerpRig()` escreve nele no lugar.
   Guardar a referência e comparar depois compara o objeto consigo mesmo, e foi
   assim que a primeira versão destes testes "passou" três medições idênticas.
   Então: fotografa-se em NÚMEROS. */
const snap = () => {
  const r = sc.getRig();
  return {
    albedo: r.cycloramaAlbedo, rim: r.rimIntensity, exposure: r.exposure,
    hemi: r.hemiIntensity, ambient: r.ambientIntensity, shadow: r.shadowRadius,
    key: r.keyColor.clone(),
  };
};

sc.setStudioParams({ backdrop: 'preto' }, { animate: false });
await B.frame();
const preto = snap();
sc.setStudioParams({ backdrop: 'branco' }, { animate: false });
await B.frame();
const branco = snap();
ok('o fundo muda o albedo do ciclorama no rig', branco.albedo > preto.albedo);
ok('  albedo preto → branco', [+preto.albedo.toFixed(2), +branco.albedo.toFixed(2)]);
ok('preto é SEM SALA (albedo exatamente 0)', preto.albedo === 0);
ok('um fundo claro sobe o recorte', branco.rim > preto.rim);
ok('um fundo claro baixa a exposição', branco.exposure < preto.exposure);

sc.setStudioParams({ backdrop: 'cinza-escuro', fill: 1, rim: 1, softness: 1 }, { animate: false });
await B.frame();
const base = snap();
sc.setStudioParams({ fill: 0 }, { animate: false });
await B.frame();
ok('preenchimento a 0 zera hemi e ambiente',
  sc.getRig().hemiIntensity === 0 && sc.getRig().ambientIntensity === 0);
sc.setStudioParams({ fill: 4 }, { animate: false });
await B.frame();
ok('preenchimento a 400% quadruplica o hemi', near(sc.getRig().hemiIntensity, base.hemi * 4, 1e-6));
ok('a faixa do preenchimento passa de 100%', sc.STUDIO_RANGE.fill[1] >= 4);
sc.setStudioParams({ fill: 1 }, { animate: false });

/* ---- temperatura de cor ---- */
sc.setStudioParams({ temp: sc.TEMP_NEUTRAL }, { animate: false });
await B.frame();
const neutro = snap();
ok('6500 K não tinge nada (a chave fica neutra)',
  near(neutro.key.r, neutro.key.g, 1e-6) && near(neutro.key.g, neutro.key.b, 1e-6));
sc.setStudioParams({ temp: 2700 }, { animate: false });
await B.frame();
const quente = snap();
ok('2700 K esquenta a chave', quente.key.r > quente.key.b * 1.2);
sc.setStudioParams({ temp: 9000 }, { animate: false });
await B.frame();
const frio = snap();
ok('9000 K esfria a chave', frio.key.b > frio.key.r);
sc.setStudioParams({ temp: sc.TEMP_NEUTRAL }, { animate: false });
await B.frame();

/* ---- a sala acompanha a órbita (o "estúdio parece pequeno" + a câmera
        se reposicionando sozinha eram o MESMO conflito) ---- */
sc.setStudioParams({ backdrop: 'cinza-escuro' }, { animate: false });
await B.frame();
const room = sc.scene.getObjectByName('ts-ciclorama');
const shell = room && room.getObjectByName('ciclorama-shell');
ok('a sala de ciclorama está de pé', !!shell && !!room.visible);
if (shell) {
  shell.geometry.computeBoundingBox();
  const wall = Math.max(shell.geometry.boundingBox.max.x, shell.geometry.boundingBox.max.z);
  /* O DEFEITO QUE ISTO PEGA: enquanto a parede era uma constante (50 m) e a
     órbita passou a chegar a ~38 m + folga, a caixa de interior ficava MENOR que
     `maxDistance` e as duas regras brigavam por quadro — que é a "câmera se
     reposicionando sozinha". A parede tem de conter a órbita, sempre. */
  ok('a parede está além do alcance máximo da órbita', wall > controls.maxDistance);
  ok('  parede / maxDistance (m)', [+wall.toFixed(1), +controls.maxDistance.toFixed(1)]);
}

/* ---- os postes não entram no estúdio ---- */
let poles = 0;
sc.scene.traverse((o) => {
  if (o.visible && /lamp|poste/i.test(o.name || '') && o.isMesh) poles++;
});
ok('nenhum poste de luz visível no estúdio', poles === 0);
ok('  malhas de poste visíveis', poles);

/* ---- o recorte transparente ---- */
sc.setTurntable(false);
await B.frame();
const cut = await B.captureViewport({ quality: 'low', background: 'recorte' });
const cen = await B.alphaCensus(cut.blob);
ok('recorte: saiu em PNG', cut.blob.type === 'image/png');
ok('recorte: o fundo é transparente', cen.clear > cen.total * 0.2);
ok('recorte: o veículo é opaco', cen.solid > cen.total * 0.02);
ok('  pixels transparentes / opacos / parciais', [cen.clear, cen.solid, cen.partial]);

const full = await B.captureViewport({ quality: 'low', background: 'cena' });
const cen2 = await B.alphaCensus(full.blob);
ok('cena: nenhum pixel transparente', cen2.clear === 0);

/* A cena TEM de voltar exatamente como estava — o recorte esconde metade do
   grafo, e um `finally` que esquecesse algo deixaria o estúdio sem ciclorama. */
await B.frame();
ok('a cena voltou: o plano de sombra saiu',
  !sc.scene.children.some((c) => c.name === 'ts-capture-shadow'));

/* ---- o painel da câmera só fecha quando deve ---- */
const shotBtn = document.getElementById('btn-shot');
shotBtn.click();
await B.frame();
const menu = document.getElementById('ts-shotmenu');
ok('o painel de captura abriu', !!menu && !menu.classList.contains('hidden'));
menu.querySelector('.ts-shotseg__btn[data-bg="recorte"]')?.click();
await B.frame();
ok('escolher o fundo NÃO fecha o painel', !menu.classList.contains('hidden'));
menu.querySelector('.ts-shotmenu__item[data-q="high"]')?.click();
await B.frame();
ok('escolher a qualidade NÃO fecha o painel', !menu.classList.contains('hidden'));
ok('existe o botão "Capturar imagem"', !!menu.querySelector('.ts-shotgo'));
ok('o rótulo do botão', menu.querySelector('.ts-shotgo')?.textContent || '');
ok('sem texto técnico de ladrilho no painel',
  !/ladrilho|mosaico/i.test(menu.textContent || ''));
shotBtn.click();
await B.frame();
ok('o trigger fecha o painel', menu.classList.contains('hidden'));

/* A TELA DE ERRO DE BOOT É ARTEFATO DA BANCADA, não da aplicação: com `*.glb`
   bloqueado, `runApply({first:true})` falha e traz o painel de bootstrap de
   volta com a mensagem — que é o caminho de erro correto e documentado. Ele
   cobre a tela inteira e tornaria inútil qualquer `--shot`. Aposentá-lo aqui,
   no fim das verificações, não afeta medição nenhuma acima. */
document.getElementById('loading')?.classList.add('hide');
document.getElementById('ts-selector')?.classList.add('hidden');
await B.frame();

return out;
