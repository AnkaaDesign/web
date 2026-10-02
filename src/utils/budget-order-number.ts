/**
 * O Nº DO PEDIDO DE COMPRA NO ORÇAMENTO — UM pedido por orçamento, com herança.
 *
 * Regra DD12.1 (merge da `main` de 30/09; `order-number-gate.ts` na API): o
 * cliente emite UM pedido de compra para o lote, não um por caminhão. Quando os
 * veículos que já têm número concordam num único valor, esse é o pedido do
 * orçamento — os que estão sem número o HERDAM (na assinatura de Compras, o
 * servidor grava o herdado neles). Números diferentes já registrados (legado)
 * não dão herança.
 *
 * A tela usa isto para dizer, no passo Veículos, qual é o pedido do orçamento e
 * quem vai herdá-lo — em vez de deixar o operador digitar o mesmo número N vezes,
 * ou achar que um veículo em branco está "sem pedido".
 *
 * Puro; espelha `inheritedOrderNumber` da API.
 */

export interface OrderNumberVehicleLike {
  customerOrderNumber?: string | null;
  /** Status da tarefa: veículo CANCELADO sai do escopo (como na API). */
  status?: string | null;
  /** O pedido de compra registrado pelo portal — conta como pedido (DD12). */
  purchaseOrderId?: string | null;
  /** O nº desse pedido, quando a consulta o traz — entra na herança (DD12.1). */
  purchaseOrder?: { number?: string | null } | null;
}

/** Espaços das pontas fora e internos colapsados — a normalização da API. */
export function normalizeOrderNumber(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export interface OrderNumberInheritance {
  /** O pedido único do orçamento, que os sem número herdam; `null` se não há ou se divergem. */
  inherited: string | null;
  /** Os números registrados, sem repetição. Mais de um = divergência (legado). */
  registered: string[];
  /** Quantos veículos (do escopo) estão sem pedido. */
  missing: number;
}

/**
 * Espelha `orderNumberRequirement` da API (`order-number-gate.ts`):
 *  · ESCOPO: veículos não cancelados; se TODOS estiverem cancelados, o conjunto
 *    inteiro volta (a regra não some por causa de uma anomalia);
 *  · O NÚMERO VISÍVEL de cada veículo: o digitado, senão o do pedido do portal;
 *  · TEM PEDIDO: número visível ∨ `purchaseOrderId` (pedido do portal sem o nº
 *    carregado continua sendo pedido — não é contado como "sem pedido");
 *  · HERANÇA: um único número visível no escopo vale para os que não têm.
 */
export function orderNumberInheritance(vehicles: readonly (OrderNumberVehicleLike | null | undefined)[]): OrderNumberInheritance {
  const all = vehicles.map((v) => v ?? {});
  const live = all.filter((v) => v.status !== "CANCELLED");
  const scope = live.length ? live : all;
  const values = scope.map(
    (v) => normalizeOrderNumber(v.customerOrderNumber) || normalizeOrderNumber(v.purchaseOrder?.number),
  );
  const registered = [...new Set(values.filter(Boolean))];
  return {
    inherited: registered.length === 1 ? registered[0] : null,
    registered,
    missing: scope.filter((v, i) => !values[i] && !v.purchaseOrderId).length,
  };
}
