import { useMemo, useState } from "react";
import {
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconSelector,
} from "@tabler/icons-react";

import type { ProductionAvailabilityComponent } from "@/api-client/paint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { formatGrams, formatRatioPct, formatUnits } from "./format";

interface ComponentsAvailabilityTableProps {
  components: ProductionAvailabilityComponent[];
  isLoading: boolean;
  hasRows: boolean;
  className?: string;
}

type SortKey = "name" | "required" | "available" | "missing" | "ratio" | "status";
type SortDir = "asc" | "desc";

const missingGrams = (c: ProductionAvailabilityComponent): number | null =>
  c.availableGrams == null ? null : Math.max(0, c.requiredGrams - c.availableGrams);

const missingUnits = (c: ProductionAvailabilityComponent): number | null =>
  c.requiredUnits == null ? null : Math.max(0, c.requiredUnits - c.availableUnits);

/** Status rank for sorting: shortage first, then unmeasured, then OK. */
function statusRank(c: ProductionAvailabilityComponent): number {
  if (c.availableRatio == null) return 1;
  return c.availableRatio < 1 ? 0 : 2;
}

/** Default ordering when the user hasn't picked a column: limiting → severity → name. */
function defaultCompare(
  a: ProductionAvailabilityComponent,
  b: ProductionAvailabilityComponent,
): number {
  const la = a.isLimiting ? 0 : 1;
  const lb = b.isLimiting ? 0 : 1;
  if (la !== lb) return la - lb;
  const sa = statusRank(a);
  const sb = statusRank(b);
  if (sa !== sb) return sa - sb;
  return a.itemName.localeCompare(b.itemName, "pt-BR");
}

function compareBy(
  key: SortKey,
  a: ProductionAvailabilityComponent,
  b: ProductionAvailabilityComponent,
): number {
  switch (key) {
    case "name":
      return a.itemName.localeCompare(b.itemName, "pt-BR");
    case "required":
      return a.requiredGrams - b.requiredGrams;
    case "available":
      return a.availableUnits - b.availableUnits;
    case "missing":
      return (missingGrams(a) ?? -1) - (missingGrams(b) ?? -1);
    case "ratio": {
      // Unmeasured (null) sorts last regardless of direction is handled by caller flip;
      // here treat null as -Infinity so it groups together.
      const ra = a.availableRatio ?? -1;
      const rb = b.availableRatio ?? -1;
      return ra - rb;
    }
    case "status":
      return statusRank(a) - statusRank(b);
  }
}

function StatusDot({ component }: { component: ProductionAvailabilityComponent }) {
  if (component.availableRatio == null) {
    return <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full bg-amber-500" />;
  }
  const ok = component.availableRatio >= 1;
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full",
        ok ? "bg-green-500" : "bg-red-500",
      )}
    />
  );
}

export function ComponentsAvailabilityTable({
  components,
  isLoading,
  hasRows,
  className,
}: ComponentsAvailabilityTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const arr = [...components];
    if (!sortKey) {
      arr.sort(defaultCompare);
    } else {
      arr.sort((a, b) => {
        const v = compareBy(sortKey, a, b);
        return sortDir === "asc" ? v : -v;
      });
    }
    return arr;
  }, [components, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggle = (itemId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });

  const SortHeader = ({
    label,
    column,
    align = "left",
    className,
  }: {
    label: string;
    column: SortKey;
    align?: "left" | "right" | "center";
    className?: string;
  }) => {
    const active = sortKey === column;
    return (
      <TableHead
        className={cn(
          align === "right" && "text-right",
          align === "center" && "text-center",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => onSort(column)}
          className={cn(
            "inline-flex items-center gap-1 transition-colors hover:text-foreground",
            align === "right" && "flex-row-reverse",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
          {active ? (
            sortDir === "asc" ? (
              <IconChevronUp className="h-3.5 w-3.5" />
            ) : (
              <IconChevronDown className="h-3.5 w-3.5" />
            )
          ) : (
            <IconSelector className="h-3.5 w-3.5 opacity-40" />
          )}
        </button>
      </TableHead>
    );
  };

  const renderBody = () => {
    if (!hasRows) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
            Selecione tintas acima para ver os componentes necessários.
          </TableCell>
        </TableRow>
      );
    }

    if (isLoading && sorted.length === 0) {
      return Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={`sk-${i}`}>
          <TableCell colSpan={7}>
            <Skeleton className="h-6 w-full" />
          </TableCell>
        </TableRow>
      ));
    }

    if (sorted.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
            Nenhum componente — as tintas selecionadas não possuem fórmula cadastrada.
          </TableCell>
        </TableRow>
      );
    }

    return sorted.map((c) => {
      const isOpen = expanded.has(c.itemId);
      const expandable = c.contributions.length > 1;
      const mg = missingGrams(c);
      const mu = missingUnits(c);
      const short = c.availableRatio != null && c.availableRatio < 1;
      const ratioTone =
        c.availableRatio == null
          ? "text-amber-600 dark:text-amber-400"
          : c.availableRatio >= 1
            ? "text-green-600 dark:text-green-400"
            : "text-red-600 dark:text-red-400";

      return [
        <TableRow
          key={c.itemId}
          className={cn(expandable && "cursor-pointer", c.isLimiting && "bg-red-500/[0.04]")}
          onClick={expandable ? () => toggle(c.itemId) : undefined}
        >
          <TableCell className="w-8 pr-0">
            {expandable ? (
              <IconChevronRight
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isOpen && "rotate-90",
                )}
              />
            ) : null}
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <StatusDot component={c} />
              <span className="truncate font-medium">{c.itemName}</span>
              {c.uniCode ? (
                <span className="flex-shrink-0 text-xs font-normal text-muted-foreground">
                  {c.uniCode}
                </span>
              ) : null}
              {c.isLimiting ? (
                <Badge
                  variant="outline"
                  className="flex-shrink-0 border-red-500/40 px-1.5 py-0 text-[10px] font-medium text-red-600 dark:text-red-400"
                >
                  Limitante
                </Badge>
              ) : null}
            </div>
          </TableCell>
          <TableCell className="text-right tabular-nums">
            <div className="font-medium">{formatGrams(c.requiredGrams)}</div>
            {c.requiredUnits != null ? (
              <div className="text-xs text-muted-foreground">≈ {formatUnits(c.requiredUnits)}</div>
            ) : null}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {c.availableGrams != null ? (
              <>
                <div className="font-medium">{formatGrams(c.availableGrams)}</div>
                <div className="text-xs text-muted-foreground">{formatUnits(c.availableUnits)}</div>
              </>
            ) : (
              <div className="font-medium">{formatUnits(c.availableUnits)}</div>
            )}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {mg == null ? (
              <span className="text-muted-foreground">—</span>
            ) : mg <= 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <div className="font-medium text-red-600 dark:text-red-400">
                {formatGrams(mg)}
                {mu != null && mu > 0 ? (
                  <div className="text-xs font-normal text-red-600/80 dark:text-red-400/80">
                    ≈ {formatUnits(mu)}
                  </div>
                ) : null}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right">
            {c.availableRatio == null ? (
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-600 dark:text-amber-400"
              >
                sem medida
              </Badge>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", short ? "bg-red-500" : "bg-green-500")}
                    style={{ width: `${Math.min(c.availableRatio, 1) * 100}%` }}
                  />
                </div>
                <span className={cn("w-10 text-right font-semibold tabular-nums", ratioTone)}>
                  {formatRatioPct(Math.min(c.availableRatio, 1))}
                </span>
              </div>
            )}
          </TableCell>
          <TableCell className="text-center">
            {c.availableRatio == null ? (
              <span className="text-amber-600 dark:text-amber-400">—</span>
            ) : c.availableRatio >= 1 ? (
              <Badge variant="success">OK</Badge>
            ) : (
              <Badge variant="destructive">Falta</Badge>
            )}
          </TableCell>
        </TableRow>,
        expandable && isOpen ? (
          <TableRow key={`${c.itemId}-detail`} className="hover:bg-transparent">
            <TableCell colSpan={7} className="p-0">
              <div className="bg-muted/30 px-6 py-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Demanda por tinta
                </div>
                <div className="max-w-xl overflow-hidden rounded-md bg-background/50">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-border/20">
                      {[...c.contributions]
                        .sort((a, b) => b.grams - a.grams)
                        .map((contrib, idx) => (
                          <tr key={`${contrib.paintId}-${idx}`}>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-border"
                                  style={{ backgroundColor: contrib.hex || "#888888" }}
                                />
                                <span className="truncate" title={contrib.paintName}>
                                  {contrib.paintName}
                                </span>
                              </div>
                            </td>
                            <td className="w-28 px-3 py-1.5 text-right font-medium tabular-nums">
                              {formatGrams(contrib.grams)}
                            </td>
                            <td className="w-20 px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                              {contrib.units > 0 ? `≈ ${formatUnits(contrib.units)}` : ""}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TableCell>
          </TableRow>
        ) : null,
      ];
    });
  };

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Componentes necessários
          {hasRows && sorted.length > 0 ? (
            <Badge variant="secondary" className="font-normal">
              {sorted.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-auto p-0">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <SortHeader label="Componente" column="name" />
              <SortHeader label="Necessário" column="required" align="right" />
              <SortHeader label="Em estoque" column="available" align="right" />
              <SortHeader label="Faltante" column="missing" align="right" />
              <SortHeader label="Disponibilidade" column="ratio" align="right" className="w-56" />
              <SortHeader label="Status" column="status" align="center" />
            </TableRow>
          </TableHeader>
          <TableBody>{renderBody()}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
