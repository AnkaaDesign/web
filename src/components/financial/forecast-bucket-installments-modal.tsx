import { useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IconAlertTriangle, IconCalendarStats, IconCash } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ForecastInstallment } from '@/types/financial-analytics';
import { formatCurrency } from '@/types/statistics-common';

interface ForecastBucketInstallmentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketLabel: string;
  bucketKey: string;
  dueAmount: number;
  installments: ForecastInstallment[];
  totalCount: number;
  truncated?: boolean;
}

const BUCKET_TONE: Record<string, { className: string; icon: typeof IconAlertTriangle }> = {
  OVERDUE: { className: 'text-red-700 dark:text-red-400', icon: IconAlertTriangle },
  D7:  { className: 'text-emerald-700 dark:text-emerald-400', icon: IconCalendarStats },
  D15: { className: 'text-sky-700 dark:text-sky-400', icon: IconCalendarStats },
  D30: { className: 'text-cyan-700 dark:text-cyan-400', icon: IconCalendarStats },
  D60: { className: 'text-violet-700 dark:text-violet-400', icon: IconCalendarStats },
  D90: { className: 'text-amber-700 dark:text-amber-400', icon: IconCalendarStats },
  ALL: { className: 'text-primary', icon: IconCash },
};

function daysOnlyLabel(days: number): string {
  const abs = Math.abs(days);
  if (abs === 0) return 'hoje';
  return `${abs} ${abs === 1 ? 'dia' : 'dias'}`;
}

export function ForecastBucketInstallmentsModal({
  open,
  onOpenChange,
  bucketLabel,
  bucketKey,
  dueAmount,
  installments,
  totalCount,
  truncated,
}: ForecastBucketInstallmentsModalProps) {
  const sorted = useMemo(
    () => [...installments].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [installments],
  );

  const tone = BUCKET_TONE[bucketKey] ?? BUCKET_TONE.D30;
  const Icon = tone.icon;
  const isOverdue = bucketKey === 'OVERDUE';
  const isAll = bucketKey === 'ALL';
  const timingColumnLabel = isOverdue ? 'Vencida há' : isAll ? 'Vencimento em' : 'Vence em';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl flex flex-col max-h-[90vh] h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Icon className={`h-5 w-5 ${tone.className}`} />
            Parcelas — {bucketLabel}
          </DialogTitle>
          <DialogDescription className="text-foreground/75">
            <span className="font-semibold text-foreground">{totalCount}</span>{' '}
            parcela{totalCount !== 1 ? 's' : ''} totalizando{' '}
            <span className={`font-semibold ${tone.className}`}>{formatCurrency(dueAmount)}</span>
            {truncated && (
              <>
                {' · '}
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  exibindo as {installments.length} primeiras
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <Table className="[&>div]:border-0 table-fixed w-full">
            <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
              <TableRow>
                <TableHead className="text-sm w-[24%]">Cliente</TableHead>
                <TableHead className="text-sm w-[34%]">Tarefa</TableHead>
                <TableHead className="text-sm w-[90px]">Parcela</TableHead>
                <TableHead className="text-sm text-right w-[110px]">Vencimento</TableHead>
                <TableHead className="text-sm text-right whitespace-nowrap w-[150px]">{timingColumnLabel}</TableHead>
                <TableHead className="text-sm text-right w-[140px]">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-foreground/60 py-10">
                    Nenhuma parcela nesta faixa
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map(inst => {
                  const due = new Date(inst.dueDate);
                  const dueStr = format(due, 'dd/MM/yyyy', { locale: ptBR });
                  const overdueRow = inst.daysFromNow < 0;
                  const installmentDisplay = inst.totalInstallments > 0
                    ? `${inst.installmentNumber}/${inst.totalInstallments}`
                    : `${inst.installmentNumber}`;
                  return (
                    <TableRow key={inst.installmentId} className="text-sm">
                      <TableCell className="py-3">
                        <div className="text-sm text-foreground truncate" title={inst.customerName}>
                          {inst.customerName}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        {inst.taskName ? (
                          <div className="min-w-0">
                            <div className="text-sm text-foreground truncate" title={inst.taskName}>
                              {inst.taskName}
                            </div>
                            {inst.taskSerialNumber && (
                              <div className="text-xs text-foreground/60 truncate">
                                {inst.taskSerialNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-foreground/55 italic">Sem tarefa</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-foreground/85 tabular-nums">
                        {installmentDisplay}
                      </TableCell>
                      <TableCell className="text-right text-sm text-foreground/90 whitespace-nowrap tabular-nums">
                        {dueStr}
                      </TableCell>
                      <TableCell className={`text-right whitespace-nowrap text-sm font-medium tabular-nums ${overdueRow ? BUCKET_TONE.OVERDUE.className : tone.className}`}>
                        {daysOnlyLabel(inst.daysFromNow)}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-bold whitespace-nowrap tabular-nums ${overdueRow ? BUCKET_TONE.OVERDUE.className : 'text-foreground'}`}>
                        {formatCurrency(inst.remaining)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
