import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconCreditCard, IconPlus } from "@tabler/icons-react";
import { useUserLoans } from "../../hooks";
import { useAuth } from "@/contexts/auth-context";
import { SECTOR_PRIVILEGES } from "../../constants";
import { formatCurrency } from "../../utils";
import type { Discount } from "../../types";
import { EmployeeLoanDialog } from "../human-resources/payroll/employee-loan-dialog";

interface CollaboratorLoansCardProps {
  userId: string;
  className?: string;
}

const toNumber = (value: number | string | { toNumber(): number } | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && typeof value.toNumber === "function") return value.toNumber();
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const typeLabel = (discountType?: string): string => {
  if (discountType === "ADVANCE") return "Adiantamento";
  return "Empréstimo";
};

/** Formats "YYYY-MM" into "MM/YYYY"; passes through anything else. */
const formatCompetence = (competence?: string | null): string => {
  if (!competence) return "-";
  const match = /^(\d{4})-(\d{2})$/.exec(competence);
  return match ? `${match[2]}/${match[1]}` : competence;
};

/**
 * Empréstimos / Adiantamentos — employee-anchored persistent discounts that the
 * API auto-applies to every future folha (POST /discount/loan). Lists the
 * colaborador's loans and lets HR/ADMIN/Contabilidade register new ones.
 */
export function CollaboratorLoansCard({ userId, className }: CollaboratorLoansCardProps) {
  const { user: currentUser } = useAuth();
  const privileges = currentUser?.sector?.privileges;
  const canRegister =
    privileges === SECTOR_PRIVILEGES.ADMIN ||
    privileges === SECTOR_PRIVILEGES.HUMAN_RESOURCES ||
    privileges === SECTOR_PRIVILEGES.ACCOUNTING;

  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: loans = [], isLoading, refetch } = useUserLoans(userId);

  const loanRows = (Array.isArray(loans) ? (loans as Discount[]) : []).filter(
    (d) => d.discountType === "LOAN" || d.discountType === "ADVANCE",
  );

  // Só exibe a seção quando há empréstimos/adiantamentos — oculta enquanto carrega e quando vazia.
  if (isLoading || loanRows.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconCreditCard className="h-5 w-5 text-muted-foreground" />
          Empréstimos / Adiantamentos
        </CardTitle>
        {canRegister && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <IconPlus className="h-4 w-4 mr-2" />
            Registrar Empréstimo
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Carregando...</p>
        ) : loanRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhum empréstimo ou adiantamento registrado para este colaborador.
          </p>
        ) : (
          <div className="divide-y divide-border/50">
            {loanRows.map((loan) => {
              const total = loan.totalInstallments ?? null;
              const current = loan.currentInstallment ?? 1;
              const parcela = toNumber(loan.value);
              const isActive = loan.isActive !== false;
              return (
                <div key={loan.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {loan.reference || typeLabel(loan.discountType)}
                      </span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {typeLabel(loan.discountType)}
                      </Badge>
                      {!isActive && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          Quitado/Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {total ? `Parcela ${current}/${total}` : `Parcela ${current}`}
                      {" · "}Início {formatCompetence(loan.startCompetence)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(parcela)}</p>
                    <p className="text-[10px] text-muted-foreground">por mês</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {canRegister && (
        <EmployeeLoanDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={userId}
          onSaved={() => refetch()}
        />
      )}
    </Card>
  );
}
