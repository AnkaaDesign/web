import type { User, Bonus } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { formatCurrency } from "../../../../utils";
// REMOVED: import { calculateBonusAmount, getPositionLevel } from "../../../../utils"; - Using incorrect calculation
import { BONUS_STATUS, BONUS_STATUS_LABELS } from "../../../../constants";
import { IconCheck, IconClock, IconCalculator } from "@tabler/icons-react";

// Extended User interface for payroll display with month info and bonus data
export interface PayrollUserRow extends User {
  monthLabel?: string;
  monthYear?: string;
  monthCommissions?: any[];
  monthTaskCount?: number;
  // Payroll and Bonus information
  payrollId?: string; // ID of the payroll entity
  baseRemuneration?: number;
  bonusAmount?: number;
  bonus?: Bonus | any; // Bonus object
  calculatedBonus?: number;
  bonusStatus?: 'DRAFT' | 'CONFIRMED' | 'LIVE_CALCULATION';
  hasBonus?: boolean; // Flag to determine if user has bonus this period
  monthAverage?: number; // Month-specific average calculated from all eligible users
}

export interface PayrollColumn {
  key: string;
  header: string;
  accessor: (user: PayrollUserRow, monthSpecificTasks?: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export const createPayrollColumns = (): PayrollColumn[] => [
  // Payroll Number (Nº Folha)
  {
    key: "payrollNumber",
    header: "Nº FOLHA",
    accessor: (user: PayrollUserRow, monthSpecificTasks?: number) => (
      <div className="font-mono text-sm">
        {user.payrollNumber ? user.payrollNumber.toString().padStart(4, "0") : "-"}
      </div>
    ),
    sortable: true,
    className: "w-24",
    align: "left",
  },
  // User Name
  {
    key: "user.name",
    header: "NOME",
    accessor: (user: PayrollUserRow, monthSpecificTasks?: number) => <div className="font-medium truncate">{user.name}</div>,
    sortable: true,
    className: "w-64",
    align: "left",
  },
  // CPF
  {
    key: "user.cpf",
    header: "CPF",
    accessor: (user: PayrollUserRow, monthSpecificTasks?: number) => (
      <div className="text-sm font-mono">
        {user.cpf ? user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '-'}
      </div>
    ),
    sortable: true,
    className: "w-32",
    align: "left",
  },
  // Position
  {
    key: "position.name",
    header: "CARGO",
    accessor: (user: PayrollUserRow, monthSpecificTasks?: number) => <div className="text-sm truncate">{user.position?.name || "-"}</div>,
    sortable: true,
    className: "w-48",
    align: "left",
  },
  // Sector
  {
    key: "sector.name",
    header: "SETOR",
    accessor: (user: PayrollUserRow, monthSpecificTasks?: number) => <div className="text-sm truncate">{user.sector?.name || "-"}</div>,
    sortable: true,
    className: "w-40",
    align: "left",
  },
  // Performance Level - Show numeric value
  {
    key: "performanceLevel",
    header: "NÍVEL PERFORMANCE",
    accessor: (user: PayrollUserRow, monthSpecificTasks?: number) => {
      const level = user.performanceLevel || 0;

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
  // Total Weighted Tasks for the Period (SAME for all eligible users)
  {
    key: "tasksCompleted",
    header: "TAREFAS CONCLUÍDAS",
    accessor: (user: PayrollUserRow) => {
      // If user is not eligible for bonus, show dash
      if (!user.position?.bonifiable) {
        return (
          <div className="text-sm text-muted-foreground">
            -
          </div>
        );
      }

      // DEBUG: Log the user data to see what's available
      if (user.name === "Breno Willian dos Santos Silva") {
        console.log('Breno data:', {
          name: user.name,
          hasBonus: !!user.bonus,
          bonusType: typeof user.bonus,
          hasTasks: !!user.bonus?.tasks,
          tasksLength: user.bonus?.tasks?.length,
          bonusKeys: user.bonus ? Object.keys(user.bonus) : [],
          fullBonus: user.bonus
        });
      }

      // Calculate TOTAL weighted tasks for the period (not per-user)
      // The bonus system is based on collective performance, not individual task ownership
      let totalWeightedTasks = 0;

      if (user.bonus?.tasks && Array.isArray(user.bonus.tasks)) {
        // Count ALL tasks (bonus.tasks contains all period tasks)
        const fullCommissionTasks = user.bonus.tasks.filter((t: any) =>
          t.commission === 'FULL_COMMISSION'
        ).length;
        const partialCommissionTasks = user.bonus.tasks.filter((t: any) =>
          t.commission === 'PARTIAL_COMMISSION'
        ).length;

        totalWeightedTasks = fullCommissionTasks + (partialCommissionTasks * 0.5);
      }

      return (
        <div className="text-sm font-medium tabular-nums">
          {totalWeightedTasks.toFixed(1)}
        </div>
      );
    },
    sortable: true,
    className: "w-32",
    align: "left",
  },
  // Average Tasks Per Employee for this specific month/row
  {
    key: "averageTasks",
    header: "MÉDIA TAREFAS",
    accessor: (user: PayrollUserRow, overallAverage?: number) => {
      // If user is not eligible for bonus, show dash
      if (!user.position?.bonifiable) {
        return (
          <div className="text-sm text-muted-foreground">
            -
          </div>
        );
      }

      // Use the overall average passed from the table (calculated across all users)
      // This ensures all users see the same average for the month
      let monthAverage = overallAverage || 0;

      // Fallback: If no overall average provided, try to calculate from bonus data
      if (!overallAverage && user.bonus?.tasks && user.bonus?.users) {
        const tasks = user.bonus.tasks;
        const usersCount = user.bonus.users.length;

        // Count total weighted tasks for the month
        const fullCommissionTasks = tasks.filter((t: any) =>
          t.commission === 'FULL_COMMISSION'
        ).length;
        const partialCommissionTasks = tasks.filter((t: any) =>
          t.commission === 'PARTIAL_COMMISSION'
        ).length;
        const totalWeightedTasks = fullCommissionTasks + (partialCommissionTasks * 0.5);

        // Calculate average: total weighted tasks / number of users with bonus
        monthAverage = usersCount > 0 ? totalWeightedTasks / usersCount : 0;
      }

      return (
        <div className="text-sm font-medium tabular-nums">
          {monthAverage.toFixed(1)}
        </div>
      );
    },
    sortable: true,
    className: "w-32",
    align: "left",
  },
  // Bonus with status indicators
  {
    key: "bonus",
    header: "BONIFICAÇÃO",
    accessor: (user: PayrollUserRow, monthSpecificTasks?: number) => {
      // Check if user is eligible for bonus based on position
      if (!user.position?.bonifiable) {
        return (
          <div className="text-sm font-medium text-right text-muted-foreground">
            Não elegível
          </div>
        );
      }

      // Get bonus amount directly from bonus.baseBonus field
      let bonusAmount = 0;

      if (user.bonus?.baseBonus !== undefined) {
        const baseBonus = user.bonus.baseBonus;
        bonusAmount = typeof baseBonus === 'string' ? parseFloat(baseBonus) : (baseBonus || 0);
      }

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
  // Remuneration - from payroll baseRemuneration field
  {
    key: "remuneration",
    header: "REMUNERAÇÃO",
    accessor: (user: PayrollUserRow, monthSpecificTasks?: number) => {
      // Get base remuneration from the payroll entity's baseRemuneration field
      const remuneration = user.baseRemuneration || 0;

      return (
        <div className="text-sm font-medium tabular-nums text-right">
          {formatCurrency(remuneration)}
        </div>
      );
    },
    sortable: true,
    className: "w-36",
    align: "right",
  },
  // Total Earnings (remuneration + bonus)
  {
    key: "totalEarnings",
    header: "TOTAL",
    accessor: (user: PayrollUserRow, monthSpecificTasks?: number) => {
      // Get base remuneration from payroll
      const remuneration = user.baseRemuneration || 0;

      // Get bonus amount from bonus entity
      let bonus = 0;
      if (user.position?.bonifiable && user.bonus?.baseBonus !== undefined) {
        const baseBonus = user.bonus.baseBonus;
        bonus = typeof baseBonus === 'string' ? parseFloat(baseBonus) : (baseBonus || 0);
      }

      const total = remuneration + bonus;

      return (
        <div className="text-sm font-semibold tabular-nums text-right text-primary">
          {formatCurrency(total)}
        </div>
      );
    },
    sortable: true,
    className: "w-36",
    align: "right",
  },
];

export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set([
    "user.name",
    "position.name",
    "performanceLevel",
    "averageTasks",
    "bonus",
    "remuneration",
    "totalEarnings"
  ]);
};