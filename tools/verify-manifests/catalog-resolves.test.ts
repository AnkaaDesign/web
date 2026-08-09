/**
 * Verificação ponta a ponta dos manifestos, pelo CARREGADOR DE VERDADE.
 * ============================================================================
 *
 * O que este teste existe para impedir: um `brands.json` que parece certo lido
 * a olho e que, passado pelo `normalizeManufacturer` / `normalizeModel` /
 * `normalizeChassis` do motor, perde entradas em silêncio — porque esses
 * normalizadores DESCARTAM o que não entendem (`return null`) em vez de gritar.
 * Contar 60 chassis no JSON não prova que o motor enxerga 60.
 *
 * Então aqui o caminho é o mesmo do app: `loadCatalog()` → `getModel()` →
 * `getChassis()` → `fileOf()` → o `.glb` existe no disco servido.
 *
 * `fetch` é apontado para `web/public/`, que é exatamente a árvore que o rsync
 * leva para `/srv/studio-assets/v1/`. Não há mock de dado: os arquivos lidos
 * são os que vão para produção.
 *
 *   npx vitest run tools/verify-manifests/catalog-resolves.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PUBLIC = resolve(__dirname, '../../public');
const BASE = '/studio-assets/v1';

/** Traduz a URL que o motor monta de volta para um caminho em `web/public/`. */
function toDisk(url: string): string {
  let p = String(url);
  try { p = new URL(p, 'http://local').pathname; } catch { /* já é caminho */ }
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  return join(PUBLIC, decodeURIComponent(p).replace(/^\/+/, ''));
}

beforeAll(() => {
  /* Serve `web/public/` por fetch. HEAD é o que a sonda de disponibilidade do
     motor usa; GET devolve o JSON. Qualquer coisa fora da árvore vira 404, que
     é o mesmo que o navegador veria. */
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const file = toDisk(typeof input === 'string' ? input : (input as Request).url ?? String(input));
    const ok = existsSync(file) && statSync(file).isFile();
    if ((init?.method || 'GET').toUpperCase() === 'HEAD') {
      return new Response(null, { status: ok ? 200 : 404 });
    }
    if (!ok) return new Response('not found', { status: 404 });
    return new Response(readFileSync(file), { status: 200 });
  }) as typeof fetch;
});

describe('manifestos servidos de web/public/', () => {
  it('resolve marca -> modelo -> chassi -> arquivo, para TODOS os chassis', async () => {
    const mod = await import(
      '../../src/pages/tools/truck-studio/engine/catalog/catalog'
    );
    const { loadCatalog, getModel, getChassis, fileOf } = mod;

    const cat = await loadCatalog();

    /* Se caiu no catálogo mínimo embutido, o brands.json não foi lido — e o
       teste passaria examinando dados que não são os meus. */
    expect(cat.manufacturerFallback ?? false, 'caiu no catalogo de fallback').toBe(false);
    expect(cat.manufacturers.length).toBeGreaterThan(0);

    const disk = JSON.parse(readFileSync(join(PUBLIC, 'brands/trucks/brands.json'), 'utf8'));
    const nDisk = disk.manufacturers.reduce(
      (s: number, m: { models: { chassis: unknown[] }[] }) =>
        s + m.models.reduce((t, x) => t + x.chassis.length, 0), 0);

    const missing: string[] = [];
    const noFile: string[] = [];
    let seen = 0;
    const files = new Set<string>();

    for (const man of cat.manufacturers) {
      for (const model of man.models) {
        /* o motor tem de achar o modelo pelo id, como o seletor faz */
        expect(getModel(model.id), `getModel('${model.id}')`).not.toBeNull();
        for (const ch of model.chassis) {
          seen++;
          const found = getChassis(model.id, ch.id);
          expect(found, `getChassis('${model.id}','${ch.id}')`).not.toBeNull();
          const rel = fileOf(model, found!.chassis);
          if (!rel) { noFile.push(`${model.id}/${ch.id}`); continue; }
          files.add(rel);
          const abs = join(PUBLIC, rel);
          if (!existsSync(abs)) missing.push(`${model.id}/${ch.id} -> ${rel}`);
        }
      }
    }

    /* Nenhum chassi pode sumir entre o disco e o catálogo normalizado. */
    expect(seen, 'chassis vistos pelo motor != chassis no disco').toBe(nDisk);
    expect(noFile, 'chassis sem geometria resolvivel').toEqual([]);
    expect(missing, 'geometria apontada mas ausente no disco').toEqual([]);

    /* Dois chassis podem apontar para o MESMO arquivo (7 pares byte-idênticos):
       isso é esperado, então o que se afirma é o contrário — que há menos
       arquivos distintos do que chassis. */
    expect(files.size).toBeLessThan(seen);
    console.log(`   ${cat.manufacturers.length} marcas · `
      + `${cat.manufacturers.reduce((s, m) => s + m.models.length, 0)} modelos · `
      + `${seen} chassis · ${files.size} arquivos distintos`);
  });

  it('hitch.json cobre os chassis que sao cavalo, em espaco cru', async () => {
    const hitch = JSON.parse(readFileSync(join(PUBLIC, 'models/vehicles/hitch.json'), 'utf8'));
    expect(hitch.schema).toBe('truck-studio/hitch@1');
    expect(hitch.axes.forward).toBe('+Z');
    for (const [id, t] of Object.entries<Record<string, any>>(hitch.tractors)) {
      expect(t.fifthWheel, `${id} sem quinta roda`).toBeTruthy();
      expect(existsSync(join(PUBLIC, t.sourceFile)), `${id} -> ${t.sourceFile}`).toBe(true);
      expect(t.fingerprint.sha256, `${id} sem fingerprint`).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('renders.json so promete imagem que existe', async () => {
    const r = JSON.parse(readFileSync(join(PUBLIC, 'renders/renders.json'), 'utf8'));
    expect(r.fallback).toEqual(['color', 'neutral', 'silhouette']);
    for (const [key, rel] of Object.entries<string>(r.neutral)) {
      expect(existsSync(join(PUBLIC, rel)), `${key} -> ${rel}`).toBe(true);
    }
  });

  it('cabs.json foi aposentado da arvore servida', () => {
    expect(existsSync(join(PUBLIC, 'models/vehicles/cabs.json')),
      'cabs.json ainda esta em web/public — segunda fonte de verdade').toBe(false);
  });
});
