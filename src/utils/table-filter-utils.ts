import { ReactNode } from "react";

/**
 * Filter data types
 */
export type FilterDataType = "string" | "number" | "boolean" | "date" | "dateRange" | "select" | "multiSelect" | "range";

/**
 * Filter operator types
 */
export type FilterOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "between"
  | "in"
  | "notIn"
  | "isEmpty"
  | "isNotEmpty";

/**
 * Base filter condition
 */
export interface FilterCondition<T = any> {
  field: string;
  operator: FilterOperator;
  value: T;
  dataType: FilterDataType;
}

/**
 * Filter group with logical operators
 */
export interface FilterGroup {
  conditions: FilterCondition[];
  operator: "AND" | "OR";
  groups?: FilterGroup[];
}

/**
 * Complete filter definition
 */
export interface FilterDefinition {
  id: string;
  name: string;
  description?: string;
  groups: FilterGroup[];
  isPreset?: boolean;
  createdBy?: string;
  createdAt?: Date;
}

/**
 * Field definition for type-safe filters
 */
export interface FilterFieldDefinition {
  key: string;
  label: string;
  dataType: FilterDataType;
  operators: FilterOperator[];
  options?: Array<{ value: any; label: string }>;
  validation?: {
    required?: boolean;
    min?: number | Date;
    max?: number | Date;
    pattern?: RegExp;
  };
}

/**
 * Generic filter indicator structure
 */
export interface FilterIndicator {
  id: string;
  label: string;
  value: string;
  icon?: ReactNode;
  onRemove: () => void;
}

/**
 * Options for extracting active filters
 */
export interface ExtractFilterOptions<TFilters> {
  /**
   * Filters to extract from
   */
  filters: Partial<TFilters>;
  /**
   * Function to remove a filter
   */
  onRemoveFilter: (key: string) => void;
  /**
   * Custom label resolver for filter keys
   */
  getLabel?: (key: string) => string;
  /**
   * Custom value resolver for filter values
   */
  getDisplayValue?: (key: string, value: any) => string;
  /**
   * Icon resolver for filter keys
   */
  getIcon?: (key: string) => ReactNode;
  /**
   * Keys to exclude from indicators
   */
  excludeKeys?: string[];
  /**
   * Lookup data for resolving entity names
   */
  lookupData?: Record<string, Array<{ id: string; name?: string; fantasyName?: string; label?: string }>>;
}

/**
 * Default label formatter - converts camelCase to readable text
 */
export function defaultGetLabel(key: string): string {
  const labels: Record<string, string> = {
    searchingFor: "Busca",
    search: "Busca",
    status: "Status",
    isActive: "Ativo",
    showInactive: "Inativos",
    createdAt: "Criado em",
    updatedAt: "Atualizado em",
    categoryId: "Categoria",
    categoryIds: "Categorias",
    brandId: "Marca",
    brandIds: "Marcas",
    supplierId: "Fornecedor",
    supplierIds: "Fornecedores",
    userId: "Usuário",
    userIds: "Usuários",
    customerId: "Cliente",
    customerIds: "Clientes",
    sectorId: "Setor",
    sectorIds: "Setores",
    positionId: "Cargo",
    positionIds: "Cargos",
    hasTasks: "Possui tarefas",
    hasOrders: "Possui pedidos",
    hasItems: "Possui itens",
    stockLevels: "Níveis de estoque",
    quantity: "Quantidade",
    price: "Preço",
    icms: "ICMS",
    ipi: "IPI",
    taskCount: "Qtd. tarefas",
    orderCount: "Qtd. pedidos",
    itemCount: "Qtd. itens",
    states: "Estados",
    tags: "Tags",
    priority: "Prioridade",
    commissionStatus: "Status de comissão",
    orderStatus: "Status do pedido",
    taskStatus: "Status da tarefa",
  };

  return labels[key] || key.replace(/([A-Z])/g, " $1").trim();
}

/**
 * Default value formatter
 */
export function defaultGetDisplayValue(key: string, value: any): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return "Vazio";
  }

  // Handle boolean values
  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  // Handle date values
  if (value instanceof Date || (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/))) {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleDateString("pt-BR");
  }

  // Handle date range objects
  if (typeof value === "object" && (value.gte || value.lte)) {
    const from = value.gte ? new Date(value.gte).toLocaleDateString("pt-BR") : "";
    const to = value.lte ? new Date(value.lte).toLocaleDateString("pt-BR") : "";
    if (from && to) return `${from} - ${to}`;
    if (from) return `Após ${from}`;
    if (to) return `Até ${to}`;
  }

  // Handle range objects (min/max)
  if (typeof value === "object" && (value.min !== undefined || value.max !== undefined)) {
    if (value.min !== undefined && value.max !== undefined) {
      return `${value.min} - ${value.max}`;
    }
    if (value.min !== undefined) return `≥ ${value.min}`;
    if (value.max !== undefined) return `≤ ${value.max}`;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return "Nenhum";
    if (value.length === 1) return String(value[0]);
    return `${value.length} selecionados`;
  }

  // Default: convert to string
  return String(value);
}

/**
 * Extract active filters into indicator format
 */
export function extractActiveFilters<TFilters>(options: ExtractFilterOptions<TFilters>): FilterIndicator[] {
  const {
    filters,
    onRemoveFilter,
    getLabel = defaultGetLabel,
    getDisplayValue = defaultGetDisplayValue,
    getIcon,
    excludeKeys = ["page", "limit", "skip", "take", "orderBy", "include", "where"],
    lookupData = {},
  } = options;

  const indicators: FilterIndicator[] = [];

  Object.entries(filters).forEach(([key, value]) => {
    // Skip excluded keys
    if (excludeKeys.includes(key)) return;

    // Skip null/undefined/empty values
    if (value === null || value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    if (typeof value === "string" && value.trim() === "") return;
    if (typeof value === "object" && !Array.isArray(value) && !value.gte && !value.lte && !value.min && value.max === undefined) {
      // Skip empty objects (but keep date/number ranges)
      if (Object.keys(value).length === 0) return;
    }

    // Handle arrays with individual indicators
    if (Array.isArray(value) && key.endsWith("Ids")) {
      // For entity ID arrays, create individual indicators
      const entityType = key.replace("Ids", "");
      const lookupKey = entityType + "s"; // e.g., categories, brands
      const lookupItems = lookupData[lookupKey] || [];

      value.forEach((id: string) => {
        const item = lookupItems.find((item) => item.id === id);
        const displayName = item?.name || item?.fantasyName || item?.label || id;

        indicators.push({
          id: `${key}-${id}`,
          label: getLabel(entityType),
          value: displayName,
          icon: getIcon?.(key),
          onRemove: () => {
            const currentValue = filters[key as keyof TFilters] as string[];
            const newValue = currentValue.filter((v) => v !== id);
            onRemoveFilter(newValue.length > 0 ? key : key);
          },
        });
      });
    } else if (Array.isArray(value)) {
      // For other arrays, show as grouped
      indicators.push({
        id: key,
        label: getLabel(key),
        value: getDisplayValue(key, value),
        icon: getIcon?.(key),
        onRemove: () => onRemoveFilter(key),
      });
    } else {
      // Single value filters
      indicators.push({
        id: key,
        label: getLabel(key),
        value: getDisplayValue(key, value),
        icon: getIcon?.(key),
        onRemove: () => onRemoveFilter(key),
      });
    }
  });

  return indicators;
}

/**
 * Create a filter remover function for array filters
 */
export function createArrayFilterRemover<TFilters>(setFilter: (key: keyof TFilters, value: any) => void) {
  return (filterKey: string, filters: Partial<TFilters>) => {
    // Handle array filters with individual removal
    const [baseKey, itemToRemove] = filterKey.split("-");

    if (itemToRemove) {
      // Remove individual item from array filter
      const currentArray = filters[baseKey as keyof TFilters] as any[];
      if (Array.isArray(currentArray)) {
        const newArray = currentArray.filter((item) => item !== itemToRemove);
        setFilter(baseKey as keyof TFilters, newArray.length > 0 ? newArray : undefined);
      }
    } else {
      // Remove entire filter
      setFilter(filterKey as keyof TFilters, undefined);
    }
  };
}

/**
 * Convert filters from URL format to API format
 * This is a generic implementation - override for specific entities
 */
export function convertFiltersToApiFormat<TUrlFilters, TApiFilters>(
  urlFilters: Partial<TUrlFilters>,
  customTransform?: (filters: Partial<TUrlFilters>) => Partial<TApiFilters>,
): Partial<TApiFilters> {
  if (customTransform) {
    return customTransform(urlFilters);
  }

  // Default transformation (pass-through)
  return urlFilters as any;
}

/**
 * Check if any filters are active (excluding pagination)
 */
export function hasActiveFilters<TFilters>(filters: Partial<TFilters>, excludeKeys: string[] = ["page", "limit", "skip", "take", "orderBy", "include", "where"]): boolean {
  return Object.entries(filters).some(([key, value]) => {
    if (excludeKeys.includes(key)) return false;

    // Check for meaningful values
    if (value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === "string" && value.trim() === "") return false;
    if (typeof value === "object" && !Array.isArray(value)) {
      // Check for non-empty objects
      return Object.keys(value).length > 0;
    }

    return true;
  });
}

/**
 * Count active filters (excluding pagination)
 */
export function countActiveFilters<TFilters>(
  filters: Partial<TFilters>,
  excludeKeys: string[] = ["page", "limit", "skip", "take", "orderBy", "include", "where", "searchingFor", "search"],
): number {
  return Object.entries(filters).reduce((count, [key, value]) => {
    if (excludeKeys.includes(key)) return count;

    // Check for meaningful values
    if (value === null || value === undefined) return count;
    if (Array.isArray(value)) {
      return value.length > 0 ? count + value.length : count;
    }
    if (typeof value === "string" && value.trim() === "") return count;
    if (typeof value === "object" && !Array.isArray(value)) {
      // Count non-empty objects
      return Object.keys(value).length > 0 ? count + 1 : count;
    }

    return count + 1;
  }, 0);
}

// ============================================================================
// FILTER BUILDERS FOR DIFFERENT DATA TYPES
// ============================================================================

/**
 * String filter builder
 */
export class StringFilterBuilder {
  static equals(field: string, value: string): FilterCondition<string> {
    return { field, operator: "equals", value, dataType: "string" };
  }

  static contains(field: string, value: string): FilterCondition<string> {
    return { field, operator: "contains", value, dataType: "string" };
  }

  static startsWith(field: string, value: string): FilterCondition<string> {
    return { field, operator: "startsWith", value, dataType: "string" };
  }

  static endsWith(field: string, value: string): FilterCondition<string> {
    return { field, operator: "endsWith", value, dataType: "string" };
  }

  static isEmpty(field: string): FilterCondition<null> {
    return { field, operator: "isEmpty", value: null, dataType: "string" };
  }

  static isNotEmpty(field: string): FilterCondition<null> {
    return { field, operator: "isNotEmpty", value: null, dataType: "string" };
  }

  static in(field: string, values: string[]): FilterCondition<string[]> {
    return { field, operator: "in", value: values, dataType: "multiSelect" };
  }
}

/**
 * Number filter builder
 */
export class NumberFilterBuilder {
  static equals(field: string, value: number): FilterCondition<number> {
    return { field, operator: "equals", value, dataType: "number" };
  }

  static greaterThan(field: string, value: number): FilterCondition<number> {
    return { field, operator: "greaterThan", value, dataType: "number" };
  }

  static greaterThanOrEqual(field: string, value: number): FilterCondition<number> {
    return { field, operator: "greaterThanOrEqual", value, dataType: "number" };
  }

  static lessThan(field: string, value: number): FilterCondition<number> {
    return { field, operator: "lessThan", value, dataType: "number" };
  }

  static lessThanOrEqual(field: string, value: number): FilterCondition<number> {
    return { field, operator: "lessThanOrEqual", value, dataType: "number" };
  }

  static between(field: string, min: number, max: number): FilterCondition<{ min: number; max: number }> {
    return { field, operator: "between", value: { min, max }, dataType: "range" };
  }
}

/**
 * Date filter builder
 */
export class DateFilterBuilder {
  static equals(field: string, value: Date): FilterCondition<Date> {
    return { field, operator: "equals", value, dataType: "date" };
  }

  static after(field: string, value: Date): FilterCondition<Date> {
    return { field, operator: "greaterThan", value, dataType: "date" };
  }

  static afterOrEqual(field: string, value: Date): FilterCondition<Date> {
    return { field, operator: "greaterThanOrEqual", value, dataType: "date" };
  }

  static before(field: string, value: Date): FilterCondition<Date> {
    return { field, operator: "lessThan", value, dataType: "date" };
  }

  static beforeOrEqual(field: string, value: Date): FilterCondition<Date> {
    return { field, operator: "lessThanOrEqual", value, dataType: "date" };
  }

  static between(field: string, start: Date, end: Date): FilterCondition<{ gte: Date; lte: Date }> {
    return { field, operator: "between", value: { gte: start, lte: end }, dataType: "dateRange" };
  }

  static today(field: string): FilterCondition<Date> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { field, operator: "greaterThanOrEqual", value: today, dataType: "date" };
  }

  static thisWeek(field: string): FilterCondition<{ gte: Date; lte: Date }> {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return { field, operator: "between", value: { gte: startOfWeek, lte: endOfWeek }, dataType: "dateRange" };
  }

  static thisMonth(field: string): FilterCondition<{ gte: Date; lte: Date }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    return { field, operator: "between", value: { gte: startOfMonth, lte: endOfMonth }, dataType: "dateRange" };
  }
}

/**
 * Boolean filter builder
 */
export class BooleanFilterBuilder {
  static isTrue(field: string): FilterCondition<boolean> {
    return { field, operator: "equals", value: true, dataType: "boolean" };
  }

  static isFalse(field: string): FilterCondition<boolean> {
    return { field, operator: "equals", value: false, dataType: "boolean" };
  }
}

/**
 * Select filter builder
 */
export class SelectFilterBuilder {
  static equals(field: string, value: any): FilterCondition<any> {
    return { field, operator: "equals", value, dataType: "select" };
  }

  static in(field: string, values: any[]): FilterCondition<any[]> {
    return { field, operator: "in", value: values, dataType: "multiSelect" };
  }

  static notIn(field: string, values: any[]): FilterCondition<any[]> {
    return { field, operator: "notIn", value: values, dataType: "multiSelect" };
  }
}

// ============================================================================
// FILTER SERIALIZATION AND DESERIALIZATION
// ============================================================================

/**
 * Serialize filters to URL-safe format
 */
export function serializeFiltersToUrl(filters: Partial<any>): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, JSON.stringify(value));
      }
    } else if (value instanceof Date) {
      params.set(key, value.toISOString());
    } else if (typeof value === "object") {
      // Handle date ranges and other objects
      if (value.gte || value.lte || value.min !== undefined || value.max !== undefined) {
        const serialized: any = {};
        if (value.gte) serialized.gte = value.gte instanceof Date ? value.gte.toISOString() : value.gte;
        if (value.lte) serialized.lte = value.lte instanceof Date ? value.lte.toISOString() : value.lte;
        if (value.min !== undefined) serialized.min = value.min;
        if (value.max !== undefined) serialized.max = value.max;
        params.set(key, JSON.stringify(serialized));
      } else {
        params.set(key, JSON.stringify(value));
      }
    } else if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      params.set(key, String(value));
    }
  });

  return params;
}

/**
 * Deserialize filters from URL
 */
export function deserializeFiltersFromUrl(searchParams: URLSearchParams): Record<string, any> {
  const filters: Record<string, any> = {};

  searchParams.forEach((value, key) => {
    try {
      // Try to parse as JSON first
      if (value.startsWith("[") || value.startsWith("{")) {
        const parsed = JSON.parse(value);

        // Handle date ranges
        if (typeof parsed === "object" && !Array.isArray(parsed)) {
          if (parsed.gte && typeof parsed.gte === "string") {
            parsed.gte = new Date(parsed.gte);
          }
          if (parsed.lte && typeof parsed.lte === "string") {
            parsed.lte = new Date(parsed.lte);
          }
        }

        filters[key] = parsed;
      } else if (value === "true") {
        filters[key] = true;
      } else if (value === "false") {
        filters[key] = false;
      } else if (!isNaN(Number(value)) && value !== "") {
        filters[key] = Number(value);
      } else if (value.match(/^\d{4}-\d{2}-\d{2}T/)) {
        // ISO date string
        filters[key] = new Date(value);
      } else {
        filters[key] = value;
      }
    } catch {
      // If parsing fails, treat as string
      filters[key] = value;
    }
  });

  return filters;
}

// ============================================================================
// FILTER VALIDATION AND SANITIZATION
// ============================================================================

/**
 * Validate filter condition
 */
export function validateFilterCondition(condition: FilterCondition, fieldDefinition?: FilterFieldDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if operator is valid for data type
  const validOperators = getValidOperatorsForDataType(condition.dataType);
  if (!validOperators.includes(condition.operator)) {
    errors.push(`Operador '${condition.operator}' não é válido para tipo '${condition.dataType}'`);
  }

  // Validate against field definition if provided
  if (fieldDefinition) {
    if (!fieldDefinition.operators.includes(condition.operator)) {
      errors.push(`Operador '${condition.operator}' não é permitido para campo '${fieldDefinition.label}'`);
    }

    if (fieldDefinition.validation) {
      const validation = fieldDefinition.validation;

      // Required validation
      if (validation.required && (condition.value === null || condition.value === undefined || condition.value === "")) {
        errors.push(`Campo '${fieldDefinition.label}' é obrigatório`);
      }

      // Min/Max validation for numbers and dates
      if (typeof condition.value === "number") {
        if (validation.min !== undefined && condition.value < validation.min) {
          errors.push(`Valor deve ser maior ou igual a ${validation.min}`);
        }
        if (validation.max !== undefined && condition.value > validation.max) {
          errors.push(`Valor deve ser menor ou igual a ${validation.max}`);
        }
      }

      if (condition.value instanceof Date) {
        if (validation.min instanceof Date && condition.value < validation.min) {
          errors.push(`Data deve ser posterior a ${validation.min.toLocaleDateString("pt-BR")}`);
        }
        if (validation.max instanceof Date && condition.value > validation.max) {
          errors.push(`Data deve ser anterior a ${validation.max.toLocaleDateString("pt-BR")}`);
        }
      }

      // Pattern validation for strings
      if (typeof condition.value === "string" && validation.pattern) {
        if (!validation.pattern.test(condition.value)) {
          errors.push(`Formato inválido para campo '${fieldDefinition.label}'`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get valid operators for data type
 */
export function getValidOperatorsForDataType(dataType: FilterDataType): FilterOperator[] {
  switch (dataType) {
    case "string":
      return ["equals", "notEquals", "contains", "startsWith", "endsWith", "isEmpty", "isNotEmpty"];
    case "number":
      return ["equals", "notEquals", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual", "between"];
    case "boolean":
      return ["equals", "notEquals"];
    case "date":
      return ["equals", "notEquals", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual", "between"];
    case "dateRange":
      return ["between"];
    case "select":
      return ["equals", "notEquals", "in", "notIn"];
    case "multiSelect":
      return ["in", "notIn"];
    case "range":
      return ["between"];
    default:
      return [];
  }
}

/**
 * Sanitize filter value based on data type
 */
export function sanitizeFilterValue(value: any, dataType: FilterDataType): any {
  switch (dataType) {
    case "string":
      return typeof value === "string" ? value.trim() : String(value || "");
    case "number":
      return typeof value === "number" ? value : Number(value) || 0;
    case "boolean":
      return Boolean(value);
    case "date":
      return value instanceof Date ? value : new Date(value);
    case "select":
    case "multiSelect":
      return value;
    default:
      return value;
  }
}

// ============================================================================
// FILTER COMBINATION LOGIC
// ============================================================================

/**
 * Combine filter groups with logical operators
 */
export function combineFilterGroups(groups: FilterGroup[], operator: "AND" | "OR"): FilterGroup {
  return {
    conditions: [],
    operator,
    groups,
  };
}

/**
 * Create filter group from conditions
 */
export function createFilterGroup(conditions: FilterCondition[], operator: "AND" | "OR" = "AND"): FilterGroup {
  return {
    conditions,
    operator,
  };
}

/**
 * Add condition to filter group
 */
export function addConditionToGroup(group: FilterGroup, condition: FilterCondition): FilterGroup {
  return {
    ...group,
    conditions: [...group.conditions, condition],
  };
}

/**
 * Remove condition from filter group
 */
export function removeConditionFromGroup(group: FilterGroup, conditionIndex: number): FilterGroup {
  return {
    ...group,
    conditions: group.conditions.filter((_, index) => index !== conditionIndex),
  };
}

/**
 * Convert filter definition to API query format
 */
export function convertFilterDefinitionToQuery(definition: FilterDefinition): Record<string, any> {
  const query: Record<string, any> = {};

  const processGroup = (group: FilterGroup): any => {
    const conditions: Record<string, any> = {};

    // Process individual conditions
    group.conditions.forEach((condition) => {
      const value = convertConditionToQueryValue(condition);
      if (value !== undefined) {
        conditions[condition.field] = value;
      }
    });

    // Process nested groups
    if (group.groups && group.groups.length > 0) {
      const nestedQueries = group.groups.map(processGroup);
      if (group.operator === "OR") {
        return { OR: [conditions, ...nestedQueries] };
      } else {
        return { AND: [conditions, ...nestedQueries] };
      }
    }

    return conditions;
  };

  if (definition.groups.length === 1) {
    return processGroup(definition.groups[0]);
  } else if (definition.groups.length > 1) {
    return { AND: definition.groups.map(processGroup) };
  }

  return query;
}

/**
 * Convert filter condition to API query value
 */
function convertConditionToQueryValue(condition: FilterCondition): any {
  switch (condition.operator) {
    case "equals":
      return condition.value;
    case "notEquals":
      return { not: condition.value };
    case "contains":
      return { contains: condition.value, mode: "insensitive" };
    case "startsWith":
      return { startsWith: condition.value, mode: "insensitive" };
    case "endsWith":
      return { endsWith: condition.value, mode: "insensitive" };
    case "greaterThan":
      return { gt: condition.value };
    case "greaterThanOrEqual":
      return { gte: condition.value };
    case "lessThan":
      return { lt: condition.value };
    case "lessThanOrEqual":
      return { lte: condition.value };
    case "between":
      if (condition.value && typeof condition.value === "object") {
        const range: any = {};
        if (condition.value.min !== undefined || condition.value.gte !== undefined) {
          range.gte = condition.value.min || condition.value.gte;
        }
        if (condition.value.max !== undefined || condition.value.lte !== undefined) {
          range.lte = condition.value.max || condition.value.lte;
        }
        return range;
      }
      return condition.value;
    case "in":
      return { in: condition.value };
    case "notIn":
      return { notIn: condition.value };
    case "isEmpty":
      return null;
    case "isNotEmpty":
      return { not: null };
    default:
      return condition.value;
  }
}

// ============================================================================
// FILTER PRESET MANAGEMENT
// ============================================================================

/**
 * Filter preset storage interface
 */
export interface FilterPresetStorage {
  savePreset(preset: FilterDefinition): Promise<void>;
  loadPreset(id: string): Promise<FilterDefinition | null>;
  loadPresets(userId?: string): Promise<FilterDefinition[]>;
  deletePreset(id: string): Promise<void>;
  updatePreset(preset: FilterDefinition): Promise<void>;
}

/**
 * Local storage implementation for filter presets
 */
export class LocalStorageFilterPresets implements FilterPresetStorage {
  private readonly storageKey = "ankaa_filter_presets";

  async savePreset(preset: FilterDefinition): Promise<void> {
    const presets = await this.loadPresets();
    const updatedPresets = [...presets.filter((p) => p.id !== preset.id), preset];
    localStorage.setItem(this.storageKey, JSON.stringify(updatedPresets));
  }

  async loadPreset(id: string): Promise<FilterDefinition | null> {
    const presets = await this.loadPresets();
    return presets.find((p) => p.id === id) || null;
  }

  async loadPresets(userId?: string): Promise<FilterDefinition[]> {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return [];

      const presets: FilterDefinition[] = JSON.parse(data);
      return userId ? presets.filter((p) => p.createdBy === userId || p.isPreset) : presets;
    } catch {
      return [];
    }
  }

  async deletePreset(id: string): Promise<void> {
    const presets = await this.loadPresets();
    const updatedPresets = presets.filter((p) => p.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(updatedPresets));
  }

  async updatePreset(preset: FilterDefinition): Promise<void> {
    await this.savePreset(preset);
  }
}

/**
 * Create a new filter preset
 */
export function createFilterPreset(
  name: string,
  groups: FilterGroup[],
  options: {
    description?: string;
    isPreset?: boolean;
    createdBy?: string;
  } = {},
): FilterDefinition {
  return {
    id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description: options.description,
    groups,
    isPreset: options.isPreset || false,
    createdBy: options.createdBy,
    createdAt: new Date(),
  };
}

// ============================================================================
// FILTER COMPARISON FUNCTIONS
// ============================================================================

/**
 * Compare two filter definitions for equality
 */
export function areFiltersEqual(filter1: FilterDefinition, filter2: FilterDefinition): boolean {
  return JSON.stringify(normalizeFilterDefinition(filter1)) === JSON.stringify(normalizeFilterDefinition(filter2));
}

/**
 * Normalize filter definition for comparison
 */
function normalizeFilterDefinition(filter: FilterDefinition): any {
  return {
    groups: filter.groups.map((group) => ({
      operator: group.operator,
      conditions: group.conditions
        .map((condition) => ({
          field: condition.field,
          operator: condition.operator,
          value: condition.value,
          dataType: condition.dataType,
        }))
        .sort((a, b) => a.field.localeCompare(b.field)),
      groups: group.groups?.map((g) => normalizeFilterDefinition({ ...filter, groups: [g] }).groups[0]),
    })),
  };
}

/**
 * Check if a filter definition is empty
 */
export function isFilterDefinitionEmpty(filter: FilterDefinition): boolean {
  return filter.groups.every((group) => group.conditions.length === 0 && (group.groups?.every((g) => isFilterDefinitionEmpty({ ...filter, groups: [g] })) ?? true));
}

/**
 * Get summary of active filters
 */
export function getFilterSummary(filter: FilterDefinition): string {
  const conditionCount = countFilterConditions(filter);

  if (conditionCount === 0) {
    return "Nenhum filtro aplicado";
  } else if (conditionCount === 1) {
    return "1 filtro aplicado";
  } else {
    return `${conditionCount} filtros aplicados`;
  }
}

/**
 * Count total conditions in filter definition
 */
function countFilterConditions(filter: FilterDefinition): number {
  return filter.groups.reduce((count, group) => {
    let groupCount = group.conditions.length;
    if (group.groups) {
      groupCount += group.groups.reduce((subCount, subGroup) => subCount + countFilterConditions({ ...filter, groups: [subGroup] }), 0);
    }
    return count + groupCount;
  }, 0);
}

// ============================================================================
// TYPE-SAFE FILTER DEFINITIONS
// ============================================================================

/**
 * Create type-safe filter field definitions
 */
export function createFilterFields<T extends Record<string, any>>(fields: { [K in keyof T]?: FilterFieldDefinition }): { [K in keyof T]: FilterFieldDefinition } {
  return fields as any;
}

/**
 * Predefined common field definitions
 */
export const CommonFilterFields = {
  id: {
    key: "id",
    label: "ID",
    dataType: "string" as FilterDataType,
    operators: ["equals", "contains"] as FilterOperator[],
  },
  name: {
    key: "name",
    label: "Nome",
    dataType: "string" as FilterDataType,
    operators: ["equals", "contains", "startsWith", "endsWith"] as FilterOperator[],
  },
  status: {
    key: "status",
    label: "Status",
    dataType: "select" as FilterDataType,
    operators: ["equals", "in", "notIn"] as FilterOperator[],
  },
  createdAt: {
    key: "createdAt",
    label: "Criado em",
    dataType: "dateRange" as FilterDataType,
    operators: ["between", "greaterThanOrEqual", "lessThanOrEqual"] as FilterOperator[],
  },
  updatedAt: {
    key: "updatedAt",
    label: "Atualizado em",
    dataType: "dateRange" as FilterDataType,
    operators: ["between", "greaterThanOrEqual", "lessThanOrEqual"] as FilterOperator[],
  },
  isActive: {
    key: "isActive",
    label: "Ativo",
    dataType: "boolean" as FilterDataType,
    operators: ["equals"] as FilterOperator[],
  },
} as const;
