import { BENEFIT_KIND } from "../../../constants";

// A REGRA de cálculo da divisão empresa × colaborador vive em
// web/src/utils/benefit-discount.ts (espelho de api/src/utils/benefit-discount.ts).
// Este arquivo guarda apenas os tetos legais e textos de ajuda da UI.

/**
 * Legal/business caps for the employee discount percent by benefit kind.
 * - Vale Transporte: máx. 6% do salário-base (Lei 7.418/85 / CLT)
 * - Vale Refeição / Vale Alimentação: máx. 20% do custo (PAT)
 * - Demais: máx. 100%
 */
export function getKindDiscountCap(kind?: string | null): number {
  if (kind === BENEFIT_KIND.TRANSPORT_VOUCHER) return 6;
  if (kind === BENEFIT_KIND.MEAL_VOUCHER || kind === BENEFIT_KIND.FOOD_VOUCHER) return 20;
  return 100;
}

export function getKindDiscountHelper(kind?: string | null): string {
  if (kind === BENEFIT_KIND.TRANSPORT_VOUCHER) return "Desconto limitado a 6% do salário-base do colaborador (CLT), nunca excedendo o custo do VT";
  if (kind === BENEFIT_KIND.MEAL_VOUCHER || kind === BENEFIT_KIND.FOOD_VOUCHER) return "Desconto limitado a 20% do custo do benefício (PAT)";
  return "Máx. 100% do custo";
}

/**
 * Longer explanation used in tooltips: how the cost of the benefit is split
 * between the company and the collaborator, and which legal cap applies.
 */
export function getKindSplitTooltip(kind?: string | null): string {
  if (kind === BENEFIT_KIND.TRANSPORT_VOUCHER) {
    return "Vale Transporte: a empresa custeia o benefício e desconta do colaborador um percentual do SALÁRIO-BASE (máx. 6% — Lei 7.418/85 / Decreto 95.247/87), limitado ao custo do próprio VT. O restante do custo é pago pela empresa.";
  }
  if (kind === BENEFIT_KIND.MEAL_VOUCHER || kind === BENEFIT_KIND.FOOD_VOUCHER) {
    return "Vale Refeição/Alimentação: o desconto do colaborador é um percentual do CUSTO do benefício, limitado a 20% (PAT). O restante do custo é pago pela empresa.";
  }
  return "O custo mensal do benefício é dividido entre a empresa e o colaborador conforme o desconto configurado na adesão (valor fixo ou percentual do custo).";
}
