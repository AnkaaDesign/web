// web/src/components/production/performance-period-modal.tsx
//
// Modal opened by clicking a bar on the "Desempenho" chart. Side-by-side
// layout (mirrors `bonus-value-day-modal`):
//   - LEFT  : tasks completed during the clicked period
//   - RIGHT : per-user attribution scoped to THAT period only
//             (working days, allocated tasks, daily rate)
//
// Allocation rule (mirrors the backend):
//   contribution(u) = weight(u) × occupancy(u)
//   tasksAllocated(u) = T × contribution(u) / Σ contribution

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { getTasks } from '@/api-client/task';
import { TASK_STATUS } from '@/constants/enums';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  IconActivity,
  IconChecks,
  IconUsers,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconCalculator,
} from '@tabler/icons-react';
import { formatNumber } from '@/types/statistics-common';
import type { TaskPerformancePeriodUser } from '@/types/production-analytics';

interface PerformancePeriodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: string;       // "2026-03" or "2026"
  label: string;        // "Março 2026"
  sectorIds?: string[];
  totalCount: number;
  activeUsers: number;
  workingDays: number;
  avgPerformance: number;
  users: TaskPerformancePeriodUser[];
  // Which columns to render. 'tasks' shows only the completed tasks list,
  // 'collaborators' shows only the per-user attribution, 'both' shows
  // them side-by-side (the chart-click default).
  mode?: 'tasks' | 'collaborators' | 'both';
  // sectorId → hex color, mirroring the chart's bar colors. When provided
  // and >1 sector is present, names are tinted by sector and the default
  // sort becomes sector-then-tasks.
  sectorColorMap?: Record<string, string>;
}

// Business period: month M = 26th of M-1 through 25th of M; year Y = the
// 12 business months of Y.
function getBusinessPeriodRange(period: string): { from: Date; to: Date } {
  if (/^\d{4}$/.test(period)) {
    const y = parseInt(period);
    return {
      from: new Date(y - 1, 11, 26, 0, 0, 0),
      to:   new Date(y,     11, 25, 23, 59, 59),
    };
  }
  const [yearStr, monthStr] = period.split('-');
  const y = parseInt(yearStr);
  const m = parseInt(monthStr) - 1;
  return {
    from: new Date(y, m - 1, 26, 0, 0, 0),
    to:   new Date(y, m,     25, 23, 59, 59),
  };
}

type UserSortKey = 'tasks' | 'workingDays' | 'rank' | 'name' | 'sector';
type SortDir = 'asc' | 'desc';

export function PerformancePeriodModal({
  open,
  onOpenChange,
  period,
  label,
  sectorIds,
  totalCount,
  activeUsers,
  workingDays,
  avgPerformance,
  users,
  mode = 'both',
  sectorColorMap,
}: PerformancePeriodModalProps) {
  const showTasks = mode === 'tasks' || mode === 'both';
  const showCollaborators = mode === 'collaborators' || mode === 'both';
  const { from, to } = getBusinessPeriodRange(period);

  // Tint names by sector only when comparing >1 sector that's actually
  // represented in the result set (otherwise everyone would share one color).
  const multiSector = useMemo(() => {
    if (!sectorColorMap) return false;
    const seen = new Set<string>();
    for (const u of users) if (u.sectorId) seen.add(u.sectorId);
    return seen.size > 1;
  }, [sectorColorMap, users]);

  const [sortKey, setSortKey] = useState<UserSortKey>(multiSector ? 'sector' : 'tasks');
  const [sortDir, setSortDir] = useState<SortDir>(multiSector ? 'asc' : 'desc');
  const [search, setSearch] = useState('');
  const [taskSearch, setTaskSearch] = useState('');

  const tasksQuery = useQuery({
    queryKey: ['performance-period-tasks', period, sectorIds],
    queryFn: () =>
      getTasks({
        finishedDateRange: { from, to },
        status: [TASK_STATUS.COMPLETED],
        ...(sectorIds?.length ? { sectorIds } : {}),
        limit: 100,
        include: { truck: true, customer: true, sector: true },
      } as any),
    enabled: open && showTasks,
  });

  const rawTasks: any[] = (tasksQuery.data as any)?.data ?? [];
  // Group by sector then finishedAt desc when comparing >1 sector, so the
  // task list reads the same way as the colaboradores column on the right.
  const multiSectorTasks = useMemo(() => {
    if (!sectorColorMap) return false;
    const seen = new Set<string>();
    for (const t of rawTasks) if (t.sectorId) seen.add(t.sectorId);
    return seen.size > 1;
  }, [sectorColorMap, rawTasks]);

  const tasks = useMemo(
    () => [...rawTasks].sort((a, b) => {
      if (multiSectorTasks) {
        const s = (a.sector?.name ?? '').localeCompare(b.sector?.name ?? '');
        if (s !== 0) return s;
      }
      const da = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const db = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      return db - da;
    }),
    [rawTasks, multiSectorTasks],
  );

  const toggleSort = (key: UserSortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'sector' || key === 'rank' ? 'asc' : 'desc');
    }
  };

  const sortIcon = (key: UserSortKey) => {
    if (sortKey !== key) return <IconSelector className="h-3.5 w-3.5 inline opacity-50" />;
    return sortDir === 'asc'
      ? <IconChevronUp className="h-3.5 w-3.5 inline" />
      : <IconChevronDown className="h-3.5 w-3.5 inline" />;
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.userName.toLowerCase().includes(q) ||
      (u.sectorName ?? '').toLowerCase().includes(q) ||
      (u.positionName ?? '').toLowerCase().includes(q),
    );
  }, [users, search]);

  const sortedUsers = useMemo(() => {
    const sign = sortDir === 'asc' ? 1 : -1;
    const arr = [...filteredUsers];
    arr.sort((a, b) => {
      // Sector grouping: tasks desc within each sector (independent of sortDir
      // so the rows always read "biggest first" inside the group, matching
      // the way the chart is read).
      if (sortKey === 'sector') {
        const s = (a.sectorName ?? '').localeCompare(b.sectorName ?? '');
        if (s !== 0) return s * sign;
        return b.tasksAllocated - a.tasksAllocated;
      }
      let cmp = 0;
      switch (sortKey) {
        case 'tasks':       cmp = a.tasksAllocated - b.tasksAllocated; break;
        case 'workingDays': cmp = a.workingDays - b.workingDays; break;
        case 'rank':        cmp = a.rank - b.rank; break;
        case 'name':        cmp = a.userName.localeCompare(b.userName); break;
      }
      if (cmp === 0) cmp = a.userName.localeCompare(b.userName);
      return cmp * sign;
    });
    return arr;
  }, [filteredUsers, sortKey, sortDir]);

  const taskLabel = (task: any) => task.name || '—';
  const customerName = (task: any) => task.customer?.fantasyName ?? task.customer?.name ?? '';

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(t =>
      taskLabel(t).toLowerCase().includes(q) ||
      customerName(t).toLowerCase().includes(q),
    );
  }, [tasks, taskSearch]);

  // Σ tasksAllocated should equal totalCount — surface that here for transparency.
  const allocatedSum = useMemo(
    () => users.reduce((s, u) => s + u.tasksAllocated, 0),
    [users],
  );

  const tasksLoading = tasksQuery.isLoading;
  const tasksError = tasksQuery.isError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${mode === 'both' ? 'max-w-screen-2xl' : 'max-w-3xl'} flex flex-col max-h-[90vh] h-[90vh] p-0`}>
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <IconActivity className="h-5 w-5 text-primary" />
            Desempenho · {label}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 mt-1">
            <span>
              <strong className="text-foreground">{formatNumber(totalCount)}</strong>{' '}
              tarefa{totalCount !== 1 ? 's' : ''} concluída{totalCount !== 1 ? 's' : ''}
            </span>
            <span className="text-foreground/60">·</span>
            <span>
              <strong className="text-foreground">{activeUsers}</strong>{' '}
              colaborador{activeUsers !== 1 ? 'es' : ''} ativo{activeUsers !== 1 ? 's' : ''}
            </span>
            <span className="text-foreground/60">·</span>
            <span>
              <strong className="text-foreground">{workingDays}</strong> dias úteis
            </span>
            <span className="text-foreground/60">·</span>
            <span>
              Média ajustada{' '}
              <strong className="text-foreground">{avgPerformance.toFixed(2)}</strong>
            </span>
            {sectorIds?.length ? (
              <>
                <span className="text-foreground/60">·</span>
                <span>{sectorIds.length} setor{sectorIds.length > 1 ? 'es' : ''} filtrado{sectorIds.length > 1 ? 's' : ''}</span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className={`flex-1 min-h-0 grid ${mode === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-0 overflow-hidden`}>
          {/* LEFT: Tarefas concluídas */}
          {showTasks && (
          <div className={`flex flex-col min-h-0 ${showCollaborators ? 'border-r' : ''}`}>
            {mode === 'both' && (
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
            )}
            <div className="flex-shrink-0 px-6 py-3 border-b flex items-center justify-between gap-3">
              <Input
                type="text"
                value={taskSearch}
                onChange={v => setTaskSearch(v == null ? '' : String(v))}
                placeholder="Buscar tarefa ou cliente..."
                className="flex-1"
              />
              {mode !== 'both' && !tasksLoading && !tasksError && taskSearch.trim() && (
                <span className="text-xs text-foreground/65 shrink-0">
                  {filteredTasks.length} de {tasks.length}
                </span>
              )}
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
                    Array.from({ length: 10 }).map((_, i) => (
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
                        {taskSearch ? 'Nenhum resultado.' : 'Nenhuma tarefa concluída neste período.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map((task: any) => {
                      const cname = customerName(task);
                      const finished = task.finishedAt
                        ? format(new Date(task.finishedAt), 'dd/MM', { locale: ptBR })
                        : '—';
                      const taskSectorColor = multiSectorTasks && task.sectorId
                        ? sectorColorMap?.[task.sectorId]
                        : undefined;
                      return (
                        <TableRow key={task.id} className="text-sm">
                          <TableCell
                            className="font-medium max-w-[220px] truncate"
                            style={taskSectorColor ? { color: taskSectorColor } : undefined}
                            title={taskSectorColor ? (task.sector?.name ?? undefined) : undefined}
                          >
                            {taskLabel(task)}
                          </TableCell>
                          <TableCell className="text-foreground/85 max-w-[180px] truncate">
                            {cname || '—'}
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

          {/* RIGHT: Colaboradores */}
          {showCollaborators && (
          <div className="flex flex-col min-h-0">
            {mode === 'both' && (
              <div className="flex-shrink-0 px-6 py-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconUsers className="h-4 w-4 text-emerald-400" />
                    <span className="font-medium">Colaboradores</span>
                  </div>
                  {search.trim() && (
                    <span className="text-xs text-foreground/65">
                      mostrando {sortedUsers.length} de {users.length}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="flex-shrink-0 px-6 py-3 border-b flex items-center justify-between gap-3">
              <Input
                type="text"
                value={search}
                onChange={v => setSearch(v == null ? '' : String(v))}
                placeholder="Buscar por nome, cargo ou setor..."
                className="flex-1"
              />
              {mode !== 'both' && search.trim() && (
                <span className="text-xs text-foreground/65 shrink-0">
                  {sortedUsers.length} de {users.length}
                </span>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              <Table className="[&>div]:border-0 [&_th]:px-6 [&_td]:px-6">
                <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
                  <TableRow>
                    <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('name')}>
                      Nome {sortIcon('name')}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('rank')}>
                      Cargo {sortIcon('rank')}
                    </TableHead>
                    <TableHead
                      className="text-right whitespace-nowrap"
                      title="Peso da posição = base + passo × rank (rank=0 para a posição mais baixa). Base e passo são configuráveis no filtro."
                    >
                      Peso
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('workingDays')}>
                      Dias Úteis {sortIcon('workingDays')}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleSort('tasks')}
                      title="Tarefas Atribuídas = T × (peso × dias úteis) / Σ(peso × dias úteis). Soma exata = T."
                    >
                      Tarefas {sortIcon('tasks')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-sm text-foreground/60">
                        {search ? 'Nenhum resultado.' : 'Nenhum colaborador ativo neste período.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedUsers.map(u => {
                      const sectorColor = multiSector && u.sectorId
                        ? sectorColorMap?.[u.sectorId]
                        : undefined;
                      return (
                      <TableRow key={u.userId} className="text-sm">
                        <TableCell
                          className="font-medium whitespace-nowrap"
                          style={sectorColor ? { color: sectorColor } : undefined}
                          title={sectorColor ? (u.sectorName ?? undefined) : undefined}
                        >
                          {u.userName}
                        </TableCell>
                        <TableCell className="text-xs text-foreground/80 whitespace-nowrap">
                          {u.positionName ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-foreground/80">
                          {u.weight.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {formatNumber(u.workingDays)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-emerald-400">
                          {u.tasksAllocated.toFixed(2)}
                        </TableCell>
                      </TableRow>
                      );
                    })
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
                <div className="text-muted-foreground">Tarefas concluídas</div>
                <div className="text-right font-medium text-foreground">
                  {formatNumber(totalCount)}
                </div>

                <div className="text-muted-foreground">Dias úteis no período</div>
                <div className="text-right font-medium text-foreground">{workingDays}</div>

                <div className="text-muted-foreground">Colaboradores ativos</div>
                <div className="text-right font-medium text-foreground">{activeUsers}</div>

                <div className="text-muted-foreground">Soma das atribuições</div>
                <div className="text-right font-medium text-foreground">
                  {allocatedSum.toFixed(2)}
                </div>

                <div className="text-muted-foreground">Média ajustada</div>
                <div className="text-right font-medium text-emerald-400">
                  {avgPerformance.toFixed(2)}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed pt-1">
                Cada tarefa é atribuída proporcionalmente ao peso do cargo × dias úteis trabalhados.
                A soma das atribuições é igual ao total de tarefas concluídas.
              </p>
            </div>
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
