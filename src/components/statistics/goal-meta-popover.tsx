import { useEffect, useState } from "react";
import { IconTarget } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GOAL_UNIT } from "@/constants";
import { formatGoalValue } from "@/utils/goal-format";

export interface GoalMetaPopoverProps {
  /** Resolved goal value (override ?? default). */
  value: number | null;
  /** Admin-configured default. Used in placeholder + "sobrescrevendo padrão (X)" hint. */
  defaultValue: number | null;
  /** Whether `value` came from the override, the default, or there's no goal set. */
  source: "override" | "default" | "none";
  /** Callback when the user applies an override or clears it. Passing null falls back to the default. */
  onOverride: (next: number | null) => void;
  /** Unit of measure — used for display formatting in the button + hint. */
  unit: GOAL_UNIT;
  /** Hide the popover button entirely (e.g., when no goal metric applies to the current mode). */
  enabled?: boolean;
  /** Override the input placeholder. Defaults to "Padrão: <defaultValue>" or "Ex: 100". */
  placeholder?: string;
}

/**
 * Shared "Meta" button + popover. Used across every statistics page that
 * pulls a default goal from the admin-configured goals feature. Keeps the
 * user-override semantics consistent: typing a value persists as an override
 * (per page mount) and "Limpar" / "Usar padrão" falls back to the default.
 */
export function GoalMetaPopover({
  value,
  defaultValue,
  source,
  onOverride,
  unit,
  enabled = true,
  placeholder,
}: GoalMetaPopoverProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  // When the popover opens, prefill the input with the current override (if
  // any) so the user can adjust their last value instead of retyping.
  useEffect(() => {
    if (!open) return;
    if (source === "override" && value != null) setInput(String(value));
    else setInput("");
  }, [open, source, value]);

  if (!enabled) return null;

  const apply = () => {
    const v = parseFloat(input.replace(",", "."));
    onOverride(isNaN(v) ? null : v);
    setOpen(false);
  };

  const buttonLabel =
    value != null ? `Meta: ${formatGoalValue(value, unit, { compactCurrency: true })}` : "Meta";

  const computedPlaceholder =
    placeholder ?? (defaultValue != null ? `Padrão: ${defaultValue}` : "Ex: 100");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={value != null ? "default" : "outline"} size="sm">
          <IconTarget className="h-4 w-4 mr-2" />
          {buttonLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Definir Meta</p>
            {source === "default" && (
              <p className="text-xs text-muted-foreground">
                Padrão de Administração › Metas
              </p>
            )}
            {source === "override" && defaultValue != null && (
              <p className="text-xs text-muted-foreground">
                Sobrescrevendo padrão ({formatGoalValue(defaultValue, unit)})
              </p>
            )}
            {source === "none" && (
              <p className="text-xs text-muted-foreground">
                Sem meta padrão configurada para este período
              </p>
            )}
          </div>
          <Input
            type="number"
            min={0}
            placeholder={computedPlaceholder}
            value={input}
            onChange={v => setInput(v == null ? "" : String(v))}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            className="bg-transparent"
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={apply}>
              Aplicar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onOverride(null);
                setInput("");
                setOpen(false);
              }}
            >
              {source === "override" ? "Usar padrão" : "Limpar"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
