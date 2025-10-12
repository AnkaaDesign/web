import { GroupByField } from "@/components/grouping/GroupBySelector";
import { Aggregation } from "@/components/grouping/AggregationSelector";

export interface GroupingPreset {
  id: string;
  name: string;
  description: string;
  groups: GroupByField[];
  aggregations: Aggregation[];
  category: "general" | "inventory" | "sales" | "hr" | "custom";
}

/**
 * Predefined grouping presets
 */
export const GROUPING_PRESETS: Record<string, GroupingPreset> = {
  "by-status": {
    id: "by-status",
    name: "Por Status",
    description: "Agrupa registros por status",
    groups: [
      {
        id: "group-status",
        field: "status",
        label: "Status",
        order: 0,
      },
    ],
    aggregations: [
      {
        id: "agg-count",
        field: "id",
        function: "count",
        displayFormat: "number",
        label: "Total de registros",
      },
    ],
    category: "general",
  },

  "by-sector": {
    id: "by-sector",
    name: "Por Setor",
    description: "Agrupa por setor",
    groups: [
      {
        id: "group-sector",
        field: "sectorId",
        label: "Setor",
        order: 0,
      },
    ],
    aggregations: [
      {
        id: "agg-count",
        field: "id",
        function: "count",
        displayFormat: "number",
        label: "Total por setor",
      },
    ],
    category: "general",
  },

  "by-month": {
    id: "by-month",
    name: "Por Mês",
    description: "Agrupa por mês de criação",
    groups: [
      {
        id: "group-month",
        field: "createdAt",
        label: "Mês",
        order: 0,
      },
    ],
    aggregations: [
      {
        id: "agg-count",
        field: "id",
        function: "count",
        displayFormat: "number",
        label: "Total por mês",
      },
    ],
    category: "general",
  },

  "by-category": {
    id: "by-category",
    name: "Por Categoria",
    description: "Agrupa por categoria",
    groups: [
      {
        id: "group-category",
        field: "categoryId",
        label: "Categoria",
        order: 0,
      },
    ],
    aggregations: [
      {
        id: "agg-count",
        field: "id",
        function: "count",
        displayFormat: "number",
        label: "Total por categoria",
      },
    ],
    category: "inventory",
  },

  "by-user": {
    id: "by-user",
    name: "Por Usuário",
    description: "Agrupa por usuário responsável",
    groups: [
      {
        id: "group-user",
        field: "userId",
        label: "Usuário",
        order: 0,
      },
    ],
    aggregations: [
      {
        id: "agg-count",
        field: "id",
        function: "count",
        displayFormat: "number",
        label: "Total por usuário",
      },
    ],
    category: "general",
  },

  "by-category-and-status": {
    id: "by-category-and-status",
    name: "Por Categoria e Status",
    description: "Agrupa por categoria e depois por status",
    groups: [
      {
        id: "group-category",
        field: "categoryId",
        label: "Categoria",
        order: 0,
      },
      {
        id: "group-status",
        field: "status",
        label: "Status",
        order: 1,
      },
    ],
    aggregations: [
      {
        id: "agg-count",
        field: "id",
        function: "count",
        displayFormat: "number",
        label: "Quantidade",
      },
    ],
    category: "inventory",
  },

  "by-supplier": {
    id: "by-supplier",
    name: "Por Fornecedor",
    description: "Agrupa por fornecedor",
    groups: [
      {
        id: "group-supplier",
        field: "supplierId",
        label: "Fornecedor",
        order: 0,
      },
    ],
    aggregations: [
      {
        id: "agg-count",
        field: "id",
        function: "count",
        displayFormat: "number",
        label: "Total de itens",
      },
      {
        id: "agg-total",
        field: "totalValue",
        function: "sum",
        displayFormat: "currency",
        label: "Valor total",
      },
    ],
    category: "inventory",
  },

  "by-stock-level": {
    id: "by-stock-level",
    name: "Por Nível de Estoque",
    description: "Agrupa itens por nível de estoque",
    groups: [
      {
        id: "group-stock-level",
        field: "stockLevel",
        label: "Nível de Estoque",
        order: 0,
      },
    ],
    aggregations: [
      {
        id: "agg-count",
        field: "id",
        function: "count",
        displayFormat: "number",
        label: "Quantidade de itens",
      },
      {
        id: "agg-total-stock",
        field: "currentStock",
        function: "sum",
        displayFormat: "number",
        label: "Estoque total",
      },
    ],
    category: "inventory",
  },

  "by-priority": {
    id: "by-priority",
    name: "Por Prioridade",
    description: "Agrupa tarefas por prioridade",
    groups: [
      {
        id: "group-priority",
        field: "priority",
        label: "Prioridade",
        order: 0,
      },
    ],
    aggregations: [
      {
        id: "agg-count",
        field: "id",
        function: "count",
        displayFormat: "number",
        label: "Total de tarefas",
      },
    ],
    category: "general",
  },

  "by-customer": {
    id: "by-customer",
    name: "Por Cliente",
    description: "Agrupa vendas por cliente",
    groups: [
      {
        id: "group-customer",
        field: "customerId",
        label: "Cliente",
        order: 0,
      },
    ],
    aggregations: [
      {
        id: "agg-count",
        field: "id",
        function: "count",
        displayFormat: "number",
        label: "Número de pedidos",
      },
      {
        id: "agg-revenue",
        field: "totalAmount",
        function: "sum",
        displayFormat: "currency",
        label: "Receita total",
      },
    ],
    category: "sales",
  },

  "by-sector-and-user": {
    id: "by-sector-and-user",
    name: "Por Setor e Usuário",
    description: "Agrupa por setor e depois por usuário",
    groups: [
      {
        id: "group-sector",
        field: "sectorId",
        label: "Setor",
        order: 0,
      },
      {
        id: "group-user",
        field: "userId",
        label: "Usuário",
        order: 1,
      },
    ],
    aggregations: [
      {
        id: "agg-count",
        field: "id",
        function: "count",
        displayFormat: "number",
        label: "Total",
      },
    ],
    category: "hr",
  },
};

/**
 * Get preset by ID
 */
export function getGroupingPreset(id: string): GroupingPreset | undefined {
  return GROUPING_PRESETS[id];
}

/**
 * Get all grouping preset IDs
 */
export function getAllGroupingPresetIds(): string[] {
  return Object.keys(GROUPING_PRESETS);
}

/**
 * Get presets by category
 */
export function getGroupingPresetsByCategory(
  category: "general" | "inventory" | "sales" | "hr" | "custom"
): GroupingPreset[] {
  return Object.values(GROUPING_PRESETS).filter((preset) => preset.category === category);
}

/**
 * Create a custom grouping preset
 */
export function createGroupingPreset(
  name: string,
  description: string,
  groups: GroupByField[],
  aggregations: Aggregation[] = []
): GroupingPreset {
  return {
    id: `custom-${Date.now()}`,
    name,
    description,
    groups,
    aggregations,
    category: "custom",
  };
}
