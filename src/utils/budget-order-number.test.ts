import { describe, expect, it } from "vitest";
import { normalizeOrderNumber, orderNumberInheritance } from "./budget-order-number";

describe("orderNumberInheritance", () => {
  it("um número registrado vale para o orçamento: os sem número herdam", () => {
    expect(
      orderNumberInheritance([{ customerOrderNumber: " 4500 " }, { customerOrderNumber: null }, {}]),
    ).toEqual({ inherited: "4500", registered: ["4500"], missing: 2 });
  });
  it("o mesmo número repetido continua sendo um pedido só", () => {
    expect(orderNumberInheritance([{ customerOrderNumber: "4500" }, { customerOrderNumber: "4500" }]).inherited).toBe(
      "4500",
    );
  });
  it("números diferentes (legado) não dão herança", () => {
    const r = orderNumberInheritance([{ customerOrderNumber: "1" }, { customerOrderNumber: "2" }, {}]);
    expect(r.inherited).toBeNull();
    expect(r.registered).toEqual(["1", "2"]);
    expect(r.missing).toBe(1);
  });
  it("nenhum número: nada a herdar", () => {
    expect(orderNumberInheritance([{}, null])).toEqual({ inherited: null, registered: [], missing: 2 });
  });
  it("normaliza como a API", () => {
    expect(normalizeOrderNumber("  PC  4500 ")).toBe("PC 4500");
    expect(normalizeOrderNumber(42)).toBe("");
  });
  // Os casos de `scripts/verify-order-number-gate.ts` (API) que dependem do pedido do portal e do escopo.
  it("pedido do portal (purchaseOrderId) conta como pedido: não falta", () => {
    expect(orderNumberInheritance([{ purchaseOrderId: "po-1", customerOrderNumber: null }]).missing).toBe(0);
  });
  it("herança a partir do nº do pedido do portal", () => {
    const r = orderNumberInheritance([
      { purchaseOrderId: "po-1", purchaseOrder: { number: "4500" } },
      { customerOrderNumber: null },
    ]);
    expect(r.inherited).toBe("4500");
    expect(r.missing).toBe(1);
  });
  it("veículo cancelado sai do escopo", () => {
    const r = orderNumberInheritance([{ customerOrderNumber: "4500" }, { status: "CANCELLED", customerOrderNumber: "9" }]);
    expect(r).toEqual({ inherited: "4500", registered: ["4500"], missing: 0 });
  });
  it("todos cancelados: o conjunto inteiro volta", () => {
    expect(orderNumberInheritance([{ status: "CANCELLED" }, { status: "CANCELLED" }]).missing).toBe(2);
  });
});
