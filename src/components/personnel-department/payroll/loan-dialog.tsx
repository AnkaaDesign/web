import { useEffect, useMemo, useState } from "react";
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
import { IconInfoCircle, IconLoader2 } from "@tabler/icons-react";
import { usePayrollDiscountMutations } from "../../../hooks";
import { formatCurrency } from "../../../utils";

/**
 * Loan (consignado) discount shape used by this dialog.
 * Mirrors the PayrollDiscount API model (only the fields we touch).
 */
export interface LoanDiscountRow {
  id: string;
  reference: string;
  value: number | string | null;
  discountType?: string;
  isPersistent?: boolean;
  isActive?: boolean;
  totalInstallments?: number | null;
  currentInstallment?: number | null;
}

interface LoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saved payroll UUID. Loans can only be registered on saved payrolls. */
  payrollId: string;
  /** When provided, the dialog edits this existing loan instead of creating one. */
  loan?: LoanDiscountRow | null;
  /** Called after a successful create/update/cancel so the caller can refetch. */
  onSaved?: () => void;
}

const toNumber = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Dialog to register or edit a consignado/empréstimo (LOAN payroll discount).
 *
 * Creates a persistent discount that the API automatically copies month to
 * month, advancing `currentInstallment` and deactivating it once the last
 * installment is charged.
 */
export function LoanDialog({ open, onOpenChange, payrollId, loan, onSaved }: LoanDialogProps) {
  const isEditing = !!loan;

  const { addDiscountAsync, updateDiscountAsync, isLoading } = usePayrollDiscountMutations();

  // Form state
  const [reference, setReference] = useState("");
  const [totalValue, setTotalValue] = useState<number | null>(null);
  const [installments, setInstallments] = useState<number>(1);
  const [installmentValue, setInstallmentValue] = useState<number | null>(null);
  const [installmentValueTouched, setInstallmentValueTouched] = useState(false);
  const [currentInstallment, setCurrentInstallment] = useState<number>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize/reset form when the dialog opens
  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    if (loan) {
      const parcela = toNumber(loan.value);
      const total = loan.totalInstallments ?? 1;
      setReference(loan.reference || "");
      setInstallments(total);
      setInstallmentValue(parcela || null);
      setTotalValue(parcela > 0 ? Math.round(parcela * total * 100) / 100 : null);
      setCurrentInstallment(loan.currentInstallment ?? 1);
      setInstallmentValueTouched(true);
    } else {
      setReference("");
      setTotalValue(null);
      setInstallments(1);
      setInstallmentValue(null);
      setCurrentInstallment(1);
      setInstallmentValueTouched(false);
    }
  }, [open, loan]);

  // Auto-compute installment value from total/installments unless manually edited
  useEffect(() => {
    if (installmentValueTouched) return;
    if (totalValue && totalValue > 0 && installments >= 1) {
      setInstallmentValue(Math.round((totalValue / installments) * 100) / 100);
    }
  }, [totalValue, installments, installmentValueTouched]);

  const isValid = useMemo(() => {
    return (
      reference.trim().length > 0 &&
      installments >= 1 &&
      installmentValue !== null &&
      installmentValue > 0 &&
      (!isEditing || (currentInstallment >= 1 && currentInstallment <= installments))
    );
  }, [reference, installments, installmentValue, currentInstallment, isEditing]);

  const handleSubmit = async () => {
    if (!isValid || installmentValue === null) return;
    setSubmitError(null);

    try {
      if (isEditing && loan) {
        await updateDiscountAsync({
          payrollId,
          discountId: loan.id,
          discount: {
            reference: reference.trim(),
            value: installmentValue,
            totalInstallments: installments,
            currentInstallment,
          },
        });
      } else {
        await addDiscountAsync({
          payrollId,
          discount: {
            reference: reference.trim(),
            discountType: "LOAN",
            value: installmentValue,
            isPersistent: true,
            totalInstallments: installments,
            currentInstallment: 1,
          },
        });
      }
      onOpenChange(false);
      onSaved?.();
    } catch (error: any) {
      // The axios interceptor already shows an error toast; keep an inline hint too
      setSubmitError(error?.response?.data?.message || "Erro ao salvar o empréstimo.");
    }
  };

  const handleCancelLoan = async () => {
    if (!loan) return;
    setSubmitError(null);
    try {
      await updateDiscountAsync({
        payrollId,
        discountId: loan.id,
        discount: { isActive: false },
      });
      onOpenChange(false);
      onSaved?.();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.message || "Erro ao cancelar o empréstimo.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Empréstimo" : "Registrar Empréstimo"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere os dados do empréstimo consignado deste colaborador."
              : "Registre um empréstimo/consignado descontado em folha para este colaborador."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="loan-reference">
              Descrição <span className="text-destructive">*</span>
            </Label>
            <Input
              id="loan-reference"
              type="text"
              value={reference}
              onChange={(value) => setReference(typeof value === "string" ? value : "")}
              placeholder="Ex.: Empréstimo consignado - Banco X"
              maxLength={200}
            />
          </div>

          {!isEditing && (
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
          )}

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
                  if (!isEditing) setInstallmentValueTouched(false);
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

          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="loan-current-installment">Parcela atual</Label>
              <Input
                id="loan-current-installment"
                type="integer"
                min={1}
                max={installments}
                value={currentInstallment}
                onChange={(value) => {
                  const parsed = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
                  setCurrentInstallment(Number.isFinite(parsed) && parsed >= 1 ? parsed : 1);
                }}
              />
            </div>
          )}

          {!isEditing && installmentValue !== null && installmentValue > 0 && installments >= 1 && (
            <p className="text-sm text-muted-foreground">
              {installments}x de <span className="font-medium text-foreground">{formatCurrency(installmentValue)}</span>
              {" "}(total {formatCurrency(Math.round(installmentValue * installments * 100) / 100)})
            </p>
          )}

          <Alert>
            <IconInfoCircle className="h-4 w-4" />
            <AlertDescription>
              O desconto se repete automaticamente nas próximas folhas, avançando a parcela a cada
              mês até a quitação.
            </AlertDescription>
          </Alert>

          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {isEditing && loan?.isActive !== false && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelLoan}
              disabled={isLoading}
              className="mr-auto"
            >
              Cancelar Empréstimo
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Fechar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!isValid || isLoading}>
            {isLoading && <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
