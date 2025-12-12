import type { User, Bonus } from "../../../../types";
import { formatCurrency } from "../../../../utils";

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
  // Bonus Bruto (Gross Bonus)
  {
    key: "bonus",
    header: "BÔNUS BRUTO",
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
    className: "w-32",
    align: "right",
  },
  // Bonus Líquido (Net Bonus - after discounts)
  {
    key: "netBonus",
    header: "BÔNUS LÍQUIDO",
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

      // Calculate discounts
      let totalDiscounts = 0;
      if (user.bonus?.bonusDiscounts && Array.isArray(user.bonus.bonusDiscounts)) {
        user.bonus.bonusDiscounts.forEach((discount: any) => {
          if (discount.percentage) {
            totalDiscounts += bonusAmount * (discount.percentage / 100);
          } else if (discount.value) {
            totalDiscounts += discount.value;
          }
        });
      }

      const netBonus = bonusAmount - totalDiscounts;

      // If bonus amount is 0, show as "Sem bônus"
      if (bonusAmount === 0) {
        return (
          <div className="text-sm font-medium text-right text-muted-foreground">
            Sem bônus
          </div>
        );
      }

      return (
        <div className="text-sm font-medium tabular-nums text-right text-green-600">
          {formatCurrency(netBonus)}
        </div>
      );
    },
    sortable: true,
    className: "w-32",
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
  // Total Bruto (remuneration + gross bonus)
  {
    key: "totalEarnings",
    header: "TOTAL BRUTO",
    accessor: (user: PayrollUserRow, monthSpecificTasks?: number) => {
      // Get base remuneration from payroll
      const remuneration = user.baseRemuneration || 0;

      // Get gross bonus amount from bonus entity
      let bonus = 0;
      if (user.position?.bonifiable && user.bonus?.baseBonus !== undefined) {
        const baseBonus = user.bonus.baseBonus;
        bonus = typeof baseBonus === 'string' ? parseFloat(baseBonus) : (baseBonus || 0);
      }

      const total = remuneration + bonus;

      return (
        <div className="text-sm font-medium tabular-nums text-right">
          {formatCurrency(total)}
        </div>
      );
    },
    sortable: true,
    className: "w-32",
    align: "right",
  },
  // Total Líquido (remuneration + net bonus after discounts)
  {
    key: "totalNet",
    header: "TOTAL LÍQUIDO",
    accessor: (user: PayrollUserRow, monthSpecificTasks?: number) => {
      // Get base remuneration from payroll
      const remuneration = user.baseRemuneration || 0;

      // Get bonus and calculate net bonus
      let netBonus = 0;
      if (user.position?.bonifiable && user.bonus?.baseBonus !== undefined) {
        const baseBonus = user.bonus.baseBonus;
        let bonusAmount = typeof baseBonus === 'string' ? parseFloat(baseBonus) : (baseBonus || 0);

        // Calculate discounts
        let totalDiscounts = 0;
        if (user.bonus?.bonusDiscounts && Array.isArray(user.bonus.bonusDiscounts)) {
          user.bonus.bonusDiscounts.forEach((discount: any) => {
            if (discount.percentage) {
              totalDiscounts += bonusAmount * (discount.percentage / 100);
            } else if (discount.value) {
              totalDiscounts += discount.value;
            }
          });
        }

        netBonus = bonusAmount - totalDiscounts;
      }

      const totalNet = remuneration + netBonus;

      return (
        <div className="text-sm font-semibold tabular-nums text-right text-primary">
          {formatCurrency(totalNet)}
        </div>
      );
    },
    sortable: true,
    className: "w-32",
    align: "right",
  },
];

export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set([
    "payrollNumber",
    "user.name",
    "position.name",
    "sector.name",
    "bonus",
    "netBonus",
    "remuneration",
    "totalNet"
  ]);
};