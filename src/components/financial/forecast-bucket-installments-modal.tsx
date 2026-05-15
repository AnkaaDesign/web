import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
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

const PERIOD_BUCKET_TONES = [
  'text-emerald-700 dark:text-emerald-400',
  'text-sky-700 dark:text-sky-400',
  'text-cyan-700 dark:text-cyan-400',
  'text-violet-700 dark:text-violet-400',
  'text-amber-700 dark:text-amber-400',
  'text-fuchsia-700 dark:text-fuchsia-400',
];

function resolveTone(bucketKey: string): { className: string; icon: typeof IconAlertTriangle } {
  if (bucketKey === 'OVERDUE') {
    return { className: 'text-red-700 dark:text-red-400', icon: IconAlertTriangle };
  }
  if (bucketKey === 'ALL') {
    return { className: 'text-primary', icon: IconCash };
  }
  if (bucketKey === 'PAID') {
    return { className: 'text-emerald-700 dark:text-emerald-400', icon: IconCash };
  }
  if (bucketKey === 'BEYOND') {
    return { className: 'text-foreground/70', icon: IconCalendarStats };
  }
  // Period buckets: P1, P2, ... — rotate through tones by index.
  const match = /^P(\d+)$/.exec(bucketKey);
  const idx = match ? Math.max(0, parseInt(match[1], 10) - 1) : 0;
  return {
    className: PERIOD_BUCKET_TONES[idx % PERIOD_BUCKET_TONES.length],
    icon: IconCalendarStats,
  };
}

// Kept for legacy tone lookups in the rows.
const OVERDUE_TONE_CLASS = 'text-red-700 dark:text-red-400';

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
  const isPaid = bucketKey === 'PAID';
  const isOverdue = bucketKey === 'OVERDUE';
  const isAll = bucketKey === 'ALL';

  const [search, setSearch] = useState('');

  // PAID lists most-recent first; everything else lists oldest-due first
  // (overdue shows the stalest items at top; future periods show the next
  // bills to come due at top).
  const sorted = useMemo(
    () => [...installments].sort((a, b) => {
      if (isPaid) {
        const ap = a.paidAt ? new Date(a.paidAt).getTime() : 0;
        const bp = b.paidAt ? new Date(b.paidAt).getTime() : 0;
        return bp - ap;
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }),
    [installments, isPaid],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(inst =>
      (inst.customerName || '').toLowerCase().includes(q) ||
      (inst.taskName || '').toLowerCase().includes(q) ||
      (inst.taskSerialNumber || '').toLowerCase().includes(q) ||
      String(inst.installmentNumber).includes(q),
    );
  }, [sorted, search]);

  const tone = resolveTone(bucketKey);
  const Icon = tone.icon;
  const dateColumnLabel = isPaid ? 'Pago em' : 'Vencimento';
  const timingColumnLabel = isPaid
    ? 'Pago há'
    : isOverdue
      ? 'Vencida há'
      : isAll
        ? 'Vencimento em'
        : 'Vence em';
  const balanceColumnLabel = isPaid ? 'Pago' : 'Saldo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Icon className={`h-5 w-5 ${tone.className}`} />
            Parcelas — {bucketLabel}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            <span className="font-semibold text-foreground">{totalCount}</span>{' '}
            parcela{totalCount !== 1 ? 's' : ''}{' '}
            {isPaid ? 'somando' : 'totalizando'}{' '}
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

        <div className="px-6 py-3 border-b shrink-0">
          <Input
            type="text"
            value={search}
            onChange={v => setSearch(v == null ? '' : String(v))}
            placeholder="Buscar por cliente, tarefa, identificador ou nº da parcela..."
            className="w-full"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <Table className="[&>div]:border-0 table-fixed w-full [&_th]:px-6 [&_td]:px-6">
            <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
              <TableRow>
                <TableHead className="text-sm w-[24%]">Cliente</TableHead>
                <TableHead className="text-sm w-[34%]">Tarefa</TableHead>
                <TableHead className="text-sm w-[90px]">Parcela</TableHead>
                <TableHead className="text-sm text-right w-[110px]">{dateColumnLabel}</TableHead>
                <TableHead className="text-sm text-right whitespace-nowrap w-[150px]">{timingColumnLabel}</TableHead>
                <TableHead className="text-sm text-right w-[140px]">{balanceColumnLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-foreground/60">
                    {search ? 'Nenhum resultado.' : 'Nenhuma parcela nesta faixa'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(inst => {
                  // For PAID rows the visible date is paidAt (when the money
                  // actually came in); otherwise the due date drives the column.
                  const referenceDate = isPaid && inst.paidAt
                    ? new Date(inst.paidAt)
                    : new Date(inst.dueDate);
                  const dateStr = format(referenceDate, 'dd/MM/yyyy', { locale: ptBR });
                  const overdueRow = !isPaid && inst.daysFromNow < 0;
                  const installmentDisplay = inst.totalInstallments > 0
                    ? `${inst.installmentNumber}/${inst.totalInstallments}`
                    : `${inst.installmentNumber}`;
                  const balanceValue = isPaid ? inst.paidAmount : inst.remaining;
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
                        {dateStr}
                      </TableCell>
                      <TableCell className={`text-right whitespace-nowrap text-sm font-medium tabular-nums ${overdueRow ? OVERDUE_TONE_CLASS : tone.className}`}>
                        {daysOnlyLabel(inst.daysFromNow)}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-bold whitespace-nowrap tabular-nums ${overdueRow ? OVERDUE_TONE_CLASS : isPaid ? tone.className : 'text-foreground'}`}>
                        {formatCurrency(balanceValue)}
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
