// web/src/utils/portal-capabilities.ts
//
// O QUE CADA PAPEL DE CONTATO PODE FAZER NO PORTAL.
//
// ⚠️ ESPELHO de `api/src/modules/people/portal/portal-capabilities.ts`. Divergir
// faz a tela oferecer um botão que o servidor devolve em 403 — que é a forma
// mais cara de descobrir que os dois mapas discordaram.
//
// ⚠️ ISTO NÃO SUBSTITUI O SERVIDOR. É recorte de INTERFACE: some o botão que a
// pessoa não usaria. O portão que vale está no `@PortalCapability` da API, e
// toda rota de escrita do portal passa por ele. Nunca trate esta lista como
// segurança.
//
// ── Por que existe um SEGUNDO mapa, além das seções ──────────────────────────
//
// `sectionsForRoles()` (a régua da assinatura, reusada pelo portal) responde
// "o que eu VEJO": VEHICLE, LAYOUT, SERVICES, PRICING, DELIVERY, PAYMENT,
// GUARANTEE. Não responde "o que eu FAÇO" — e são perguntas diferentes. O
// Financeiro do cliente vê preço e não pede orçamento; o Gestor de Frota não vê
// preço nenhum e é justamente quem sabe placa e chassi.
import { RESPONSIBLE_ROLE } from "@/constants/enums";

export enum PORTAL_CAPABILITY {
  /** Abrir uma requisição de orçamento. */
  REQUEST_BUDGET = "REQUEST_BUDGET",
  /** Aprovar o valor ou recusar um orçamento em negociação. */
  APPROVE_VALUE = "APPROVE_VALUE",
  /** Informar o número do pedido de compra. */
  WRITE_PURCHASE_ORDER = "WRITE_PURCHASE_ORDER",
  /** Escrever série, placa, chassi e plaqueta. */
  WRITE_VEHICLE_IDENTITY = "WRITE_VEHICLE_IDENTITY",
  /** Acompanhar o andamento do serviço. */
  TRACK = "TRACK",
  /** Aprovar ou reprovar a ARTE do implemento (DD5: Compras não aprova arte). */
  APPROVE_ARTWORK = "APPROVE_ARTWORK",
}

/**
 * Papel → o que ele faz.
 *
 * Duas escolhas que valem defesa, e estão no §2.1 do desenho:
 *
 *  • `FLEET_MANAGER` ganha `WRITE_VEHICLE_IDENTITY`. Ele não assina NADA hoje
 *    (`ROLE_DEFAULT_SECTIONS` lhe dá conjunto vazio), então o papel existia sem
 *    fazer nada — e é literalmente quem sabe a placa e o chassi da frota.
 *
 *  • `WRITE_PURCHASE_ORDER` está em TODOS os nove papéis, por decisão do dono:
 *    "vendedor também pode definir o número de pedido, não apenas o compras,
 *    todos os papéis — mas se não tiver, pelo menos o compras fica impedido de
 *    assinar". A regra anterior (só Compras e Financeiro) fazia um orçamento
 *    inteiro esperar uma pessoa específica digitar cinco dígitos.
 *    ⛔ O PORTÃO NÃO MUDOU: quem tem Compras como ÚNICA função segue sem
 *    assinar enquanto faltar o número. A exigência é sobre o ATO DE APROVAR,
 *    nunca sobre quem pode digitar.
 *    ⛔ E no servidor a implicação de seção desta capacidade ENCOLHEU para
 *    `['VEHICLE']`. Enquanto ela implicava `PAYMENT`, universalizá-la teria
 *    entregue parcelas e boletos ao Marketing e ao Motorista.
 */
/**
 * ⚠️ ESPELHO de `ROLE_CAPABILITIES` da API (`portal-capabilities.ts`). Tipado
 * `Record<RESPONSIBLE_ROLE, …>`: função nova no enum sem decisão aqui é ERRO DE
 * COMPILAÇÃO — com `Record<string>` as três funções da main de 28/09 caíam em
 * `undefined` e o portal abria em branco para elas.
 */
export const PORTAL_ROLE_CAPABILITIES: Record<RESPONSIBLE_ROLE, PORTAL_CAPABILITY[]> = {
  [RESPONSIBLE_ROLE.COMMERCIAL]: [
    PORTAL_CAPABILITY.REQUEST_BUDGET,
    PORTAL_CAPABILITY.APPROVE_VALUE,
    PORTAL_CAPABILITY.WRITE_VEHICLE_IDENTITY,
    PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER,
    PORTAL_CAPABILITY.TRACK,
    PORTAL_CAPABILITY.APPROVE_ARTWORK,
  ],
  [RESPONSIBLE_ROLE.SELLER]: [
    PORTAL_CAPABILITY.REQUEST_BUDGET,
    PORTAL_CAPABILITY.APPROVE_VALUE,
    PORTAL_CAPABILITY.WRITE_VEHICLE_IDENTITY,
    PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER,
    PORTAL_CAPABILITY.TRACK,
    PORTAL_CAPABILITY.APPROVE_ARTWORK,
  ],
  [RESPONSIBLE_ROLE.REPRESENTATIVE]: [
    PORTAL_CAPABILITY.REQUEST_BUDGET,
    PORTAL_CAPABILITY.APPROVE_VALUE,
    PORTAL_CAPABILITY.WRITE_VEHICLE_IDENTITY,
    PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER,
    PORTAL_CAPABILITY.TRACK,
    PORTAL_CAPABILITY.APPROVE_ARTWORK,
  ],
  [RESPONSIBLE_ROLE.COORDINATOR]: [
    PORTAL_CAPABILITY.REQUEST_BUDGET,
    PORTAL_CAPABILITY.APPROVE_VALUE,
    PORTAL_CAPABILITY.WRITE_VEHICLE_IDENTITY,
    PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER,
    PORTAL_CAPABILITY.TRACK,
    PORTAL_CAPABILITY.APPROVE_ARTWORK,
  ],
  // ⛔ Compras não aprova arte (DD5).
  [RESPONSIBLE_ROLE.PURCHASING]: [
    PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER,
    PORTAL_CAPABILITY.WRITE_VEHICLE_IDENTITY,
    PORTAL_CAPABILITY.TRACK,
  ],
  // Marketing pede o serviço e aprova a arte, e NÃO vê preço — `PRICING` não é dele.
  [RESPONSIBLE_ROLE.MARKETING]: [
    PORTAL_CAPABILITY.REQUEST_BUDGET,
    PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER,
    PORTAL_CAPABILITY.TRACK,
    PORTAL_CAPABILITY.APPROVE_ARTWORK,
  ],
  [RESPONSIBLE_ROLE.FINANCIAL]: [PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER],
  [RESPONSIBLE_ROLE.FLEET_MANAGER]: [
    PORTAL_CAPABILITY.WRITE_VEHICLE_IDENTITY,
    PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER,
    PORTAL_CAPABILITY.TRACK,
  ],
  [RESPONSIBLE_ROLE.DRIVER]: [PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER, PORTAL_CAPABILITY.TRACK],
  // PCP, Expedição e Logística (decisão do dono, 02/10): o PCP confere a
  // identidade do veículo, como o Gestor de Frota; Expedição e Logística
  // acompanham, como o Motorista. Nenhum pede orçamento, aprova valor ou arte.
  [RESPONSIBLE_ROLE.PRODUCTION_PLANNING]: [
    PORTAL_CAPABILITY.WRITE_VEHICLE_IDENTITY,
    PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER,
    PORTAL_CAPABILITY.TRACK,
  ],
  [RESPONSIBLE_ROLE.SHIPPING]: [PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER, PORTAL_CAPABILITY.TRACK],
  [RESPONSIBLE_ROLE.LOGISTICS]: [PORTAL_CAPABILITY.WRITE_PURCHASE_ORDER, PORTAL_CAPABILITY.TRACK],
};

/**
 * UNIÃO, nunca interseção — a mesma semântica de `sectionsForRoles` e de
 * `hasRole` no contexto do portal. Quem acumula papéis pode MAIS, não menos.
 */
export function capabilitiesForRoles(roles: string[] | undefined | null): PORTAL_CAPABILITY[] {
  if (!roles?.length) return [];
  const out = new Set<PORTAL_CAPABILITY>();
  for (const role of roles) {
    for (const cap of PORTAL_ROLE_CAPABILITIES[role as RESPONSIBLE_ROLE] ?? []) out.add(cap);
  }
  return [...out];
}

export function hasPortalCapability(
  roles: string[] | undefined | null,
  capability: PORTAL_CAPABILITY,
): boolean {
  return capabilitiesForRoles(roles).includes(capability);
}

/**
 * O contato cujo ÚNICO papel é Compras.
 *
 * Existe porque o portão do pedido de compra é literalmente sobre isto: quem só
 * é Compras assina apenas com o número do pedido na mão; quem acumula Compras
 * com Comercial, Vendedor, Representante ou Coordenador assina normalmente.
 *
 * ⚠️ `roles.length === 1` e não "inclui PURCHASING": a diferença é a regra.
 */
export function isPurchasingOnly(roles: string[] | undefined | null): boolean {
  return roles?.length === 1 && roles[0] === RESPONSIBLE_ROLE.PURCHASING;
}
