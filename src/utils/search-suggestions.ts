import type { SearchField, SearchSuggestion } from "@/hooks/use-advanced-search";
import type { Item, User, Customer, Supplier, Task } from "../types";
import { IconBox, IconUser, IconUsers, IconTruck, IconClipboardList } from "@tabler/icons-react";

// Generic suggestion builder interface
export interface SuggestionBuilder<T = any> {
  /** Entity type identifier */
  type: string;
  /** Display label for the category */
  categoryLabel: string;
  /** Icon for this entity type */
  icon: React.ReactNode;
  /** Extract searchable text from entity */
  getSearchableText: (entity: T) => string[];
  /** Create suggestion from entity */
  createSuggestion: (entity: T, query: string) => SearchSuggestion<T>;
  /** Calculate relevance score */
  calculateRelevance?: (entity: T, query: string) => number;
  /** Check if entity matches query */
  matches?: (entity: T, query: string) => boolean;
}

// Default relevance calculation
export function calculateDefaultRelevance(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match gets highest score
  if (lowerText === lowerQuery) return 1000;

  // Starts with query gets high score
  if (lowerText.startsWith(lowerQuery)) return 800;

  // Contains query at word boundary gets medium score
  const wordBoundaryMatch = new RegExp(`\\b${lowerQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  if (wordBoundaryMatch.test(text)) return 600;

  // Contains query anywhere gets low score
  if (lowerText.includes(lowerQuery)) return 400;

  return 0;
}

// Default matching function
export function defaultMatches(entity: any, query: string, getSearchableText: (entity: any) => string[]): boolean {
  const searchableTexts = getSearchableText(entity);
  const lowerQuery = query.toLowerCase();

  return searchableTexts.some((text) => text.toLowerCase().includes(lowerQuery));
}

// Suggestion builders for different entity types
export const suggestionBuilders: Record<string, SuggestionBuilder> = {
  items: {
    type: "items",
    categoryLabel: "Produtos",
    icon: IconBox({ className: "h-4 w-4" }),
    getSearchableText: (item: Item) =>
      [item.name, ...(item.barcodes || []), item.description || "", item.brand?.name || "", item.category?.name || "", item.supplier?.name || ""].filter(Boolean),
    createSuggestion: (item: Item, query: string) => ({
      id: `item-${item.id}`,
      label: item.name,
      sublabel: item.barcodes && item.barcodes.length > 0 ? `Código: ${item.barcodes[0]}` : item.brand?.name,
      category: "items",
      categoryLabel: "Produtos",
      entity: item,
      icon: IconBox({ className: "h-4 w-4" }),
      relevance: calculateDefaultRelevance(item.name, query),
    }),
    calculateRelevance: (item: Item, query: string) => {
      const searchableTexts = suggestionBuilders.items.getSearchableText(item);
      return Math.max(...searchableTexts.map((text) => calculateDefaultRelevance(text, query)));
    },
    matches: (item: Item, query: string) => {
      return defaultMatches(item, query, suggestionBuilders.items.getSearchableText);
    },
  },

  users: {
    type: "users",
    categoryLabel: "Usuários",
    icon: IconUser({ className: "h-4 w-4" }),
    getSearchableText: (user: User) => [user.name, user.email || "", user.cpf || "", user.position?.name || "", user.sector?.name || ""].filter(Boolean),
    createSuggestion: (user: User, query: string) => ({
      id: `user-${user.id}`,
      label: user.name,
      sublabel: user.email || user.position?.name,
      category: "users",
      categoryLabel: "Usuários",
      entity: user,
      icon: IconUser({ className: "h-4 w-4" }),
      relevance: calculateDefaultRelevance(user.name, query),
    }),
    calculateRelevance: (user: User, query: string) => {
      const searchableTexts = suggestionBuilders.users.getSearchableText(user);
      return Math.max(...searchableTexts.map((text) => calculateDefaultRelevance(text, query)));
    },
    matches: (user: User, query: string) => {
      return defaultMatches(user, query, suggestionBuilders.users.getSearchableText);
    },
  },

  customers: {
    type: "customers",
    categoryLabel: "Clientes",
    icon: IconUsers({ className: "h-4 w-4" }),
    getSearchableText: (customer: Customer) =>
      [customer.name, customer.fantasyName || "", customer.email || "", customer.cpf || "", customer.cnpj || "", customer.phone || ""].filter(Boolean),
    createSuggestion: (customer: Customer, query: string) => ({
      id: `customer-${customer.id}`,
      label: customer.fantasyName || customer.name,
      sublabel: customer.cpf || customer.cnpj || customer.email,
      category: "customers",
      categoryLabel: "Clientes",
      entity: customer,
      icon: IconUsers({ className: "h-4 w-4" }),
      relevance: calculateDefaultRelevance(customer.name, query),
    }),
    calculateRelevance: (customer: Customer, query: string) => {
      const searchableTexts = suggestionBuilders.customers.getSearchableText(customer);
      return Math.max(...searchableTexts.map((text) => calculateDefaultRelevance(text, query)));
    },
    matches: (customer: Customer, query: string) => {
      return defaultMatches(customer, query, suggestionBuilders.customers.getSearchableText);
    },
  },

  suppliers: {
    type: "suppliers",
    categoryLabel: "Fornecedores",
    icon: IconTruck({ className: "h-4 w-4" }),
    getSearchableText: (supplier: Supplier) => [supplier.name, supplier.fantasyName || "", supplier.email || "", supplier.cnpj || "", supplier.phone || ""].filter(Boolean),
    createSuggestion: (supplier: Supplier, query: string) => ({
      id: `supplier-${supplier.id}`,
      label: supplier.fantasyName || supplier.name,
      sublabel: supplier.cnpj || supplier.email,
      category: "suppliers",
      categoryLabel: "Fornecedores",
      entity: supplier,
      icon: IconTruck({ className: "h-4 w-4" }),
      relevance: calculateDefaultRelevance(supplier.name, query),
    }),
    calculateRelevance: (supplier: Supplier, query: string) => {
      const searchableTexts = suggestionBuilders.suppliers.getSearchableText(supplier);
      return Math.max(...searchableTexts.map((text) => calculateDefaultRelevance(text, query)));
    },
    matches: (supplier: Supplier, query: string) => {
      return defaultMatches(supplier, query, suggestionBuilders.suppliers.getSearchableText);
    },
  },

  tasks: {
    type: "tasks",
    categoryLabel: "Tarefas",
    icon: IconClipboardList({ className: "h-4 w-4" }),
    getSearchableText: (task: Task) =>
      [
        task.name || "",
        task.description || "",
        task.customer?.name || "",
        task.customer?.fantasyName || "",
        task.user?.name || "",
        task.sector?.name || "",
        ...(task.serviceOrders?.map((s) => s.name) || []),
      ].filter(Boolean),
    createSuggestion: (task: Task, query: string) => ({
      id: `task-${task.id}`,
      label: task.name || `Tarefa #${task.id.slice(-6)}`,
      sublabel: task.customer?.fantasyName || task.customer?.name,
      category: "tasks",
      categoryLabel: "Tarefas",
      entity: task,
      icon: IconClipboardList({ className: "h-4 w-4" }),
      relevance: calculateDefaultRelevance(task.name || "", query),
    }),
    calculateRelevance: (task: Task, query: string) => {
      const searchableTexts = suggestionBuilders.tasks.getSearchableText(task);
      return Math.max(...searchableTexts.map((text) => calculateDefaultRelevance(text, query)));
    },
    matches: (task: Task, query: string) => {
      return defaultMatches(task, query, suggestionBuilders.tasks.getSearchableText);
    },
  },
};

// Multi-entity search function
export async function searchMultipleEntities(
  query: string,
  entityFetchers: Record<string, (query: string) => Promise<any[]>>,
  options: {
    maxPerEntity?: number;
    maxTotal?: number;
    enabledEntities?: string[];
  } = {},
): Promise<SearchSuggestion[]> {
  const { maxPerEntity = 3, maxTotal = 8, enabledEntities = Object.keys(suggestionBuilders) } = options;

  if (!query || query.length < 1) {
    return [];
  }

  const searchPromises = enabledEntities
    .filter((entityType) => entityFetchers[entityType] && suggestionBuilders[entityType])
    .map(async (entityType) => {
      try {
        const entities = await entityFetchers[entityType](query);
        const builder = suggestionBuilders[entityType];

        return entities
          .filter((entity) => builder.matches?.(entity, query) ?? true)
          .map((entity) => builder.createSuggestion(entity, query))
          .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
          .slice(0, maxPerEntity);
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Error searching ${entityType}:`, error);
        }
        return [];
      }
    });

  const results = await Promise.all(searchPromises);
  const allSuggestions = results.flat();

  // Sort by relevance and limit total results
  return allSuggestions.sort((a, b) => (b.relevance || 0) - (a.relevance || 0)).slice(0, maxTotal);
}

// Create search field configurations
export function createSearchFields(entityType: string): SearchField[] {
  const builder = suggestionBuilders[entityType];
  if (!builder) {
    return [{ key: "searchingFor", label: "Busca Geral" }];
  }

  const baseFields: SearchField[] = [{ key: "searchingFor", label: "Busca Geral", weight: 1 }];

  // Add entity-specific fields
  switch (entityType) {
    case "items":
      return [
        ...baseFields,
        { key: "name", label: "Nome", weight: 0.9 },
        { key: "barcodes", label: "Código de Barras", weight: 0.8, exactMatch: true },
        { key: "description", label: "Descrição", weight: 0.6 },
      ];

    case "users":
      return [
        ...baseFields,
        { key: "name", label: "Nome", weight: 0.9 },
        { key: "email", label: "Email", weight: 0.8, exactMatch: true },
        { key: "cpf", label: "CPF", weight: 0.7, exactMatch: true },
      ];

    case "customers":
      return [
        ...baseFields,
        { key: "name", label: "Razão Social", weight: 0.9 },
        { key: "fantasyName", label: "Nome Fantasia", weight: 0.9 },
        { key: "email", label: "Email", weight: 0.7 },
        { key: "cpf", label: "CPF", weight: 0.8, exactMatch: true },
        { key: "cnpj", label: "CNPJ", weight: 0.8, exactMatch: true },
      ];

    case "suppliers":
      return [
        ...baseFields,
        { key: "name", label: "Razão Social", weight: 0.9 },
        { key: "fantasyName", label: "Nome Fantasia", weight: 0.9 },
        { key: "cnpj", label: "CNPJ", weight: 0.8, exactMatch: true },
      ];

    case "tasks":
      return [...baseFields, { key: "name", label: "Nome da Tarefa", weight: 0.9 }, { key: "description", label: "Descrição", weight: 0.6 }];

    default:
      return baseFields;
  }
}

// Create suggestion fetcher for entity hooks
export function createSuggestionFetcher(entityHooks: Record<string, any>, enabledEntities: string[] = Object.keys(suggestionBuilders)) {
  return async (query: string): Promise<SearchSuggestion[]> => {
    const entityFetchers: Record<string, (query: string) => Promise<any[]>> = {};

    // Map entity hooks to fetcher functions
    enabledEntities.forEach((entityType) => {
      const hook = entityHooks[entityType];
      if (hook && typeof hook.getMany === "function") {
        entityFetchers[entityType] = async (searchQuery: string) => {
          const response = await hook.getMany({
            searchingFor: searchQuery,
            take: 5,
            orderBy: { name: "asc" },
          });
          return response?.data || [];
        };
      }
    });

    return searchMultipleEntities(query, entityFetchers, {
      maxPerEntity: 3,
      maxTotal: 8,
      enabledEntities,
    });
  };
}

// Highlight text helper specifically for search results
export function highlightSearchText(text: string, query: string, className: string = "bg-primary/20 text-primary font-medium px-0.5 rounded"): React.ReactNode {
  if (!query || !text) return text;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));

  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return React.createElement("mark", { key: index, className }, part);
    }
    return part;
  });
}

// Create search context for specific entity types
export interface SearchContext {
  entityType: string;
  searchFields: SearchField[];
  suggestionBuilder: SuggestionBuilder;
  fetchSuggestions: (query: string) => Promise<SearchSuggestion[]>;
}

export function createSearchContext(entityType: string, entityHooks: Record<string, any>): SearchContext {
  const searchFields = createSearchFields(entityType);
  const suggestionBuilder = suggestionBuilders[entityType];
  const fetchSuggestions = createSuggestionFetcher(entityHooks, [entityType]);

  return {
    entityType,
    searchFields,
    suggestionBuilder,
    fetchSuggestions,
  };
}
