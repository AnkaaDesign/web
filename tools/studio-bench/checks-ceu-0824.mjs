/* O CÉU DEPOIS DAS 19:00 — a travessia dos dois plates e o degrau de HDR.
   ---------------------------------------------------------------------------
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-ceu-0824.mjs

   DUAS MUDANÇAS DE 2026-08-24, e uma trava para cada defeito que elas fecham.

   ═══ 1. A TRAVESSIA ERA UM DEGRAU, E ACABAVA ANTES DAS 19:00 ═══

   `skyblend.ts` recebia `nightness` e aplicava `smoothstep(n, 0,25…0,95)`. As
   duas saturações se somavam — `nightness` satura no sol a −14° (19:20) e a
   curva em n = 0,95 (**18:55**) —, então:

     · a travessia inteira cabia entre 17:45 e 18:55, ou seja **5 paradas** de um
       controle que tem 72;
     · e de 19:00 a 24:00 o céu era **bit-a-bit o mesmo** — 20 paradas mortas.

   O peso passou a sair da ALTITUDE do sol (`skyMixAt()`, banda +12°…−30°), que
   continua caindo até −70,6° à meia-noite.

   ⚠️⚠️ E A PRIMEIRA CORREÇÃO ERROU DE ALVO — o portão nasceu exigindo a coisa
   errada e por isso APROVOU o defeito seguinte. A banda foi para +12°…−30°,
   espalhando a travessia até as 20:15, e o dono reprovou na foto:

       *"mesmo estando escuro ainda mostra nuvens, por isso pedi outra hdri,
        um realmente de noite"*

   O plate de noite NÃO tem nuvem (renderizado sozinho é céu limpo com lua e
   estrelas). As nuvens eram do plate de **DIA**, que é um POENTE estático — e a
   banda larga deixava **44 % dele no ar às 19:00**.

   ⚠️ **A TRAVA QUE FALTAVA, e é a mais importante deste arquivo:** neste par não
   existe plate de crepúsculo, então **todo peso residual do lado de dia é uma
   foto de poente sobreposta à noite**, e `backgroundIntensity` escala os dois
   lados por igual — escurecer não apaga a nuvem. Logo a travessia tem de ACABAR
   quando a noite começa. `mix(19:00) >= 0,95` é essa trava, e ela vale mais que
   qualquer medida de suavidade.

   ⚠️ E A SUAVIDADE NÃO VEM DA LARGURA DA BANDA — VEM DO PASSO DO CONTROLE. A
   janela é fixa (uma hora e vinte); com passo de 0,25 h são quatro paradas, e
   quatro paradas para ir de 0 a 1 são saltos de 0,25 faça-se a curva que se
   fizer. `ui/hud.ts` passou a oferecer 5 minutos, e o maior salto caiu de 0,363
   para 0,100. **Por isso a varredura abaixo anda de 5 em 5 minutos: ela tem de
   medir o que o dedo do usuário produz, não uma régua inventada aqui.**

   ⚠️ AS TRAVAS NÃO SÃO A MESMA COISA DITA VÁRIAS VEZES, e é por isso que são
   várias: uma curva pode ser CONTÍNUA e ainda deixar poente dentro da noite;
   pode chegar à noite na hora certa e ter um salto no meio; e pode ser as duas
   e ainda assim cravar a lua num céu de poente, que é o único artefato visual
   que este arquivo pode produzir.

   ⚠️ A TRAVA DA LUA É A QUE NÃO PODE AFROUXAR. O pico do plate de noite é
   55 633 (a lua, três texels) contra 33 do sol domado do `_puresky` de dia — o
   cabeçalho de `skyblend.ts` mede os dois. Qualquer peso não desprezível antes
   de o poente ceder crava um ponto branco num céu laranja. O teto de 18:00 é o
   que a curva ANTIGA entregava (0,083): a banda nova tem de ser melhor ou igual,
   nunca pior, e hoje ela entrega 0,038.

   ═══ 2. `hdrVariant` ERA UMA LINHA DE TABELA E MAIS NADA ═══

   O perfil pedia `@1k` no nível Baixo desde 2026-08-14, mas a peneira de
   `coldProfile()` só emite um sufixo quando o MANIFESTO declara que o arquivo
   existe — e `environments.json` declarava só `@ktx2`/`@ktx2-1k`. Os arquivos
   também não existiam. Resultado: `hdrVariant()` devolvia `''` nos TRÊS níveis
   e o Baixo carregava os mesmos 75,5 MB do Alto.

   ⚠️ E ESSE É EXATAMENTE O MODO DE FALHA QUE UM PORTÃO DE CONFIGURAÇÃO NÃO PEGA.
   Conferir que `cold().hdrVariant === '@1k'` prova que a TABELA diz `@1k`, que é
   o que já era verdade quando o degrau estava morto. A única prova que vale é o
   TAMANHO DO ALVO DE MISTURA: `skyblend` aloca o alvo no tamanho da FONTE, então
   `getSkyBlend().tamanho` responde qual arquivo de fato desceu — 2048×1024 ou
   1024×512. É a diferença entre perguntar o que o código pretende e o que ele
   fez. */
const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);

async function settle() {
  const overlay = document.getElementById('ts-selector');
  if (!overlay) return true;
  for (let step = 0; step < 12; step++) {
    if (overlay.classList.contains('hidden')) return true;
    const cards = [...overlay.querySelectorAll('.ts-card:not([disabled])')];
    if (!cards.length) break;
    const local = cards.find((c) => /volvo/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;

const env = S.catalog.getEnvironment('distrito-industrial');
out.push(['cenário com par de céus', !!(env && env.hdri && env.hdriNight)]);
if (env) await S.environment.applyEnvironment(env);
out.push(['par de céus montado', await B.until(() => !!S.lighting.getSkyBlend().ativo, 240000)]);
await B.frame(); await B.frame();

const r3 = (v) => Math.round(v * 1000) / 1000;

/* ---------------------------------------------------------------------------
   A VARREDURA DO RELÓGIO — 17:00 a 24:00 nas paradas que o controle oferece.

   `setHourOfDay(h)` sem `animate` é o que o próprio controle faz (ver hud.ts:
   "no tween: must track the thumb"), então isto mede a MESMA sequência de pesos
   que o usuário produz arrastando. Dois quadros por parada porque `applyRig()`
   roda por quadro e é ele quem chama `updateSkyBlend()`. */
const PASSO = 1 / 12;          // 5 min — o passo que `ui/hud.ts` oferece
const amostras = [];
for (let h = 17; h <= 24.0001; h += PASSO) {
  S.lighting.setHourOfDay(h);
  await B.frame(); await B.frame();
  amostras.push({ h, peso: S.lighting.getSkyBlend().peso });
}
/* O MAIS PRÓXIMO, e não igualdade exata: `h` acumula em ponto flutuante ao longo
   de 85 iterações, e um `find` exato devolveria `undefined` — que só apareceria
   como um TypeError no meio do relatório. */
const em = (h) => amostras.reduce((m, a) =>
  (Math.abs(a.h - h) < Math.abs(m.h - h) ? a : m), amostras[0]);

/* ---- 1. CONTINUIDADE: quantas paradas mexem no céu, e qual é o maior salto ---- */
let paradas = 0, maiorSalto = 0, ondeSalto = 0;
for (let i = 1; i < amostras.length; i++) {
  const d = Math.abs(amostras[i].peso - amostras[i - 1].peso);
  if (d > 1e-4) paradas++;
  if (d > maiorSalto) { maiorSalto = d; ondeSalto = amostras[i].h; }
}
out.push(['paradas de 5 min que mudam o céu', paradas]);
out.push(['≥ 12 paradas', paradas >= 12]);
out.push(['maior salto entre paradas vizinhas (0,363 no passo/curva originais)',
  r3(maiorSalto) + ' às ' + r3(ondeSalto) + ' h']);
out.push(['nenhum salto acima de 0,12', maiorSalto <= 0.12]);

/* ---- 2. ⚠️ SEM POENTE DENTRO DA NOITE — a trava que a 1ª correção não tinha ----
   O lado "dia" do par é um POENTE ESTÁTICO com cúmulo aceso por baixo, e
   `backgroundIntensity` escala os dois lados por igual: escurecer NÃO apaga a
   nuvem. Então "quanto do plate de dia ainda está no ar" é literalmente "quanta
   nuvem de poente aparece no céu de noite", e o teto tem de ser apertado. */
const p19 = em(19).peso, p1915 = em(19.25).peso, p21 = em(21).peso;
out.push(['peso às 19:00 (a 1ª correção deixou 0,556)', r3(p19)]);
out.push(['às 19:00 já é o plate de NOITE', p19 >= 0.95]);
out.push(['resto de POENTE no céu às 19:00', r3(1 - p19)]);
out.push(['≤ 5 % de plate de dia às 19:00', (1 - p19) <= 0.05]);
out.push(['a noite chega inteira até as 19:15', p1915 >= 0.999]);
out.push(['e continua inteira às 21:00', p21 >= 0.999]);

/* ---- 3. A TRAVA DA LUA: o poente não pode ganhar um ponto branco ---- */
const p18 = em(18).peso;
out.push(['peso às 18:00, sol ainda a +7,1° (era 0,083)', r3(p18)]);
out.push(['não afrouxou a trava da lua', p18 <= 0.083]);
out.push(['nada de lua antes de 17:45', em(17.5).peso <= 1e-3]);

/* ---- 4. MONOTONICIDADE: o céu nunca volta para o dia enquanto anoitece ---- */
let regressoes = 0;
for (let i = 1; i < amostras.length; i++) {
  if (amostras[i].peso < amostras[i - 1].peso - 1e-4) regressoes++;
}
out.push(['paradas em que o céu CLAREOU ao avançar a hora', regressoes]);
out.push(['travessia monótona', regressoes === 0]);

/* ---------------------------------------------------------------------------
   O DEGRAU DE HDR — e a medida é o TAMANHO DO ALVO, não o campo do perfil.

   `applyCold()` é o que passa a cortina e recarrega o cenário; sem ele o campo
   novo fica PENDENTE e o alvo continua no tamanho antigo, que é precisamente a
   diferença que este bloco existe para não confundir. */
const tamDe = () => (S.lighting.getSkyBlend().tamanho || []).join('×');
const nivelAnterior = S.quality.mode;

S.quality.set('alta');
out.push(['Alta pede hdrVariant', "'" + S.quality.cold().hdrVariant + "'"]);
out.push(['Alta não degrada o céu', S.quality.cold().hdrVariant === '']);

for (const nivel of ['media', 'baixa']) {
  S.quality.set(nivel);
  out.push([nivel + ' pede hdrVariant', "'" + S.quality.cold().hdrVariant + "'"]);
  out.push([nivel + ' pede @1k (o manifesto declara)', S.quality.cold().hdrVariant === '@1k']);
  if (S.quality.applyCold) await S.quality.applyCold();
  await B.until(() => !!S.lighting.getSkyBlend().ativo, 240000);
  await B.frame(); await B.frame();
  out.push([nivel + ' — alvo de mistura', tamDe()]);
  out.push([nivel + ' — o arquivo @1k desceu de fato', tamDe() === '1024×512']);
}

S.quality.set('alta');
if (S.quality.applyCold) await S.quality.applyCold();
await B.until(() => !!S.lighting.getSkyBlend().ativo, 240000);
await B.frame(); await B.frame();
out.push(['Alta — alvo de mistura', tamDe()]);
out.push(['Alta continua em 2048×1024', tamDe() === '2048×1024']);

/* ---------------------------------------------------------------------------
   E O CHÃO, PELA MESMA RÉGUA — porque ele já esteve morto do mesmo jeito.

   `groundVariant` passou por este exato buraco entre 2026-08-14 e 2026-08-15 (a
   tabela pedia `@ktx2`, o manifesto não declarava, a peneira devolvia `''`), e
   um degrau de asset que ninguém confere volta a morrer no primeiro deploy pela
   metade. A medida boa é a mesma: não o que o perfil PEDE, e sim o tamanho da
   textura que de fato está ligada no material do chão. */
function chao() {
  const set = S.scene.getObjectByName('ts-set');
  const vistos = new Map();
  set?.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      const t = m && m.map;
      if (!t || !t.image) continue;
      if (!/asphalt|concrete|grass|gravel/i.test(m.name || '')) continue;
      vistos.set(m.name, (t.image.width || 0) + '×' + (t.image.height || 0)
        + (t.isCompressedTexture ? ' comprimida' : ' crua'));
    }
  });
  return [...vistos].map(([k, v]) => k + ' ' + v).sort().join(' · ') || 'nenhum material de chão';
}
out.push(['Alta — albedo do chão', chao()]);
for (const nivel of ['media', 'baixa']) {
  S.quality.set(nivel);
  if (S.quality.applyCold) await S.quality.applyCold();
  await B.until(() => !!S.scene.getObjectByName('ts-set'), 240000);
  await B.frame(); await B.frame();
  out.push([nivel + ' pede groundVariant', "'" + S.quality.cold().groundVariant + "'"]);
  out.push([nivel + ' — albedo do chão', chao()]);
  out.push([nivel + ' — o chão veio COMPRIMIDO', /comprimida/.test(chao())]);
}

S.quality.set(nivelAnterior);
S.lighting.setHourOfDay(17.75);
await B.frame();

/* A TABELA INTEIRA no relatório: um número por parada, para quem for mexer na
   banda poder ver a forma da curva sem reabrir o app. */
out.push(['a curva, de 15 em 15 min',
  amostras.filter((a) => a.h >= 17.75 - 1e-6 && a.h <= 19.5 + 1e-6
      && Math.abs(a.h * 4 - Math.round(a.h * 4)) < 1e-6)
    .map((a) => a.h.toFixed(2) + '=' + a.peso.toFixed(3)).join('  ')]);

return out;
