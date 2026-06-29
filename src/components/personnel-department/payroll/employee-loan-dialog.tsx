import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconInfoCircle, IconLoader2 } from "@tabler/icons-react";
import { useRegisterLoan } from "../../../hooks";
import { getUsers } from "../../../api-client";
import { formatCurrency } from "../../../utils";
import { EMPLOYEE_TYPE, CONTRACT_STATUS } from "../../../constants";

type LoanKind = "COMPANY" | "PAYROLL_CONSIGNED";

interface EmployeeLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Colaborador the loan is anchored to. When omitted, the dialog renders a
   * colaborador search selector at the top of the form.
   */
  userId?: string;
  /** Called after a successful registration so the caller can refetch. */
  onSaved?: () => void;
}

/** Convert a Date to the "YYYY-MM" competence string (day is irrelevant). */
function dateToCompetence(date: Date | null): string {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Registers an employee-anchored loan/advance (POST /discount/loan). Creates a
 * master persistent discount that the API auto-applies to every future folha,
 * advancing the installment each month until quitação (35% consignável is
 * enforced server-side).
 */
export function EmployeeLoanDialog({ open, onOpenChange, userId, onSaved }: EmployeeLoanDialogProps) {
  const registerLoan = useRegisterLoan();

  // When userId is not provided, the dialog shows a colaborador selector.
  const showUserSelector = !userId;

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<"LOAN" | "ADVANCE">("LOAN");
  const [loanKind, setLoanKind] = useState<LoanKind>("COMPANY");
  const [lenderName, setLenderName] = useState("");
  const [description, setDescription] = useState("");
  const [totalValue, setTotalValue] = useState<number | null>(null);
  const [installments, setInstallments] = useState<number>(1);
  const [installmentValue, setInstallmentValue] = useState<number | null>(null);
  const [installmentValueTouched, setInstallmentValueTouched] = useState(false);
  const [competenceDate, setCompetenceDate] = useState<Date | null>(new Date());
  const [submitError, setSubmitError] = useState<string | null>(null);

  const startCompetence = useMemo(() => dateToCompetence(competenceDate), [competenceDate]);

  // The effective colaborador id: the fixed prop, or the one picked in the selector.
  const effectiveUserId = userId ?? selectedUserId ?? undefined;

  // Reset the form whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setSelectedUserId(null);
    setDiscountType("LOAN");
    setLoanKind("COMPANY");
    setLenderName("");
    setDescription("");
    setTotalValue(null);
    setInstallments(1);
    setInstallmentValue(null);
    setInstallmentValueTouched(false);
    setCompetenceDate(new Date());
  }, [open]);

  // Async colaborador search for the optional selector (same pattern as the
  // employee-cost calculator / salary-adjustment tools).
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const pageSize = 50;
      const response = await getUsers({
        take: pageSize,
        skip: (page - 1) * pageSize,
        where: {
          currentContractStatus: CONTRACT_STATUS.ACTIVE,
          currentEmployeeType: EMPLOYEE_TYPE.CLT, // Loans/folha discounts are CLT-only
          ...(searchTerm
            ? {
                OR: [
                  { name: { contains: searchTerm, mode: "insensitive" } },
                  { email: { contains: searchTerm, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { name: "asc" },
        include: { position: true },
      });

      const users = response.data ?? [];
      const total = response.meta?.totalRecords ?? 0;
      const hasMore = page * pageSize < total;

      return {
        data: users.map((u: any) => ({
          value: u.id,
          label: u.name,
          description: u.position?.name ?? "Sem cargo",
        })) as ComboboxOption[],
        hasMore,
        total,
      };
    } catch {
      return { data: [], hasMore: false };
    }
  }, []);

  // Auto-compute installment value from total/installments unless manually edited
  useEffect(() => {
    if (installmentValueTouched) return;
    if (totalValue && totalValue > 0 && installments >= 1) {
      setInstallmentValue(Math.round((totalValue / installments) * 100) / 100);
    }
  }, [totalValue, installments, installmentValueTouched]);

  const isValidCompetence = /^\d{4}-(0[1-9]|1[0-2])$/.test(startCompetence);

  const isValid = useMemo(() => {
    return (
      !!effectiveUserId &&
      installments >= 1 &&
      installments <= 120 &&
      installmentValue !== null &&
      installmentValue > 0 &&
      isValidCompetence
    );
  }, [effectiveUserId, installments, installmentValue, isValidCompetence]);

  const handleSubmit = async () => {
    if (!isValid || installmentValue === null || !effectiveUserId) return;
    setSubmitError(null);
    const isConsigned = loanKind === "PAYROLL_CONSIGNED";
    try {
      await registerLoan.mutateAsync({
        userId: effectiveUserId,
        value: installmentValue,
        totalInstallments: installments,
        startCompetence,
        discountType,
        loanKind,
        lenderName: isConsigned ? lenderName.trim() || undefined : undefined,
        description: description.trim() || undefined,
      });
      onOpenChange(false);
      onSaved?.();
    } catch (error: any) {
      // The axios interceptor already shows an error toast; keep an inline hint too
      setSubmitError(error?.response?.data?.message || "Erro ao registrar o empréstimo.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Empréstimo / Adiantamento</DialogTitle>
          <DialogDescription>
            Registre um empréstimo/consignado ou adiantamento descontado automaticamente nas folhas
            deste colaborador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showUserSelector && (
            <div className="space-y-2">
              <Label>
                Colaborador <span className="text-destructive">*</span>
              </Label>
              <Combobox
                async
                queryKey={["employee-loan", "user-search"]}
                queryFn={queryUsers}
                minSearchLength={0}
                pageSize={50}
                debounceMs={300}
                value={selectedUserId ?? undefined}
                onValueChange={(v) => setSelectedUserId(Array.isArray(v) ? (v[0] ?? null) : (v ?? null))}
                placeholder="Buscar colaborador..."
                emptyText="Nenhum colaborador encontrado"
                searchable
                clearable
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modalidade</Label>
              <Combobox
                value={loanKind}
                onValueChange={(value) => setLoanKind((Array.isArray(value) ? value[0] : value) as LoanKind)}
                options={[
                  { value: "COMPANY", label: "Empréstimo da empresa" },
                  { value: "PAYROLL_CONSIGNED", label: "Consignado em folha" },
                ]}
                searchable={false}
                clearable={false}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Combobox
                value={discountType}
                onValueChange={(value) => setDiscountType((Array.isArray(value) ? value[0] : value) as "LOAN" | "ADVANCE")}
                options={[
                  { value: "LOAN", label: "Empréstimo" },
                  { value: "ADVANCE", label: "Adiantamento" },
                ]}
                searchable={false}
                clearable={false}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Competência inicial <span className="text-destructive">*</span>
            </Label>
            <DateTimeInput
              mode="date"
              value={competenceDate}
              onChange={(date) => setCompetenceDate(date instanceof Date ? date : null)}
              hideLabel
              placeholder="Selecione o mês inicial"
              className="w-full"
            />
          </div>

          {loanKind === "PAYROLL_CONSIGNED" && (
            <div className="space-y-2">
              <Label htmlFor="loan-lender">Banco / Credor</Label>
              <Input
                id="loan-lender"
                type="text"
                value={lenderName}
                onChange={(value) => setLenderName(typeof value === "string" ? value : "")}
                placeholder="Ex.: Banco X"
                maxLength={200}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="loan-description">Descrição</Label>
            <Input
              id="loan-description"
              type="text"
              value={description}
              onChange={(value) => setDescription(typeof value === "string" ? value : "")}
              placeholder="Ex.: Empréstimo consignado - Banco X"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="loan-total">Valor total</Label>
            <Input
              id="loan-total"
              type="currency"
              value={totalValue}
              onChange={(value) => {
                setTotalValue(typeof value === "number" ? value : null);
                setInstallmentValueTouched(false);
              }}
              placeholder="R$ 0,00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loan-installments">
                Número de parcelas <span className="text-destructive">*</span>
              </Label>
              <Input
                id="loan-installments"
                type="integer"
                min={1}
                max={120}
                value={installments}
                onChange={(value) => {
                  const parsed = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
                  setInstallments(Number.isFinite(parsed) && parsed >= 1 ? parsed : 1);
                  setInstallmentValueTouched(false);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-installment-value">
                Valor da parcela <span className="text-destructive">*</span>
              </Label>
              <Input
                id="loan-installment-value"
                type="currency"
                value={installmentValue}
                onChange={(value) => {
                  setInstallmentValue(typeof value === "number" ? value : null);
                  setInstallmentValueTouched(true);
                }}
                placeholder="R$ 0,00"
              />
            </div>
          </div>

          {installmentValue !== null && installmentValue > 0 && installments >= 1 && (
            <p className="text-sm text-muted-foreground">
              {installments}x de <span className="font-medium text-foreground">{formatCurrency(installmentValue)}</span>
              {" "}(total {formatCurrency(Math.round(installmentValue * installments * 100) / 100)})
            </p>
          )}

          <Alert>
            <IconInfoCircle className="h-4 w-4" />
            <AlertDescription>
              O desconto se aplica automaticamente a partir da competência informada e se repete nas
              próximas folhas, avançando a parcela a cada mês até a quitação. O limite de 35%
              consignável é validado pelo sistema.
            </AlertDescription>
          </Alert>

          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={registerLoan.isPending}>
            Fechar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!isValid || registerLoan.isPending}>
            {registerLoan.isPending && <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
