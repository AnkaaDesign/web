import { describe, expect, it } from "vitest";
import {
  BUDGET_WIZARD_STEP,
  budgetStepOfField,
  budgetWizardSteps,
  checkBudgetStep,
  firstFailingStep,
  resolveStepJump,
} from "./budget-wizard";

const complete = {
  name: "Carlotti",
  customerId: "c1",
  expiresAt: new Date("2026-11-01"),
  plates: ["ABC1D23"],
  services: [{ description: "Pintura", invoiceToCustomerId: null }],
  customerConfigs: [{ customerId: "c1" }],
};

describe("budgetWizardSteps", () => {
  it("são sempre cinco, na ordem do dono", () => {
    const steps = budgetWizardSteps({ vehicleCount: 3, payerCount: 2 });
    expect(steps.map((s) => s.name)).toEqual(["Tarefa", "Veículos", "Serviços", "Faturamento", "Resumo"]);
    expect(steps.map((s) => s.id)).toEqual([1, 2, 3, 4, 5]);
    expect(steps[1].description).toBe("3 veículos");
    expect(steps[3].description).toBe("2 pagadores");
  });
  it("não cria um passo por cliente", () => {
    expect(budgetWizardSteps({ vehicleCount: 1, payerCount: 4 })).toHaveLength(5);
  });
});

describe("budgetStepOfField", () => {
  it("leva cada campo ao passo onde ele mora", () => {
    expect(budgetStepOfField("expiresAt")).toBe(BUDGET_WIZARD_STEP.TASK);
    expect(budgetStepOfField("guaranteeYears")).toBe(BUDGET_WIZARD_STEP.TASK);
    expect(budgetStepOfField("vehicles.2.plate")).toBe(BUDGET_WIZARD_STEP.VEHICLES);
    expect(budgetStepOfField("customerOrderNumber")).toBe(BUDGET_WIZARD_STEP.VEHICLES);
    expect(budgetStepOfField("services.0.amount")).toBe(BUDGET_WIZARD_STEP.SERVICES);
    expect(budgetStepOfField("customerConfigs.1.customerData.cnpj")).toBe(BUDGET_WIZARD_STEP.BILLING);
    expect(budgetStepOfField("billingGroups")).toBe(BUDGET_WIZARD_STEP.BILLING);
  });
});

describe("checkBudgetStep", () => {
  it("Tarefa exige a validade", () => {
    expect(checkBudgetStep(1, { ...complete, expiresAt: null })).toMatchObject({ ok: false, step: 1 });
    expect(checkBudgetStep(1, complete)).toEqual({ ok: true });
  });
  it("Veículos exige alguma identificação, na criação ou no detalhe", () => {
    expect(checkBudgetStep(2, { expiresAt: new Date() })).toMatchObject({ ok: false, step: 2 });
    expect(checkBudgetStep(2, { vehicles: [{ plate: "", serialNumber: "39088" }] })).toEqual({ ok: true });
    expect(checkBudgetStep(2, { serialNumbers: [1] })).toEqual({ ok: true });
  });
  it("Veículos recusa medidas que não fecham", () => {
    expect(checkBudgetStep(2, complete, { measuresError: "Lados diferentes" })).toMatchObject({
      ok: false,
      message: "Lados diferentes",
    });
  });
  it("Serviços exige um com descrição", () => {
    expect(checkBudgetStep(3, { services: [{ description: "  " }] })).toMatchObject({ ok: false });
  });
  it("Faturamento: pelo menos um pagador, todos com cliente, sem repetir", () => {
    expect(checkBudgetStep(4, { ...complete, customerConfigs: [] })).toMatchObject({ ok: false });
    expect(checkBudgetStep(4, { ...complete, customerConfigs: [{ customerId: "" }] })).toMatchObject({ ok: false });
    expect(
      checkBudgetStep(4, { ...complete, customerConfigs: [{ customerId: "c1" }, { customerId: "c1" }] }),
    ).toMatchObject({ ok: false, message: expect.stringContaining("duas vezes") });
  });
  it("Faturamento: com dois pagadores, todo serviço tem quem pague", () => {
    const two = { ...complete, customerConfigs: [{ customerId: "c1" }, { customerId: "c2" }] };
    expect(checkBudgetStep(4, two)).toMatchObject({ ok: false, message: expect.stringContaining("falta 1") });
    expect(
      checkBudgetStep(4, { ...two, services: [{ description: "Pintura", invoiceToCustomerId: "c2" }] }),
    ).toEqual({ ok: true });
    // Um serviço preso a um pagador que saiu da lista também conta como sem pagador.
    expect(
      checkBudgetStep(4, { ...two, services: [{ description: "Pintura", invoiceToCustomerId: "c9" }] }),
    ).toMatchObject({ ok: false });
  });
});

describe("firstFailingStep / resolveStepJump", () => {
  it("o Salvar pára no primeiro passo com problema", () => {
    expect(firstFailingStep({ ...complete, services: [] })).toMatchObject({ step: 3 });
    expect(firstFailingStep(complete)).toBeNull();
  });
  it("no detalhe o clique vai direto", () => {
    expect(resolveStepJump(1, 5, {}, {}, "free")).toEqual({ step: 5, refusal: null });
  });
  it("na criação avançar confere o caminho e voltar é livre", () => {
    expect(resolveStepJump(1, 4, { ...complete, services: [] }, {}, "linear")).toMatchObject({ step: 3 });
    expect(resolveStepJump(4, 1, {}, {}, "linear")).toEqual({ step: 1, refusal: null });
    expect(resolveStepJump(1, 5, complete, {}, "linear")).toEqual({ step: 5, refusal: null });
  });
});
