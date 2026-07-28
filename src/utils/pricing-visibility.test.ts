/**
 * The screen/document split: hiding values is a screen affordance, so anything the user
 * deliberately GENERATES (PDF, planilha, quote text) — and the client-side search index —
 * must still carry the real numbers.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getPricingVisible, setPricingVisible, subscribePricingVisible, withPricingVisible } from "./pricing-visibility";
import { formatCurrency, formatCurrencyUnmasked } from "./number";
import { rawColumnValue } from "@/components/ui/datatable/data-table-utils";

beforeEach(() => setPricingVisible(false));

describe("withPricingVisible", () => {
  it("forces values visible inside the scope and restores after", () => {
    expect(getPricingVisible()).toBe(false);
    const inside = withPricingVisible(() => getPricingVisible());
    expect(inside).toBe(true);
    expect(getPricingVisible()).toBe(false);
  });

  it("nests without leaking (inner scope must not un-force the outer one)", () => {
    withPricingVisible(() => {
      withPricingVisible(() => undefined);
      expect(getPricingVisible()).toBe(true);
    });
    expect(getPricingVisible()).toBe(false);
  });

  it("restores even when the callback throws", () => {
    expect(() =>
      withPricingVisible(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(getPricingVisible()).toBe(false);
  });

  it("does not notify subscribers or unmask the screen", () => {
    let notified = 0;
    const unsubscribe = subscribePricingVisible(() => notified++);
    withPricingVisible(() => formatCurrencyUnmasked(10));
    unsubscribe();
    expect(notified).toBe(0);
    expect(getPricingVisible()).toBe(false);
  });
});

describe("formatCurrencyUnmasked", () => {
  it("prints real values while the screen is masked", () => {
    expect(formatCurrency(1234.5)).toBe("R$ ••••••");
    expect(formatCurrencyUnmasked(1234.5)).toContain("1.234,50");
  });

  it("matches formatCurrency once values are revealed", () => {
    setPricingVisible(true);
    expect(formatCurrencyUnmasked(1234.5)).toBe(formatCurrency(1234.5));
  });
});

describe("rawColumnValue (export + client-side search)", () => {
  const column = {
    id: "price",
    meta: { exportValue: (row: { price: number }) => formatCurrency(row.price) },
  } as never;

  it("exports the real value while the screen is masked", () => {
    expect(formatCurrency(99.9)).toBe("R$ ••••••");
    expect(rawColumnValue(column, { price: 99.9 })).toContain("99,90");
  });
});
