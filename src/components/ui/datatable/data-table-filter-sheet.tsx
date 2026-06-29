import { useEffect, useState } from "react";
import { IconFilter } from "@tabler/icons-react";
import { Label } from "@/components/ui/label";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { DataTableFilterField } from "./data-table-filter-fields";
import { countActiveFilters } from "./data-table-utils";
import type { DataTableFilterDef, DataTableFilterValues } from "./data-table-types";

interface DataTableFilterSheetProps<TData> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defs: DataTableFilterDef<TData>[];
  values: DataTableFilterValues;
  onApply: (values: DataTableFilterValues) => void;
  onReset: () => void;
}

/**
 * Generic, declarative filter sheet built on the canonical `FilterDrawer`. Pages
 * pass a `defs` array instead of hand-rolling a bespoke filter modal. Edits are
 * staged in a local draft and committed on "Aplicar".
 */
export function DataTableFilterSheet<TData>({
  open,
  onOpenChange,
  defs,
  values,
  onApply,
  onReset,
}: DataTableFilterSheetProps<TData>) {
  const [draft, setDraft] = useState<DataTableFilterValues>(values);

  // Re-seed the draft from the applied values whenever the sheet opens.
  useEffect(() => {
    if (open) setDraft(values);
  }, [open, values]);

  const activeCount = countActiveFilters(draft);

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      activeFilterCount={activeCount}
      onApply={() => {
        onApply(draft);
        onOpenChange(false);
      }}
      onReset={() => {
        setDraft({});
        onReset();
        onOpenChange(false);
      }}
    >
      {defs.map((def) => (
        <div key={def.key} className="space-y-2">
          <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {def.icon}
            {def.label}
          </Label>
          <DataTableFilterField
            def={def}
            value={draft[def.key]}
            onChange={(v) => setDraft((d) => ({ ...d, [def.key]: v }))}
          />
        </div>
      ))}
    </FilterDrawer>
  );
}
