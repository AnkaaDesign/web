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
});
