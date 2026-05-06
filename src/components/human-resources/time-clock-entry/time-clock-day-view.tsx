import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/date-time-input";
import {
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useSecullumTimeEntriesByDay } from "../../../hooks";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { ColumnVisibilityManager } from "@/components/integrations/secullum/calculations/list";
import type { ColumnDef } from "@/components/integrations/secullum/calculations/list";
import { renderTimeValue, renderHourValue } from "@/components/integrations/secullum/cell-renderers";
import type { DayExportRow } from "./time-clock-day-view-export";

// Visualização Dia mirrors Visualização Colaborador's column set so the two
// views read alike. Keys are aligned with calculation-table-columns.tsx
// (entrada1/saida1/normais/faltas/...). Aggregate columns (NORMAL, EX50%, …)
// only populate when Secullum's /Batidas response includes them on the entry
// — when not available the cell shows "-".
const DAY_VIEW_COLUMNS: ColumnDef[] = [
  { key: "entrada1", header: "Entrada 1" },
  { key: "saida1", header: "Saída 1" },
  { key: "entrada2", header: "Entrada 2" },
  { key: "saida2", header: "Saída 2" },
  { key: "entrada3", header: "Entrada 3" },
  { key: "saida3", header: "Saída 3" },
  { key: "entrada4", header: "Entrada 4" },
  { key: "saida4", header: "Saída 4" },
  { key: "entrada5", header: "Entrada 5" },
  { key: "saida5", header: "Saída 5" },
  { key: "normais", header: "Normal" },
  { key: "faltas", header: "Faltas" },
  { key: "ex50", header: "EX50%" },
  { key: "ex100", header: "EX100%" },
  { key: "ex150", header: "EX150%" },
  { key: "dsr", header: "DSR" },
  { key: "dsrDeb", header: "DSR.Deb" },
  { key: "ajuste", header: "Ajuste" },
  { key: "atras", header: "Atraso" },
  { key: "adian", header: "Adiant." },
  { key: "compensated", header: "Compensado" },
  { key: "neutral", header: "Neutro" },
  { key: "dayOff", header: "Folga" },
  { key: "freeLunch", header: "Almoço" },
];

// Match calculation-list defaults exactly so the two modes default to the
// same set (minus "date", which Day view shows globally above the table).
const DAY_VIEW_DEFAULT_COLUMNS = new Set([
  "entrada1",
  "saida1",
  "entrada2",
  "saida2",
  "normais",
  "faltas",
  "ex50",
  "ex100",
  "dsr",
  "ajuste",
]);

const SECULLUM_FIELD_MAP: Record<string, string> = {
  entrada1: "Entrada1",
  saida1: "Saida1",
  entrada2: "Entrada2",
  saida2: "Saida2",
  entrada3: "Entrada3",
  saida3: "Saida3",
  entrada4: "Entrada4",
  saida4: "Saida4",
  entrada5: "Entrada5",
  saida5: "Saida5",
  normais: "Normais",
  faltas: "Faltas",
  ex50: "Ex50",
  ex100: "Ex100",
  ex150: "Ex150",
  dsr: "DSR",
  dsrDeb: "DSRDebito",
  ajuste: "Ajuste",
  atras: "Atraso",
  adian: "Adiantamento",
  compensated: "Compensado",
  neutral: "Neutro",
  dayOff: "Folga",
  freeLunch: "AlmocoLivre",
};

const BOOL_KEYS = new Set(["compensated", "neutral", "dayOff", "freeLunch"]);
// Aggregate hour columns — render via renderHourValue so polarity coloring
// (green = good, red = bad/zero = muted) matches Visualização Colaborador.
const HOUR_KEYS = new Set([
  "normais",
  "faltas",
  "ex50",
  "ex100",
  "ex150",
  "dsr",
  "dsrDeb",
  "ajuste",
  "atras",
  "adian",
]);
// Debit columns — positive value is bad (red), see renderHourValue("bad").
const BAD_KEYS = new Set(["faltas", "atras", "adian"]);

interface TimeClockDayViewProps {
  className?: string;
  onExportDataChange?: (
    data: {
      rows: DayExportRow[];
      visibleColumns: Set<string>;
      date: Date;
    } | null,
  ) => void;
}

interface DayRow {
  user: {
    id: string;
    name: string;
    positionName: string | null;
    sectorName: string | null;
  };
  entry: any | null;
}

function parseUrlDate(raw: string | null): Date | null {
  if (!raw) return null;
  const parts = raw.split("-");
  if (parts.length !== 3) return null;
  const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  return isNaN(d.getTime()) ? null : d;
}

export function TimeClockDayView({ className, onExportDataChange }: TimeClockDayViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState<Date>(
    () => parseUrlDate(searchParams.get("date")) ?? new Date(),
  );

  const dateStr = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate]);

  const { data, isLoading, error } = useSecullumTimeEntriesByDay(dateStr);

  // Storage key bumped to v2 because the column keys were renamed to match
  // calculation-list (entry1→entrada1, exit1→saida1, ...). Old persisted Sets
  // would reference keys that no longer exist; v2 lets users start with the
  // new defaults without having to click "Restaurar".
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "time-clock-day-view-visible-columns-v2",
    DAY_VIEW_DEFAULT_COLUMNS,
  );

  const isVisible = (key: string) => !visibleColumns || visibleColumns.has(key);

  const handleDateChange = (date: Date | null | any) => {
    if (date && typeof date === "object" && "getTime" in date && !isNaN(date.getTime())) {
      setSelectedDate(date);
      const params = new URLSearchParams(searchParams);
      params.set("date", format(date, "yyyy-MM-dd"));
      setSearchParams(params, { replace: true });
    }
  };

  const shiftDay = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    handleDateChange(next);
  };

  const rows: DayRow[] = (data?.data?.data ?? []) as DayRow[];

  const visibleCols = DAY_VIEW_COLUMNS.filter((c) => isVisible(c.key));

  // Push a flattened, export-friendly view of the rows up to the unified page
  // so it can render the export popover in the page header for this mode.
  const exportRows: DayExportRow[] = useMemo(() => {
    return rows.map((r) => {
      const e = r.entry ?? {};
      const get = (key: string): string => {
        const val = e[SECULLUM_FIELD_MAP[key]];
        return val === null || val === undefined ? "" : String(val);
      };
      const getBool = (key: string): string => (e[SECULLUM_FIELD_MAP[key]] ? "Sim" : "");
      return {
        id: r.user.id,
        userName: r.user.name,
        sectorName: r.user.sectorName ?? "",
        entrada1: get("entrada1"),
        saida1: get("saida1"),
        entrada2: get("entrada2"),
        saida2: get("saida2"),
        entrada3: get("entrada3"),
        saida3: get("saida3"),
        entrada4: get("entrada4"),
        saida4: get("saida4"),
        entrada5: get("entrada5"),
        saida5: get("saida5"),
        normais: get("normais"),
        faltas: get("faltas"),
        ex50: get("ex50"),
        ex100: get("ex100"),
        ex150: get("ex150"),
        dsr: get("dsr"),
        dsrDeb: get("dsrDeb"),
        ajuste: get("ajuste"),
        atras: get("atras"),
        adian: get("adian"),
        compensated: getBool("compensated"),
        neutral: getBool("neutral"),
        dayOff: getBool("dayOff"),
        freeLunch: getBool("freeLunch"),
      };
    });
  }, [rows]);

  // Identity columns (userName, sectorName) are always exported regardless of
  // the column-visibility manager state.
  const exportVisibleColumns = useMemo(
    () => new Set(["userName", "sectorName", ...Array.from(visibleColumns ?? [])]),
    [visibleColumns],
  );

  useEffect(() => {
    onExportDataChange?.({
      rows: exportRows,
      visibleColumns: exportVisibleColumns,
      date: selectedDate,
    });
  }, [exportRows, exportVisibleColumns, selectedDate, onExportDataChange]);

  const formatCell = (entry: any | null, key: string): React.ReactNode => {
    if (!entry) return <span className="text-muted-foreground">-</span>;
    const secullumKey = SECULLUM_FIELD_MAP[key];
    const value = entry[secullumKey];
    if (BOOL_KEYS.has(key)) {
      return value ? <span className="text-sm">Sim</span> : <span className="text-muted-foreground">-</span>;
    }
    if (HOUR_KEYS.has(key)) {
      return renderHourValue(value, BAD_KEYS.has(key) ? "bad" : "good");
    }
    return renderTimeValue(value);
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 min-h-0">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <strong className="font-medium">Erro ao carregar registros do dia:</strong>{" "}
            {(error as any)?.message || "Erro desconhecido"}
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => shiftDay(-1)}
              className="h-10 w-10"
            >
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <DateTimeInput
              mode="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="w-[200px]"
              placeholder="Selecione um dia"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => shiftDay(1)}
              className="h-10 w-10"
            >
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="ml-auto">
            <ColumnVisibilityManager
              columns={DAY_VIEW_COLUMNS}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
              defaultVisibleColumns={DAY_VIEW_DEFAULT_COLUMNS}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto border border-border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-96 text-muted-foreground">
              <div className="text-center">
                <div className="text-lg font-medium">Nenhum colaborador ativo encontrado</div>
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-muted">
                <tr className="border-b border-border h-12">
                  <th className="text-left text-foreground font-bold uppercase text-xs px-4 py-2 sticky left-0 bg-muted z-30 w-[220px] min-w-[220px] max-w-[220px]">
                    Colaborador
                  </th>
                  <th className="text-left text-foreground font-bold uppercase text-xs px-4 py-2 w-[180px] min-w-[180px] max-w-[180px] bg-muted">
                    Setor
                  </th>
                  {visibleCols.map((c) => (
                    <th
                      key={c.key}
                      className={cn(
                        "text-center text-foreground font-bold uppercase text-xs px-4 py-2 bg-muted",
                        BOOL_KEYS.has(c.key)
                          ? "w-28 min-w-28 max-w-28"
                          : "w-32 min-w-32 max-w-32",
                      )}
                    >
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ user, entry }, idx) => {
                  const stripe = idx % 2 === 1;
                  return (
                    <tr
                      key={user.id}
                      className={cn(
                        // Match Calc's effective zebra. Calc uses shadcn TableRow
                        // whose `[tbody_&:nth-child(even)]:bg-muted/50` selector
                        // (higher CSS specificity than plain `bg-muted/10`)
                        // wins, so its visible zebra is bg-muted/50, not the
                        // bg-muted/10 the dev probably intended. We use raw
                        // <tr> here so we apply bg-muted/50 directly to keep
                        // Day view visually identical to Colaborador.
                        "border-b border-border transition-colors hover:bg-muted/70 h-12",
                        stripe ? "bg-muted/50" : "bg-card",
                      )}
                    >
                      <td className="px-4 py-2 sticky left-0 z-10 bg-inherit w-[220px] min-w-[220px] max-w-[220px]">
                        <span className="text-sm font-medium truncate block">{user.name}</span>
                      </td>
                      <td className="px-4 py-2 w-[180px] min-w-[180px] max-w-[180px]">
                        <span className="text-sm truncate block">
                          {user.sectorName ?? <span className="text-muted-foreground">-</span>}
                        </span>
                      </td>
                      {visibleCols.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            "px-4 py-2 text-center text-sm",
                            BOOL_KEYS.has(c.key)
                              ? "w-28 min-w-28 max-w-28"
                              : "w-32 min-w-32 max-w-32",
                          )}
                        >
                          {formatCell(entry, c.key)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
