import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { formatCurrency } from "../../../../utils";
import type { BonusDiscount, Bonus } from "../../../../types";
import { IconTrash, IconEdit, IconCalculator } from "@tabler/icons-react";

interface BonusDiscountListProps {
  bonus: Bonus;
  discounts?: BonusDiscount[];
  onEdit?: (discount: BonusDiscount) => void;
  onDelete?: (discountId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function BonusDiscountList({
  bonus,
  discounts = [],
  onEdit,
  onDelete,
  isLoading = false,
  className
}: BonusDiscountListProps) {
  // Calculate discount amounts
  const discountsWithCalculations = discounts.map((discount) => {
    const calculatedAmount = discount.value || (bonus.baseBonus * (discount.percentage || 0) / 100);
    return {
      ...discount,
      calculatedAmount,
    };
  });

  const totalDiscountValue = discountsWithCalculations.reduce((total, discount) => {
    return total + discount.calculatedAmount;
  }, 0);

  const finalBonusAmount = Math.max(0, bonus.baseBonus - totalDiscountValue);

  const columns: StandardizedColumn<typeof discountsWithCalculations[0]>[] = [
    {
      key: "calculationOrder",
      title: "Ordem",
      sortable: true,
      render: (discount) => (
        <Badge variant="outline" className="w-12 justify-center">
          {discount.calculationOrder}
        </Badge>
      ),
    },
    {
      key: "reference",
      title: "Referência",
      sortable: true,
      render: (discount) => (
        <div className="font-medium">
          {discount.reference}
        </div>
      ),
    },
    {
      key: "type",
      title: "Tipo",
      render: (discount) => (
        <Badge variant={discount.percentage ? "secondary" : "outline"}>
          {discount.percentage ? `${discount.percentage}%` : "Valor Fixo"}
        </Badge>
      ),
    },
    {
      key: "value",
      title: "Valor Original",
      render: (discount) => {
        if (discount.percentage) {
          return (
            <span className="text-sm text-muted-foreground">
              {discount.percentage}% de {formatCurrency(bonus.baseBonus)}
            </span>
          );
        }
        return (
          <span className="font-medium">
            {formatCurrency(discount.value || 0)}
          </span>
        );
      },
    },
    {
      key: "calculatedAmount",
      title: "Desconto Aplicado",
      sortable: true,
      render: (discount) => (
        <span className="font-medium text-red-600">
          -{formatCurrency(discount.calculatedAmount)}
        </span>
      ),
    },
    {
      key: "actions",
      title: "Ações",
      render: (discount) => (
        <div className="flex items-center gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(discount)}
            >
              <IconEdit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(discount.id)}
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <p className="text-sm font-medium text-muted-foreground">Valor Base</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(bonus.baseBonus)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <p className="text-sm font-medium text-muted-foreground">Total de Descontos</p>
            <p className="text-2xl font-bold text-red-600">
              -{formatCurrency(totalDiscountValue)}
            </p>
            <p className="text-xs text-muted-foreground">
              {discounts.length} desconto(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <p className="text-sm font-medium text-muted-foreground">Valor Final</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(finalBonusAmount)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <IconCalculator className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {((finalBonusAmount / bonus.baseBonus) * 100).toFixed(1)}% do valor base
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Descontos Aplicados</CardTitle>
        </CardHeader>
        <CardContent>
          <StandardizedTable
            data={discountsWithCalculations}
            columns={columns}
            emptyMessage="Nenhum desconto aplicado"
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}