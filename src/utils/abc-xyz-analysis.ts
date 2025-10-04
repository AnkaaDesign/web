import type { Item } from "../types";
import { ABC_CATEGORY, ACTIVITY_OPERATION, XYZ_CATEGORY } from "../constants";
import type { Activity } from "../types";

interface AbcAnalysisParams {
  items: Item[];
  valueField?: keyof Item; // Default: 'totalPrice'
  thresholds?: {
    a: number; // Default: 0.7 (70%)
    b: number; // Default: 0.9 (90%)
  };
}

interface XyzAnalysisParams {
  items: Item[];
  activities: Map<string, Activity[]>; // Map of itemId to activities
  period?: number; // Analysis period in days (default: 90)
  thresholds?: {
    x: number; // Default: 0.5 (CV < 50%)
    y: number; // Default: 1.0 (CV < 100%)
  };
}

interface AbcXyzResult {
  itemId: string;
  abcCategory: ABC_CATEGORY;
  abcCategoryOrder: number;
  xyzCategory: XYZ_CATEGORY;
  xyzCategoryOrder: number;
  totalValue: number;
  cumulativePercentage: number;
  coefficientOfVariation: number;
}

/**
 * Performs ABC analysis on items based on their value contribution
 * A items: 70% of total value
 * B items: Next 20% of total value (70-90%)
 * C items: Last 10% of total value (90-100%)
 */
export function calculateAbcAnalysis({
  items,
  valueField = "totalPrice",
  thresholds = { a: 0.7, b: 0.9 },
}: AbcAnalysisParams): Map<string, { category: ABC_CATEGORY; order: number }> {
  const results = new Map<string, { category: ABC_CATEGORY; order: number }>();

  // Filter and sort items by value (descending)
  const validItems = items.filter((item) => item[valueField] != null && Number(item[valueField]) > 0).sort((a, b) => Number(b[valueField]) - Number(a[valueField]));

  if (validItems.length === 0) return results;

  // Calculate total value
  const totalValue = validItems.reduce((sum, item) => sum + Number(item[valueField]), 0);

  let cumulativeValue = 0;
  let order = 1;

  validItems.forEach((item) => {
    cumulativeValue += Number(item[valueField]);
    const cumulativePercentage = cumulativeValue / totalValue;

    let category: ABC_CATEGORY;
    if (cumulativePercentage <= thresholds.a) {
      category = ABC_CATEGORY.A;
    } else if (cumulativePercentage <= thresholds.b) {
      category = ABC_CATEGORY.B;
    } else {
      category = ABC_CATEGORY.C;
    }

    results.set(item.id, { category, order });
    order++;
  });

  // Set remaining items as C category
  items.forEach((item) => {
    if (!results.has(item.id)) {
      results.set(item.id, { category: ABC_CATEGORY.C, order });
      order++;
    }
  });

  return results;
}

/**
 * Performs XYZ analysis based on demand variability (coefficient of variation)
 * X items: CV < 50% (stable demand)
 * Y items: CV 50-100% (variable demand)
 * Z items: CV > 100% (irregular demand)
 */
export function calculateXyzAnalysis({
  items,
  activities,
  period = 90,
  thresholds = { x: 0.5, y: 1.0 },
}: XyzAnalysisParams): Map<string, { category: XYZ_CATEGORY; order: number; cv: number }> {
  const results = new Map<string, { category: XYZ_CATEGORY; order: number; cv: number }>();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - period);

  // Calculate CV for each item
  const itemsCvData = items.map((item) => {
    const itemActivities = activities.get(item.id) || [];

    // Filter activities within the period and group by week
    const weeklyDemand = calculateWeeklyDemand(itemActivities, cutoffDate);

    if (weeklyDemand.length < 3) {
      // Not enough data points
      return { item, cv: Infinity };
    }

    const cv = calculateCoefficientOfVariation(weeklyDemand);
    return { item, cv };
  });

  // Sort by CV (ascending) for ordering
  itemsCvData.sort((a, b) => a.cv - b.cv);

  let order = 1;
  itemsCvData.forEach(({ item, cv }) => {
    let category: XYZ_CATEGORY;

    if (cv < thresholds.x) {
      category = XYZ_CATEGORY.X;
    } else if (cv < thresholds.y) {
      category = XYZ_CATEGORY.Y;
    } else {
      category = XYZ_CATEGORY.Z;
    }

    results.set(item.id, { category, order, cv });
    order++;
  });

  return results;
}

/**
 * Combines ABC and XYZ analysis results
 */
export function performAbcXyzAnalysis(
  items: Item[],
  activities: Map<string, Activity[]>,
  abcParams?: Partial<AbcAnalysisParams>,
  xyzParams?: Partial<XyzAnalysisParams>,
): AbcXyzResult[] {
  const abcResults = calculateAbcAnalysis({ items, ...abcParams });
  const xyzResults = calculateXyzAnalysis({ items, activities, ...xyzParams });

  return items.map((item) => {
    const abc = abcResults.get(item.id) || { category: ABC_CATEGORY.C, order: 999 };
    const xyz = xyzResults.get(item.id) || { category: XYZ_CATEGORY.Z, order: 999, cv: Infinity };

    return {
      itemId: item.id,
      abcCategory: abc.category,
      abcCategoryOrder: abc.order,
      xyzCategory: xyz.category,
      xyzCategoryOrder: xyz.order,
      totalValue: item.totalPrice || 0,
      cumulativePercentage: 0, // Would need to calculate this separately
      coefficientOfVariation: xyz.cv,
    };
  });
}

// Helper functions

function calculateWeeklyDemand(activities: Activity[], cutoffDate: Date): number[] {
  const weeklyMap = new Map<number, number>();

  activities
    .filter(
      (activity) => activity.createdAt >= cutoffDate && activity.operation === ACTIVITY_OPERATION.OUTBOUND, // Only consider outgoing movements
    )
    .forEach((activity) => {
      const weekNumber = getWeekNumber(activity.createdAt);
      const currentDemand = weeklyMap.get(weekNumber) || 0;
      weeklyMap.set(weekNumber, currentDemand + activity.quantity);
    });

  // Fill in missing weeks with 0
  const weeks = Array.from(weeklyMap.keys()).sort((a, b) => a - b);
  if (weeks.length === 0) return [];

  const result: number[] = [];
  for (let week = weeks[0]; week <= weeks[weeks.length - 1]; week++) {
    result.push(weeklyMap.get(week) || 0);
  }

  return result;
}

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

function calculateCoefficientOfVariation(values: number[]): number {
  if (values.length === 0) return Infinity;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  if (mean === 0) return Infinity;

  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const standardDeviation = Math.sqrt(variance);

  return standardDeviation / mean;
}

/**
 * Get strategy recommendation based on ABC/XYZ combination
 */
export function getInventoryStrategy(
  abc: ABC_CATEGORY,
  xyz: XYZ_CATEGORY,
): {
  strategy: string;
  orderingPolicy: string;
  safetyStock: string;
  reviewFrequency: string;
} {
  const key = `${abc}${xyz}`;

  const strategies: Record<
    string,
    {
      strategy: string;
      orderingPolicy: string;
      safetyStock: string;
      reviewFrequency: string;
    }
  > = {
    AX: {
      strategy: "Just-in-Time (JIT)",
      orderingPolicy: "Lote econômico com pontos de reposição fixos",
      safetyStock: "Mínimo (1-2 semanas)",
      reviewFrequency: "Contínua",
    },
    AY: {
      strategy: "Controle rigoroso com buffer",
      orderingPolicy: "Revisão periódica com níveis variáveis",
      safetyStock: "Moderado (2-4 semanas)",
      reviewFrequency: "Semanal",
    },
    AZ: {
      strategy: "Análise caso a caso",
      orderingPolicy: "Pedidos manuais baseados em previsões",
      safetyStock: "Alto (4-8 semanas)",
      reviewFrequency: "Diária",
    },
    BX: {
      strategy: "Sistema automatizado",
      orderingPolicy: "Ponto de reposição automático",
      safetyStock: "Baixo (1-2 semanas)",
      reviewFrequency: "Quinzenal",
    },
    BY: {
      strategy: "Revisão periódica",
      orderingPolicy: "Lotes fixos com ajuste sazonal",
      safetyStock: "Moderado (3-4 semanas)",
      reviewFrequency: "Mensal",
    },
    BZ: {
      strategy: "Estoque de segurança generoso",
      orderingPolicy: "Pedidos por oportunidade",
      safetyStock: "Alto (6-12 semanas)",
      reviewFrequency: "Mensal",
    },
    CX: {
      strategy: "Sistema Kanban",
      orderingPolicy: "Lotes grandes econômicos",
      safetyStock: "Mínimo (1 semana)",
      reviewFrequency: "Trimestral",
    },
    CY: {
      strategy: "Controle visual",
      orderingPolicy: "Estoque máximo/mínimo",
      safetyStock: "Baixo (2-3 semanas)",
      reviewFrequency: "Semestral",
    },
    CZ: {
      strategy: "Compra sob demanda",
      orderingPolicy: "Pedidos apenas quando necessário",
      safetyStock: "Variável ou zero",
      reviewFrequency: "Anual",
    },
  };

  return (
    strategies[key] || {
      strategy: "Análise personalizada necessária",
      orderingPolicy: "Definir baseado em características específicas",
      safetyStock: "Avaliar caso a caso",
      reviewFrequency: "Conforme necessidade",
    }
  );
}
