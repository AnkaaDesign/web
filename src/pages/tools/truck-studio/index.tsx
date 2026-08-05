import { useEffect, useRef } from "react";

import { mountStudio, unmountStudio } from "./engine";
import { setColorProvider, setColorPersister, FINISH_FROM_API } from "./engine/catalog/colors";
import { getPaints, updatePaint } from "@/api-client/paint";
import "./engine/core/studio.css";
import "./engine/ui/selector.css";
import "./engine/ui/loader.css";
import "./engine/ui/hud.css";
import "./engine/ui/paint-panel.css";

/**
 * Truck Studio — configurador 3D (visualizador three.js + editor de plotagem
 * fabric.js) de um semirreboque Frigorífico Paleteiro atrás de um cavalo
 * selecionável.
 *
 * Não listado de propósito: alcançável só em /ferramentas/teste enquanto a
 * funcionalidade está sendo construída. Não está no menu nem no hub Ferramentas.
 *
 * Fluxo: o estúdio abre num seletor de cards de QUATRO passos — cenário →
 * fabricante → modelo → cor — e então uma cortina animada cobre o download e
 * voa a foto do caminhão escolhido para um crachá no canto inferior esquerdo,
 * que é também por onde o seletor é reaberto. A escolha é lembrada, então uma
 * visita de volta cai direto na vista 3D. Tudo isso vive no engine
 * (ui/selector.ts + ui/loader.ts + studio.ts); esta página nunca vê a escolha.
 *
 * O engine é TypeScript puro sob ./engine — sem React, sem Tailwind. Ele é dono
 * da própria subárvore de DOM e sobrevive a trocas de rota; esta página só o
 * hospeda. Ver engine/index.ts para o mapa de módulos e engine/core/dom.ts para
 * por que a subárvore é construída uma vez e nunca destruída.
 *
 * As quatro folhas de estilo são importadas AQUI, e não pelos módulos que as
 * desenham. Isso é uma DEPENDÊNCIA, não uma ORDEM: `studio.css` precisa estar
 * presente porque declara as custom properties (`--bg`, `--panel`, `--accent`,
 * os tokens `--ts-glass-*`/`--ts-pill-*`/`--ts-plate-*`) e a regra `.hidden`
 * sobre as quais as outras três se apoiam.
 *
 * A ORDEM entre elas NÃO é carregante, e isso foi MEDIDO em 2026-08-03, não
 * deduzido — a pergunta trocou de resposta três vezes num só dia e merece o
 * método junto:
 *
 *   - custom property resolve no ponto de USO contra `.truck-studio-root`, então
 *     ordem de declaração entre arquivos não a alcança;
 *   - `.hidden` é `display:none !important`, que ganha de qualquer declaração
 *     não-important em qualquer posição da cascata;
 *   - e, o único argumento que realmente decide: extraindo os seletores dos
 *     quatro arquivos e cruzando, existe UM só declarado em dois deles —
 *     `.ts-corner`, em `studio.css` e `selector.css` — com ZERO propriedade em
 *     comum (lá `transition`/`translate`, cá posição e layout). Sem sobreposição
 *     não há disputa, e sem disputa a ordem não decide nada.
 *
 * ATENÇÃO AO MEDIR DE NOVO: uma contagem intermediária chegou a apontar ONZE
 * seletores duplicados e a concluir que a ordem era carregante. Era estado de
 * meio-caminho — a consolidação do vidro fosco/pílula/placa passou por hoistar
 * regras para `studio.css` antes de trocá-las por tokens. Medir uma árvore com
 * refatoração em voo mede a refatoração, não o código. Refaça a extração antes
 * de acreditar em qualquer número aqui, inclusive neste.
 *
 * Consequência prática: mover cada `.css` para o módulo que o desenha (o que
 * `engine/index.ts` descreve como o desenho pretendido) está LIBERADO.
 */

/**
 * Liga a paleta do estúdio à tabela `Paint` da API.
 *
 * FORA do engine de propósito: o engine não importa `@/` (a única exceção é
 * core/paths.ts), e é esta página — que já é React e já vive dentro do app —
 * quem tem o direito de falar com o api-client. O engine só conhece o contrato
 * `ColorProvider`, e cai na paleta embutida se isto falhar ou devolver vazio.
 *
 * ANTES de mountStudio(): loadColors() memoiza na primeira chamada, e o seletor
 * abre antes de qualquer 3D existir.
 *
 * NÃO PODE LANÇAR NA AVALIAÇÃO DO MÓDULO, e não lança: setColorProvider() só
 * guarda a função (com um `typeof` na frente) e invalida o memo. A função abaixo
 * só é INVOCADA dentro de doLoad(), que a envolve num try/catch e cai na paleta
 * embutida tanto num erro quanto numa lista vazia. Uma API fora do ar custa as
 * cores do banco, nunca o seletor.
 */
const PAINT_MANUFACTURER_TO_BRAND: Record<string, string> = {
  SCANIA: "scania",
  VOLVO: "volvo",
  DAF: "daf",
  IVECO: "iveco",
  MERCEDES_BENZ: "mb",
  VOLKSWAGEN: "vw",
};

/**
 * `previewConfig` do banco → a intenção cromática que o shader 3D sabe usar.
 *
 * O JSON do banco descreve um DESENHO 2D: uma lista de luzes com posição,
 * espalhamento e rotação num plano, mais `flipColor`, `flakeColor` e
 * `effectIntensity`. Posição e espalhamento não têm tradução num material PBR
 * sobre geometria de verdade — quem ilumina o caminhão é o rig do cenário, não
 * essa lista. O que atravessa é a COR.
 *
 * A regra do flip, e por que ela não é simplesmente `flipColor`: no ajuste do
 * `Verde Saiph` o `flipColor` é `#8c8c8c` (cinza), e o amarelo que aparece na
 * amostra vem de uma LUZ `#c7e52e`. Ou seja, no gerador 2D o efeito de ângulo é
 * pintado pelas luzes coloridas, e `flipColor` é só o quanto a cor lava para o
 * neutro. Num shader de perolizado quem faz esse papel é a cor de interferência.
 * Então: a luz colorida MAIS FORTE é o flip, e `flipColor` é o reserva para um
 * ajuste que só tenha luzes brancas.
 *
 * "Colorida" é medida por CROMA (max−min dos canais), não por saturação HSL —
 * mesmo motivo documentado em vehicle/paint.ts: o denominador do HSL colapsa
 * perto do branco e um `#fffffe` reportaria saturação alta.
 */
const EFFECT_LIGHT_MIN_CHROMA = 0.06;

function paintEffectFrom(cfg: unknown) {
  if (!cfg || typeof cfg !== "object") return null;
  const c = cfg as Record<string, unknown>;

  /* PRIMEIRO: isto é uma RECEITA DO LABORATÓRIO?
     `paint-lab.html` salva o conjunto PBR completo — `pearlFlip`, `pearlMid`,
     `flakeDensity`, `peelScale` e companhia. Quando o ajuste veio de lá, ele é a
     verdade sobre como a tinta se comporta em 3D e passa DIRETO; não há nada a
     inferir. `pearlFlip` é o marcador porque é o campo que o gerador 2D nunca
     escreve (lá o campo chama `flipColor`). */
  if (typeof c.pearlFlip === "string" || typeof c.pearlMid === "string") {
    return {
      /* A receita manda também na FACE e no ACABAMENTO. Não é redundância com a
         coluna `hex`: o `Vermelho Ruby` está gravado como `#750406` e a receita
         pede `#c01c28`, que é outro vermelho. `hex` é a cor de catálogo (a que
         vai na amostra chapada e no crachá); a receita é como a tinta se comporta
         sob luz, e quem foi medido no laboratório foi ela. */
      color: typeof c.color === "string" ? c.color : null,
      recipeFinish: typeof c.finish === "string" ? c.finish : null,
      flip: typeof c.pearlFlip === "string" ? c.pearlFlip : null,
      flake: typeof c.flakeColor === "string" ? c.flakeColor : null,
      intensity: 1,                       // a receita já traz as amplitudes
      metalness: c.metalness, roughness: c.roughness, gloss: c.gloss,
      pearlAmount: c.pearlAmount, pearlTravel: c.pearlTravel,
      flakeAmount: c.flakeAmount, flakeDensity: c.flakeDensity,
      peel: c.peel, peelScale: c.peelScale, peelDetail: c.peelDetail,
      pearlMid: typeof c.pearlMid === "string" ? c.pearlMid : null,
      flakeTilt: c.flakeTilt, flakeGloss: c.flakeGloss,
    };
  }
  const lights = Array.isArray(c.lights) ? (c.lights as Record<string, unknown>[]) : [];

  const chroma = (hex: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return -1;
    const n = parseInt(m[1], 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    return Math.max(r, g, b) - Math.min(r, g, b);
  };

  let flip: string | null = null;
  let best = -1;
  for (const l of lights) {
    const col = typeof l?.color === "string" ? l.color : null;
    if (!col) continue;
    const ch = chroma(col);
    if (ch < EFFECT_LIGHT_MIN_CHROMA) continue;      // luz branca: não é o efeito
    /* Desempate pela INTENSIDADE da luz, não pelo croma: duas luzes coloridas
       num ajuste são a cor de face e a cor de virada, e a que manda é a que o
       setor pesou mais. */
    const inten = Number(l?.intensity);
    const score = Number.isFinite(inten) ? inten : 0;
    if (score > best) { best = score; flip = col; }
  }
  if (!flip && typeof c.flipColor === "string") flip = c.flipColor;

  const flake = typeof c.flakeColor === "string" ? c.flakeColor : null;
  if (!flip && !flake) return null;

  const ei = Number(c.effectIntensity);
  return {
    flip,
    flake,
    /* `effectIntensity` é 0..100 no banco. */
    intensity: Number.isFinite(ei) ? Math.max(0, Math.min(1, ei / 100)) : 0.6,
  };
}

setColorProvider(async () => {
  const res = await getPaints({
    /* SÓ as tintas amarradas a uma montadora. São 77 de 522 — o resto do
       catálogo é tinta geral (e algumas linhas de teste), e o passo de cor do
       estúdio pergunta "de que cor este caminhão?", não "que tintas existem".
       Puxar as 522 traria nomes como `teste`/`dsfds` para a frente da paleta,
       porque `colorOrder` é 0 na maioria delas. */
    where: { manufacturer: { not: null } },
    /* `colorOrder` é a ordem curada pelo setor; o nome só desempata os zeros. */
    orderBy: [{ colorOrder: "asc" }, { name: "asc" }],
    include: { paintBrand: true },
    /* Teto folgado sobre as 77 de hoje: um lote novo de tintas entra sem
       precisar mexer aqui, e ainda assim existe um limite — sem ele o padrão do
       servidor decide, e ele pagina em 20. */
    limit: 200,
  });
  return (res?.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    hex: p.hex,
    /* O banco tem cinco acabamentos e o motor de tinta tem três; o mapa mora no
       engine porque a conversão é dele, não da API. */
    finish: FINISH_FROM_API[p.finish],
    code: p.code ?? null,
    brand: p.paintBrand?.name ?? null,
    /* Enum do banco → id do catálogo (brands.json). A tradução é AQUI porque
       este arquivo é React e pode importar `@/`; o engine não pode, e é o que
       o mantém portátil. */
    manufacturer: p.manufacturer
      ? PAINT_MANUFACTURER_TO_BRAND[p.manufacturer] ?? null
      : null,
    /* O ajuste curado, quando existe. 107 das 522 tintas têm um. */
    effect: paintEffectFrom(p.previewConfig),
  }));
});

/**
 * O caminho de volta: a receita ajustada no estúdio vira o `previewConfig` da
 * tinta.
 *
 * GRAVA O OBJETO INTEIRO, e não um merge com o que estava lá. A coluna tem DOIS
 * autores — o gerador de amostra 2D (luzes, `flipColor`, `effectIntensity`) e a
 * receita PBR — e eles descrevem a mesma tinta por caminhos que não se somam:
 * meio de um e meio do outro não é uma tinta, é um híbrido que nenhum dos dois
 * lados sabe ler. Quem grava por último manda, e `paintEffectFrom()` decide qual
 * dos dois formatos chegou pelo marcador `pearlFlip`.
 *
 * O schema da API preserva chave não declarada (`.passthrough()`), então os
 * campos da receita atravessam a validação intactos — foi para isso que ele
 * virou passthrough.
 */
setColorPersister(async (colorId, recipe) => {
  /* O molde: `previewConfigSchema` declara os campos do gerador 2D com
     `.default()`, então no tipo de SAÍDA do zod eles são obrigatórios — `lights`,
     `effectIntensity`, `flakeColor`, `flipColor` — e uma receita PBR, que não
     tem nenhum deles, não satisfaz esse tipo. Na ENTRADA são todos opcionais, e
     é a entrada que este payload é. O schema é `.passthrough()`, então os campos
     da receita atravessam a validação intactos. */
  await updatePaint(colorId, { previewConfig: recipe } as Parameters<typeof updatePaint>[1]);
});

export const TruckStudioPage = () => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    void mountStudio(host);
    return () => unmountStudio();
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = "Truck Studio | Ankaa";
    return () => {
      document.title = previous;
    };
  }, []);

  return <div ref={hostRef} className="h-full min-h-0" />;
};

export default TruckStudioPage;
