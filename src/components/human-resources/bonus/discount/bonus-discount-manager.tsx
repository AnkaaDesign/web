import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { formatCurrency } from "../../../../utils";
import { bonusDiscountCreateSchema } from "../../../../schemas";
import type { BonusDiscountCreateFormData, BonusDiscount, Task, Bonus } from "../../../../types";
import { IconPlus, IconTrash, IconAlertTriangle } from "@tabler/icons-react";

interface BonusDiscountManagerProps {
  bonus: Bonus;
  discounts?: BonusDiscount[];
  suspendedTasks?: Task[];
  availableTasks?: Task[];
  onAddDiscount: (data: BonusDiscountCreateFormData) => Promise<void>;
  onRemoveDiscount: (discountId: string) => Promise<void>;
  onAddSuspendedTask: (taskId: string) => Promise<void>;
  onRemoveSuspendedTask: (taskId: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export function BonusDiscountManager({
  bonus,
  discounts = [],
  suspendedTasks = [],
  availableTasks = [],
  onAddDiscount,
  onRemoveDiscount,
  onAddSuspendedTask,
  onRemoveSuspendedTask,
  isLoading = false,
  className
}: BonusDiscountManagerProps) {
  const [activeTab, setActiveTab] = useState<"discounts" | "suspended">("discounts");

  const form = useForm<BonusDiscountCreateFormData>({
    resolver: zodResolver(bonusDiscountCreateSchema),
    defaultValues: {
      bonusId: bonus.id,
      calculationOrder: discounts.length + 1,
    },
  });

  const watchedValues = form.watch();

  const handleSubmit = async (data: BonusDiscountCreateFormData) => {
    await onAddDiscount(data);
    form.reset({
      bonusId: bonus.id,
      calculationOrder: discounts.length + 2,
    });
  };

  // Calculate total discount amount
  const totalDiscountValue = discounts.reduce((total, discount) => {
    if (discount.value) {
      return total + discount.value;
    }
    if (discount.percentage) {
      return total + (bonus.baseBonus * discount.percentage / 100);
    }
    return total;
  }, 0);

  const finalBonusAmount = Math.max(0, bonus.baseBonus - totalDiscountValue);

  // Discount table columns
  const discountColumns: StandardizedColumn<BonusDiscount>[] = [
    {
      key: "reference",
      title: "Referência",
      render: (discount) => (
        <div className="font-medium">
          {discount.reference}
        </div>
      ),
    },
    {
      key: "percentage",
      title: "Tipo",
      render: (discount) => (
        <Badge variant={discount.percentage ? "secondary" : "outline"}>
          {discount.percentage ? `${discount.percentage}%` : "Valor Fixo"}
        </Badge>
      ),
    },
    {
      key: "value",
      title: "Desconto",
      render: (discount) => {
        const discountAmount = discount.value || (bonus.baseBonus * (discount.percentage || 0) / 100);
        return (
          <span className="font-medium text-red-600">
            -{formatCurrency(discountAmount)}
          </span>
        );
      },
    },
    {
      key: "calculationOrder",
      title: "Ordem",
      render: (discount) => (
        <Badge variant="outline">
          {discount.calculationOrder}
        </Badge>
      ),
    },
    {
      key: "actions",
      title: "Ações",
      render: (discount) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemoveDiscount(discount.id)}
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // Suspended tasks table columns
  const suspendedTaskColumns: StandardizedColumn<Task>[] = [
    {
      key: "name",
      title: "Tarefa",
      render: (task) => (
        <div className="font-medium">
          {task.name}
        </div>
      ),
    },
    {
      key: "customer.name",
      title: "Cliente",
      render: (task) => task.customer?.name || "N/A",
    },
    {
      key: "price",
      title: "Valor",
      render: (task) => formatCurrency(task.price || 0),
    },
    {
      key: "actions",
      title: "Ações",
      render: (task) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemoveSuspendedTask(task.id)}
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo da Bonificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Valor Base</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(bonus.baseBonus)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Total de Descontos</p>
              <p className="text-2xl font-bold text-red-600">
                -{formatCurrency(totalDiscountValue)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Valor Final</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(finalBonusAmount)}
              </p>
            </div>
          </div>

          {suspendedTasks.length > 0 && (
            <Alert>
              <IconAlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {suspendedTasks.length} tarefa(s) suspensa(s) não contabilizada(s) na bonificação
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === "discounts"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600"
          }`}
          onClick={() => setActiveTab("discounts")}
        >
          Descontos
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === "suspended"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-600"
          }`}
          onClick={() => setActiveTab("suspended")}
        >
          Tarefas Suspensas
        </button>
      </div>

      {/* Discounts Tab */}
      {activeTab === "discounts" && (
        <div className="space-y-6">
          {/* Add Discount Form */}
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Desconto</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="reference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Referência</FormLabel>
                          <FormControl>
                            <Input placeholder="Motivo do desconto..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="percentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Percentual (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value ? Number(e.target.value) : undefined;
                                field.onChange(value);
                                if (value !== undefined) {
                                  form.setValue("value", undefined);
                                }
                              }}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor Fixo (R$)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value ? Number(e.target.value) : undefined;
                                field.onChange(value);
                                if (value !== undefined) {
                                  form.setValue("percentage", undefined);
                                }
                              }}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-end">
                      <Button type="submit" disabled={isLoading}>
                        <IconPlus className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                    </div>
                  </div>

                  {(watchedValues.percentage || watchedValues.value) && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        Desconto calculado: {" "}
                        <span className="text-red-600">
                          -{formatCurrency(
                            watchedValues.value ||
                            (bonus.baseBonus * (watchedValues.percentage || 0) / 100)
                          )}
                        </span>
                      </p>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Discounts List */}
          <Card>
            <CardHeader>
              <CardTitle>Descontos Aplicados</CardTitle>
            </CardHeader>
            <CardContent>
              <StandardizedTable
                data={discounts}
                columns={discountColumns}
                emptyMessage="Nenhum desconto aplicado"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Suspended Tasks Tab */}
      {activeTab === "suspended" && (
        <div className="space-y-6">
          {/* Add Suspended Task */}
          <Card>
            <CardHeader>
              <CardTitle>Suspender Tarefa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Select onValueChange={onAddSuspendedTask}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma tarefa para suspender..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.name} - {task.customer?.name} - {formatCurrency(task.price || 0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Tarefas suspensas não são contabilizadas no cálculo da bonificação
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Suspended Tasks List */}
          <Card>
            <CardHeader>
              <CardTitle>Tarefas Suspensas</CardTitle>
            </CardHeader>
            <CardContent>
              <StandardizedTable
                data={suspendedTasks}
                columns={suspendedTaskColumns}
                emptyMessage="Nenhuma tarefa suspensa"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}