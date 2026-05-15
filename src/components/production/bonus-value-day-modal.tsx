// web/src/components/production/bonus-value-day-modal.tsx
//
// Modal opened by clicking an x-axis point on the "Relação Bônus / Produção"
// chart. Shows what composes the cumulative bonus value at the clicked day:
//   - Left  : tasks completed from period start through the clicked day
//   - Right : collaborators with their bonus value accrued at that day
//   - Below : calculation summary (period totals, eligible users, day fraction)
//
// Bonus accrual math: the chart's per-day aggregate bonus is computed by the
// backend as projectedFinalBonus × (cumulativeWeightedTasks[D] / projectedTotalWeighted).
// We re-use that same ratio (`dayFraction`) to prorate each collaborator's
// period bonus into a "value at day D", so the sum across users equals the
// chart's value at that x.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getTasks } from '@/api-client/task';
import { bonusService } from '@/api-client/services/bonus';
import { TASK_STATUS } from '@/constants/enums';
import { formatCurrency } from '@/types/statistics-common';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IconCoins, IconUsers, IconChecks, IconCalculator } from '@tabler/icons-react';

interface BonusValueDayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  sectorIds?: string[];
  // Snapshot of the clicked day
  dayDate: string;          // ISO date string
  dayDateLabel: string;     // e.g. "14 Mai"
  dayBonusValue: number;    // cumulative aggregate bonus at this day
  dayTaskCount: number;     // cumulative task count at this day
  dayWeightedTaskCount: number;
  dayIsForecast: boolean;
  // Which pane to show. Omit (default) for the full split view.
  // 'tasks' → only the tasks pane (full width); 'collaborators' → only the
  // collaborators pane. Used by the summary cards so clicking "Tarefas
  // concluídas" doesn't surface collaborator data.
  focus?: 'tasks' | 'collaborators';
  // Period context
  periodStartIso: string;   // ISO date for first day of the business period
  forecastedFinalBonusValue: number;
  forecastedFinalWeightedTaskCount: number;
}

export function BonusValueDayModal({
  open,
  onOpenChange,
  year,
  month,
  sectorIds,
  dayDate,
  dayDateLabel,
  dayBonusValue,
  dayTaskCount,
  dayWeightedTaskCount,
  dayIsForecast,
  focus,
  periodStartIso,
  forecastedFinalBonusValue,
  forecastedFinalWeightedTaskCount,
}: BonusValueDayModalProps) {
  const showTasks = focus !== 'collaborators';
  const showCollaborators = focus !== 'tasks';
  const [taskSearch, setTaskSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const from = useMemo(() => new Date(periodStartIso), [periodStartIso]);
  const to   = useMemo(() => {
    // End-of-day for the clicked date so any task finished on that calendar day is included.
    const d = new Date(dayDate);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [dayDate]);

  const sectorKey = useMemo(() => (sectorIds && sectorIds.length ? [...sectorIds].sort().join(',') : ''), [sectorIds]);

  // Tasks completed from period start through the clicked day.
  const tasksQuery = useQuery({
    queryKey: ['bonus-day-tasks', year, month, dayDate, sectorKey],
    queryFn: () =>
      getTasks({
        finishedDateRange: { from, to },
        status: [TASK_STATUS.COMPLETED],
        ...(sectorIds?.length ? { sectorIds } : {}),
        limit: 500,
        include: {
          truck: true,
          customer: true,
        },
      } as any),
    enabled: open && showTasks,
  });

  // Period-level per-user bonus (live calculation). The backend doesn't
  // expose per-day per-user values, so we prorate by `dayFraction` to mirror
  // how the chart's daily aggregate is built.
  //
  // Unwrap path: `bonusService.getLiveBonuses` returns the AxiosResponse, so
  // axios `.data` is the envelope `{ success, message, data: PayrollData }`.
  // We then dig into `.data.bonuses` for the per-user list, falling back to a
  // direct shape in case any environment skips the envelope.
  const bonusesQuery = useQuery({
    queryKey: ['bonus-live-payroll', year, month],
    queryFn: () => bonusService.getLiveBonuses(year, month).then((r: any) => {
      const body = r?.data ?? r;
      return body?.data ?? body;
    }),
    enabled: open && showCollaborators,
  });

  const rawTasks: any[] = (tasksQuery.data as any)?.data ?? [];
  const tasks = useMemo(
    () => [...rawTasks].sort((a, b) => {
      const da = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const db = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      return db - da;
    }),
    [rawTasks],
  );

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t: any) => {
      const name = (t.name || '').toLowerCase();
      const cust = (t.customer?.fantasyName ?? t.customer?.name ?? '').toLowerCase();
      return name.includes(q) || cust.includes(q);
    });
  }, [tasks, taskSearch]);

  // Note: actual API response field names come from `LiveBonusData` on the
  // server (bonus.service.ts). The web's `PayrollData` interface declares some
  // legacy-named fields (`performance`, `ponderedTaskCount`, `sector`) that the
  // server doesn't actually send — `performanceLevel` and `weightedTasks` are
  // the real fields, and there is no per-user sector on the response.
  const payroll: any = bonusesQuery.data;
  const payrollUsers: Array<{
    userId: string;
    userName: string;
    positionName: string;
    baseBonus: number;
    weightedTasks: number;
    rawTaskCount: number;
    performanceLevel: number;
    tasks?: Array<{ sectorId?: string | null }>;
  }> = Array.isArray(payroll?.bonuses) ? payroll.bonuses : [];

  // Filter to the selected sectors. The API doesn't include a `sector` field
  // on each bonus entry, but it does include the user's tasks for the period —
  // we keep users that have at least one task in any of the selected sectors.
  const filteredUsers = useMemo(() => {
    if (!sectorIds?.length) return payrollUsers;
    const set = new Set(sectorIds);
    return payrollUsers.filter(u =>
      Array.isArray(u.tasks) && u.tasks.some(t => t.sectorId && set.has(t.sectorId)),
    );
  }, [payrollUsers, sectorIds]);

  // Fraction of the period's projected final bonus accrued by this day.
  // Matches the chart's daily distribution: dayBonusValue / forecastedFinal.
  const dayFraction = forecastedFinalBonusValue > 0
    ? Math.min(1, dayBonusValue / forecastedFinalBonusValue)
    : 0;

  const eligibleCount = filteredUsers.filter(u => (u.performanceLevel ?? 0) > 0).length;
  const liveBonusTotal = filteredUsers.reduce((s, u) => s + (u.baseBonus ?? 0), 0);
  // The /bonus/live endpoint computes each user's bonus from the CURRENT B1,
  // while the chart's projected final uses an end-of-period extrapolated B1 —
  // so Σ(userBaseBonus) ≠ forecastedFinalBonusValue. Rescale each user so the
  // sum matches the chart at every day, including 100% at period end.
  const rescaleFactor = liveBonusTotal > 0 && forecastedFinalBonusValue > 0
    ? forecastedFinalBonusValue / liveBonusTotal
    : 1;

  // Sorted by accrued value (desc) so the biggest contributors show first.
  const sortedUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const base = q
      ? filteredUsers.filter(u =>
          (u.userName || '').toLowerCase().includes(q) ||
          (u.positionName || '').toLowerCase().includes(q),
        )
      : filteredUsers;
    return [...base]
      .map(u => {
        const rescaledFinal = (u.baseBonus ?? 0) * rescaleFactor;
        return {
          ...u,
          rescaledFinal,
          accruedBonus: rescaledFinal * dayFraction,
        };
      })
      .sort((a, b) => b.accruedBonus - a.accruedBonus);
  }, [filteredUsers, dayFraction, rescaleFactor, userSearch]);

  // The chart's projected final weighted tasks is the right base for B1 here —
  // it matches the same projection that produced the per-day bonus values.
  const b1 = eligibleCount > 0
    ? forecastedFinalWeightedTaskCount / eligibleCount
    : 0;

  const tasksLoading = tasksQuery.isLoading;
  const tasksError = tasksQuery.isError;
  const bonusesLoading = bonusesQuery.isLoading;
  const bonusesError = bonusesQuery.isError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl flex flex-col max-h-[90vh] h-[90vh] p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <IconCoins className="h-5 w-5 text-emerald-500" />
            Bônus / Produção · {dayDateLabel}
            {dayIsForecast && (
              <Badge variant="outline" className="text-amber-400 border-amber-400/40 ml-1">
                Previsão
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 mt-1">
            <span>Composição acumulada do dia 26 ao dia {format(new Date(dayDate), 'dd/MM', { locale: ptBR })}</span>
            <span className="text-foreground/80">·</span>
            <span>
              <strong className="text-foreground">{dayTaskCount}</strong> tarefa{dayTaskCount !== 1 ? 's' : ''}{' '}
              (peso {dayWeightedTaskCount.toFixed(2)})
            </span>
            <span className="text-foreground/80">·</span>
            <span className="text-emerald-400 font-medium">{formatCurrency(dayBonusValue)}</span>
            {showCollaborators && !bonusesLoading && !bonusesError && (
              <>
                <span className="text-foreground/80">·</span>
                <span>
                  <strong className="text-foreground">{eligibleCount}</strong>{' '}
                  elegível{eligibleCount !== 1 ? 'eis' : ''}
                </span>
              </>
            )}
            {sectorIds?.length ? (
              <>
                <span className="text-foreground/80">·</span>
                <span>{sectorIds.length} setor{sectorIds.length > 1 ? 'es' : ''} filtrado{sectorIds.length > 1 ? 's' : ''}</span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className={`flex-1 min-h-0 grid grid-cols-1 ${showTasks && showCollaborators ? 'md:grid-cols-2' : ''} gap-0 overflow-hidden`}>
          {/* LEFT: Tasks table */}
          {showTasks && (
          <div className={`flex flex-col min-h-0 ${showCollaborators ? 'border-r' : ''}`}>
            <div className="flex-shrink-0 px-6 py-3 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconChecks className="h-4 w-4 text-blue-400" />
                  <span className="font-medium">Tarefas concluídas</span>
                </div>
                {!tasksLoading && !tasksError && taskSearch.trim() && (
                  <span className="text-xs text-foreground/65">
                    mostrando {filteredTasks.length} de {tasks.length}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 px-6 py-3 border-b">
              <Input
                type="text"
                value={taskSearch}
                onChange={v => setTaskSearch(v == null ? '' : String(v))}
                placeholder="Buscar tarefa ou cliente..."
                className="w-full"
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Table className="[&>div]:border-0 [&_th]:px-6 [&_td]:px-6">
                <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Finalizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasksLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 3 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : tasksError ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-destructive py-10">
                        Erro ao carregar as tarefas.
                      </TableCell>
                    </TableRow>
                  ) : filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-12 text-center text-sm text-foreground/60">
                        {taskSearch ? 'Nenhum resultado.' : 'Nenhuma tarefa concluída neste intervalo.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map((task: any) => {
                      const customerName = task.customer?.fantasyName ?? task.customer?.name ?? '';
                      const finished = task.finishedAt
                        ? format(new Date(task.finishedAt), 'dd/MM', { locale: ptBR })
                        : '—';
                      return (
                        <TableRow key={task.id} className="text-sm">
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {task.name || '—'}
                          </TableCell>
                          <TableCell className="text-foreground/85 max-w-[180px] truncate">
                            {customerName || '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs text-foreground/80 whitespace-nowrap">
                            {finished}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          )}

          {/* RIGHT: Collaborators + summary */}
          {showCollaborators && (
          <div className="flex flex-col min-h-0">
            <div className="flex-shrink-0 px-6 py-3 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconUsers className="h-4 w-4 text-emerald-400" />
                  <span className="font-medium">Colaboradores</span>
                </div>
                {!bonusesLoading && !bonusesError && userSearch.trim() && (
                  <span className="text-xs text-foreground/65">
                    mostrando {sortedUsers.length} de {filteredUsers.length}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 px-6 py-3 border-b">
              <Input
                type="text"
                value={userSearch}
                onChange={v => setUserSearch(v == null ? '' : String(v))}
                placeholder="Buscar por nome ou cargo..."
                className="w-full"
              />
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              <Table className="[&>div]:border-0 [&_th]:px-6 [&_td]:px-6">
                <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Nome</TableHead>
                    <TableHead className="whitespace-nowrap">Cargo</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Nível</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonusesLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : bonusesError ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-destructive py-10">
                        Erro ao carregar bônus.
                      </TableCell>
                    </TableRow>
                  ) : sortedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-12 text-center text-sm text-foreground/60">
                        {userSearch ? 'Nenhum resultado.' : 'Nenhum colaborador elegível neste período.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedUsers.map(u => (
                      <TableRow key={u.userId} className="text-sm">
                        <TableCell className="font-medium whitespace-nowrap">
                          {u.userName}
                        </TableCell>
                        <TableCell className="text-xs text-foreground/80 whitespace-nowrap">
                          {u.positionName || '—'}
                        </TableCell>
                        <TableCell className="text-center text-xs text-foreground/80">
                          {u.performanceLevel > 0 ? u.performanceLevel : '—'}
                        </TableCell>
                        <TableCell className="text-right text-xs whitespace-nowrap font-medium text-emerald-400">
                          {formatCurrency(u.accruedBonus)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Calculation summary */}
            <div className="flex-shrink-0 border-t bg-muted/20 px-6 py-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <IconCalculator className="h-4 w-4 text-muted-foreground" />
                Resumo do cálculo
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="text-muted-foreground">Bônus final do período</div>
                <div className="text-right font-medium text-foreground">
                  {formatCurrency(forecastedFinalBonusValue)}
                </div>

                <div className="text-muted-foreground">Tarefas ponderadas (projeção)</div>
                <div className="text-right font-medium text-foreground">
                  {forecastedFinalWeightedTaskCount.toFixed(2)}
                </div>

                <div className="text-muted-foreground">B1 (média/colaborador elegível)</div>
                <div className="text-right font-medium text-foreground">
                  {b1.toFixed(2)}
                </div>

                <div className="text-muted-foreground">Acumulado até este dia</div>
                <div className="text-right font-medium text-emerald-400">
                  {formatCurrency(dayBonusValue)} ({(dayFraction * 100).toFixed(1)}%)
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed pt-1">
                O bônus do período é projetado pelo ritmo atual de tarefas e distribuído
                dia a dia proporcionalmente ao peso acumulado. O valor de cada colaborador
                acompanha a mesma proporção ({(dayFraction * 100).toFixed(1)}%) do bônus final.
              </p>
            </div>
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
