import {
  FilterDefinition,
  createFilterPreset,
  createFilterGroup,
  DateFilterBuilder,
  BooleanFilterBuilder,
  SelectFilterBuilder,
  StringFilterBuilder,
} from "@/utils/table-filter-utils";

/**
 * Predefined time-based filter presets
 */
export const TIME_BASED_PRESETS: Record<string, FilterDefinition> = {
  "last-7-days": createFilterPreset(
    "Últimos 7 dias",
    [
      createFilterGroup([DateFilterBuilder.after("createdAt", (() => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return date;
      })())], "AND")
    ],
    {
      description: "Registros criados nos últimos 7 dias",
      isPreset: true,
    }
  ),

  "last-30-days": createFilterPreset(
    "Últimos 30 dias",
    [
      createFilterGroup([DateFilterBuilder.after("createdAt", (() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date;
      })())], "AND")
    ],
    {
      description: "Registros criados nos últimos 30 dias",
      isPreset: true,
    }
  ),

  "this-month": createFilterPreset(
    "Este mês",
    [createFilterGroup([DateFilterBuilder.thisMonth("createdAt")], "AND")],
    {
      description: "Registros criados no mês atual",
      isPreset: true,
    }
  ),

  "last-month": createFilterPreset(
    "Mês passado",
    [
      createFilterGroup([(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return DateFilterBuilder.between("createdAt", start, end);
      })()], "AND")
    ],
    {
      description: "Registros criados no mês passado",
      isPreset: true,
    }
  ),

  "this-quarter": createFilterPreset(
    "Este trimestre",
    [
      createFilterGroup([(() => {
        const now = new Date();
        const quarter = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), quarter * 3, 1);
        const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        return DateFilterBuilder.between("createdAt", start, end);
      })()], "AND")
    ],
    {
      description: "Registros criados no trimestre atual",
      isPreset: true,
    }
  ),

  "this-year": createFilterPreset(
    "Este ano",
    [
      createFilterGroup([(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        return DateFilterBuilder.between("createdAt", start, end);
      })()], "AND")
    ],
    {
      description: "Registros criados este ano",
      isPreset: true,
    }
  ),

  "today": createFilterPreset(
    "Hoje",
    [createFilterGroup([DateFilterBuilder.today("createdAt")], "AND")],
    {
      description: "Registros criados hoje",
      isPreset: true,
    }
  ),

  "this-week": createFilterPreset(
    "Esta semana",
    [createFilterGroup([DateFilterBuilder.thisWeek("createdAt")], "AND")],
    {
      description: "Registros criados nesta semana",
      isPreset: true,
    }
  ),
};

/**
 * Entity-specific filter presets
 */
export const ENTITY_PRESETS: Record<string, FilterDefinition> = {
  "active-items": createFilterPreset(
    "Itens ativos",
    [createFilterGroup([BooleanFilterBuilder.isTrue("isActive")], "AND")],
    {
      description: "Apenas itens ativos",
      isPreset: true,
    }
  ),

  "inactive-items": createFilterPreset(
    "Itens inativos",
    [createFilterGroup([BooleanFilterBuilder.isFalse("isActive")], "AND")],
    {
      description: "Apenas itens inativos",
      isPreset: true,
    }
  ),

  "pending-orders": createFilterPreset(
    "Pedidos pendentes",
    [createFilterGroup([SelectFilterBuilder.in("status", ["PENDING", "IN_PROGRESS"])], "AND")],
    {
      description: "Pedidos com status pendente ou em andamento",
      isPreset: true,
    }
  ),

  "completed-orders": createFilterPreset(
    "Pedidos concluídos",
    [createFilterGroup([SelectFilterBuilder.equals("status", "COMPLETED")], "AND")],
    {
      description: "Pedidos concluídos",
      isPreset: true,
    }
  ),

  "overdue-tasks": createFilterPreset(
    "Tarefas atrasadas",
    [
      createFilterGroup([
        DateFilterBuilder.before("dueDate", new Date()),
        SelectFilterBuilder.in("status", ["PENDING", "IN_PROGRESS"]),
      ], "AND")
    ],
    {
      description: "Tarefas com prazo vencido e ainda não concluídas",
      isPreset: true,
    }
  ),

  "low-stock-items": createFilterPreset(
    "Estoque baixo",
    [
      createFilterGroup([
        StringFilterBuilder.isNotEmpty("minimumStock"),
      ], "AND")
    ],
    {
      description: "Itens com estoque abaixo do mínimo",
      isPreset: true,
    }
  ),

  "pending-ppe-deliveries": createFilterPreset(
    "Entregas de EPIs pendentes",
    [
      createFilterGroup([
        SelectFilterBuilder.equals("type", "PPE"),
        SelectFilterBuilder.in("deliveryStatus", ["PENDING", "SCHEDULED"]),
      ], "AND")
    ],
    {
      description: "Entregas de EPIs pendentes ou agendadas",
      isPreset: true,
    }
  ),

  "recent-changes": createFilterPreset(
    "Alterações recentes",
    [
      createFilterGroup([DateFilterBuilder.after("updatedAt", (() => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return date;
      })())], "AND")
    ],
    {
      description: "Registros atualizados nos últimos 7 dias",
      isPreset: true,
    }
  ),

  "my-items": createFilterPreset(
    "Meus itens",
    [createFilterGroup([StringFilterBuilder.equals("createdById", "{{currentUserId}}")], "AND")],
    {
      description: "Itens criados por mim",
      isPreset: true,
    }
  ),
};

/**
 * Inventory-specific presets
 */
export const INVENTORY_PRESETS: Record<string, FilterDefinition> = {
  "critical-stock": createFilterPreset(
    "Estoque crítico",
    [
      createFilterGroup([
        SelectFilterBuilder.equals("stockLevel", "CRITICAL"),
        BooleanFilterBuilder.isTrue("isActive"),
      ], "AND")
    ],
    {
      description: "Itens ativos com estoque crítico",
      isPreset: true,
    }
  ),

  "overstocked": createFilterPreset(
    "Excesso de estoque",
    [createFilterGroup([SelectFilterBuilder.equals("stockLevel", "OVERSTOCKED")], "AND")],
    {
      description: "Itens com estoque acima do máximo",
      isPreset: true,
    }
  ),

  "no-stock": createFilterPreset(
    "Sem estoque",
    [createFilterGroup([SelectFilterBuilder.equals("stockLevel", "OUT_OF_STOCK")], "AND")],
    {
      description: "Itens sem estoque",
      isPreset: true,
    }
  ),
};

/**
 * Combine all presets into a single object
 */
export const FILTER_PRESETS = {
  ...TIME_BASED_PRESETS,
  ...ENTITY_PRESETS,
  ...INVENTORY_PRESETS,
};

/**
 * Get preset by ID
 */
export function getPreset(id: string): FilterDefinition | undefined {
  return FILTER_PRESETS[id];
}

/**
 * Get all preset IDs
 */
export function getAllPresetIds(): string[] {
  return Object.keys(FILTER_PRESETS);
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category: "time" | "entity" | "inventory"): Record<string, FilterDefinition> {
  switch (category) {
    case "time":
      return TIME_BASED_PRESETS;
    case "entity":
      return ENTITY_PRESETS;
    case "inventory":
      return INVENTORY_PRESETS;
    default:
      return {};
  }
}
