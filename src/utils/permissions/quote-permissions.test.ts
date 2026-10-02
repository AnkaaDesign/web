import { describe, expect, it } from "vitest";
import { SECTOR_PRIVILEGES, TASK_QUOTE_STATUS } from "@/constants/enums";
import { getAvailableQuoteStatusTransitions, isQuoteStatusChangeAllowed } from "./quote-permissions";

const { ADMIN, COMMERCIAL, FINANCIAL, PRODUCTION } = SECTOR_PRIVILEGES as Record<string, string>;

describe("isQuoteStatusChangeAllowed — espelho de budget.guards.ts na API", () => {
  it.each([
    [TASK_QUOTE_STATUS.APPROVED, TASK_QUOTE_STATUS.IN_NEGOTIATION, "aprovar o valor"],
    [TASK_QUOTE_STATUS.IN_NEGOTIATION, TASK_QUOTE_STATUS.PENDING, "enviar ao cliente"],
    [TASK_QUOTE_STATUS.PENDING, TASK_QUOTE_STATUS.APPROVED, "reprovar o valor"],
    [TASK_QUOTE_STATUS.PENDING, TASK_QUOTE_STATUS.IN_NEGOTIATION, "retirar do cliente"],
  ])("→ %s vindo de %s (%s) é só ADMIN e COMERCIAL", (to, from) => {
    expect(isQuoteStatusChangeAllowed(to, ADMIN, from)).toBe(true);
    expect(isQuoteStatusChangeAllowed(to, COMMERCIAL, from)).toBe(true);
    expect(isQuoteStatusChangeAllowed(to, FINANCIAL, from)).toBe(false);
  });

  it("o FINANCEIRO cancela e reabre o vencido", () => {
    expect(isQuoteStatusChangeAllowed(TASK_QUOTE_STATUS.CANCELLED, FINANCIAL, TASK_QUOTE_STATUS.PENDING)).toBe(true);
    expect(isQuoteStatusChangeAllowed(TASK_QUOTE_STATUS.PENDING, FINANCIAL, TASK_QUOTE_STATUS.EXPIRED)).toBe(true);
  });

  it("papel fora da lista ou vazio não pede nada", () => {
    expect(isQuoteStatusChangeAllowed(TASK_QUOTE_STATUS.CANCELLED, PRODUCTION ?? "PRODUCTION")).toBe(false);
    expect(isQuoteStatusChangeAllowed(TASK_QUOTE_STATUS.CANCELLED, "")).toBe(false);
  });
});

describe("getAvailableQuoteStatusTransitions", () => {
  it("o FINANCEIRO não vê os atos do valor a partir de Aguardando o cliente", () => {
    const financial = getAvailableQuoteStatusTransitions(TASK_QUOTE_STATUS.IN_NEGOTIATION as any, FINANCIAL);
    expect(financial).not.toContain(TASK_QUOTE_STATUS.APPROVED);
    expect(financial).not.toContain(TASK_QUOTE_STATUS.PENDING);
  });
  it("o COMERCIAL vê o grafo inteiro do contrato", () => {
    const commercial = getAvailableQuoteStatusTransitions(TASK_QUOTE_STATUS.IN_NEGOTIATION as any, COMMERCIAL);
    expect(commercial).toContain(TASK_QUOTE_STATUS.APPROVED);
  });
});
