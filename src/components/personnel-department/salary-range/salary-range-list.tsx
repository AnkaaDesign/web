import React, { useMemo, useState } from "react";
import { usePositions } from "../../../hooks";
import type { Position } from "../../../types";
import { formatCurrency, formatDate } from "../../../utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  IconChevronUp,
  IconChevronDown,
  IconChevronRight,
  IconSelector,
  IconAlertTriangle,
  IconBriefcase,
  IconCashBanknote,
  IconArrowDown,
  IconArrowUp,
  IconChartBar,
} from "@tabler/icons-react";

// The API returns MonetaryValue records (value/current/createdAt) under the
// legacy `remunerations` relation name on Position.
interface RemunerationRecord {
  id: string;
  value: number;
  current?: boolean;
  createdAt: Date | string;
}

const getRemunerationHistory = (position: Position): RemunerationRecord[] => {
  const records = (position.monetaryValues ?? position.remunerations ?? []) as unknown as RemunerationRecord[];
  return [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const getCurrentRemuneration = (position: Position): number => position.remuneration ?? getRemunerationHistory(position)[0]?.value ?? 0;

type SortColumn = "hierarchy" | "name" | "remuneration" | "users";

interface SalaryRangeListProps {
  className?: string;
}

export function SalaryRangeList({ className }: SalaryRangeListProps) {
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ column: SortColumn; direction: "asc" | "desc" }>({ column: "hierarchy", direction: "asc" });

  const { data: response, isLoading, error } = usePositions({
    include: {
      remunerations: true,
      _count: { select: { users: true } },
    },
    orderBy: { hierarchy: "asc" },
    limit: 100,
  });

  const positions = useMemo(() => response?.data || [], [response?.data]);

  // Summary metrics over positions with a defined remuneration
  const summary = useMemo(() => {
    const values = positions.map(getCurrentRemuneration).filter((value) => value > 0);
    const total = positions.length;
    if (values.length === 0) {
      return { total, min: 0, max: 0, avg: 0 };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { total, min, max, avg };
  }, [positions]);

  // Client-side search + sort (read-mostly page, single fetch)
  const filteredPositions = useMemo(() => {
    let result = positions;

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((position) => position.name.toLowerCase().includes(term));
    }

    const direction = sort.direction === "asc" ? 1 : -1;
    return [...result].sort((a, b) => {
      switch (sort.column) {
        case "name":
          return direction * a.name.localeCompare(b.name, "pt-BR");
        case "remuneration":
          return direction * (getCurrentRemuneration(a) - getCurrentRemuneration(b));
        case "users":
          return direction * ((a._count?.users ?? 0) - (b._count?.users ?? 0));
        case "hierarchy":
        default: {
          // Nulls last
          const aHierarchy = a.hierarchy ?? Number.MAX_SAFE_INTEGER;
          const bHierarchy = b.hierarchy ?? Number.MAX_SAFE_INTEGER;
          return direction * (aHierarchy - bHierarchy);
        }
      }
    });
  }, [positions, search, sort]);

  const toggleSort = (column: SortColumn) => {
    setSort((previous) => {
      if (previous.column === column) {
        return { column, direction: previous.direction === "asc" ? "desc" : "asc" };
      }
      return { column, direction: "asc" };
    });
  };

  const toggleExpanded = (positionId: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(positionId)) {
        next.delete(positionId);
      } else {
        next.add(positionId);
      }
      return next;
    });
  };

  const renderSortIndicator = (column: SortColumn) => {
    if (sort.column !== column) return <IconSelector className="h-4 w-4 text-muted-foreground" />;
    return sort.direction === "asc" ? <IconChevronUp className="h-4 w-4 text-foreground" /> : <IconChevronDown className="h-4 w-4 text-foreground" />;
  };

  const headers: Array<{ key: SortColumn | "expand" | "bonifiable" | "history"; label: string; sortable?: SortColumn; className?: string }> = [
    { key: "expand", label: "", className: "w-10" },
    { key: "hierarchy", label: "HIERARQUIA", sortable: "hierarchy", className: "w-32" },
    { key: "name", label: "CARGO", sortable: "name", className: "min-w-[220px]" },
    { key: "remuneration", label: "REMUNERAÇÃO ATUAL", sortable: "remuneration", className: "min-w-[170px]" },
    { key: "bonifiable", label: "BONIFICÁVEL", className: "min-w-[130px]" },
    { key: "users", label: "COLABORADORES", sortable: "users", className: "min-w-[150px]" },
    { key: "history", label: "REGISTROS", className: "min-w-[120px]" },
  ];

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4 min-h-0", className)}>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        <Card className="shadow-sm border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IconBriefcase className="h-4 w-4" />
              Total de Cargos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IconArrowDown className="h-4 w-4" />
              Menor Remuneração
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.min > 0 ? formatCurrency(summary.min) : "—"}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IconArrowUp className="h-4 w-4" />
              Maior Remuneração
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.max > 0 ? formatCurrency(summary.max) : "—"}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IconChartBar className="h-4 w-4" />
              Remuneração Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avg > 0 ? formatCurrency(summary.avg) : "—"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Positions table */}
      <Card className="flex-1 flex flex-col shadow-sm border border-border min-h-0">
        <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
          {/* Row wrapper required: TableSearchInput is flex-1 and would otherwise
              stretch vertically inside this flex-col, pushing the table down. */}
          <div className="flex flex-col gap-3 sm:flex-row flex-shrink-0">
            <TableSearchInput value={search} onChange={setSearch} placeholder="Buscar cargo" />
          </div>

          <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  {headers.map((header) => (
                    <TableHead key={header.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs", header.className)}>
                      {header.sortable ? (
                        <button
                          onClick={() => toggleSort(header.sortable!)}
                          className="flex items-center gap-1 hover:bg-muted/80 transition-colors cursor-pointer border-0 bg-transparent p-0 uppercase font-bold"
                        >
                          {header.label}
                          {renderSortIndicator(header.sortable)}
                        </button>
                      ) : (
                        header.label
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {error ? (
                  <TableRow>
                    <TableCell colSpan={headers.length} className="p-0">
                      <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                        <IconAlertTriangle className="h-8 w-8 mb-4" />
                        <div className="text-lg font-medium mb-2">Não foi possível carregar os cargos</div>
                        <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredPositions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headers.length} className="p-0">
                      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                        <IconCashBanknote className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <div className="text-lg font-medium mb-2">Nenhum cargo encontrado</div>
                        <div className="text-sm">{search ? "Ajuste a busca para ver mais resultados." : "Cadastre cargos para visualizar as faixas salariais."}</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPositions.map((position, index) => {
                    const isExpanded = expandedIds.has(position.id);
                    const history = getRemunerationHistory(position);
                    const currentValue = getCurrentRemuneration(position);

                    return (
                      <React.Fragment key={position.id}>
                        <TableRow
                          className={cn(
                            "cursor-pointer transition-colors border-b border-border",
                            index % 2 === 1 && "bg-muted/10",
                            "hover:bg-muted/20",
                            isExpanded && "bg-muted/30 hover:bg-muted/40",
                          )}
                          onClick={() => toggleExpanded(position.id)}
                        >
                          <TableCell className="w-10">
                            {isExpanded ? <IconChevronDown className="h-4 w-4 text-muted-foreground" /> : <IconChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell>{position.hierarchy ?? <span className="text-muted-foreground">-</span>}</TableCell>
                          <TableCell className="font-medium">{position.name}</TableCell>
                          <TableCell>{currentValue > 0 ? <span className="font-medium">{formatCurrency(currentValue)}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell>
                            {position.bonifiable ? (
                              <Badge variant="active" className="text-xs whitespace-nowrap">
                                Bonificável
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                                Não bonificável
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="w-10">
                              {position._count?.users ?? 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {history.length} {history.length === 1 ? "registro" : "registros"}
                            </span>
                          </TableCell>
                        </TableRow>

                        {/* Expanded row: MonetaryValue history timeline */}
                        {isExpanded && (
                          <TableRow className="hover:bg-transparent border-b border-border">
                            <TableCell colSpan={headers.length} className="bg-muted/10 p-4">
                              {history.length === 0 ? (
                                <div className="text-sm text-muted-foreground">Nenhum histórico de remuneração para este cargo.</div>
                              ) : (
                                <div className="space-y-0">
                                  <div className="text-sm font-medium mb-3">Histórico de Remunerações</div>
                                  <div className="relative pl-5 space-y-4 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-border">
                                    {history.map((record) => (
                                      <div key={record.id} className="relative">
                                        <span
                                          className={cn(
                                            "absolute -left-5 top-1.5 h-3 w-3 rounded-full border-2 border-background",
                                            record.current ? "bg-green-700" : "bg-muted-foreground/40",
                                          )}
                                        />
                                        <div className="flex items-center gap-3 text-sm">
                                          <span className="font-medium">{formatCurrency(record.value)}</span>
                                          <span className="text-muted-foreground">{formatDate(new Date(record.createdAt))}</span>
                                          {record.current && (
                                            <Badge variant="active" className="text-xs">
                                              Atual
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
