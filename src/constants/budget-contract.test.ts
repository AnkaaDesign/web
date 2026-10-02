import { describe, expect, it } from "vitest";
import { enums } from "@/generated/contracts/enums.json";
import {
  BUDGET_SIGNATURE_STATUS,
  BUDGET_VALUE_APPROVAL_SOURCE,
  LAYOUT_APPROVAL_SOURCE,
  LAYOUT_STATUS,
  RESPONSIBLE_ROLE,
  TASK_QUOTE_STATUS,
} from "./enums";
import {
  BUDGET_LIST_STATUSES,
  BUDGET_MANUAL_TRANSITIONS,
  BUDGET_STATUS_LABELS,
  BUDGET_STATUS_ORDER,
  isBudgetBillable,
} from "./budget-contract";

const sorted = (values: readonly string[]) => [...values].sort();

describe("o web fala o contrato da API (orçamento)", () => {
  it.each([
    ["TASK_QUOTE_STATUS", TASK_QUOTE_STATUS],
    ["BUDGET_SIGNATURE_STATUS", BUDGET_SIGNATURE_STATUS],
    ["BUDGET_VALUE_APPROVAL_SOURCE", BUDGET_VALUE_APPROVAL_SOURCE],
    ["LAYOUT_STATUS", LAYOUT_STATUS],
    ["LAYOUT_APPROVAL_SOURCE", LAYOUT_APPROVAL_SOURCE],
    ["RESPONSIBLE_ROLE", RESPONSIBLE_ROLE],
  ] as const)("%s tem exatamente os valores do contrato", (name, local) => {
    const contract = (enums as Record<string, string[]>)[name];
    expect(contract, `${name} sumiu do contrato`).toBeDefined();
    expect(sorted(Object.values(local))).toEqual(sorted(contract));
  });

  it("não existe mais PRE_APPROVED", () => {
    expect(Object.values(TASK_QUOTE_STATUS)).not.toContain("PRE_APPROVED");
  });

  it("todo estado tem rótulo, ordem e linha de transição", () => {
    for (const status of Object.values(TASK_QUOTE_STATUS)) {
      expect(BUDGET_STATUS_LABELS[status]).toBeTruthy();
      expect(BUDGET_STATUS_ORDER[status]).toBeGreaterThan(0);
      expect(BUDGET_MANUAL_TRANSITIONS[status]).toBeDefined();
    }
  });

  it("a lista de vivos não pede o legado SIGNED", () => {
    expect(BUDGET_LIST_STATUSES).not.toContain(TASK_QUOTE_STATUS.SIGNED);
    expect(BUDGET_LIST_STATUSES).toContain(TASK_QUOTE_STATUS.REQUESTED);
  });

  it("cobrável = valor aprovado E assinatura resolvida", () => {
    expect(isBudgetBillable({ status: "APPROVED", signatureStatus: "NOT_ISSUED" })).toBe(false);
    expect(isBudgetBillable({ status: "APPROVED", signatureStatus: "SIGNED_OFFLINE" })).toBe(true);
    expect(isBudgetBillable({ status: "PENDING", signatureStatus: "SIGNED" })).toBe(false);
    expect(isBudgetBillable({ status: "PENDING", billable: true })).toBe(true);
  });
});
