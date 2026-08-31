import { describe, it, expect, beforeAll } from "vitest";
import { generatePaymentText } from "./quote-text-generators";
import { setPricingVisible } from "./pricing-visibility";

// The generator now uses formatCurrencyUnmasked, so it prints real values regardless of
// the staff eye-toggle. Kept hidden here on purpose: it pins that behaviour.
beforeAll(() => setPricingVisible(false));

describe("generatePaymentText", () => {
  it("names the settlement method inside the installments clause", () => {
    const text = generatePaymentText({
      customPaymentText: null,
      paymentConfig: { type: "INSTALLMENTS", method: "BANK_SLIP", installmentCount: 4, installmentStep: 20, entryDays: 1 },
      total: 5998.68,
    });
    expect(text).toContain("em 4 (quatro) parcelas de");
    expect(text).toContain("via boleto, com entrada para 1 dia a partir da finalização do serviço");
    expect(text).toContain("e as demais a cada 20 dias.");
  });

  it("names the settlement method inside the à vista clause", () => {
    const text = generatePaymentText({
      customPaymentText: null,
      paymentConfig: { type: "CASH", method: "BANK_SLIP", cashDays: 40 },
      total: 8360,
    });
    expect(text).toContain("Pagamento à vista no valor de");
    expect(text).toContain("via boleto, para 40 dias a partir da finalização do serviço.");
  });

  it("says 'via Pix' for a Pix config", () => {
    const text = generatePaymentText({
      customPaymentText: null,
      paymentConfig: { type: "CASH", method: "PIX", cashDays: 5 },
      total: 100,
    });
    expect(text).toContain("via Pix, para 5 dias");
  });

  it("falls back to boleto — what the API stamps — when no method is configured", () => {
    const text = generatePaymentText({
      customPaymentText: null,
      paymentConfig: { type: "CASH", cashDays: 1 },
      total: 100,
    });
    expect(text).toContain("via boleto, para 1 dia a partir");
  });

  it("uses the concrete vencimento once the first due date is known (dossiê)", () => {
    const firstDueDate = new Date(2026, 6, 20); // 20/07/2026
    expect(
      generatePaymentText({
        customPaymentText: null,
        paymentConfig: { type: "INSTALLMENTS", method: "BANK_SLIP", installmentCount: 4, installmentStep: 20, entryDays: 1 },
        total: 5998.68,
        firstDueDate,
      }),
    ).toContain("via boleto, com entrada em 20/07/2026 e as demais a cada 20 dias.");

    expect(
      generatePaymentText({
        customPaymentText: null,
        paymentConfig: { type: "CASH", method: "BANK_SLIP", cashDays: 40 },
        total: 8360,
        firstDueDate,
      }),
    ).toContain("via boleto, com vencimento em 20/07/2026.");
  });

  it("lets the real installments' method override the configured one", () => {
    const text = generatePaymentText({
      customPaymentText: null,
      paymentConfig: { type: "CASH", method: "BANK_SLIP", cashDays: 5 },
      total: 100,
      paymentMethod: "PIX",
    });
    expect(text).toContain("via Pix");
  });

  it("gives the legacy paymentCondition enum the same wording as the config", () => {
    const legacy = generatePaymentText({
      customPaymentText: null,
      paymentCondition: "CASH_40",
      total: 8360,
    });
    const structured = generatePaymentText({
      customPaymentText: null,
      paymentConfig: { type: "CASH", method: "BANK_SLIP", cashDays: 40 },
      total: 8360,
    });
    expect(legacy).toBe(structured);
  });

  it("returns custom free text verbatim and nothing for CUSTOM/absent terms", () => {
    expect(
      generatePaymentText({ customPaymentText: "Combinado no ato.", paymentCondition: "CASH_5", total: 10 }),
    ).toBe("Combinado no ato.");
    expect(generatePaymentText({ customPaymentText: null, paymentCondition: "CUSTOM", total: 10 })).toBe("");
    expect(generatePaymentText({ customPaymentText: null, total: 10 })).toBe("");
  });

  // Regressão: orçamento 952 (Confiança / JAD Zogheib). O `customPaymentText` legado viaja no
  // orçamento clonado e nenhuma tela o escreve ou apaga, então ele NÃO pode atropelar o config
  // estruturado — a tela mostrava "À Vista - Boleto, 10/09/2026" e o PDF saía "À COMBINAR".
  it("ignores a leftover customPaymentText when a structured config exists", () => {
    const text = generatePaymentText({
      customPaymentText: "À COMBINAR",
      paymentConfig: { type: "CASH", method: "BANK_SLIP", cashDays: 5, specificDate: "2026-09-10" },
      paymentCondition: null,
      total: 38484.5,
    });
    expect(text).not.toContain("COMBINAR");
    expect(text).toContain("Pagamento à vista no valor de");
    expect(text).toContain("via boleto, com vencimento em 10/09/2026.");
  });

  it("keeps the free text when it IS the chosen condition (legacy CUSTOM)", () => {
    expect(
      generatePaymentText({
        customPaymentText: "50% na entrada, 50% na entrega",
        paymentConfig: { type: "CASH", method: "BANK_SLIP", cashDays: 5 },
        paymentCondition: "CUSTOM",
        total: 100,
      }),
    ).toBe("50% na entrada, 50% na entrega");
  });

  it("keeps the free text when there is no structured config at all", () => {
    expect(
      generatePaymentText({
        customPaymentText: "À COMBINAR",
        paymentCondition: null,
        total: 100,
      }),
    ).toBe("À COMBINAR");
  });
});
