// Two horizontal pill rows for picking widget size:
//   Width:  1/4  •  1/2  •  3/4  •  Total
//   Altura:  1   •   2   •   3   •   4
//
// Replaces the previous tiny 4×4 grid popover. Bigger touch targets, clearer
// labels, much easier to scan in edit mode.

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Button } from "../../components/ui/button";
import { IconLayoutGrid, IconCheck } from "@tabler/icons-react";
import { WIDGET_COL_VALUES, WIDGET_ROW_VALUES } from "../schemas";
import type { WidgetSize, WidgetCols, WidgetRows } from "../types";
import { cn } from "../../lib/utils";
import {
  SELECT_TILE_ACTIVE,
  SELECT_TILE_BASE,
  SELECT_TILE_DISABLED,
  SELECT_TILE_INACTIVE,
} from "./config-kit";

interface SizeSelectorProps {
  value: WidgetSize;
  min: WidgetSize;
  max: WidgetSize;
  onChange: (size: WidgetSize) => void;
}

const WIDTH_LABELS: Record<WidgetCols, string> = {
  1: "1/4",
  2: "1/2",
  3: "3/4",
  4: "Total",
};

const HEIGHT_LABELS: Record<WidgetRows, string> = {
  1: "1×",
  2: "2×",
  3: "3×",
  4: "4×",
};

const TRIGGER_LABEL: Record<WidgetCols, string> = {
  1: "1/4",
  2: "1/2",
  3: "3/4",
  4: "Total",
};

export function SizeSelector({ value, min, max, onChange }: SizeSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 gap-1 text-xs"
          title={`Tamanho: ${TRIGGER_LABEL[value.cols]} × ${value.rows} ${value.rows === 1 ? "linha" : "linhas"}`}
        >
          <IconLayoutGrid className="h-3.5 w-3.5" />
          {TRIGGER_LABEL[value.cols]} × {value.rows}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-3" align="end">
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Largura
          </div>
          <div className="grid grid-cols-4 gap-1">
            {WIDGET_COL_VALUES.map((c) => {
              const disabled = c < min.cols || c > max.cols;
              const active = c === value.cols;
              return (
                <button
                  key={c}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ cols: c as WidgetCols, rows: value.rows })}
                  className={cn(
                    SELECT_TILE_BASE,
                    "h-9 text-xs font-bold",
                    active
                      ? SELECT_TILE_ACTIVE
                      : disabled
                        ? SELECT_TILE_DISABLED
                        : SELECT_TILE_INACTIVE,
                  )}
                >
                  {WIDTH_LABELS[c]}
                  {active && (
                    <IconCheck className="absolute top-0.5 right-0.5 h-3 w-3" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Altura
          </div>
          <div className="grid grid-cols-4 gap-1">
            {WIDGET_ROW_VALUES.map((r) => {
              const disabled = r < min.rows || r > max.rows;
              const active = r === value.rows;
              return (
                <button
                  key={r}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ cols: value.cols, rows: r as WidgetRows })}
                  className={cn(
                    SELECT_TILE_BASE,
                    "h-9 text-xs font-bold",
                    active
                      ? SELECT_TILE_ACTIVE
                      : disabled
                        ? SELECT_TILE_DISABLED
                        : SELECT_TILE_INACTIVE,
                  )}
                >
                  {HEIGHT_LABELS[r]}
                  {active && (
                    <IconCheck className="absolute top-0.5 right-0.5 h-3 w-3" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-1.5 border-t border-border text-[11px] text-muted-foreground tabular-nums text-center">
          {WIDTH_LABELS[value.cols]} largura • {value.rows}{" "}
          {value.rows === 1 ? "linha" : "linhas"} de altura
        </div>
      </PopoverContent>
    </Popover>
  );
}
