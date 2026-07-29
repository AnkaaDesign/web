import type { DateRange } from "react-day-picker";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Input } from "@/components/ui/input";
import type { DataTableFilterDef } from "./data-table-types";

interface FieldProps<TData> {
  def: DataTableFilterDef<TData>;
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * Module-level so an EMPTY selection keeps the same array identity across renders.
 *
 * `Combobox`'s async option-merge effect lists `value` in its deps and resets the loaded option
 * list back to page 1 whenever it changes. A fresh `[]` per render therefore threw away every page
 * the user had scrolled in — while the page COUNTER kept advancing, so the next "carregar mais"
 * skipped a whole page and those entities became unreachable without typing a search.
 */
const EMPTY_IDS: string[] = [];

/** Renders a single declarative filter definition as the appropriate input. */
export function DataTableFilterField<TData>({ def, value, onChange }: FieldProps<TData>) {
  switch (def.type) {
    case "select":
      return (
        <Combobox
          mode="single"
          value={(value as string) ?? ""}
          options={def.options ?? []}
          onValueChange={(v) => onChange(v ?? undefined)}
          placeholder={def.placeholder ?? "Selecione..."}
          clearable
        />
      );

    case "multiselect":
      return (
        <Combobox
          mode="multiple"
          value={(value as string[]) ?? []}
          options={def.options ?? []}
          onValueChange={(v) => onChange(v ?? [])}
          placeholder={def.placeholder ?? "Selecione..."}
        />
      );

    case "entity-select":
    case "entity-multiselect": {
      // Server-searched picker: the option set is too large to ship up front (see
      // DataTableAsyncFilterConfig). `initialOptions` carries the already-selected entities so a
      // cold load — ids restored from the URL, nothing fetched yet — still shows names.
      const cfg = def.async;
      if (!cfg) return null;
      const multiple = def.type === "entity-multiselect";
      return (
        <Combobox<any>
          {...(multiple
            ? { mode: "multiple" as const, value: (value as string[]) ?? EMPTY_IDS }
            : { mode: "single" as const, value: (value as string) ?? "" })}
          onValueChange={(v) => onChange(multiple ? (Array.isArray(v) ? v : []) : (v ?? undefined))}
          async
          queryKey={cfg.queryKey}
          queryFn={cfg.queryFn}
          initialOptions={cfg.selectedOptions ?? []}
          minSearchLength={cfg.minSearchLength ?? 0}
          getOptionValue={cfg.getOptionValue}
          getOptionLabel={cfg.getOptionLabel}
          renderOption={cfg.renderOption}
          placeholder={def.placeholder ?? "Buscar..."}
          emptyText={cfg.emptyText ?? "Nenhum resultado encontrado"}
          clearable
        />
      );
    }

    case "boolean":
      // A clean Sim/Não/Todos select (consistent with the other filters) instead of a toggle.
      return (
        <Combobox
          mode="single"
          value={value === true || value === "true" ? "true" : value === false || value === "false" ? "false" : ""}
          options={[
            { value: "true", label: "Sim" },
            { value: "false", label: "Não" },
          ]}
          onValueChange={(v) => onChange(v ?? undefined)}
          placeholder={def.placeholder ?? "Todos"}
          clearable
        />
      );

    case "text":
      return (
        <Input
          type="text"
          value={(value as string) ?? ""}
          onChange={(v) => onChange(String(v ?? ""))}
          placeholder={def.placeholder}
        />
      );

    case "number-range": {
      const v = (value as { min?: number; max?: number }) ?? {};
      const set = (key: "min" | "max") => (x: string | number | null) => {
        const n = x === "" || x == null ? undefined : Number(x);
        onChange({ ...v, [key]: typeof n === "number" && Number.isNaN(n) ? undefined : n });
      };
      // Currency-aware: the base Input handles R$ formatting when `def.currency` is set.
      const inputType = def.currency ? "currency" : "number";
      // Range filters always carry "De"/"Até" labels (consistent with the date range).
      return (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-[11px] text-muted-foreground">De</Label>
            <Input type={inputType} value={v.min ?? null} onChange={set("min")} placeholder="Mín" />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-[11px] text-muted-foreground">Até</Label>
            <Input type={inputType} value={v.max ?? null} onChange={set("max")} placeholder="Máx" />
          </div>
        </div>
      );
    }

    case "date-range": {
      // Two single-date pickers instead of one range picker: the shared range
      // calendar dismisses after the first pick, making the end date unselectable.
      const v = (value as { from?: string; to?: string }) ?? {};
      const emit = (key: "from" | "to") => (d: Date | DateRange | null) => {
        const date = d as Date | null;
        const next = { ...v, [key]: date ? date.toISOString() : undefined };
        onChange(next.from || next.to ? next : undefined);
      };
      return (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-[11px] text-muted-foreground">De</Label>
            <DateTimeInput mode="date" value={v.from ? new Date(v.from) : null} onChange={emit("from")} />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-[11px] text-muted-foreground">Até</Label>
            <DateTimeInput mode="date" value={v.to ? new Date(v.to) : null} onChange={emit("to")} />
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
