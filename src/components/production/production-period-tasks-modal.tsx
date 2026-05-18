import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { getTasks } from '@/api-client/task';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TASK_STATUS } from '@/constants/enums';
import { IconChecks } from '@tabler/icons-react';

interface ProductionPeriodTasksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: string;     // "2025-05-14", "2025-05", or "2025"
  label: string;      // "14 Mai 2025", "Maio 2025"
  sectorIds?: string[];
  activeUsers?: number;
  // sectorId → hex color, mirroring the chart's bar colors. When provided
  // and >1 sector is actually present in the result set, task names are
  // tinted by sector and rows are grouped by sector.
  sectorColorMap?: Record<string, string>;
}

// Business period: month M of year Y covers 26th of M-1 through 25th of M.
// Day periods (YYYY-MM-DD) use calendar days (00:00 → 23:59), not business
// periods — "what day did this task finish" has no business-month analogue.
function getBusinessPeriodRange(period: string): { from: Date; to: Date } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    const [yearStr, monthStr, dayStr] = period.split('-');
    const y = parseInt(yearStr);
    const m = parseInt(monthStr) - 1;
    const d = parseInt(dayStr);
    return {
      from: new Date(y, m, d, 0, 0, 0),
      to:   new Date(y, m, d, 23, 59, 59),
    };
  }
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

export function ProductionPeriodTasksModal({
  open,
  onOpenChange,
  period,
  label,
  sectorIds,
  activeUsers,
  sectorColorMap,
}: ProductionPeriodTasksModalProps) {
  const { from, to } = getBusinessPeriodRange(period);
  const [search, setSearch] = useState('');

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['production-period-tasks', period, sectorIds],
    queryFn: () =>
      getTasks({
        finishedDateRange: { from, to },
        status: [TASK_STATUS.COMPLETED],
        ...(sectorIds?.length ? { sectorIds } : {}),
        limit: 300,
        include: {
          truck: true,
          customer: true,
          sector: true,
        },
      } as any),
    enabled: open,
  });

  const rawTasks: any[] = (response as any)?.data ?? [];
  const total = (response as any)?.meta?.total ?? rawTasks.length;

  // Tint by sector only when >1 sector actually shows up — otherwise every
  // row would share the same color and the tint would be noise.
  const multiSector = useMemo(() => {
    if (!sectorColorMap) return false;
    const seen = new Set<string>();
    for (const t of rawTasks) if (t.sectorId) seen.add(t.sectorId);
    return seen.size > 1;
  }, [sectorColorMap, rawTasks]);

  // When sector-tinted, sort sector asc → finishedAt desc within the sector
  // (matches the colaboradores modal's "sector first, then performance" rule).
  // Otherwise keep the legacy "most recent first" order.
  const tasks = useMemo(
    () => [...rawTasks].sort((a, b) => {
      if (multiSector) {
        const s = (a.sector?.name ?? '').localeCompare(b.sector?.name ?? '');
        if (s !== 0) return s;
      }
      const da = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const db = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      return db - da;
    }),
    [rawTasks, multiSector],
  );

  const taskLabel = (task: any) => task.name || '—';

  const customerName = (task: any) =>
    task.customer?.fantasyName ?? task.customer?.name ?? '';

  const indicator = (task: any) =>
    task.serialNumber ?? task.truck?.plate ?? task.truck?.chassisNumber ?? '—';

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(t =>
      taskLabel(t).toLowerCase().includes(q) ||
      customerName(t).toLowerCase().includes(q) ||
      String(indicator(t)).toLowerCase().includes(q),
    );
  }, [tasks, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <IconChecks className="h-5 w-5 text-primary" />
            Tarefas — {label}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            {isLoading
              ? 'Carregando tarefas…'
              : isError
              ? 'Erro ao carregar'
              : (
                <>
                  <span className="font-medium">{total}</span>{' '}
                  tarefa{total !== 1 ? 's' : ''} concluída{total !== 1 ? 's' : ''} neste período
                  {activeUsers != null && activeUsers > 0 && (
                    <>
                      {' · '}
                      <span className="font-medium">{activeUsers}</span>{' '}
                      colaborador{activeUsers !== 1 ? 'es' : ''} efetivo{activeUsers !== 1 ? 's' : ''} durante o período
                    </>
                  )}
                  {sectorIds?.length ? ` · ${sectorIds.length} setor${sectorIds.length > 1 ? 'es' : ''} filtrado${sectorIds.length > 1 ? 's' : ''}` : ''}
                </>
              )
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b shrink-0 flex items-center justify-between gap-3">
            <Input
              type="text"
              placeholder="Buscar por nome, cliente ou identificador..."
              value={search}
              onChange={v => setSearch(v == null ? '' : String(v))}
              className="flex-1"
            />
            {search.trim() && (
              <span className="text-xs text-foreground/65 shrink-0">
                {filteredTasks.length} de {tasks.length}
              </span>
            )}
          </div>

          {/* Plain overflow-y-auto (not Radix ScrollArea) — Radix wraps content
              in display:table which breaks position:sticky on <thead>. The
              "[&>div]:border-0" sentinel tells our Table component to skip its
              internal `overflow-auto` wrapper, so this outer div is the scroll
              container the sticky thead anchors to. */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Table className="[&>div]:border-0 [&_th]:px-6 [&_td]:px-6">
              <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
                <TableRow>
                  <TableHead>Nome da Tarefa</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead className="text-right">Finalizado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-destructive py-10">
                      Erro ao carregar as tarefas. Tente novamente.
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-sm text-foreground/60">
                      {search ? 'Nenhum resultado.' : 'Nenhuma tarefa encontrada neste período'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task: any) => {
                    const name = customerName(task);
                    const finishedDate = task.finishedAt
                      ? format(new Date(task.finishedAt), 'dd/MM/yyyy', { locale: ptBR })
                      : '—';
                    const sectorColor = multiSector && task.sectorId
                      ? sectorColorMap?.[task.sectorId]
                      : undefined;

                    return (
                      <TableRow key={task.id} className="text-sm">
                        <TableCell
                          className="font-medium max-w-[200px] truncate"
                          style={sectorColor ? { color: sectorColor } : undefined}
                          title={sectorColor ? (task.sector?.name ?? undefined) : undefined}
                        >
                          {taskLabel(task)}
                        </TableCell>
                        <TableCell className="text-foreground/85 max-w-[180px] truncate">
                          {name || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-foreground/75 font-mono">
                          {indicator(task)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-foreground/80 whitespace-nowrap">
                          {finishedDate}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
