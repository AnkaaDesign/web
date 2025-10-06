import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconSearch, IconFilter, IconX, IconChevronDown, IconChevronUp, IconFlask, IconAdjustments } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PaintProductionGetManyFormData } from "../../../../schemas";
import { PaintProductionAdvancedFilters } from "./paint-production-advanced-filters";
import { debounce } from "@/utils/url-form-state";

interface PaintProductionSearchProps {
  filters: Partial<PaintProductionGetManyFormData>;
  onFilterChange: (filters: Partial<PaintProductionGetManyFormData>) => void;
  onClearFilters: () => void;
  searchPlaceholder?: string;
  className?: string;
}

interface ActiveFilter {
  label: string;
  value: string;
  onRemove: () => void;
}

export function PaintProductionSearch({ filters, onFilterChange, onClearFilters, searchPlaceholder = "Buscar por ID, fórmula, tinta...", className }: PaintProductionSearchProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [displaySearchText, setDisplaySearchText] = useState(() => searchParams.get("search") || "");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Track if we're programmatically updating display text (to avoid sync loops)
  const isUpdatingFromFiltersRef = useRef(false);

  // Sync displaySearchText with searchingFor from filters
  useEffect(() => {
    const currentSearch = filters.searchingFor || "";
    // Only update if different and not currently handling user input
    if (currentSearch !== displaySearchText && !isUpdatingFromFiltersRef.current) {
      setDisplaySearchText(currentSearch);
    }
  }, [filters.searchingFor, displaySearchText]);

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        const newFilters = { ...filters };
        if (value.trim()) {
          newFilters.searchingFor = value.trim();
        } else {
          delete newFilters.searchingFor;
        }
        onFilterChange(newFilters);

        // Update URL
        setSearchParams(
          (prev) => {
            const params = new URLSearchParams(prev);
            if (value.trim()) {
              params.set("search", value.trim());
            } else {
              params.delete("search");
            }
            return params;
          },
          { replace: true },
        );
      }, 300),
    [filters, onFilterChange, setSearchParams],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Handle search input change
  const handleSearchChange = useCallback(
    (value: string) => {
      // Set flag to prevent sync from overriding user input
      isUpdatingFromFiltersRef.current = true;
      setDisplaySearchText(value);

      if (value === "") {
        // When clearing search, set it immediately
        const newFilters = { ...filters };
        delete newFilters.searchingFor;
        onFilterChange(newFilters);

        setSearchParams(
          (prev) => {
            const params = new URLSearchParams(prev);
            params.delete("search");
            return params;
          },
          { replace: true },
        );

        debouncedSearch.cancel();
      } else {
        debouncedSearch(value);
      }

      // Reset flag after a short delay to allow for rapid typing
      setTimeout(() => {
        isUpdatingFromFiltersRef.current = false;
      }, 100);
    },
    [filters, onFilterChange, debouncedSearch, setSearchParams],
  );

  // Extract active filters for display
  const activeFilters = useMemo((): ActiveFilter[] => {
    const active: ActiveFilter[] = [];

    // Search filter
    if (filters.searchingFor) {
      active.push({
        label: "Busca",
        value: filters.searchingFor,
        onRemove: () => {
          const newFilters = { ...filters };
          delete newFilters.searchingFor;
          onFilterChange(newFilters);
          setDisplaySearchText("");
          setSearchParams(
            (prev) => {
              const params = new URLSearchParams(prev);
              params.delete("search");
              return params;
            },
            { replace: true },
          );
        },
      });
    }

    // Formula IDs filter
    if (filters.formulaIds && filters.formulaIds.length > 0) {
      filters.formulaIds.forEach((formulaId: string) => {
        active.push({
          label: "Fórmula",
          value: `ID: ${formulaId.slice(0, 8)}...`,
          onRemove: () => {
            const newFilters = { ...filters };
            if (newFilters.formulaIds) {
              newFilters.formulaIds = newFilters.formulaIds.filter((id: string) => id !== formulaId);
              if (newFilters.formulaIds.length === 0) {
                delete newFilters.formulaIds;
              }
            }
            onFilterChange(newFilters);
          },
        });
      });
    }

    // Volume range filter
    if (filters.volumeRange) {
      let volumeValue = "Volume";
      if (filters.volumeRange.min !== undefined && filters.volumeRange.max !== undefined) {
        volumeValue += ` entre ${filters.volumeRange.min}L e ${filters.volumeRange.max}L`;
      } else if (filters.volumeRange.min !== undefined) {
        volumeValue += ` ≥ ${filters.volumeRange.min}L`;
      } else if (filters.volumeRange.max !== undefined) {
        volumeValue += ` ≤ ${filters.volumeRange.max}L`;
      }

      active.push({
        label: "Volume",
        value: volumeValue,
        onRemove: () => {
          const newFilters = { ...filters };
          delete newFilters.volumeRange;
          onFilterChange(newFilters);
        },
      });
    }

    // Created date filter
    if (filters.createdAt) {
      let dateValue = "Criado";
      if (filters.createdAt.gte && filters.createdAt.lte) {
        dateValue += ` entre ${format(filters.createdAt.gte, "dd/MM/yyyy", { locale: ptBR })} e ${format(filters.createdAt.lte, "dd/MM/yyyy", { locale: ptBR })}`;
      } else if (filters.createdAt.gte) {
        dateValue += ` após ${format(filters.createdAt.gte, "dd/MM/yyyy", { locale: ptBR })}`;
      } else if (filters.createdAt.lte) {
        dateValue += ` antes de ${format(filters.createdAt.lte, "dd/MM/yyyy", { locale: ptBR })}`;
      }

      active.push({
        label: "Data de Criação",
        value: dateValue,
        onRemove: () => {
          const newFilters = { ...filters };
          delete newFilters.createdAt;
          onFilterChange(newFilters);
        },
      });
    }

    // Updated date filter
    if (filters.updatedAt) {
      let dateValue = "Atualizado";
      if (filters.updatedAt.gte && filters.updatedAt.lte) {
        dateValue += ` entre ${format(filters.updatedAt.gte, "dd/MM/yyyy", { locale: ptBR })} e ${format(filters.updatedAt.lte, "dd/MM/yyyy", { locale: ptBR })}`;
      } else if (filters.updatedAt.gte) {
        dateValue += ` após ${format(filters.updatedAt.gte, "dd/MM/yyyy", { locale: ptBR })}`;
      } else if (filters.updatedAt.lte) {
        dateValue += ` antes de ${format(filters.updatedAt.lte, "dd/MM/yyyy", { locale: ptBR })}`;
      }

      active.push({
        label: "Data de Atualização",
        value: dateValue,
        onRemove: () => {
          const newFilters = { ...filters };
          delete newFilters.updatedAt;
          onFilterChange(newFilters);
        },
      });
    }

    return active;
  }, [filters, onFilterChange, setSearchParams]);

  // Check if we have advanced filters active
  const hasAdvancedFilters = useMemo(() => {
    return !!(filters.formulaIds?.length || filters.volumeRange || filters.createdAt || filters.updatedAt);
  }, [filters]);

  // Auto-expand advanced filters if there are active ones
  useEffect(() => {
    if (hasAdvancedFilters && !showAdvancedFilters) {
      setShowAdvancedFilters(true);
    }
  }, [hasAdvancedFilters, showAdvancedFilters]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main search bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input type="text" placeholder={searchPlaceholder} value={displaySearchText} onChange={(value) => handleSearchChange(value as string)} className="pl-10" />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={cn("group transition-colors", hasAdvancedFilters && "border-primary text-primary")}
        >
          <IconAdjustments className="h-4 w-4 mr-2" />
          Filtros Avançados
          {showAdvancedFilters ? <IconChevronUp className="h-4 w-4 ml-2" /> : <IconChevronDown className="h-4 w-4 ml-2" />}
          {hasAdvancedFilters && (
            <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground">
              {activeFilters.filter((f) => f.label !== "Busca").length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <Card className="border-muted">
          <CardContent className="pt-4">
            <PaintProductionAdvancedFilters filters={filters} onFilterChange={onFilterChange} />
          </CardContent>
        </Card>
      )}

      {/* Active Filter Indicators */}
      {activeFilters.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconFilter className="h-4 w-4" />
              <span>Filtros ativos:</span>
            </div>
            {activeFilters.length > 1 && (
              <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-6 px-2 text-xs">
                <IconX className="h-3 w-3 mr-1" />
                Limpar todos
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter, index) => (
              <Badge key={`${filter.label}-${index}`} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                <span className="text-xs font-medium text-muted-foreground">{filter.label}:</span>
                <span className="text-xs">{filter.value}</span>
                <button onClick={filter.onRemove} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors">
                  <IconX className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Search Results Summary */}
      {(filters.searchingFor || hasAdvancedFilters) && (
        <>
          <Separator />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconFlask className="h-4 w-4" />
            <span>
              {filters.searchingFor ? `Resultados para "${filters.searchingFor}"${hasAdvancedFilters ? " com filtros aplicados" : ""}` : "Resultados com filtros aplicados"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
