import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

// The recurring view uses the same payroll period as the Controle de Ponto:
// the 26th of the previous month through the 25th of the selected month.
function payrollPeriod(month: Date): { start: Date; end: Date } {
  const prev = addMonths(month, -1);
  return {
    start: new Date(prev.getFullYear(), prev.getMonth(), 26),
    end: new Date(month.getFullYear(), month.getMonth(), 25, 23, 59, 59, 999),
  };
}
import {
  IconCalendarRepeat,
  IconCash,
  IconCheck,
  IconClockHour4,
} from "@tabler/icons-react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { PeriodControl } from "@/components/human-resources/time-clock-entry/period-control";
import {
  StandardizedTable,
  type StandardizedColumn,
} from "@/components/ui/standardized-table";
import { useRecurringForecast } from "@/hooks/financial/use-reconciliation";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES, routes } from "@/constants";
import { formatCurrency } from "@/utils";
import type { RecurringForecastItem } from "@/types/reconciliation";

export const ReconciliationRecurringForecastPage = () => {
  usePageTracker({ title: "Recorrentes - Conciliação", icon: "calendar" });
  const navigate = useNavigate();
  const now = new Date();
  // Date-range model (like the Controle de Ponto range view). `anchorMonth`
  // backs the prev/next chevrons (they reset the range to that month's bounds),
  // while the calendar lets the user pick an arbitrary range.
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => startOfMonth(now));
  const [startDate, setStartDate] = useState<Date>(() => payrollPeriod(now).start);
  const [endDate, setEndDate] = useState<Date>(() => payrollPeriod(now).end);
  const [searchText, setSearchText] = useState("");

  const { data, isLoading } = useRecurringForecast(
    startDate.toISOString(),
    endDate.toISOString(),
  );

  // Replicates the Controle de Ponto chip: shows the MONTH name by default, and
  // only switches to "Período personalizado" (with the range as subtitle) once
  // the user picks a custom range that no longer matches the anchor month.
  const isCustomRange = useMemo(() => {
    const p = payrollPeriod(selectedMonth);
    return (
      format(startDate, "yyyy-MM-dd") !== format(p.start, "yyyy-MM-dd") ||
      format(endDate, "yyyy-MM-dd") !== format(p.end, "yyyy-MM-dd")
    );
  }, [selectedMonth, startDate, endDate]);

  const periodTitle = isCustomRange
    ? "Período personalizado"
    : format(selectedMonth, "MMMM yyyy", { locale: ptBR });
  const periodSubtitle = `${format(startDate, "dd/MM", { locale: ptBR })} a ${format(
    endDate,
    "dd/MM/yyyy",
    { locale: ptBR },
  )}`;

  // Chevrons step a whole month and reset the range to that month's payroll bounds.
  const stepMonth = (delta: number) => {
    const next = addMonths(selectedMonth, delta);
    const p = payrollPeriod(next);
    setSelectedMonth(next);
    setStartDate(p.start);
    setEndDate(p.end);
  };

  const allItems = data?.items ?? [];
  const items = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(i => i.category.name.toLowerCase().includes(q));
  }, [allItems, searchText]);
  const paidCount = useMemo(
    () => allItems.filter(i => i.status === "PAID").length,
    [allItems],
  );
  const pendingCount = useMemo(
    () => allItems.filter(i => i.status === "PENDING").length,
    [allItems],
  );

  const columns: StandardizedColumn<RecurringForecastItem>[] = [
    {
      key: "name",
      header: "Categoria",
      render: item => (
        <div className="flex items-center gap-2 min-w-0">
          {item.category.color && (
            <span
              className="h-3 w-3 rounded-full flex-shrink-0 border border-border"
              style={{ backgroundColor: item.category.color }}
            />
          )}
          <span className="truncate text-sm font-medium">
            {item.category.name}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "140px",
      align: "center",
      render: item =>
        item.status === "PAID" ? (
          <Badge variant="completed" size="sm">
            <IconCheck className="h-3 w-3 mr-1" /> Pago
          </Badge>
        ) : (
          <Badge variant="pending" size="sm">
            <IconClockHour4 className="h-3 w-3 mr-1" /> Pendente
          </Badge>
        ),
    },
    {
      key: "paidAmount",
      header: "Pago no período",
      width: "160px",
      align: "right",
      render: item => (
        <span className="font-semibold tabular-nums text-sm">
          {formatCurrency(item.paidAmount)}
        </span>
      ),
    },
    {
      key: "transactionCount",
      header: "Transações",
      width: "120px",
      align: "center",
      render: item => (
        <span className="tabular-nums text-sm">{item.transactionCount}</span>
      ),
    },
  ];

  return (
    <PrivilegeRoute
      requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Recorrentes — Pagamentos do mês"
          icon={IconCalendarRepeat}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Conciliação Bancária" },
            { label: "Recorrentes" },
          ]}
          className="flex-shrink-0"
        />

        <SummaryGrid
          totalPaid={data?.totalPaid ?? 0}
          paidCount={paidCount}
          pendingCount={pendingCount}
          isLoading={isLoading}
          dateFrom={format(startDate, "yyyy-MM-dd")}
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex flex-col shadow-sm border border-border h-full">
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              {/* Search on the left (fills available width), period range on
                  the right. */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-shrink-0">
                <div className="flex flex-1 min-w-0">
                  <TableSearchInput
                    value={searchText}
                    onChange={setSearchText}
                    placeholder="Buscar por categoria..."
                  />
                </div>
                <PeriodControl
                  variant="range"
                  title={periodTitle}
                  subtitle={periodSubtitle}
                  startDate={startDate}
                  endDate={endDate}
                  onRangeChange={(s, e) => {
                    if (s) setStartDate(s);
                    if (e) setEndDate(e);
                  }}
                  onPrev={() => stepMonth(-1)}
                  onNext={() => stepMonth(1)}
                />
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                <StandardizedTable
                  columns={columns}
                  data={items}
                  getItemKey={item => item.category.id}
                  isLoading={isLoading}
                  emptyMessage="Nenhuma categoria recorrente paga no período"
                  emptyIcon={IconCalendarRepeat}
                  onRowClick={item =>
                    navigate(
                      `${routes.financial.reconciliation.transactions}?categoryIds=${item.category.id}`,
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

function SummaryGrid({
  totalPaid,
  paidCount,
  pendingCount,
  isLoading,
  dateFrom,
}: {
  totalPaid: number;
  paidCount: number;
  pendingCount: number;
  isLoading: boolean;
  dateFrom: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label="Total pago no período"
        value={isLoading ? null : formatCurrency(totalPaid)}
        Icon={IconCash}
        tone="emerald"
        href={`${routes.financial.reconciliation.transactions}?dateFrom=${dateFrom}`}
      />
      <KpiCard
        label="Recorrentes pagas"
        value={isLoading ? null : String(paidCount)}
        Icon={IconCheck}
        tone="blue"
      />
      <KpiCard
        label="Recorrentes pendentes"
        value={isLoading ? null : String(pendingCount)}
        Icon={IconClockHour4}
        tone="amber"
      />
    </div>
  );
}

const TONE_STYLES: Record<"emerald" | "amber" | "blue", string> = {
  emerald: "text-emerald-600 bg-emerald-500/10",
  amber: "text-amber-600 bg-amber-500/10",
  blue: "text-blue-600 bg-blue-500/10",
};

function KpiCard({
  label,
  value,
  Icon,
  tone,
  href,
}: {
  label: string;
  value: string | null;
  Icon: typeof IconCheck;
  tone: "emerald" | "amber" | "blue";
  href?: string;
}) {
  const body = (
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
  );
  if (href) {
    return (
      <Link
        to={href}
        className="block focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-md"
      >
        <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
          {body}
        </Card>
      </Link>
    );
  }
  return <Card>{body}</Card>;
}

export default ReconciliationRecurringForecastPage;
