import { useEffect, useRef } from "react";

import { mountStudio, unmountStudio } from "./engine";
import { setColorProvider, setColorPersister, FINISH_FROM_API } from "./engine/catalog/colors";
import { updatePaint } from "@/api-client/paint";
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
 * Publicado em /ferramentas/estudio-3D, no menu de navegação e no hub de
 * Ferramentas (grupo "Cores"). O acesso continua restrito a ADMIN pelo gate em
 * utils/route-privileges.ts — mudar o público é editar aquela linha, não o menu.
 *
 * A geometria não é servida por esta origem: vem da API sob STUDIO_ASSETS_BASE
 * (runbook em api/docs/DEPLOYMENT-studio-assets.md).
 *
 * Fluxo: o estúdio abre num seletor de cards de CINCO passos — cenário →
 * fabricante → modelo → chassi → cor — e então uma cortina animada cobre o download e
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
/**
 * O endpoint PÚBLICO de cores do estúdio.
 *
 * `GET /studio/colors` — sem autenticação, sem paginação, ordenado por
 * `colorOrder ASC, name ASC`, com `Cache-Control: public, max-age=86400`. Ele
 * devolve só o que o estúdio usa (`id, name, hex, finish, code, colorOrder,
 * brand, manufacturer, previewConfig`) e nunca fórmula, componente ou custo.
 *
 * POR QUE PRODUÇÃO, E NÃO A ORIGEM DA PÁGINA. O estúdio precisa de cor mesmo
 * sem uma API local rodando — é a mesma decisão que já vale para a árvore de
 * assets. `VITE_STUDIO_COLORS_URL` existe para apontar a um servidor local
 * quando se está justamente mexendo neste endpoint.
 *
 * ⚠️ NÃO É `getPaints()`. Aquele é o api-client autenticado e pagina em 20; e o
 * enum→id de catálogo (`MERCEDES_BENZ` → `mb`) que este arquivo fazia à mão
 * SAIU: o servidor já devolve o id do catálogo. Duas cópias da mesma tradução
 * são uma divergência esperando a próxima montadora.
 */
const STUDIO_COLORS_URL: string =
  (import.meta.env?.VITE_STUDIO_COLORS_URL as string | undefined)?.trim()
  || "https://api.ankaadesign.com.br/studio/colors";

/* Teto de espera. Sem ele, uma API que aceita a conexão e nunca responde
   deixaria loadColors() pendurado — e loadColors() é aguardado no boot, ao lado
   do catálogo, então o estúdio nunca abriria. Um provedor lento tem de custar a
   paleta do banco, jamais a página. */
const COLORS_TIMEOUT_MS = 8000;

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

/** Uma linha de `GET /studio/colors`, ainda sem validar (o engine valida). */
interface StudioColorRow {
  id?: unknown;
  name?: unknown;
  hex?: unknown;
  finish?: unknown;
  code?: unknown;
  brand?: unknown;
  manufacturer?: unknown;
  previewConfig?: unknown;
}

setColorProvider(async () => {
  /* AbortSignal.timeout tem suporte universal nos alvos deste app; o `?.` é
     para o jsdom do Vitest, onde o polyfill pode não estar. Sem sinal, a
     requisição simplesmente não tem teto — inconveniente, nunca fatal. */
  const signal = AbortSignal.timeout?.(COLORS_TIMEOUT_MS);
  const res = await fetch(STUDIO_COLORS_URL, {
    signal,
    /* Rota pública: nenhum cabeçalho de autenticação, e `omit` para o navegador
       não anexar cookie de sessão numa requisição cross-origin que não precisa
       dele (seria preflight de graça, e um 401 onde deveria haver 200). */
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    /* UMA mensagem clara, e ela vai para o `console.warn` de
       engine/catalog/colors.ts junto com "usando a paleta embutida". O 404 é o
       caminho ESPERADO enquanto o endpoint não é implantado — ver o README de
       implantação —, então a mensagem tem de dizer isso em vez de parecer um
       bug do estúdio. */
    throw new Error(
      `GET ${STUDIO_COLORS_URL} → ${res.status}`
      + (res.status === 404
        ? " (endpoint público de cores ainda não implantado na API)"
        : ""),
    );
  }
  const body = (await res.json()) as { data?: unknown };
  const rows: StudioColorRow[] = Array.isArray(body?.data) ? body.data as StudioColorRow[] : [];
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    hex: p.hex,
    /* O banco tem cinco acabamentos (SOLID/METALLIC/PEARL/MATTE/SATIN) e o
       motor de tinta tem três; o mapa mora no ENGINE porque a conversão é dele.
       O servidor manda o valor cru de propósito — inventar um acabamento do
       lado de lá tiraria do estúdio a única decisão que é mesmo dele. */
    finish: typeof p.finish === "string" ? FINISH_FROM_API[p.finish] : undefined,
    code: p.code ?? null,
    /* Já achatado pelo servidor (`paintBrand.name`). */
    brand: p.brand ?? null,
    /* JÁ É O ID DO CATÁLOGO (`scania`, `mb`, `vw`…), traduzido no servidor.
       A tabela enum→id que ficava aqui foi apagada: com o servidor traduzindo,
       ela era uma segunda definição da mesma coisa, e a próxima montadora
       entraria num lado e não no outro. */
    manufacturer: p.manufacturer ?? null,
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
