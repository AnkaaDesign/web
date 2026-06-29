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
