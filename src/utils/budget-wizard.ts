/**
 * O ASSISTENTE DO ORÇAMENTO — a ordem dos passos e o que cada um exige.
 *
 * Decisão do dono (02/10/2026): ① Tarefa → ② Veículos → ③ Serviços →
 * ④ Faturamento → ⑤ Resumo. Os mesmos cinco passos na criação e no detalhe — a
 * criação anda em linha (cada "Próximo" confere o passo), o detalhe se navega
 * livre (o orçamento é revisitado várias vezes: precificar, enviar, arte,
 * emitir, cobrar) e confere tudo ao salvar.
 *
 * Antes eram "Tarefa · Informações · Serviços · Cliente 1..N · Resumo": um passo
 * POR CLIENTE de faturamento, e os prazos da proposta num passo próprio. Os
 * prazos foram para a Tarefa e os pagadores viraram UMA lista no Faturamento.
 *
 * Puro (sem React): as duas telas e os testes leem daqui.
 */

export const BUDGET_WIZARD_STEP = {
  TASK: 1,
  VEHICLES: 2,
  SERVICES: 3,
  BILLING: 4,
  REVIEW: 5,
} as const;

export type BudgetWizardStep = (typeof BUDGET_WIZARD_STEP)[keyof typeof BUDGET_WIZARD_STEP];

export const BUDGET_WIZARD_STEP_COUNT = 5;

export interface BudgetWizardStepItem {
  id: BudgetWizardStep;
  name: string;
  description: string;
}

/** Os cinco passos, com a descrição do que há em cada um. */
export function budgetWizardSteps(opts: { vehicleCount: number; payerCount: number }): BudgetWizardStepItem[] {
  const vehicles = Math.max(1, opts.vehicleCount);
  const payers = opts.payerCount;
  return [
    { id: BUDGET_WIZARD_STEP.TASK, name: "Tarefa", description: "Cliente, prazos e arquivos" },
    {
      id: BUDGET_WIZARD_STEP.VEHICLES,
      name: "Veículos",
      description: vehicles === 1 ? "Identificação e medidas" : `${vehicles} veículos`,
    },
    { id: BUDGET_WIZARD_STEP.SERVICES, name: "Serviços", description: "Serviços e preços" },
    {
      id: BUDGET_WIZARD_STEP.BILLING,
      name: "Faturamento",
      description: payers === 0 ? "Quem paga" : payers === 1 ? "1 pagador" : `${payers} pagadores`,
    },
    { id: BUDGET_WIZARD_STEP.REVIEW, name: "Resumo", description: "Revisão e emissão" },
  ];
}

/**
 * Em que passo mora cada campo do formulário — para levar o operador ao lugar
 * do erro (o Salvar confere tudo e pára no primeiro passo com problema).
 */
export function budgetStepOfField(path: string): BudgetWizardStep {
  const root = path.split(/[.[]/)[0];
  switch (root) {
    case "vehicles":
    case "plates":
    case "serialNumbers":
    case "customerOrderNumber":
    case "category":
    case "implementType":
    case "forecastDate":
    case "term":
    case "measures":
      return BUDGET_WIZARD_STEP.VEHICLES;
    case "services":
    case "subtotal":
    case "total":
      return BUDGET_WIZARD_STEP.SERVICES;
    case "customerConfigs":
    case "billingSplit":
    case "billingGroups":
      return BUDGET_WIZARD_STEP.BILLING;
    default:
      return BUDGET_WIZARD_STEP.TASK;
  }
}

/** O que a validação lê do formulário. Campos ausentes valem "vazio". */
export interface BudgetWizardData {
  name?: string | null;
  customerId?: string | null;
  expiresAt?: Date | string | null;
  /** Criação: as placas e séries que vão virar veículos. */
  plates?: readonly string[] | null;
  serialNumbers?: readonly (string | number)[] | null;
  /** Detalhe: um item por veículo do orçamento. */
  vehicles?: ReadonlyArray<{ plate?: string | null; serialNumber?: string | null } | null | undefined> | null;
  services?: ReadonlyArray<{ description?: string | null; invoiceToCustomerId?: string | null } | null> | null;
  customerConfigs?: ReadonlyArray<{ customerId?: string | null } | null> | null;
}

export interface BudgetWizardContext {
  /** As medidas do implemento não fecham (ex.: lados com larguras diferentes). */
  measuresError?: string | null;
}

export type BudgetStepCheck = { ok: true } | { ok: false; step: BudgetWizardStep; message: string };

const OK: BudgetStepCheck = { ok: true };
const fail = (step: BudgetWizardStep, message: string): BudgetStepCheck => ({ ok: false, step, message });

/** Os serviços que valem (com descrição). */
export function validServicesOf(services: BudgetWizardData["services"]) {
  return (services ?? []).filter((s): s is NonNullable<typeof s> => !!s && !!s.description?.trim());
}

/** O que um passo exige para seguir. */
export function checkBudgetStep(
  step: BudgetWizardStep,
  data: BudgetWizardData,
  ctx: BudgetWizardContext = {},
): BudgetStepCheck {
  switch (step) {
    case BUDGET_WIZARD_STEP.TASK: {
      if (!data.expiresAt) return fail(step, "A validade da proposta é obrigatória.");
      return OK;
    }
    case BUDGET_WIZARD_STEP.VEHICLES: {
      const hasVehicleId =
        (data.plates?.length ?? 0) > 0 ||
        (data.serialNumbers?.length ?? 0) > 0 ||
        (data.vehicles ?? []).some((v) => !!v?.plate?.trim() || !!String(v?.serialNumber ?? "").trim());
      if (!data.name?.trim() && !data.customerId && !hasVehicleId) {
        return fail(step, "Identifique o trabalho: logomarca, cliente, placa ou nº de série.");
      }
      if (ctx.measuresError) return fail(step, ctx.measuresError);
      return OK;
    }
    case BUDGET_WIZARD_STEP.SERVICES: {
      if (validServicesOf(data.services).length === 0) return fail(step, "Adicione pelo menos um serviço.");
      return OK;
    }
    case BUDGET_WIZARD_STEP.BILLING: {
      const configs = (data.customerConfigs ?? []).filter(Boolean) as { customerId?: string | null }[];
      if (configs.length === 0) return fail(step, "Escolha quem paga: adicione pelo menos um pagador.");
      if (configs.some((c) => !c.customerId)) return fail(step, "Escolha o cliente de cada pagador.");
      const ids = configs.map((c) => c.customerId as string);
      if (new Set(ids).size !== ids.length) return fail(step, "O mesmo cliente aparece duas vezes como pagador.");
      if (configs.length > 1) {
        const payerIds = new Set(ids);
        const unassigned = validServicesOf(data.services).filter(
          (s) => !s.invoiceToCustomerId || !payerIds.has(s.invoiceToCustomerId),
        );
        if (unassigned.length > 0) {
          return fail(
            step,
            unassigned.length === 1
              ? "Com mais de um pagador, diga quem paga cada serviço (falta 1)."
              : `Com mais de um pagador, diga quem paga cada serviço (faltam ${unassigned.length}).`,
          );
        }
      }
      return OK;
    }
    default:
      return OK;
  }
}

/** O primeiro passo, de `from` até `to` (exclusive), que não deixa seguir. */
export function firstFailingStep(
  data: BudgetWizardData,
  ctx: BudgetWizardContext = {},
  from: BudgetWizardStep = BUDGET_WIZARD_STEP.TASK,
  to: number = BUDGET_WIZARD_STEP.REVIEW,
): Exclude<BudgetStepCheck, { ok: true }> | null {
  for (let step = from; step < to; step++) {
    const check = checkBudgetStep(step as BudgetWizardStep, data, ctx);
    if (!check.ok) return check;
  }
  return null;
}

/**
 * Para onde vai um clique no marcador do passo.
 *
 * - DETALHE (`free`): vai direto. Nada se perde revisitando, e o Salvar confere
 *   todos os passos antes de gravar.
 * - CRIAÇÃO (linear): voltar é livre; avançar roda TODAS as conferências entre
 *   aqui e o destino, como apertar "Próximo" tantas vezes — e pára no primeiro
 *   passo que recusa.
 */
export function resolveStepJump(
  current: BudgetWizardStep,
  target: number,
  data: BudgetWizardData,
  ctx: BudgetWizardContext,
  mode: "free" | "linear",
): { step: BudgetWizardStep; refusal: string | null } {
  const clamped = Math.min(Math.max(target, 1), BUDGET_WIZARD_STEP_COUNT) as BudgetWizardStep;
  if (mode === "free" || clamped <= current) return { step: clamped, refusal: null };
  const failing = firstFailingStep(data, ctx, current, clamped);
  return failing ? { step: failing.step, refusal: failing.message } : { step: clamped, refusal: null };
}
