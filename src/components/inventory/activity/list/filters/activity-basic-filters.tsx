import type { ActivityGetManyFormData } from "../../../../../schemas";
import { ACTIVITY_REASON, ACTIVITY_REASON_LABELS, ACTIVITY_OPERATION } from "../../../../../constants";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";

interface ActivityBasicFiltersProps {
  filters: Partial<ActivityGetManyFormData>;
  updateFilter: <K extends keyof ActivityGetManyFormData>(key: K, value: ActivityGetManyFormData[K] | undefined) => void;
}

export const ActivityBasicFilters = ({ filters, updateFilter }: ActivityBasicFiltersProps) => {
  const handleReasonsChange = (reasons: string[]) => {
    updateFilter("reasons", reasons.length > 0 ? (reasons as ACTIVITY_REASON[]) : undefined);
  };

  // Transform reasons to options for MultiCombobox
  const reasonOptions = Object.values(ACTIVITY_REASON).map((reason) => ({
    value: reason,
    label: ACTIVITY_REASON_LABELS[reason],
  }));

  const selectedReasons = filters.reasons || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label className="text-base font-medium mb-3 block">Atribuição</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="hasUser" checked={filters.hasUser === true} onCheckedChange={(checked) => updateFilter("hasUser", checked ? true : undefined)} />
              <Label htmlFor="hasUser" className="text-sm font-normal cursor-pointer">
                Com usuário atribuído
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="noUser" checked={filters.hasUser === false} onCheckedChange={(checked) => updateFilter("hasUser", checked ? false : undefined)} />
              <Label htmlFor="noUser" className="text-sm font-normal cursor-pointer">
                Sem usuário atribuído
              </Label>
            </div>
          </div>
        </div>

        <div>
          <Label className="text-base font-medium mb-3 block">Operação</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="inbound"
                checked={filters.operations?.includes(ACTIVITY_OPERATION.INBOUND) ?? false}
                onCheckedChange={(checked) => {
                  const currentOps = filters.operations || [];
                  if (checked) {
                    updateFilter("operations", [...currentOps, ACTIVITY_OPERATION.INBOUND]);
                  } else {
                    const newOps = currentOps.filter((op: string) => op !== ACTIVITY_OPERATION.INBOUND);
                    updateFilter("operations", newOps.length > 0 ? newOps : undefined);
                  }
                }}
              />
              <Label htmlFor="inbound" className="text-sm font-normal cursor-pointer">
                Entrada
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="outbound"
                checked={filters.operations?.includes(ACTIVITY_OPERATION.OUTBOUND) ?? false}
                onCheckedChange={(checked) => {
                  const currentOps = filters.operations || [];
                  if (checked) {
                    updateFilter("operations", [...currentOps, ACTIVITY_OPERATION.OUTBOUND]);
                  } else {
                    const newOps = currentOps.filter((op: string) => op !== ACTIVITY_OPERATION.OUTBOUND);
                    updateFilter("operations", newOps.length > 0 ? newOps : undefined);
                  }
                }}
              />
              <Label htmlFor="outbound" className="text-sm font-normal cursor-pointer">
                Saída
              </Label>
            </div>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-base font-medium mb-3 block">Motivo da Atividade</Label>
        <Combobox
          mode="multiple"
          options={reasonOptions}
          value={selectedReasons}
          onValueChange={(value) => handleReasonsChange(Array.isArray(value) ? value : value ? [value] : [])}
          placeholder="Selecione os motivos..."
          emptyText="Nenhum motivo encontrado"
          searchPlaceholder="Buscar motivos..."
        />
        {selectedReasons.length > 0 && (
          <div className="text-xs text-muted-foreground mt-2">
            {selectedReasons.length} motivo{selectedReasons.length !== 1 ? "s" : ""} selecionado{selectedReasons.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
};
