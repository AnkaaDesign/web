import { Expense } from "../../../types";
import { EXPENSE_CATEGORY_LABELS } from "../../../constants";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "../../../utils";
import { IconCalendar, IconUser, IconReceipt, IconBuilding } from "@tabler/icons-react";
import { ExpenseStatusBadge } from "./expense-status-badge";

interface ExpenseCardProps {
  expense: Expense;
  onClick?: () => void;
}

export function ExpenseCard({ expense, onClick }: ExpenseCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg leading-none tracking-tight">
              {expense.description}
            </h3>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(expense.amount)}
            </p>
          </div>
          <ExpenseStatusBadge status={expense.status} />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Category */}
          <div className="flex items-center justify-between">
            <Badge variant="outline">
              {EXPENSE_CATEGORY_LABELS[expense.category]}
            </Badge>
            {expense.paymentMethod && (
              <span className="text-sm text-muted-foreground">
                {expense.paymentMethod}
              </span>
            )}
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <IconCalendar className="h-3 w-3" />
              {formatDate(expense.expenseDate)}
            </div>

            {expense.user && (
              <div className="flex items-center gap-1">
                <IconUser className="h-3 w-3" />
                {expense.user.name}
              </div>
            )}

            {expense.receiptNumber && (
              <div className="flex items-center gap-1">
                <IconReceipt className="h-3 w-3" />
                #{expense.receiptNumber}
              </div>
            )}

            {expense.vendor && (
              <div className="flex items-center gap-1">
                <IconBuilding className="h-3 w-3" />
                {expense.vendor}
              </div>
            )}
          </div>

          {/* Notes */}
          {expense.notes && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {expense.notes}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}