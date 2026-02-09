import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { FilterDefinition } from "@/utils/table-filter-utils";
import { createFilterGroup } from "@/utils/table-filter-utils";

export interface UseFilterStateOptions {
  /**
   * Default filter definition
   */
  defaultDefinition?: FilterDefinition;

  /**
   * Enable URL synchronization
   */
  syncWithUrl?: boolean;

  /**
   * URL parameter name for filters
   */
  urlParamName?: string;

  /**
   * Callback when filters change
   */
  onChange?: (definition: FilterDefinition) => void;
}

export interface UseFilterStateReturn {
  /**
   * Current filter definition
   */
  definition: FilterDefinition;

  /**
   * Update filter definition
   */
  setDefinition: (definition: FilterDefinition | ((prev: FilterDefinition) => FilterDefinition)) => void;

  /**
   * Clear all filters
   */
  clearFilters: () => void;

  /**
   * Check if any filters are active
   */
  hasActiveFilters: boolean;

  /**
   * Apply filters (triggers onChange callback)
   */
  applyFilters: () => void;

  /**
   * Reset to default filters
   */
  resetFilters: () => void;
}

const DEFAULT_DEFINITION: FilterDefinition = {
  id: "",
  name: "",
  groups: [createFilterGroup([], "AND")],
};

export function useFilterState({
  defaultDefinition = DEFAULT_DEFINITION,
  syncWithUrl = false,
  urlParamName = "filters",
  onChange,
}: UseFilterStateOptions = {}): UseFilterStateReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const [definition, setDefinitionState] = useState<FilterDefinition>(() => {
    if (syncWithUrl) {
      const urlFilters = searchParams.get(urlParamName);
      if (urlFilters) {
        try {
          return JSON.parse(decodeURIComponent(urlFilters));
        } catch {
          return defaultDefinition;
        }
      }
    }
    return defaultDefinition;
  });

  // Sync with URL when definition changes
  useEffect(() => {
    if (syncWithUrl && definition !== defaultDefinition) {
      const params = new URLSearchParams(searchParams);

      if (isFilterEmpty(definition)) {
        params.delete(urlParamName);
      } else {
        params.set(urlParamName, encodeURIComponent(JSON.stringify(definition)));
      }

      setSearchParams(params, { replace: true });
    }
  }, [definition, syncWithUrl, urlParamName, searchParams, setSearchParams, defaultDefinition]);

  const setDefinition = useCallback(
    (value: FilterDefinition | ((prev: FilterDefinition) => FilterDefinition)) => {
      setDefinitionState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        return next;
      });
    },
    []
  );

  const clearFilters = useCallback(() => {
    setDefinitionState(DEFAULT_DEFINITION);
  }, []);

  const resetFilters = useCallback(() => {
    setDefinitionState(defaultDefinition);
  }, [defaultDefinition]);

  const applyFilters = useCallback(() => {
    onChange?.(definition);
  }, [definition, onChange]);

  const hasActiveFilters = !isFilterEmpty(definition);

  return {
    definition,
    setDefinition,
    clearFilters,
    hasActiveFilters,
    applyFilters,
    resetFilters,
  };
}

/**
 * Check if filter definition is empty
 */
function isFilterEmpty(definition: FilterDefinition): boolean {
  return definition.groups.every(
    (group) => group.conditions.length === 0 && (!group.groups || group.groups.length === 0)
  );
}
