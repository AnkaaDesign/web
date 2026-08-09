/**
 * Verificação ponta a ponta dos manifestos, pelo CARREGADOR DE VERDADE.
 * ============================================================================
 *
 * O que este teste existe para impedir: um `brands.json` que parece certo lido
 * a olho e que, passado pelo `normalizeManufacturer` / `normalizeModel` /
 * `normalizeChassis` do motor, perde entradas em silêncio — porque esses
 * normalizadores DESCARTAM o que não entendem (`return null`) em vez de gritar.
 * Contar 52 chassis no JSON não prova que o motor enxerga 52.
 *
 * Então aqui o caminho é o mesmo do app: `loadCatalog()` → `getModel()` →
 * `getChassis()` → `fileOf()` → o `.glb` existe na árvore servida.
 *
 * ONDE OS ARQUIVOS SÃO PROCURADOS — e por que não é só `web/public/`.
 * Os manifestos, as fotos de card e os renders são VERSIONADOS e saem de
 * `web/public/`. As 52 cabines (~320 MB) e o implemento NÃO são: estão no
 * `.gitignore` e chegam ao servidor por rsync (ver o bloco "AS CABINES TAMBÉM
 * FICAM FORA" lá). Logo, num clone limpo `public/models/trucks/` não existe, e
 * procurar a geometria só ali fazia este teste falhar em 52 de 52 chassis por
 * um motivo que não é o que ele investiga.
 *
 * Então a resolução é EM DOIS LUGARES, nesta ordem: `web/public/` primeiro (é
 * onde o dado versionado está, e é o que se quer testar), a árvore servida
 * depois (`STUDIO_ASSETS_ROOT`, padrão `/srv/studio-assets`). Se a geometria
 * não estiver em NENHUM dos dois, o teste é PULADO com uma mensagem em vez de
 * falhar — a ausência dela é uma máquina sem o rsync, não um manifesto errado.
 *
 *   npx vitest run tools/verify-manifests/catalog-resolves.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PUBLIC = resolve(__dirname, '../../public');
const SERVED = join(process.env.STUDIO_ASSETS_ROOT || '/srv/studio-assets', 'v1');
const BASE = '/studio-assets/v1';

/** Onde este caminho relativo está, entre as duas raízes. `null` = em nenhuma. */
function locate(rel: string): string | null {
  const clean = rel.replace(/^\/+/, '');
  for (const root of [PUBLIC, SERVED]) {
    const p = join(root, clean);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Traduz a URL que o motor monta de volta para um caminho relativo à árvore. */
function toRel(url: string): string {
  let p = String(url);
  try { p = new URL(p, 'http://local').pathname; } catch { /* já é caminho */ }
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  return decodeURIComponent(p).replace(/^\/+/, '');
}

/** A geometria pesada chegou a esta máquina? Sem ela, os testes de arquivo
 *  não têm o que verificar e são pulados em vez de falharem. */
const HAS_GEOMETRY = locate('models/trucks') !== null;

beforeAll(() => {
  /* Serve a árvore por fetch. HEAD é o que a sonda de disponibilidade do motor
     usa; GET devolve o JSON. Qualquer coisa fora das duas raízes vira 404, que
     é o mesmo que o navegador veria. */
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const rel = toRel(typeof input === 'string' ? input : (input as Request).url ?? String(input));
    const file = locate(rel);
    const ok = !!file && statSync(file).isFile();
    if ((init?.method || 'GET').toUpperCase() === 'HEAD') {
      return new Response(null, { status: ok ? 200 : 404 });
    }
    if (!ok) return new Response('not found', { status: 404 });
    return new Response(readFileSync(file!), { status: 200 });
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
    const byFile = new Map<string, string[]>();

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
          const list = byFile.get(rel);
          if (list) list.push(`${model.id}/${ch.id}`); else byFile.set(rel, [`${model.id}/${ch.id}`]);
          if (HAS_GEOMETRY && !locate(rel)) missing.push(`${model.id}/${ch.id} -> ${rel}`);
        }
      }
    }

    /* Nenhum chassi pode sumir entre o disco e o catálogo normalizado. */
    expect(seen, 'chassis vistos pelo motor != chassis no disco').toBe(nDisk);
    expect(noFile, 'chassis sem geometria resolvivel').toEqual([]);
    expect(missing, 'geometria apontada mas ausente na arvore').toEqual([]);

    /* CADA CHASSI TEM O SEU PRÓPRIO .glb — e esta afirmação está INVERTIDA em
       relação ao que ela era.
       Até 2026-08-09 sete entradas `6x4` apontavam para o .glb do 6x2 do mesmo
       modelo (com `sameGeometryAs` documentando o empréstimo), e este teste
       afirmava justamente que havia MENOS arquivos que chassis. Só que a malha
       do 6x2 traz um eixo de apoio ELEVATÓRIO no lugar do tandem tracionado —
       ou seja, quem escolhia 6x4 recebia o veículo errado, e a diferença entre
       os dois é exatamente o que a escolha do chassi decide. As sete saíram do
       catálogo; o que se afirma agora é que o empréstimo não volta em silêncio. */
    const shared = [...byFile.entries()].filter(([, ks]) => ks.length > 1);
    expect(shared, 'chassis compartilhando .glb — a malha nao corresponde ao rotulo')
      .toEqual([]);
    expect(byFile.size).toBe(seen);

    console.log(`   ${cat.manufacturers.length} marcas · `
      + `${cat.manufacturers.reduce((s, m) => s + m.models.length, 0)} modelos · `
      + `${seen} chassis · ${byFile.size} arquivos distintos`
      + (HAS_GEOMETRY ? '' : ' · (geometria ausente nesta maquina: existencia nao conferida)'));
  });

  it('o chassi anunciado bate com os eixos MEDIDOS na malha', async () => {
    /* A trava que teria pego as sete entradas acima no dia em que entraram.
       `hitch.json` traz `axles.config` medido por vértice; `brands.json` traz o
       id do chassi, que é o que o cliente lê no card. Divergir é entregar o
       veículo errado, e nenhum dos dois arquivos sabe do outro. */
    const hitch = JSON.parse(readFileSync(join(PUBLIC, 'models/vehicles/hitch.json'), 'utf8'));
    const brands = JSON.parse(readFileSync(join(PUBLIC, 'brands/trucks/brands.json'), 'utf8'));
    const byFile = new Map<string, Record<string, any>>();
    for (const t of Object.values<Record<string, any>>(hitch.tractors)) {
      byFile.set(String(t.sourceFile), t);
    }
    /* `4x2-sl`, `6x2a-tl`, `6x4t-sl` → `4x2`, `6x2`, `6x4`: os sufixos dizem
       carroceria (cabine leito) e tipo de eixo, não tração. O que se compara é
       a tração, que é a parte que a malha decide. */
    const drive = (s: string) => (/^(\d)x(\d)/.exec(s) || [])[0] ?? s;
    const bad: string[] = [];
    for (const man of brands.manufacturers) {
      for (const model of man.models) {
        for (const ch of model.chassis) {
          const t = byFile.get(String(ch.file || model.file));
          const cfg = t?.axles?.config;
          if (!cfg) continue;                    // rígido: não está no hitch.json
          if (drive(cfg) !== drive(ch.id)) {
            bad.push(`${man.id}/${model.id}/${ch.id}: malha e ${cfg}`);
          }
        }
      }
    }
    expect(bad, 'chassi anunciado diverge dos eixos medidos').toEqual([]);
  });

  it('hitch.json cobre os chassis que sao cavalo, em espaco cru', async () => {
    const hitch = JSON.parse(readFileSync(join(PUBLIC, 'models/vehicles/hitch.json'), 'utf8'));
    expect(hitch.schema).toBe('truck-studio/hitch@1');
    expect(hitch.axes.forward).toBe('+Z');
    for (const [id, t] of Object.entries<Record<string, any>>(hitch.tractors)) {
      expect(t.fifthWheel, `${id} sem quinta roda`).toBeTruthy();
      expect(t.fingerprint.sha256, `${id} sem fingerprint`).toMatch(/^[0-9a-f]{64}$/);
      if (HAS_GEOMETRY) {
        expect(locate(t.sourceFile), `${id} -> ${t.sourceFile}`).not.toBeNull();
      }
    }
  });

  it('renders.json fala o esquema que o motor LE', async () => {
    /* A regressão que este caso existe para não repetir: a leva de renders de
       2026-08-09 (manhã) escreveu o manifesto com `neutral`, `path`,
       `neutralPath` e `fallback`, e os arquivos com o nome `_neutral.webp`.
       `catalog/renders.ts` lê `format` e `have`, e monta o caminho com o
       colorId — então nenhum dos 53 renders foi usado UMA vez: `parse()` não
       achava `have`, devolvia índice vazio, e todo card caía no placeholder de
       silhueta com as imagens ali no disco, sem erro nenhum no console.
       Por isso este caso afirma o CONTRATO DO CONSUMIDOR, não o formato que o
       gerador achou bonito. */
    const r = JSON.parse(readFileSync(join(PUBLIC, 'renders/renders.json'), 'utf8'));
    expect(r.format, 'renders.json sem `format`').toBe('webp');
    expect(r.have, 'renders.json sem `have` — o motor le SO ele').toBeTruthy();

    const keys = Object.keys(r.have);
    expect(keys.length, 'nenhum render no manifesto').toBeGreaterThan(0);

    const missing: string[] = [];
    for (const [key, ids] of Object.entries<string[]>(r.have)) {
      expect(Array.isArray(ids) && ids.length, `${key} com lista vazia`).toBeTruthy();
      for (const id of ids) {
        const rel = `renders/trucks/${key}/${id}.${r.format}`;
        if (!locate(rel)) missing.push(rel);
      }
    }
    expect(missing.slice(0, 10), 'manifesto promete imagem que nao existe').toEqual([]);

    /* Todo chassi do catálogo tem ao menos o render neutro: é o degrau 2 da
       cadeia de fallback, e sem ele o card cai na silhueta. */
    const brands = JSON.parse(readFileSync(join(PUBLIC, 'brands/trucks/brands.json'), 'utf8'));
    const semRender: string[] = [];
    for (const man of brands.manufacturers) {
      for (const model of man.models) {
        for (const ch of model.chassis) {
          const key = `${man.id}/${model.id}/${ch.id}`;
          if (!r.have[key]?.includes('neutro')) semRender.push(key);
        }
      }
    }
    expect(semRender, 'chassi sem render neutro').toEqual([]);
  });

  it('cabs.json foi aposentado da arvore servida', () => {
    expect(existsSync(join(PUBLIC, 'models/vehicles/cabs.json')),
      'cabs.json ainda esta em web/public — segunda fonte de verdade').toBe(false);
  });
});
