import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Badge } from "@/components/ui/badge";
import { IconDroplet, IconCalendar, IconFlask, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { PaintProductionGetManyFormData } from "../../../../schemas";
import type { PaintFormula, Paint, PaintType } from "../../../../types";
import { usePaintFormulas } from "../../../../hooks";

// Define the shape of formula objects with includes
type PaintFormulaWithIncludes = PaintFormula & {
  paint?: Paint & {
    paintType?: PaintType;
  };
};

interface PaintProductionAdvancedFiltersProps {
  filters: Partial<PaintProductionGetManyFormData>;
  onFilterChange: (filters: Partial<PaintProductionGetManyFormData>) => void;
  className?: string;
}

export function PaintProductionAdvancedFilters({ filters, onFilterChange, className }: PaintProductionAdvancedFiltersProps) {
  // Load available formulas for selection
  const { data: formulasData } = usePaintFormulas({
    orderBy: { createdAt: "desc" },
    include: {
      paint: {
        include: {
          paintType: true,
        },
      },
    },
    limit: 100,
  });

  // Local state for form controls
  const [volumeMin, setVolumeMin] = useState<string>(filters.volumeRange?.min?.toString() || "");
  const [volumeMax, setVolumeMax] = useState<string>(filters.volumeRange?.max?.toString() || "");
  const [formulaSearchTerm, setFormulaSearchTerm] = useState("");
  const [showFormulaSearch, setShowFormulaSearch] = useState(false);

  // Sync local volume state with filters
  useEffect(() => {
    setVolumeMin(filters.volumeRange?.min?.toString() || "");
    setVolumeMax(filters.volumeRange?.max?.toString() || "");
  }, [filters.volumeRange]);

  // Handle volume range changes
  const handleVolumeChange = (type: "min" | "max", value: string) => {
    const numValue = value === "" ? undefined : parseFloat(value);

    if (type === "min") {
      setVolumeMin(value);
    } else {
      setVolumeMax(value);
    }

    // Update filters
    const newFilters = { ...filters };
    const currentRange = newFilters.volumeRange || {};

    if (type === "min") {
      if (numValue !== undefined && !isNaN(numValue)) {
        currentRange.min = numValue;
      } else {
        delete currentRange.min;
      }
    } else {
      if (numValue !== undefined && !isNaN(numValue)) {
        currentRange.max = numValue;
      } else {
        delete currentRange.max;
      }
    }

    if (Object.keys(currentRange).length > 0) {
      newFilters.volumeRange = currentRange;
    } else {
      delete newFilters.volumeRange;
    }

    onFilterChange(newFilters);
  };

  // Handle formula selection
  const handleFormulaAdd = (formulaId: string) => {
    const newFilters = { ...filters };
    const currentFormulas = newFilters.formulaIds || [];

    if (!currentFormulas.includes(formulaId)) {
      newFilters.formulaIds = [...currentFormulas, formulaId];
      onFilterChange(newFilters);
    }

    setFormulaSearchTerm("");
    setShowFormulaSearch(false);
  };

  // Handle formula removal
  const handleFormulaRemove = (formulaId: string) => {
    const newFilters = { ...filters };
    if (newFilters.formulaIds) {
      newFilters.formulaIds = newFilters.formulaIds.filter((id: string) => id !== formulaId);
      if (newFilters.formulaIds.length === 0) {
        delete newFilters.formulaIds;
      }
      onFilterChange(newFilters);
    }
  };

  // Filter formulas based on search term
  const filteredFormulas =
    formulasData?.data?.filter((formula) => {
      const matchesSearch =
        formulaSearchTerm === "" ||
        formula.description?.toLowerCase().includes(formulaSearchTerm.toLowerCase()) ||
        formula.paint?.name?.toLowerCase().includes(formulaSearchTerm.toLowerCase());

      const notAlreadySelected = !filters.formulaIds?.includes(formula.id);

      return matchesSearch && notAlreadySelected;
    }) || [];

  // Get selected formulas for display
  const selectedFormulas = (filters.formulaIds?.map((id: string) => formulasData?.data?.find((f) => f.id === id)).filter(Boolean) as PaintFormulaWithIncludes[]) || [];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Formula Filters */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <IconFlask className="h-4 w-4" />
          Fórmulas
        </Label>

        {/* Selected Formulas Display */}
        {selectedFormulas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedFormulas.map((formula: PaintFormulaWithIncludes) => (
              <Badge key={formula.id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                <span className="text-xs">{formula.paint?.name || formula.description || `ID: ${formula.id.slice(0, 8)}...`}</span>
                <button onClick={() => handleFormulaRemove(formula.id)} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors">
                  <IconX className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Formula Search */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Buscar fórmulas por nome da tinta ou descrição..."
                value={formulaSearchTerm}
                onChange={(value) => setFormulaSearchTerm(value as string)}
                onFocus={() => setShowFormulaSearch(true)}
              />
            </div>
          </div>

          {/* Formula Search Results */}
          {showFormulaSearch && formulaSearchTerm && filteredFormulas.length > 0 && (
            <div className="border rounded-md bg-background shadow-sm max-h-48 overflow-y-auto">
              {filteredFormulas.slice(0, 10).map((formula: PaintFormulaWithIncludes) => (
                <button
                  key={formula.id}
                  onClick={() => handleFormulaAdd(formula.id)}
                  className="w-full px-3 py-2 text-left hover:bg-muted transition-colors border-b last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border" style={{ backgroundColor: formula.paint?.hex || "#666" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{formula.paint?.name || "Sem nome"}</div>
                      {formula.description && <div className="text-xs text-muted-foreground truncate">{formula.description}</div>}
                    </div>
                    <div className="text-xs text-muted-foreground">{formula.paint?.paintType?.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Volume Range */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <IconDroplet className="h-4 w-4" />
          Volume (Litros)
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mínimo</Label>
            <Input type="number" placeholder="Volume mínimo" value={volumeMin} onChange={(value) => handleVolumeChange("min", String(value ?? ""))} min="0.001" max="100" step="0.001" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Máximo</Label>
            <Input type="number" placeholder="Volume máximo" value={volumeMax} onChange={(value) => handleVolumeChange("max", String(value ?? ""))} min="0.001" max="100" step="0.001" />
          </div>
        </div>
      </div>

      {/* Creation Date Range */}
      <div className="space-y-3">
        <div className="text-sm font-medium flex items-center gap-2">
          <IconCalendar className="h-4 w-4" />
          Data de Criação
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              context="generic"
              value={filters.createdAt?.gte}
              onChange={(date: Date | null) => {
                const newFilters = { ...filters };
                if (!date && !filters.createdAt?.lte) {
                  delete newFilters.createdAt;
                } else {
                  newFilters.createdAt = {
                    ...(date && { gte: date }),
                    ...(filters.createdAt?.lte && { lte: filters.createdAt.lte }),
                  };
                }
                onFilterChange(newFilters);
              }}
              hideLabel
              placeholder="Selecionar data inicial..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
            <DateTimeInput
              mode="date"
              context="generic"
              value={filters.createdAt?.lte}
              onChange={(date: Date | null) => {
                const newFilters = { ...filters };
                if (!date && !filters.createdAt?.gte) {
                  delete newFilters.createdAt;
                } else {
                  newFilters.createdAt = {
                    ...(filters.createdAt?.gte && { gte: filters.createdAt.gte }),
                    ...(date && { lte: date }),
                  };
                }
                onFilterChange(newFilters);
              }}
              hideLabel
              placeholder="Selecionar data final..."
            />
          </div>
        </div>
      </div>

      {/* Updated Date Range */}
      <div className="space-y-3">
        <div className="text-sm font-medium flex items-center gap-2">
          <IconCalendar className="h-4 w-4" />
          Data de Atualização
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              context="generic"
              value={filters.updatedAt?.gte}
              onChange={(date: Date | null) => {
                const newFilters = { ...filters };
                if (!date && !filters.updatedAt?.lte) {
                  delete newFilters.updatedAt;
                } else {
                  newFilters.updatedAt = {
                    ...(date && { gte: date }),
                    ...(filters.updatedAt?.lte && { lte: filters.updatedAt.lte }),
                  };
                }
                onFilterChange(newFilters);
              }}
              hideLabel
              placeholder="Selecionar data inicial..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
            <DateTimeInput
              mode="date"
              context="generic"
              value={filters.updatedAt?.lte}
              onChange={(date: Date | null) => {
                const newFilters = { ...filters };
                if (!date && !filters.updatedAt?.gte) {
                  delete newFilters.updatedAt;
                } else {
                  newFilters.updatedAt = {
                    ...(filters.updatedAt?.gte && { gte: filters.updatedAt.gte }),
                    ...(date && { lte: date }),
                  };
                }
                onFilterChange(newFilters);
              }}
              hideLabel
              placeholder="Selecionar data final..."
            />
          </div>
        </div>
      </div>

      {/* Helper Text */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
        <p className="mb-1">
          <strong>Dica:</strong> Use os filtros para refinar sua busca:
        </p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>Selecione fórmulas específicas para ver apenas suas produções</li>
          <li>Defina um intervalo de volume para encontrar produções por tamanho</li>
          <li>Use filtros de data para ver produções de períodos específicos</li>
        </ul>
      </div>
    </div>
  );
}
