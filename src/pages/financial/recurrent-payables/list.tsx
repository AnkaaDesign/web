import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  IconRepeat,
  IconEdit,
  IconArchive,
  IconArchiveOff,
  IconTrash,
  IconPlus,
  IconCash,
  IconCheck,
  IconClockHour4,
  IconTrendingUp,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
} from "@tabler/icons-react";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSearchInput } from "@/components/ui/table-search-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";

import {
  useRecurrentPayables,
  useRecurrentPayableMonthly,
  useRecurrentPayableMutations,
} from "@/hooks/financial/use-recurrent-payable";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES, routes, SCHEDULE_FREQUENCY_LABELS, SCHEDULE_FREQUENCY, FAVORITE_PAGES } from "@/constants";
import { formatCurrency } from "@/utils";
import type {
  RecurrentPayable,
  RecurrentPayableMonthlyItem,
} from "@/types/recurrent-payable";

// Resolves the displayed cadastro value: the fixed amount for FIXED bills, else
// the estimate for VARIABLE bills (null when none informed yet).
const amountOf = (p: RecurrentPayable): number | null => {
  const raw = p.amountKind === "FIXED" ? p.fixedAmount : p.estimatedAmount;
  return raw == null ? null : Number(raw);
};

const WEEKDAY_ABBR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const isWeekly = (p: RecurrentPayable): boolean => p.frequency === "WEEKLY" || p.frequency === "BIWEEKLY";

// "Dia 10" for monthly bills; "Ter, Sex" (the weekdays) for weekly ones.
const scheduleLabel = (p: RecurrentPayable): string => {
  if (isWeekly(p)) {
    const days = [...(p.daysOfWeek ?? [])].sort((a, b) => a - b).map((d) => WEEKDAY_ABBR[d] ?? "?");
    return days.length ? days.join(", ") : "—";
  }
  return p.dueDayOfMonth ? `Dia ${p.dueDayOfMonth}` : "—";
};

export const RecurrentPayablesListPage = () => {
  usePageTracker({ title: "Recorrentes", icon: "repeat" });
  const navigate = useNavigate();

  // Month/competence model — occurrences are keyed by competence (YYYY-MM), so a
  // single month is the natural unit (no payroll-period range needed).
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => startOfMonth(new Date()));
  const competence = format(selectedMonth, "yyyy-MM");

  const { data: monthly, isLoading: monthlyLoading } = useRecurrentPayableMonthly(competence);
  const { data: payables, isLoading: listLoading } = useRecurrentPayables();
  const { update, delete: remove, pay, deleteMutation, payMutation } = useRecurrentPayableMutations();

  const [deleteTarget, setDeleteTarget] = useState<RecurrentPayable | null>(null);
  const [payTarget, setPayTarget] = useState<{ payable: RecurrentPayable; item: RecurrentPayableMonthlyItem } | null>(null);
  // Multi-occurrence (weekly) bills settle per occurrence via this dialog.
  const [occTarget, setOccTarget] = useState<RecurrentPayable | null>(null);
  const [searchText, setSearchText] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: RecurrentPayable } | null>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Index the month's occurrences by payable id so each bill row is enriched with
  // its Pago/Pendente status, paid amount and forecast for the selected month.
  const monthlyById = useMemo(() => {
    const map = new Map<string, RecurrentPayableMonthlyItem>();
    for (const item of monthly?.items ?? []) map.set(item.id, item);
    return map;
  }, [monthly]);

  // Rows are driven by the full cadastro (so inactive bills remain manageable),
  // enriched with the month occurrence for active ones.
  const rows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const base = [...(payables ?? [])].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      // Weekly bills have no day-of-month; group them ahead of monthly ones.
      const dayA = a.dueDayOfMonth ?? 0;
      const dayB = b.dueDayOfMonth ?? 0;
      if (dayA !== dayB) return dayA - dayB;
      return a.name.localeCompare(b.name, "pt-BR");
    });
    if (!q) return base;
    return base.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.supplier?.fantasyName ?? p.payeeName ?? "").toLowerCase().includes(q) ||
        (p.category?.name ?? "").toLowerCase().includes(q),
    );
  }, [payables, searchText]);

  const isLoading = monthlyLoading || listLoading;

  const stepMonth = (delta: number) => setSelectedMonth((m) => addMonths(m, delta));

  const handleContextMenu = useCallback((e: React.MouseEvent, item: RecurrentPayable) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  const openEdit = useCallback(
    (p: RecurrentPayable) => {
      setContextMenu(null);
      navigate(routes.financial.recurrentPayables.edit(p.id));
    },
    [navigate],
  );

  const toggleActive = useCallback(
    (p: RecurrentPayable) => {
      update({ id: p.id, body: { isActive: !p.isActive } });
      setContextMenu(null);
    },
    [update],
  );

  const openDelete = useCallback((p: RecurrentPayable) => {
    setDeleteTarget(p);
    setContextMenu(null);
  }, []);

  // FIXED bills settle with their known amount immediately; VARIABLE bills
  // (água/energia) require the real paid amount, so we prompt for it. Weekly
  // bills have several occurrences a month, paid individually via a breakdown.
  const startPay = useCallback(
    (p: RecurrentPayable) => {
      setContextMenu(null);
      const item = monthlyById.get(p.id);
      if (!item || item.pendingCount === 0) return;
      // Multiple occurrences in the month → open the per-occurrence breakdown.
      if (item.occurrenceCount > 1) {
        setOccTarget(p);
        return;
      }
      // Single occurrence (monthly bill).
      if (!item.occurrenceId || item.status === "PAID") return;
      if (p.amountKind === "FIXED") {
        pay({ occurrenceId: item.occurrenceId, body: {} });
      } else {
        setPayTarget({ payable: p, item });
      }
    },
    [monthlyById, pay],
  );

  const columns: StandardizedColumn<RecurrentPayable>[] = [
    {
      key: "name",
      header: "Conta",
      render: (p) => {
        const item = monthlyById.get(p.id);
        return (
          <div className={`flex items-center gap-2 min-w-0 ${p.isActive ? "" : "opacity-50"}`}>
            {item?.category?.color && (
              <span
                className="h-3 w-3 rounded-full flex-shrink-0 border border-border"
                style={{ backgroundColor: item.category.color }}
              />
            )}
            <span className="truncate text-sm font-medium">{p.name}</span>
          </div>
        );
      },
    },
    {
      key: "category",
      header: "Categoria",
      width: "320px",
      render: (p) =>
        p.category?.name ? (
          <span className={`text-sm ${p.isActive ? "" : "opacity-50"}`}>{p.category.name}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "dueDay",
      header: "Vencimento",
      width: "140px",
      align: "center",
      render: (p) => <span className="text-sm whitespace-nowrap">{scheduleLabel(p)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "160px",
      align: "center",
      render: (p) => {
        if (!p.isActive)
          return (
            <Badge variant="muted" size="sm">
              Inativa
            </Badge>
          );
        const item = monthlyById.get(p.id);
        // Weekly bills: show paid/total for the month.
        if (item && item.occurrenceCount > 1) {
          const allPaid = item.paidCount === item.occurrenceCount;
          return (
            <Badge variant={allPaid ? "completed" : "pending"} size="sm">
              {allPaid ? <IconCheck className="h-3 w-3 mr-1" /> : <IconClockHour4 className="h-3 w-3 mr-1" />}
              {item.paidCount}/{item.occurrenceCount} pagas
            </Badge>
          );
        }
        if (item?.status === "PAID")
          return (
            <Badge variant="completed" size="sm">
              <IconCheck className="h-3 w-3 mr-1" /> Pago
            </Badge>
          );
        if (item?.status === "OVERDUE")
          return (
            <Badge variant="error" size="sm">
              <IconClockHour4 className="h-3 w-3 mr-1" /> Vencida
            </Badge>
          );
        return (
          <Badge variant="pending" size="sm">
            <IconClockHour4 className="h-3 w-3 mr-1" /> Pendente
          </Badge>
        );
      },
    },
    {
      key: "paid",
      header: "Pago no mês",
      width: "160px",
      align: "right",
      render: (p) => {
        const item = monthlyById.get(p.id);
        return item?.paidAmount != null ? (
          <span className="font-semibold tabular-nums text-sm">{formatCurrency(item.paidAmount)}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
    },
    {
      key: "forecast",
      header: "Previsão",
      width: "150px",
      align: "right",
      render: (p) => {
        const item = monthlyById.get(p.id);
        const value = item ? item.forecastAmount : amountOf(p);
        const isVariable = p.amountKind === "VARIABLE";
        return value != null ? (
          <span
            className={`tabular-nums text-sm ${isVariable ? "italic text-muted-foreground" : "text-muted-foreground"}`}
            title={isVariable ? "Valor estimado (média dos últimos 3 meses)" : "Valor fixo"}
          >
            {formatCurrency(value)}
            {isVariable ? " (est.)" : ""}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
    },
    {
      key: "frequency",
      header: "Frequência",
      width: "130px",
      render: (p) => (
        <span className="text-sm text-muted-foreground">
          {SCHEDULE_FREQUENCY_LABELS[p.frequency as SCHEDULE_FREQUENCY] ?? p.frequency}
        </span>
      ),
    },
    {
      key: "transactions",
      header: "Transações",
      width: "120px",
      align: "center",
      render: (p) => {
        const item = monthlyById.get(p.id);
        return <span className="tabular-nums text-sm">{item?.transactionCount ?? 0}</span>;
      },
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Recorrentes — Pagamentos do mês"
          favoritePage={FAVORITE_PAGES.FINANCEIRO_CONTAS_RECORRENTES_LISTAR}
          icon={IconRepeat}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Conciliação Bancária", href: routes.financial.reconciliation.root },
            { label: "Recorrentes" },
          ]}
          actions={[
            {
              key: "create",
              label: "Nova conta",
              icon: IconPlus,
              onClick: () => navigate(routes.financial.recurrentPayables.create),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />

        <SummaryGrid
          totalPaid={monthly?.totalPaid ?? 0}
          totalForecast={monthly?.totalForecast ?? 0}
          paidCount={monthly?.paidCount ?? 0}
          pendingCount={monthly?.pendingCount ?? 0}
          isLoading={monthlyLoading}
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex flex-col shadow-sm border border-border h-full">
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-shrink-0">
                <div className="flex flex-1 min-w-0">
                  <TableSearchInput
                    value={searchText}
                    onChange={setSearchText}
                    placeholder="Buscar por nome, tomador ou categoria..."
                  />
                </div>
                <MonthNav month={selectedMonth} onPrev={() => stepMonth(-1)} onNext={() => stepMonth(1)} />
              </div>

              <div className="flex-1 min-h-0 overflow-auto">
                <StandardizedTable
                  className="h-full"
                  columns={columns}
                  data={rows}
                  getItemKey={(p) => p.id}
                  onContextMenu={handleContextMenu}
                  isLoading={isLoading}
                  emptyMessage="Nenhuma conta recorrente cadastrada"
                  emptyIcon={IconRepeat}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right-click context menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent position={contextMenu} isOpen={!!contextMenu} className="w-48 ![position:fixed]" onCloseAutoFocus={(e) => e.preventDefault()}>
          {contextMenu && (
            <>
              {contextMenu.item.isActive &&
                (monthlyById.get(contextMenu.item.id)?.pendingCount ?? 0) > 0 && (
                <>
                  <DropdownMenuItem onClick={() => startPay(contextMenu.item)}>
                    <IconCircleCheck className="mr-2 h-4 w-4" />
                    {(monthlyById.get(contextMenu.item.id)?.occurrenceCount ?? 1) > 1
                      ? "Pagar ocorrências"
                      : "Marcar como paga"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => openEdit(contextMenu.item)}>
                <IconEdit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {contextMenu.item.isActive ? (
                <DropdownMenuItem onClick={() => toggleActive(contextMenu.item)}>
                  <IconArchive className="mr-2 h-4 w-4" />
                  Desativar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => toggleActive(contextMenu.item)}>
                  <IconArchiveOff className="mr-2 h-4 w-4" />
                  Ativar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openDelete(contextMenu.item)} className="text-destructive">
                <IconTrash className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      <PayOccurrenceDialog
        target={payTarget}
        isPending={payMutation.isPending}
        onClose={() => setPayTarget(null)}
        onConfirm={(paidAmount) => {
          if (!payTarget?.item.occurrenceId) return;
          pay(
            { occurrenceId: payTarget.item.occurrenceId, body: { paidAmount } },
            { onSuccess: () => setPayTarget(null) },
          );
        }}
      />

      <OccurrencesPayDialog
        payable={occTarget}
        item={occTarget ? monthlyById.get(occTarget.id) ?? null : null}
        isPending={payMutation.isPending}
        onClose={() => setOccTarget(null)}
        onPay={(occurrenceId, paidAmount) =>
          pay({ occurrenceId, body: paidAmount != null ? { paidAmount } : {} })
        }
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta recorrente</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `"${deleteTarget.name}" será removida e deixará de gerar novas cobranças mensais.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                remove(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
              }}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PrivilegeRoute>
  );
};

// ---------------------------------------------------------------------------
// Month navigation (prev/next chevrons + month label)
// ---------------------------------------------------------------------------
function MonthNav({ month, onPrev, onNext }: { month: Date; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <Button variant="outline" size="icon" onClick={onPrev} aria-label="Mês anterior">
        <IconChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[140px] text-center text-sm font-medium capitalize">
        {format(month, "MMMM yyyy", { locale: ptBR })}
      </div>
      <Button variant="outline" size="icon" onClick={onNext} aria-label="Próximo mês">
        <IconChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mark-paid dialog (VARIABLE bills — captures the real paid amount)
// ---------------------------------------------------------------------------
const payFormSchema = z.object({
  paidAmount: z.coerce.number({ invalid_type_error: "valor inválido" }).positive("Informe o valor pago"),
});
type PayFormData = z.infer<typeof payFormSchema>;

function PayOccurrenceDialog({
  target,
  isPending,
  onClose,
  onConfirm,
}: {
  target: { payable: RecurrentPayable; item: RecurrentPayableMonthlyItem } | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (paidAmount: number) => void;
}) {
  const form = useForm<PayFormData>({
    resolver: zodResolver(payFormSchema),
    defaultValues: { paidAmount: undefined as unknown as number },
  });

  // Seed the input with the forecast each time a new bill is targeted.
  useEffect(() => {
    if (target) form.reset({ paidAmount: target.item.forecastAmount || (undefined as unknown as number) });
  }, [target, form]);

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como paga</DialogTitle>
          <DialogDescription>
            {target ? `Informe o valor pago de "${target.payable.name}" neste mês.` : ""}
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit((data) => onConfirm(data.paidAmount))}
            className="space-y-4"
          >
            <FormMoneyInput<PayFormData> name="paidAmount" label="Valor pago" required disabled={isPending} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Confirmar pagamento"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Per-occurrence pay dialog (weekly bills — settle each visit individually)
// ---------------------------------------------------------------------------
function OccurrencesPayDialog({
  payable,
  item,
  isPending,
  onClose,
  onPay,
}: {
  payable: RecurrentPayable | null;
  item: RecurrentPayableMonthlyItem | null;
  isPending: boolean;
  onClose: () => void;
  onPay: (occurrenceId: string, paidAmount: number | null) => void;
}) {
  // Typed amount per VARIABLE occurrence (seeded from the forecast on open).
  const [amounts, setAmounts] = useState<Record<string, number | undefined>>({});
  const isVariable = payable?.amountKind === "VARIABLE";

  useEffect(() => {
    if (item) {
      const seed: Record<string, number | undefined> = {};
      for (const o of item.occurrences) if (o.occurrenceId) seed[o.occurrenceId] = o.forecastAmount || undefined;
      setAmounts(seed);
    }
  }, [item]);

  return (
    <Dialog open={payable !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pagar ocorrências</DialogTitle>
          <DialogDescription>
            {payable ? `Marque cada cobrança de "${payable.name}" neste mês como paga.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-auto">
          {(item?.occurrences ?? []).map((o, idx) => {
            const paid = o.status === "PAID";
            const canPay = !!o.occurrenceId && !paid;
            return (
              <div
                key={o.occurrenceId ?? `idx-${idx}`}
                className="flex items-center gap-3 rounded-md border border-border p-2"
              >
                <div className="w-16 text-sm font-medium tabular-nums">
                  {format(new Date(o.dueDate), "dd/MM")}
                </div>
                <div className="flex-1 min-w-0">
                  {paid ? (
                    <Badge variant="completed" size="sm">
                      <IconCheck className="h-3 w-3 mr-1" /> Pago {o.paidAmount != null ? formatCurrency(o.paidAmount) : ""}
                    </Badge>
                  ) : isVariable && o.occurrenceId ? (
                    <Input
                      type="number"
                      value={amounts[o.occurrenceId] ?? ""}
                      onChange={(value) =>
                        setAmounts((prev) => ({
                          ...prev,
                          [o.occurrenceId as string]: value === null || value === "" ? undefined : Number(value),
                        }))
                      }
                      disabled={isPending}
                      placeholder="Valor pago"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground tabular-nums">{formatCurrency(o.forecastAmount)}</span>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canPay || isPending || (isVariable && !(o.occurrenceId && amounts[o.occurrenceId]))}
                  onClick={() => {
                    if (!o.occurrenceId) return;
                    onPay(o.occurrenceId, isVariable ? amounts[o.occurrenceId] ?? null : null);
                  }}
                >
                  {paid ? "Pago" : "Pagar"}
                </Button>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// KPI summary cards
// ---------------------------------------------------------------------------
function SummaryGrid({
  totalPaid,
  totalForecast,
  paidCount,
  pendingCount,
  isLoading,
}: {
  totalPaid: number;
  totalForecast: number;
  paidCount: number;
  pendingCount: number;
  isLoading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total pago no mês" value={isLoading ? null : formatCurrency(totalPaid)} Icon={IconCash} tone="emerald" />
      <KpiCard label="Previsão total" value={isLoading ? null : formatCurrency(totalForecast)} Icon={IconTrendingUp} tone="violet" />
      <KpiCard label="Recorrentes pagas" value={isLoading ? null : String(paidCount)} Icon={IconCheck} tone="blue" />
      <KpiCard label="Recorrentes pendentes" value={isLoading ? null : String(pendingCount)} Icon={IconClockHour4} tone="amber" />
    </div>
  );
}

const TONE_STYLES: Record<"emerald" | "amber" | "blue" | "violet", string> = {
  emerald: "text-emerald-600 bg-emerald-500/10",
  amber: "text-amber-600 bg-amber-500/10",
  blue: "text-blue-600 bg-blue-500/10",
  violet: "text-violet-600 bg-violet-500/10",
};

function KpiCard({
  label,
  value,
  Icon,
  tone,
}: {
  label: string;
  value: string | null;
  Icon: typeof IconCheck;
  tone: "emerald" | "amber" | "blue" | "violet";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`p-2 rounded-lg ${TONE_STYLES[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {value === null ? (
            <Skeleton className="h-6 w-24 mt-1" />
          ) : (
            <p className="text-lg font-semibold truncate" title={value}>
              {value}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default RecurrentPayablesListPage;
