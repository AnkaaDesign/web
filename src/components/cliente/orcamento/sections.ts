// web/src/components/cliente/orcamento/sections.ts
//
// O RECORTE DA TELA — quais blocos do orçamento este contato enxerga.
//
// ⛔ SÃO DUAS RÉGUAS, E CONFUNDI-LAS FOI O DEFEITO DESTE ARQUIVO.
//
//   1. A RÉGUA DA ASSINATURA — `sectionsForRoles()` /
//      `ROLE_DEFAULT_SECTIONS` (`api/src/modules/common/signature/
//      quote-sections.ts`). Responde "qual recorte do PDF esta pessoa assina?",
//      e o conjunto VAZIO ali significa literalmente "este contato NÃO ASSINA" —
//      é o padrão do Gestor de Frota e do Motorista, e `withAlwaysSections`
//      preserva o vazio de propósito. `createEnvelope` decide quem assina por
//      `sections.length > 0`.
//
//   2. A RÉGUA DA TELA — `portalSectionsFor()`
//      (`api/src/modules/people/portal/portal-capabilities.ts`), que é a
//      primeira UNIDA com o que as CAPACIDADES implicam
//      (`SECTION_IMPLIED_BY_CAPABILITY`).
//
// Este arquivo espelhava só a primeira e a usava para as duas perguntas. O
// efeito, campo por campo:
//
//   · FLEET_MANAGER e DRIVER recebiam `[]` e a tela concluía "você vê apenas o
//     cabeçalho" — enquanto o servidor lhes manda `VEHICLE` + `DELIVERY`, que é
//     exatamente o trabalho deles (escrever placa e chassi, acompanhar o
//     serviço). O `PATCH` funcionava e o `GET` parecia vazio;
//   · MARKETING perdia `DELIVERY`, que a capacidade `TRACK` implica.
//
// ⚠️ E O CONTRÁRIO TAMBÉM É VERDADE: derivar "esta pessoa assina?" da régua da
// TELA faria o card de Assinaturas aparecer para o Gestor de Frota, que nunca
// vai receber envelope nenhum. Por isso `portalRoleSigns` recebe PAPÉIS e
// consulta a régua 1, e nunca a lista de seções que a tela está usando.
//
// ⚠️ NADA AQUI É SEGURANÇA. Quem recorta de verdade é o `select` do servidor.
// Este espelho serve para a tela NÃO DESENHAR O QUE NÃO VEM, e para o primeiro
// render (antes de a resposta chegar com a lista de verdade). Quando o servidor
// manda `sections`, é ela que vale — ver `resolvePortalSections`.
import { RESPONSIBLE_ROLE } from "@/constants/enums";
import { QUOTE_SECTIONS, effectiveSections, type QuoteSection } from "@/api-client/signature";
import { PORTAL_CAPABILITY, capabilitiesForRoles } from "@/utils/portal-capabilities";

/** O instrumento inteiro. */
const FULL: readonly QuoteSection[] = QUOTE_SECTIONS;

/**
 * RÉGUA 1 — papel → seções que ele ASSINA. Espelho de `ROLE_DEFAULT_SECTIONS`.
 *
 * ⚠️ `VEHICLE` NÃO aparece nas listas parciais de propósito, exatamente como na
 * API: quem a acrescenta é `effectiveSections` (o `withAlwaysSections` de lá),
 * num lugar só. Declará-la aqui criaria uma segunda fonte de verdade sobre o que
 * é obrigatório, e as duas divergiriam.
 *
 * ⚠️ `FLEET_MANAGER` e `DRIVER` ficam com o conjunto VAZIO — e vazio continua
 * vazio depois de `effectiveSections`. É deliberado: eles não assinam orçamento.
 * O que eles VEEM é outra coisa, e sai de `portalSectionsForRoles`.
 */
export const PORTAL_ROLE_SECTIONS: Record<string, readonly QuoteSection[]> = {
  [RESPONSIBLE_ROLE.COMMERCIAL]: FULL,
  [RESPONSIBLE_ROLE.SELLER]: FULL,
  [RESPONSIBLE_ROLE.REPRESENTATIVE]: FULL,
  [RESPONSIBLE_ROLE.COORDINATOR]: FULL,
  [RESPONSIBLE_ROLE.PURCHASING]: FULL,
  [RESPONSIBLE_ROLE.FINANCIAL]: ["SERVICES", "PRICING", "DELIVERY", "PAYMENT", "GUARANTEE"],
  [RESPONSIBLE_ROLE.MARKETING]: ["LAYOUT"],
  [RESPONSIBLE_ROLE.FLEET_MANAGER]: [],
  [RESPONSIBLE_ROLE.DRIVER]: [],
};

/**
 * A seção que cada CAPACIDADE implica para quem a tem.
 *
 * ⚠️ Espelho de `SECTION_IMPLIED_BY_CAPABILITY`. A lógica de cada linha está
 * escrita lá, e vale repetir a que mais surpreende: `WRITE_PURCHASE_ORDER`
 * implica `PAYMENT` porque o número do pedido é dado FISCAL — sem ele a nota não
 * sai.
 */
export const PORTAL_SECTION_IMPLIED_BY_CAPABILITY: Record<PORTAL_CAPABILITY, readonly QuoteSection[]> = {
  [PORTAL_CAPABILITY.REQUEST_BUDGET]: ["VEHICLE", "LAYOUT"],
  [PORTAL_CAPABILITY.PRE_APPROVE]: ["VEHICLE", "SERVICES", "PRICING"],
  [PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER]: ["VEHICLE", "PAYMENT"],
  [PORTAL_CAPABILITY.WRITE_VEHICLE_IDENTITY]: ["VEHICLE"],
  [PORTAL_CAPABILITY.TRACK]: ["VEHICLE", "DELIVERY"],
};

/**
 * RÉGUA 1, aplicada a uma lista de papéis: o que este contato ASSINA.
 *
 * UNIÃO, nunca interseção — a mesma semântica de `sectionsForRoles`, de
 * `capabilitiesForRoles` e de `hasRole`. Quem acumula papéis assina MAIS, não
 * menos.
 */
export function sectionsForResponsibleRoles(roles: readonly string[] | null | undefined): QuoteSection[] {
  const union = new Set<string>();
  for (const role of roles ?? []) {
    for (const section of PORTAL_ROLE_SECTIONS[role] ?? []) union.add(section);
  }
  // Canonicaliza pela ordem de `QUOTE_SECTIONS` antes de entregar, porque
  // `effectiveSections` assume entrada já tipada como seção conhecida.
  return effectiveSections(QUOTE_SECTIONS.filter((s) => union.has(s)));
}

/**
 * RÉGUA 2 — o que este contato VÊ no portal: o que ele assinaria ∪ o que as
 * capacidades dele implicam. Espelho de `portalSectionsFor`.
 *
 * Para quem já recebe o documento inteiro (Comercial, Vendedor, Representante,
 * Coordenador, Compras) a união é no-op. Ela só tem efeito nos três papéis de
 * recorte estreito — e é exatamente lá que o portal precisava dela.
 */
export function portalSectionsForRoles(roles: readonly string[] | null | undefined): QuoteSection[] {
  const union = new Set<string>(sectionsForResponsibleRoles(roles));
  for (const capability of capabilitiesForRoles(roles ? [...roles] : [])) {
    for (const section of PORTAL_SECTION_IMPLIED_BY_CAPABILITY[capability] ?? []) {
      union.add(section);
    }
  }
  // ⚠️ `effectiveSections` no fim, como o `withAlwaysSections` do servidor: a
  // ordem canônica e a injeção de `VEHICLE` têm de ser as MESMAS nos dois
  // caminhos. Note que aqui a união NUNCA é vazia para quem tem capacidade
  // alguma — o vazio é privilégio da régua da assinatura.
  return effectiveSections(QUOTE_SECTIONS.filter((s) => union.has(s)));
}

/**
 * O recorte EFETIVO deste contato, com a lista que o SERVIDOR declarou tendo
 * precedência sobre o espelho local.
 *
 * O espelho existe para a tela não pedir o que não vem; a lista do servidor
 * existe porque é ela que manda. Quando o detalhe traz `sections`, ela ganha —
 * assim uma mudança de régua na API aparece na tela sem publicar front, e o
 * espelho fica sendo só o recuo para a resposta que não a trouxe.
 */
export function resolvePortalSections(
  roles: readonly string[] | null | undefined,
  fromServer?: readonly string[] | null,
): QuoteSection[] {
  // `Array.isArray` e não `fromServer?.length`: a lista VAZIA é uma resposta
  // legítima ("este papel não vê nada deste orçamento"), e tratá-la como
  // ausência faria o espelho local devolver seções que o servidor acabou de
  // negar — exatamente a moldura vazia que este módulo existe para evitar.
  if (Array.isArray(fromServer)) {
    return QUOTE_SECTIONS.filter((s) => fromServer.includes(s));
  }
  return portalSectionsForRoles(roles);
}

/** Tem a seção? Escrito como função para o call site ler como frase. */
export function hasPortalSection(
  sections: readonly QuoteSection[] | null | undefined,
  section: QuoteSection,
): boolean {
  return (sections ?? []).includes(section);
}

/**
 * ESTE CONTATO ASSINA?
 *
 * ⛔ RECEBE PAPÉIS, E NÃO A LISTA DE SEÇÕES DA TELA. É a RÉGUA 1 que responde
 * isto, e só ela: recorte de assinatura vazio quer dizer "não assina esta
 * coleta" — o padrão do Gestor de Frota e do Motorista, e a distinção que
 * sustenta o recurso inteiro (`withAlwaysSections` preserva o vazio de
 * propósito, e `createEnvelope` decide por `sections.length > 0`).
 *
 * A versão anterior recebia as seções que a TELA estava usando. Depois que
 * aquela lista passou a incluir o que as capacidades implicam — que é o certo
 * para desenhar —, ela deixa de ser vazia para esses dois papéis, e o card de
 * Assinaturas apareceria para quem nunca vai receber envelope nenhum.
 */
export function portalRoleSigns(roles: readonly string[] | null | undefined): boolean {
  return sectionsForResponsibleRoles(roles).length > 0;
}
