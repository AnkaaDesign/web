import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/utils';
import { formatInstallmentPaymentForm } from '@/utils/installment-payment-method';
import { InstallmentStatusBadge } from './installment-status-badge';
import { BankSlipStatusBadge } from './bank-slip-status-badge';
import { BoletoActions } from './boleto-actions';
import type { Installment } from '@/types/invoice';

interface InstallmentRowProps {
  installment: Installment;
}

export function InstallmentRow({ installment }: InstallmentRowProps) {
  const paymentForm = formatInstallmentPaymentForm(installment.paymentMethod, !!installment.bankSlip);
  return (
    <TableRow>
      <TableCell className="font-medium">
        {installment.number}
      </TableCell>
      <TableCell>
        {formatDate(installment.dueDate)}
      </TableCell>
      <TableCell>
        {formatCurrency(installment.amount)}
      </TableCell>
      <TableCell>
        {installment.paidAmount > 0 && formatCurrency(installment.paidAmount)}
      </TableCell>
      <TableCell>
        <InstallmentStatusBadge status={installment.status} size="sm" />
      </TableCell>
      <TableCell>
        {paymentForm ? (
          <Badge variant="secondary" size="sm" className="font-medium whitespace-nowrap">
            {paymentForm}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {installment.bankSlip && (
          <BankSlipStatusBadge status={installment.bankSlip.status} size="sm" />
        )}
      </TableCell>
      <TableCell>
        <BoletoActions
          installmentId={installment.id}
          bankSlip={installment.bankSlip}
          dueDate={installment.dueDate}
          installmentStatus={installment.status}
          installmentPaymentMethod={installment.paymentMethod}
          receiptFiles={installment.receiptFiles}
          observations={installment.observations}
        />
      </TableCell>
    </TableRow>
  );
}
