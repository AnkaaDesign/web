import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  setImplementCatalog, getImplements, getImplement, getCurrentImplement,
  frameRegexOf, sillRegexOf, topRailRegexOf, LEGACY_IMPLEMENT,
} from './implements';

/* O MANIFESTO DE VERDADE, e não um de brinquedo.
   ---------------------------------------------------------------------------
   `models/vehicles/implements.json` é editado à mão junto com o asset (ver o
   cabeçalho de `implements.ts`), e desde as VARIANTES (2026-09-29) ele carrega
   decisões que o resto do estúdio LÊ DA ORDEM e do TIPO: o primeiro de cada
   tipo é o padrão quando a escolha não diz qual, e o card de Configurações
   rotula cada botão com o `short`, que só precisa ser único dentro do tipo.
   Um erro de digitação ali não quebra a carga — `parseOne()` perdoa campo a
   campo, de propósito —, então é aqui que ele tem de aparecer.

   ⚠️ O QUE ESTE TESTE NÃO PROVA: que os `.glb` existem (eles não moram no git)
   nem que as variantes saem certas na tela. Isso é
   `tools/studio-bench/checks-variantes-0929.mjs`. */
const MANIFEST = JSON.parse(readFileSync(
  resolve(__dirname, '../../../../../../public/models/vehicles/implements.json'), 'utf8',
));

describe('implements.json — as variantes', () => {
  beforeEach(() => { setImplementCatalog(MANIFEST); });

  it('tem os seis, com ids únicos', () => {
    const ids = getImplements().map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([
      'semirreboque-frigorifico-paleteiro', 'semirreboque-frigorifico-gancheiro',
      'sobrechassi-frigorifico-gancheiro', 'sobrechassi-frigorifico-paleteiro',
      'sobrechassi-isotermico-paleteiro', 'sobrechassi-isotermico-gancheiro',
    ]));
  });

  it('o primeiro de cada tipo continua sendo o de antes das variantes', () => {
    /* É ele que um visitante sem `implementId` recebe — e o que recebia antes. */
    const primeiro = (k: string) => getImplements().find((d) => d.kind === k)?.id;
    expect(primeiro('semirreboque')).toBe('semirreboque-frigorifico-paleteiro');
    expect(primeiro('sobrechassi')).toBe('sobrechassi-frigorifico-gancheiro');
    expect(getCurrentImplement().id).toBe('semirreboque-frigorifico-paleteiro');
  });

  it('carroceria × arranjo é única dentro do tipo (são os botões do card)', () => {
    for (const k of ['semirreboque', 'sobrechassi']) {
      const doTipo = getImplements().filter((d) => d.kind === k);
      for (const d of doTipo) {
        expect(d.body, d.id).toBeDefined();
        expect(d.arrangement, d.id).toBeDefined();
      }
      const pares = doTipo.map((d) => `${d.body}/${d.arrangement}`);
      expect(new Set(pares).size).toBe(pares.length);
      const shorts = doTipo.map((d) => d.short);
      expect(new Set(shorts).size).toBe(shorts.length);
    }
    /* O sobrechassi tem as quatro combinações — é o que o dono pediu. */
    const sobre = getImplements().filter((d) => d.kind === 'sobrechassi').map((d) => `${d.body}/${d.arrangement}`);
    expect(sobre.sort()).toEqual(['frigorifico/gancheiro', 'frigorifico/paleteiro',
      'isotermico/gancheiro', 'isotermico/paleteiro']);
  });

  it('toda regex de material compila e casa o nome que ela promete', () => {
    for (const d of getImplements()) {
      for (const re of [frameRegexOf(d), sillRegexOf(d), topRailRegexOf(d)]) {
        if (re) expect(re).toBeInstanceOf(RegExp);
      }
    }
    /* O perfil de CIMA segue quem o DOOU: Z do gancheiro, banda do paleteiro. */
    const zRe = topRailRegexOf(getImplement('semirreboque-frigorifico-gancheiro')!);
    expect(zRe?.test('metal-estrutura-principal-padrao')).toBe(true);
    /* …E o CLONE de inox: `splitTrailerHardware()` renomeia o Z para
       `…__polido` antes de `TrailerBody` medir. Sem casar o clone a medida
       volta nula e a coluna de rebites para 122 mm abaixo do Z. */
    expect(zRe?.test('metal-estrutura-principal-padrao__polido')).toBe(true);
    expect(topRailRegexOf(getImplement('sobrechassi-frigorifico-paleteiro')!)
      ?.test('metal-galvanizado-mantido')).toBe(true);
    expect(topRailRegexOf(getImplement('sobrechassi-isotermico-paleteiro')!)
      ?.test('metal-galvanizado-mantido')).toBe(true);
  });

  it('as marcas do PERFIL seguem o perfil, as do CORPO seguem a base', () => {
    const sg = getImplement('semirreboque-frigorifico-gancheiro')!;
    const sp = getImplement('sobrechassi-frigorifico-paleteiro')!;
    const sobre = getImplement('sobrechassi-frigorifico-gancheiro')!;
    /* O Z do gancheiro é inox e traz rebite modelado — onde quer que esteja. */
    expect(sg.stainlessTopRail).toBe(true);
    expect(sg.topRailDressing).toBe(true);
    expect(sp.stainlessTopRail).toBe(false);
    expect(sp.topRailDressing).toBe(false);
    /* O corpo do semirreboque não tem nada do que o bake do sobrechassi corrige. */
    expect(sg.bakedSideDoor).toBe(false);
    expect(sg.has).toEqual({ wheels: true, landingGear: true, kingpin: true, plate: true, thermoKing: true });
    /* …e o corpo do sobrechassi paleteiro tem TUDO que o gancheiro tem. */
    for (const k of ['bakedSideDoor', 'makerBranding', 'lowFrameSkin', 'cornerTape', 'lowFrameRail',
      'singleRearHose', 'strayConduits', 'sideDoorCatches', 'flankCatchOnFlat'] as const) {
      expect(sp[k], k).toBe(sobre[k]);
    }
    expect(sp.thermoKingFile).toBe(sobre.thermoKingFile);
  });

  it('o isotérmico é fibra, tem Thermo King e segue o frigorífico do mesmo arranjo', () => {
    for (const arr of ['paleteiro', 'gancheiro'] as const) {
      const iso = getImplement(`sobrechassi-isotermico-${arr}`)!;
      const frio = getImplement(`sobrechassi-frigorifico-${arr}`)!;
      expect(iso.skin).toBe('fibra');
      /* *"o isotérmico deve ter thermo king também"* — Kennedy, 2026-09-29. */
      expect(iso.has.thermoKing).toBe(true);
      expect(iso.thermoKingFile).toBe(frio.thermoKingFile);
      /* O perfil de topo é o do frigorífico do mesmo arranjo. */
      expect(iso.stainlessTopRail).toBe(frio.stainlessTopRail);
      expect(iso.topRailDressing).toBe(frio.topRailDressing);
      expect(topRailRegexOf(iso)?.source).toBe(topRailRegexOf(frio)?.source);
      /* A saia da chapa que saiu: é ela que põe o trilho de piso no lugar do
         da chapa (120,3 mm no sobrechassi) — sem ela o trilho desce e os
         rebites da ferragem inferior ficam no painel liso. */
      expect(iso.railSkirt).toBeCloseTo(0.1203, 4);
      /* …e o relevo dela (parte lisa → crista): sem ele o trilho ia 5,2 mm
         para dentro e o painel cobria o terço de cima dele. */
      expect(iso.railRelief).toBeCloseTo(0.0052, 4);
      /* Sem friso não há faixa lisa onde assentar o encosto da porta. */
      expect(iso.flankCatchOnFlat).toBe(false);
    }
    for (const d of getImplements()) {
      if (d.body !== 'isotermico') {
        expect(d.skin, d.id).toBe('chapa');
        expect(d.railSkirt, d.id).toBeUndefined();
        expect(d.railRelief, d.id).toBeUndefined();
      }
    }
  });
});

describe('parseOne — os campos novos perdoam como os velhos', () => {
  it('skin estranha cai em chapa, topRailMaterial vazio cai no padrão', () => {
    setImplementCatalog({ implements: [
      { id: 'x', file: 'x.glb', skin: 'papelão', topRailMaterial: '', railSkirt: 12, body: 'sider', arrangement: 1 },
    ] });
    const d = getImplement('x')!;
    expect(d.railSkirt).toBeUndefined();
    expect(d.body).toBeUndefined();
    expect(d.arrangement).toBeUndefined();
    expect(d.skin).toBe('chapa');
    expect(d.topRailMaterial).toBeUndefined();
    expect(topRailRegexOf(d)).toBeUndefined();
  });

  it('manifesto inútil devolve o implemento de código', () => {
    setImplementCatalog(null);
    expect(getImplements()).toEqual([LEGACY_IMPLEMENT]);
  });
});
