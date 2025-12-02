import type { Bonus } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { formatCurrency, formatDate } from "../../../../utils";
import { BONUS_STATUS_LABELS } from "../../../../constants";

// Extended Bonus interface for table display
export interface BonusTableRow extends Bonus {
  // Additional computed fields if needed
  periodLabel?: string;
}

export interface BonusColumn {
  key: string;
  header: string;
  accessor: (bonus: BonusTableRow) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

/**
 * Helper function to format month/year as "Janeiro 2024"
 */
const formatPeriod = (month: number, year: number): string => {
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return `${monthNames[month - 1]} ${year}`;
};

/**
 * Helper function to safely extract number from Decimal type
 */
const toNumber = (value: number | { toNumber: () => number } | undefined): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'toNumber' in value) return value.toNumber();
  return 0;
};

export const createBonusColumns = (): BonusColumn[] => [
  // Period (Year/Month formatted as "Janeiro 2024")
  {
    key: "period",
    header: "PERÍODO",
    accessor: (bonus: BonusTableRow) => (
      <div className="font-medium">
        {formatPeriod(bonus.month, bonus.year)}
      </div>
    ),
    sortable: true,
    className: "w-40",
    align: "left",
  },
  // User Name
  {
    key: "userName",
    header: "NOME",
    accessor: (bonus: BonusTableRow) => (
      <div className="font-medium truncate">
        {bonus.user?.name || "-"}
      </div>
    ),
    sortable: true,
    className: "w-64",
    align: "left",
  },
  // User Email
  {
    key: "userEmail",
    header: "EMAIL",
    accessor: (bonus: BonusTableRow) => (
      <div className="text-sm truncate">
        {bonus.user?.email || "-"}
      </div>
    ),
    sortable: true,
    className: "w-64",
    align: "left",
  },
  // CPF
  {
    key: "user.cpf",
    header: "CPF",
    accessor: (bonus: BonusTableRow) => (
      <div className="text-sm font-mono">
        {bonus.user?.cpf ? bonus.user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '-'}
      </div>
    ),
    sortable: true,
    className: "w-32",
    align: "left",
  },
  // Payroll Number (Nº Folha)
  {
    key: "payrollNumber",
    header: "Nº FOLHA",
    accessor: (bonus: BonusTableRow) => (
      <div className="font-mono text-sm">
        {bonus.user?.payrollNumber ? bonus.user.payrollNumber.toString().padStart(4, "0") : "-"}
      </div>
    ),
    sortable: true,
    className: "w-24",
    align: "left",
  },
  // Position
  {
    key: "position.name",
    header: "CARGO",
    accessor: (bonus: BonusTableRow) => (
      <div className="text-sm truncate">
        {bonus.user?.position?.name || "-"}
      </div>
    ),
    sortable: true,
    className: "w-48",
    align: "left",
  },
  // Sector
  {
    key: "sector.name",
    header: "SETOR",
    accessor: (bonus: BonusTableRow) => (
      <div className="text-sm truncate">
        {bonus.user?.sector?.name || "-"}
      </div>
    ),
    sortable: true,
    className: "w-40",
    align: "left",
  },
  // Performance Level (1-5 with badge)
  {
    key: "performanceLevel",
    header: "NÍVEL PERFORMANCE",
    accessor: (bonus: BonusTableRow) => {
      const level = bonus.performanceLevel || 0;

      // Color mapping for performance levels
      const getVariant = (level: number) => {
        if (level >= 5) return "success"; // 5: green
        if (level >= 3) return "info"; // 3-4: blue
        if (level >= 1) return "destructive"; // 1-2: red
        return "outline"; // 0: No bonus
      };

      return (
        <Badge variant={getVariant(level)} className="min-w-[3rem]">
          {level}
        </Badge>
      );
    },
    sortable: true,
    className: "w-32",
    align: "left",
  },
  // Task Count (array length)
  {
    key: "taskCount",
    header: "QTD TAREFAS",
    accessor: (bonus: BonusTableRow) => {
      const count = bonus.tasks?.length || 0;

      return (
        <div className="text-sm font-medium tabular-nums">
          {count}
        </div>
      );
    },
    sortable: false,
    className: "w-28",
    align: "left",
  },
  // Weighted Tasks (stored in database)
  {
    key: "weightedTasks",
    header: "TAREFAS PONDERADAS",
    accessor: (bonus: BonusTableRow) => {
      const taskCount = toNumber(bonus.weightedTasks);

      return (
        <div className="text-sm font-medium tabular-nums">
          {taskCount.toFixed(2)}
        </div>
      );
    },
    sortable: true,
    className: "w-32",
    align: "left",
  },
  // Average Tasks Per User (stored in database)
  {
    key: "averageTaskPerUser",
    header: "MÉDIA TAREFAS",
    accessor: (bonus: BonusTableRow) => {
      const average = toNumber(bonus.averageTaskPerUser);

      return (
        <div className="text-sm font-medium tabular-nums">
          {average.toFixed(2)}
        </div>
      );
    },
    sortable: true,
    className: "w-32",
    align: "left",
  },
  // Base Bonus (formatted as currency BRL)
  {
    key: "baseBonus",
    header: "BÔNUS BRUTO",
    accessor: (bonus: BonusTableRow) => {
      const bonusAmount = toNumber(bonus.baseBonus);

      // If bonus amount is 0, show as "Sem bônus"
      if (bonusAmount === 0) {
        return (
          <div className="text-sm font-medium text-right text-muted-foreground">
            Sem bônus
          </div>
        );
      }

      return (
        <div className="text-sm font-medium tabular-nums text-right">
          {formatCurrency(bonusAmount)}
        </div>
      );
    },
    sortable: true,
    className: "w-40",
    align: "right",
  },
  // Net Bonus (after deductions)
  {
    key: "netBonus",
    header: "BÔNUS LÍQUIDO",
    accessor: (bonus: BonusTableRow) => {
      const netAmount = toNumber(bonus.netBonus);

      // If bonus amount is 0, show as "Sem bônus"
      if (netAmount === 0) {
        return (
          <div className="text-sm font-medium text-right text-muted-foreground">
            Sem bônus
          </div>
        );
      }

      return (
        <div className="text-sm font-medium tabular-nums text-right">
          {formatCurrency(netAmount)}
        </div>
      );
    },
    sortable: true,
    className: "w-40",
    align: "right",
  },
  // Calculation Period (start - end dates)
  {
    key: "calculationPeriod",
    header: "PERÍODO DE CÁLCULO",
    accessor: (bonus: BonusTableRow) => {
      if (!bonus.calculationPeriodStart || !bonus.calculationPeriodEnd) {
        return <div className="text-sm">-</div>;
      }

      return (
        <div className="text-sm">
          {formatDate(bonus.calculationPeriodStart)} - {formatDate(bonus.calculationPeriodEnd)}
        </div>
      );
    },
    sortable: false,
    className: "w-48",
    align: "left",
  },
  // Status (DRAFT/CONFIRMED badge)
  {
    key: "status",
    header: "STATUS",
    accessor: (bonus: BonusTableRow) => {
      // Determine status from payroll relationship or bonus data
      // If bonus has a payrollId, it's likely CONFIRMED
      const status = bonus.payrollId ? "CONFIRMED" : "DRAFT";

      const getVariant = (status: string) => {
        if (status === "CONFIRMED") return "success";
        return "outline";
      };

      return (
        <Badge variant={getVariant(status)}>
          {BONUS_STATUS_LABELS[status as keyof typeof BONUS_STATUS_LABELS] || status}
        </Badge>
      );
    },
    sortable: true,
    className: "w-32",
    align: "left",
  },
];

export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set([
    "period",
    "userName",
    "position.name",
    "performanceLevel",
    "taskCount",
    "weightedTasks",
    "averageTaskPerUser",
    "baseBonus",
    "netBonus",
    "status"
  ]);
};
