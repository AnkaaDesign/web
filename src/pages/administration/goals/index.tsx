import { useMemo, useState } from "react";
import { IconPlus, IconTarget } from "@tabler/icons-react";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  routes,
  SECTOR_PRIVILEGES,
  FAVORITE_PAGES,
  GOAL_METRIC,
  GOAL_METRIC_LABELS,
  SECTOR_SCOPED_GOAL_METRICS,
} from "@/constants";
import { useGoals } from "@/hooks/administration/use-goal";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import type { Goal } from "@/types";
import { GoalRowModal } from "@/components/administration/goal/goal-row-modal";
import { GoalCell } from "@/components/administration/goal/goal-cell";

const MONTH_HEADERS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const isSectorScoped = (m: GOAL_METRIC) =>
  (SECTOR_SCOPED_GOAL_METRICS as readonly string[]).includes(m);

interface GoalRowGroup {
  metric: GOAL_METRIC;
  sectorId: string | null;
  sectorName: string | null;
  values: Map<number, Goal>;
}

function groupGoalsByRow(goals: Goal[]): GoalRowGroup[] {
  const groups = new Map<string, GoalRowGroup>();
  for (const g of goals) {
    const key = `${g.metric}::${g.sectorId ?? ""}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        metric: g.metric,
        sectorId: g.sectorId,
        sectorName: g.sector?.name ?? null,
        values: new Map(),
      };
      groups.set(key, group);
    }
    group.values.set(g.month, g);
  }
  return Array.from(groups.values()).sort((a, b) => {
    const aScope = a.sectorId ? 1 : 0;
    const bScope = b.sectorId ? 1 : 0;
    if (aScope !== bScope) return aScope - bScope;
    if (a.metric !== b.metric) return a.metric.localeCompare(b.metric);
    return (a.sectorName ?? "").localeCompare(b.sectorName ?? "");
  });
}

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

export function GoalListPage() {
  usePageTracker({ title: "Metas", icon: "target" });

  const [year, setYear] = useState<number>(currentYear);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useGoals({
    year,
    include: { sector: true },
    limit: 500,
    orderBy: { month: "asc" },
  });

  const rows = useMemo(() => groupGoalsByRow(data?.data ?? []), [data]);
  const existingKeys = useMemo(
    () => rows.map(r => ({ metric: r.metric, sectorId: r.sectorId })),
    [rows],
  );

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="flex h-full flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Metas"
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_METAS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Metas" },
          ]}
          actions={[
            {
              key: "new",
              label: "Nova métrica",
              onClick: () => setModalOpen(true),
              variant: "default" as const,
              icon: IconPlus,
            },
          ]}
          headerExtra={
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ano:</span>
              <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map(y => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
          className="flex-shrink-0"
        />

        <div className="flex min-h-0 flex-1 flex-col pb-6">
          <div className="flex-1 overflow-hidden rounded-lg border border-border">
            <div className="h-full overflow-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[240px]">Métrica</TableHead>
                    {MONTH_HEADERS.map(m => (
                      <TableHead key={m} className="w-[100px] text-right">
                        {m}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={13} className="py-10 text-center text-muted-foreground">
                        Carregando…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={13} className="py-12">
                        <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
                          <IconTarget className="h-10 w-10 text-muted-foreground/50" />
                          <div className="text-base font-medium">Nenhuma meta para {year}</div>
                          <div className="text-sm">
                            Clique em "Nova métrica" para começar.
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map(row => (
                    <TableRow key={`${row.metric}::${row.sectorId ?? ""}`}>
                      <TableCell className="font-medium">
                        {isSectorScoped(row.metric)
                          ? `${GOAL_METRIC_LABELS[row.metric]} · ${row.sectorName ?? "(sem setor)"}`
                          : GOAL_METRIC_LABELS[row.metric]}
                      </TableCell>
                      {Array.from({ length: 12 }, (_, i) => {
                        const month = i + 1;
                        return (
                          <TableCell key={month} className="p-0">
                            <GoalCell
                              goal={row.values.get(month)}
                              rowKey={{
                                metric: row.metric,
                                year,
                                sectorId: row.sectorId,
                                month,
                              }}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Cada coluna representa um período: do dia 26 do mês anterior ao dia 25 do mês indicado
            (mesma convenção dos bônus). Duplo clique em uma célula para editar.
          </p>
        </div>
      </div>

      <GoalRowModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        year={year}
        existingRows={existingKeys}
      />
    </PrivilegeRoute>
  );
}

export default GoalListPage;
