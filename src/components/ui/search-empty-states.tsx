import React from "react";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Badge } from "./badge";
import {
  IconSearch,
  IconSearchOff,
  IconFilter,
  IconFilterOff,
  IconMoodEmpty,
  IconWifi,
  IconBulb,
  IconHelp,
  IconDatabase,
  IconDatabaseOff,
  IconClock,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

// Types for empty state configuration
export interface EmptyStateAction {
  /** Action label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Button variant */
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Show loading state */
  loading?: boolean;
}

export interface SearchEmptyStateConfig {
  /** Unique identifier */
  type: string;
  /** State title */
  title: string;
  /** State description */
  description?: string;
  /** Icon component */
  icon?: React.ReactNode;
  /** Primary action */
  primaryAction?: EmptyStateAction;
  /** Secondary actions */
  secondaryActions?: EmptyStateAction[];
  /** Search suggestions */
  suggestions?: string[];
  /** Show current query */
  showQuery?: boolean;
  /** Custom content */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

interface SearchEmptyStatesProps {
  /** Current search query */
  query?: string;
  /** Current filters */
  filters?: Record<string, any>;
  /** Error state */
  error?: Error | null;
  /** Loading state */
  isLoading?: boolean;
  /** Number of total items without filters */
  totalItems?: number;
  /** Empty state configuration */
  config?: Partial<SearchEmptyStateConfig>;
  /** Custom empty state renderer */
  renderCustomState?: (state: SearchEmptyStateConfig) => React.ReactNode;
  /** Callbacks */
  onRetry?: () => void;
  onClearSearch?: () => void;
  onClearFilters?: () => void;
  onCreateNew?: () => void;
  onSuggestionClick?: (suggestion: string) => void;
  /** Additional props */
  className?: string;
}

/**
 * Comprehensive empty states component for search results
 */
export function SearchEmptyStates({
  query = "",
  filters = {},
  error,
  isLoading = false,
  totalItems = 0,
  config = {},
  renderCustomState,
  onRetry,
  onClearSearch,
  onClearFilters,
  onCreateNew,
  onSuggestionClick,
  className,
}: SearchEmptyStatesProps) {
  // Determine which empty state to show
  const emptyStateConfig = React.useMemo((): SearchEmptyStateConfig => {
    const hasQuery = query.trim().length > 0;
    const hasFilters = Object.keys(filters).length > 0;

    if (error) {
      return {
        type: "error",
        title: "Erro na busca",
        description: error.message || "Ocorreu um erro ao buscar os dados. Tente novamente.",
        icon: <IconWifi className="h-12 w-12 text-destructive" />,
        primaryAction: onRetry
          ? {
              label: "Tentar novamente",
              onClick: onRetry,
              variant: "default",
            }
          : undefined,
        ...config,
      };
    }

    if (isLoading) {
      return {
        type: "loading",
        title: "Buscando...",
        description: "Carregando resultados da pesquisa.",
        icon: <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />,
        ...config,
      };
    }

    if (hasQuery && hasFilters) {
      return {
        type: "no-results-query-filters",
        title: "Nenhum resultado encontrado",
        description: `Nenhum resultado encontrado para "${query}" com os filtros aplicados.`,
        icon: <IconFilterOff className="h-12 w-12 text-muted-foreground" />,
        showQuery: true,
        primaryAction: onClearFilters
          ? {
              label: "Remover filtros",
              onClick: onClearFilters,
              variant: "outline",
            }
          : undefined,
        secondaryActions: [
          ...(onClearSearch
            ? [
                {
                  label: "Limpar busca",
                  onClick: onClearSearch,
                  variant: "ghost" as const,
                },
              ]
            : []),
        ],
        suggestions: ["Tente termos mais gerais", "Remova alguns filtros", "Verifique a ortografia"],
        ...config,
      };
    }

    if (hasQuery) {
      return {
        type: "no-results-query",
        title: "Nenhum resultado encontrado",
        description: `Nenhum resultado encontrado para "${query}".`,
        icon: <IconSearchOff className="h-12 w-12 text-muted-foreground" />,
        showQuery: true,
        primaryAction: onClearSearch
          ? {
              label: "Limpar busca",
              onClick: onClearSearch,
              variant: "outline",
            }
          : undefined,
        suggestions: ["Tente termos diferentes", "Use termos mais gerais", "Verifique a ortografia", "Use sinônimos"],
        ...config,
      };
    }

    if (hasFilters) {
      return {
        type: "no-results-filters",
        title: "Nenhum item corresponde aos filtros",
        description: "Não há itens que correspondam aos filtros aplicados.",
        icon: <IconFilter className="h-12 w-12 text-muted-foreground" />,
        primaryAction: onClearFilters
          ? {
              label: "Remover filtros",
              onClick: onClearFilters,
              variant: "outline",
            }
          : undefined,
        suggestions: ["Remova alguns filtros", "Tente critérios mais amplos"],
        ...config,
      };
    }

    if (totalItems === 0) {
      return {
        type: "no-data",
        title: "Nenhum item encontrado",
        description: "Ainda não há itens cadastrados.",
        icon: <IconDatabaseOff className="h-12 w-12 text-muted-foreground" />,
        primaryAction: onCreateNew
          ? {
              label: "Criar primeiro item",
              onClick: onCreateNew,
              variant: "default",
            }
          : undefined,
        ...config,
      };
    }

    return {
      type: "empty",
      title: "Digite para buscar",
      description: "Use a barra de pesquisa acima para encontrar itens.",
      icon: <IconSearch className="h-12 w-12 text-muted-foreground" />,
      ...config,
    };
  }, [query, filters, error, isLoading, totalItems, config, onRetry, onClearSearch, onClearFilters, onCreateNew]);

  // Custom renderer
  if (renderCustomState) {
    return <div className={cn("search-empty-states", className)}>{renderCustomState(emptyStateConfig)}</div>;
  }

  return (
    <div className={cn("search-empty-states flex items-center justify-center min-h-[400px] p-8", className)}>
      <Card className="w-full max-w-md">
        <CardContent className="text-center p-8">
          {/* Icon */}
          <div className="flex justify-center mb-4">{emptyStateConfig.icon}</div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-foreground mb-2">{emptyStateConfig.title}</h3>

          {/* Description */}
          {emptyStateConfig.description && <p className="text-sm text-muted-foreground mb-4">{emptyStateConfig.description}</p>}

          {/* Current query display */}
          {emptyStateConfig.showQuery && query && (
            <div className="mb-4">
              <Badge variant="outline" className="text-xs">
                <IconSearch className="h-3 w-3 mr-1" />"{query}"
                {onClearSearch && (
                  <Button variant="ghost" size="sm" onClick={onClearSearch} className="h-4 w-4 p-0 ml-2 hover:bg-destructive hover:text-destructive-foreground">
                    <IconX className="h-3 w-3" />
                  </Button>
                )}
              </Badge>
            </div>
          )}

          {/* Suggestions */}
          {emptyStateConfig.suggestions && emptyStateConfig.suggestions.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <IconBulb className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Sugestões:</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {emptyStateConfig.suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className={cn("cursor-default", onSuggestionClick && "cursor-pointer hover:text-foreground transition-colors")}
                    onClick={() => onSuggestionClick?.(suggestion)}
                  >
                    • {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {/* Primary action */}
            {emptyStateConfig.primaryAction && (
              <Button
                variant={emptyStateConfig.primaryAction.variant || "default"}
                size={emptyStateConfig.primaryAction.size || "default"}
                onClick={emptyStateConfig.primaryAction.onClick}
                disabled={emptyStateConfig.primaryAction.loading}
                className="w-full"
              >
                {emptyStateConfig.primaryAction.loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />}
                {emptyStateConfig.primaryAction.label}
              </Button>
            )}

            {/* Secondary actions */}
            {emptyStateConfig.secondaryActions && emptyStateConfig.secondaryActions.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {emptyStateConfig.secondaryActions.map((action, index) => (
                  <Button key={index} variant={action.variant || "ghost"} size={action.size || "sm"} onClick={action.onClick} disabled={action.loading}>
                    {action.loading && <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent mr-1" />}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Custom content */}
          {emptyStateConfig.children}
        </CardContent>
      </Card>
    </div>
  );
}

// Predefined empty state configurations
export const EMPTY_STATE_PRESETS = {
  noConnection: {
    type: "no-connection",
    title: "Sem conexão",
    description: "Verifique sua conexão com a internet e tente novamente.",
    icon: <IconWifi className="h-12 w-12 text-destructive" />,
  },

  serverError: {
    type: "server-error",
    title: "Erro no servidor",
    description: "Ocorreu um erro interno. Tente novamente em alguns instantes.",
    icon: <IconDatabase className="h-12 w-12 text-destructive" />,
  },

  timeout: {
    type: "timeout",
    title: "Tempo limite excedido",
    description: "A busca está demorando mais que o esperado. Tente novamente.",
    icon: <IconClock className="h-12 w-12 text-warning" />,
  },

  forbidden: {
    type: "forbidden",
    title: "Acesso negado",
    description: "Você não tem permissão para acessar estes dados.",
    icon: <IconX className="h-12 w-12 text-destructive" />,
  },

  maintenance: {
    type: "maintenance",
    title: "Sistema em manutenção",
    description: "O sistema está temporariamente indisponível para manutenção.",
    icon: <IconHelp className="h-12 w-12 text-warning" />,
  },
} as const;

// Hook for managing empty states
export function useSearchEmptyStates(initialConfig: Partial<SearchEmptyStateConfig> = {}) {
  const [config, setConfig] = React.useState<Partial<SearchEmptyStateConfig>>(initialConfig);

  const updateConfig = React.useCallback((updates: Partial<SearchEmptyStateConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetConfig = React.useCallback(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  const applyPreset = React.useCallback((preset: keyof typeof EMPTY_STATE_PRESETS) => {
    setConfig((prev) => ({ ...prev, ...EMPTY_STATE_PRESETS[preset] }));
  }, []);

  return {
    config,
    updateConfig,
    resetConfig,
    applyPreset,
  };
}

// Compact empty state for inline display
export function CompactEmptyState({
  query,
  type = "no-results",
  onClear,
  className,
}: {
  query?: string;
  type?: "no-results" | "no-data" | "error" | "loading";
  onClear?: () => void;
  className?: string;
}) {
  const icons = {
    "no-results": <IconSearchOff className="h-6 w-6" />,
    "no-data": <IconMoodEmpty className="h-6 w-6" />,
    error: <IconWifi className="h-6 w-6" />,
    loading: <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />,
  };

  const messages = {
    "no-results": query ? `Nenhum resultado para "${query}"` : "Nenhum resultado encontrado",
    "no-data": "Nenhum item encontrado",
    error: "Erro ao carregar dados",
    loading: "Carregando...",
  };

  return (
    <div className={cn("flex items-center justify-center gap-3 py-8 text-muted-foreground", className)}>
      {icons[type]}
      <span className="text-sm">{messages[type]}</span>
      {onClear && query && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2 text-xs">
          Limpar
        </Button>
      )}
    </div>
  );
}
