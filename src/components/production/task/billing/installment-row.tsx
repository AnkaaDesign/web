import { TableRow, TableCell } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/utils';
import { InstallmentStatusBadge } from './installment-status-badge';
import { BankSlipStatusBadge } from './bank-slip-status-badge';
import { BoletoActions } from './boleto-actions';
import type { Installment } from '@/types/invoice';

interface InstallmentRowProps {
  installment: Installment;
}

export function InstallmentRow({ installment }: InstallmentRowProps) {
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
          receiptFile={installment.receiptFile}
        />
      </TableCell>
    </TableRow>
  );
}
