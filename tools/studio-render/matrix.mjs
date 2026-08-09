/* A matriz de trabalho: que imagens existem para produzir.
   ===========================================================================
   Uma função, e ela é a ÚNICA autoridade sobre o que o pipeline renderiza. Ela
   deriva a lista das MESMAS duas fontes que a interface consulta em runtime —
   `brands/trucks/brands.json` do disco e `GET /studio/colors` da API — e
   aplica as MESMAS regras do engine. Um pipeline com a sua própria noção de
   "quais cores esta montadora oferece" produziria cards para combinações que
   o seletor nunca mostra, e deixaria de produzir as que ele mostra.

   As três regras copiadas do engine, e onde cada uma vive lá:

     colorsFor()        engine/catalog/colors.ts — a paleta de uma montadora é
                        a das tintas amarradas a ela; SEM NENHUMA, devolve o
                        catálogo inteiro. Esse ramo é o que fazia a MAN pedir
                        519 cards; desde 2026-08-09 toda montadora tem ao menos
                        um branco no banco, então ele não deve mais disparar —
                        e se disparar, isto AVISA em vez de renderizar 519
                        imagens em silêncio.

     specialEdition     engine/catalog/catalog.ts — a película É o produto. O
                        seletor tira o passo "Cor"; aqui isso é um render
                        NEUTRO e nenhum de cor. É o que faz o S-Way 480
                        Metallica manter a arte M72 em vez de ganhar 2 cards de
                        um caminhão repintado que não existe.

     available          um card indisponível continua LISTADO, marcado
                        "Em breve". Ele merece o render neutro (o usuário vê o
                        caminhão que vem por aí) e nenhum de cor. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** O id de cor reservado do render neutro — o `NEUTRAL_COLOR_ID` do engine. */
export const NEUTRAL = 'neutro';

const DEFAULT_COLORS_URL =
  process.env.STUDIO_COLORS_URL || 'https://api.ankaadesign.com.br/studio/colors';

/** SOLID/METALLIC/PEARL/MATTE/SATIN → os três acabamentos do shader.
 *  Espelha `FINISH_FROM_API` de engine/catalog/colors.ts. */
const FINISH = {
  SOLID: 'solid', METALLIC: 'metallic', PEARL: 'pearl',
  MATTE: 'solid', SATIN: 'solid',
};

/* A tradução `previewConfig` → receita de tinta é a de
   `paintEffectFrom()`, em pages/tools/truck-studio/index.tsx. Ela mora LÁ
   porque é React; a lógica é reproduzida aqui, e é a única duplicação
   consciente deste arquivo. O marcador continua sendo `pearlFlip`: é o campo
   que o gerador de amostra 2D nunca escreve. */
const CHROMA_MIN = 0.06;
const chroma = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return -1;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  return Math.max(r, g, b) - Math.min(r, g, b);
};

function recipeFrom(cfg, hex, finish) {
  const base = { finish, color: hex, flakeColor: null, pearlFlip: null };
  if (!cfg || typeof cfg !== 'object') return base;

  /* Receita do laboratório: passa direto, inclusive mandando na FACE e no
     ACABAMENTO. Não é redundância com `hex` — o `Vermelho Ruby` está gravado
     como #750406 e a receita pede #c01c28. `hex` é a cor de catálogo; a
     receita é como a tinta se comporta sob luz, e foi ela que foi medida. */
  if (typeof cfg.pearlFlip === 'string' || typeof cfg.pearlMid === 'string') {
    const out = { ...base };
    if (typeof cfg.color === 'string') out.color = cfg.color;
    if (typeof cfg.finish === 'string' && FINISH[cfg.finish.toUpperCase()]) {
      out.finish = FINISH[cfg.finish.toUpperCase()];
    } else if (['solid', 'metallic', 'pearl'].includes(cfg.finish)) {
      out.finish = cfg.finish;
    }
    for (const k of ['metalness', 'roughness', 'gloss', 'pearlAmount', 'pearlTravel',
      'flakeAmount', 'flakeDensity', 'peel', 'peelScale', 'peelDetail',
      'flakeTilt', 'flakeGloss']) {
      if (Number.isFinite(Number(cfg[k]))) out[k] = Number(cfg[k]);
    }
    if (typeof cfg.pearlFlip === 'string') out.pearlFlip = cfg.pearlFlip;
    if (typeof cfg.pearlMid === 'string') out.pearlMid = cfg.pearlMid;
    if (typeof cfg.flakeColor === 'string') out.flakeColor = cfg.flakeColor;
    return out;
  }

  /* Ajuste do gerador 2D: o que atravessa é a COR. A luz colorida MAIS FORTE
     é o flip — no `Verde Saiph` o `flipColor` é cinza e o amarelo vem de uma
     luz #c7e52e. `flipColor` é o reserva para um ajuste só com luz branca. */
  let flip = null, best = -1;
  for (const l of (Array.isArray(cfg.lights) ? cfg.lights : [])) {
    const col = typeof l?.color === 'string' ? l.color : null;
    if (!col || chroma(col) < CHROMA_MIN) continue;
    const s = Number.isFinite(Number(l?.intensity)) ? Number(l.intensity) : 0;
    if (s > best) { best = s; flip = col; }
  }
  if (!flip && typeof cfg.flipColor === 'string') flip = cfg.flipColor;
  const flake = typeof cfg.flakeColor === 'string' ? cfg.flakeColor : null;
  if (!flip && !flake) return base;

  /* Sem receita do laboratório, o `effectIntensity` (0..100) governa quanto do
     efeito entra. O shader não tem um ganho global, então ele é aplicado nas
     duas amplitudes que o acabamento já traz. */
  const ei = Number(cfg.effectIntensity);
  const k = Number.isFinite(ei) ? Math.max(0, Math.min(1, ei / 100)) : 0.6;
  const out = { ...base, pearlFlip: flip, flakeColor: flake };
  if (finish === 'pearl') out.pearlAmount = 0.85 * (0.4 + 0.6 * k);
  if (finish !== 'solid') out.flakeAmount = (finish === 'pearl' ? 0.38 : 0.55) * (0.4 + 0.6 * k);
  return out;
}

/** Baixa a paleta da API — a MESMA rota pública que o estúdio consome. */
export async function fetchColors(url = DEFAULT_COLORS_URL) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  const body = await r.json();
  const rows = Array.isArray(body?.data) ? body.data : [];
  return rows
    .filter((p) => p?.id && p?.name && /^#[0-9a-f]{6}$/i.test(String(p.hex || '')))
    .map((p) => {
      const finish = FINISH[String(p.finish || '').toUpperCase()] || 'solid';
      return {
        id: p.id, name: p.name, hex: p.hex, finish,
        manufacturer: p.manufacturer ? String(p.manufacturer).toLowerCase() : null,
        colorOrder: Number(p.colorOrder) || 0,
        recipe: recipeFrom(p.previewConfig, p.hex, finish),
      };
    })
    .sort((a, b) => a.colorOrder - b.colorOrder || a.name.localeCompare(b.name, 'pt-BR'));
}

/**
 * A matriz.
 *
 * @returns `{ jobs, stats }` — `jobs` na ordem de renderização: agrupada por
 *   GEOMETRIA, porque carregar um .glb custa de 3 a 20 segundos e trocar a cor
 *   custa uma escrita de uniform. Renderizar por cor em vez de por geometria
 *   multiplicaria o tempo total por vinte.
 */
export async function buildMatrix({ assetsRoot, colorsUrl } = {}) {
  const root = assetsRoot || join(process.env.STUDIO_ASSETS_ROOT || '/srv/studio-assets', 'v1');
  const brands = JSON.parse(await readFile(join(root, 'brands/trucks/brands.json'), 'utf8'));
  const colors = await fetchColors(colorsUrl);

  const jobs = [];
  const warnings = [];
  let nNeutral = 0, nColor = 0;

  for (const man of brands.manufacturers || []) {
    /* colorsFor(): a paleta da montadora, ou o catálogo inteiro se ela não
       tiver nenhuma tinta. Ver o cabeçalho. */
    let palette = colors.filter((c) => c.manufacturer === man.id);
    if (!palette.length) {
      palette = colors;
      warnings.push(
        `[${man.id}] NENHUMA tinta amarrada a esta montadora no banco. `
        + `O seletor cai no catálogo inteiro (${colors.length} cores) e esta `
        + `matriz faria ${colors.length} imagens por chassi. Cadastre ao menos `
        + `um branco em Paint.manufacturer='${man.id.toUpperCase()}'.`);
    }

    for (const model of man.models || []) {
      for (const ch of model.chassis || []) {
        const file = ch.file || model.file;
        if (!file) {
          warnings.push(`[${man.id}/${model.id}/${ch.id}] sem \`file\` — pulado.`);
          continue;
        }
        const key = `${man.id}/${model.id}/${ch.id}`;
        const usable = ch.available !== false && model.available !== false;
        /* `paintMaterialsOf()` do engine: o do chassi ganha do do modelo, e a
           ausência dos dois (`null`) é diferente de `[]`. Ver o comentário do
           campo em catalog/catalog.ts — `[]` diz "nenhum material desta
           geometria aceita tinta", e é o que protege a película do Metallica. */
        const paintMaterials = Array.isArray(ch.paintMaterials) ? ch.paintMaterials
          : Array.isArray(model.paintMaterials) ? model.paintMaterials : null;

        /* NEUTRO SEMPRE, inclusive no indisponível: é o degrau 2 da cadeia de
           fallback de `renderUrl()` e é o que um card "Em breve" mostra. */
        jobs.push({ key, file, manufacturerId: man.id, modelId: model.id,
          chassisId: ch.id, colorId: NEUTRAL, recipe: null, paintMaterials,
          label: `${model.name} ${ch.name} · neutro` });
        nNeutral++;

        if (!usable || model.specialEdition) continue;
        for (const c of palette) {
          jobs.push({ key, file, manufacturerId: man.id, modelId: model.id,
            chassisId: ch.id, colorId: c.id, recipe: c.recipe, paintMaterials,
            label: `${model.name} ${ch.name} · ${c.name}` });
          nColor++;
        }
      }
    }
  }

  /* Agrupa por ARQUIVO (não por chave): dois chassis distintos podem, um dia,
     voltar a compartilhar geometria, e nesse caso um load serve os dois. */
  jobs.sort((a, b) => a.file.localeCompare(b.file) || a.key.localeCompare(b.key)
    || (a.colorId === NEUTRAL ? -1 : b.colorId === NEUTRAL ? 1 : 0));

  return {
    jobs,
    stats: {
      geometries: new Set(jobs.map((j) => j.file)).size,
      chassis: new Set(jobs.map((j) => j.key)).size,
      neutral: nNeutral, color: nColor, total: jobs.length,
      colors: colors.length,
    },
    warnings,
  };
}
