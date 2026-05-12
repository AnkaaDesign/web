import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { getTasks } from '@/api-client/task';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TASK_STATUS } from '@/constants/enums';

interface ProductionPeriodTasksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: string;     // "2025-05" or "2025"
  label: string;      // "Maio 2025"
  sectorIds?: string[];
}

// Business period: month M of year Y covers 26th of M-1 through 25th of M.
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

export function ProductionPeriodTasksModal({
  open,
  onOpenChange,
  period,
  label,
  sectorIds,
}: ProductionPeriodTasksModalProps) {
  const { from, to } = getBusinessPeriodRange(period);

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
        },
      } as any),
    enabled: open,
  });

  const tasks: any[] = (response as any)?.data ?? [];
  const total = (response as any)?.meta?.total ?? tasks.length;

  const taskLabel = (task: any) => task.name || '—';

  const customerName = (task: any) =>
    task.customer?.fantasyName ?? task.customer?.name ?? '';

  const indicator = (task: any) =>
    task.serialNumber ?? task.truck?.plate ?? task.truck?.chassisNumber ?? '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl flex flex-col" style={{ maxHeight: '85vh' }}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Tarefas — {label}</DialogTitle>
          <DialogDescription>
            {isLoading
              ? 'Carregando tarefas…'
              : isError
              ? 'Erro ao carregar'
              : (
                <>
                  <span className="font-medium">{total}</span>{' '}
                  tarefa{total !== 1 ? 's' : ''} concluída{total !== 1 ? 's' : ''} neste período
                  {sectorIds?.length ? ` · ${sectorIds.length} setor${sectorIds.length > 1 ? 'es' : ''} filtrado${sectorIds.length > 1 ? 's' : ''}` : ''}
                </>
              )
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
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
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                      Nenhuma tarefa encontrada neste período
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task: any) => {
                    const name = customerName(task);
                    const finishedDate = task.finishedAt
                      ? format(new Date(task.finishedAt), 'dd/MM/yyyy', { locale: ptBR })
                      : '—';

                    return (
                      <TableRow key={task.id} className="text-sm">
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {taskLabel(task)}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[180px] truncate">
                          {name || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {indicator(task)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {finishedDate}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
