import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import {
  IconUser,
  IconCurrencyReal,
  IconCalendar,
  IconDeviceFloppy,
  IconX,
  IconCalculator,
} from "@tabler/icons-react";
import { useUsers } from "../../../hooks";
import { formatCurrency } from "../../../utils";
import { payrollCreateSchema, payrollUpdateSchema } from "../../../schemas";
import type {
  PayrollCreateFormData,
  PayrollUpdateFormData
} from "../../../schemas";
import type { Payroll } from "../../../types";
import { toNumber } from "../../../types/common";
import { UserSelector } from "@/components/ui/user-selector";

interface PayrollFormProps {
  initialData?: Payroll;
  onSubmit: (data: PayrollCreateFormData | PayrollUpdateFormData) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function PayrollForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  className
}: PayrollFormProps) {
  const isEditing = !!initialData;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const [selectedUserId, setSelectedUserId] = useState(initialData?.userId || "");
  const [selectedMonth, setSelectedMonth] = useState(initialData?.month || currentMonth);

  // Form setup
  const form = useForm<PayrollCreateFormData | PayrollUpdateFormData>({
    resolver: zodResolver(isEditing ? payrollUpdateSchema : payrollCreateSchema),
    defaultValues: {
      userId: initialData?.userId || "",
      year: initialData?.year || currentYear,
      month: initialData?.month || currentMonth,
      baseRemuneration: toNumber(initialData?.baseRemuneration) || 0,
    }
  });

  // Fetch user data for the selected user
  const { data: usersResponse } = useUsers({
    where: { id: selectedUserId },
    include: {
      position: {
        include: { remunerations: true }
      },
      sector: true,
    }
  }, {
    enabled: !!selectedUserId
  });

  const selectedUser = usersResponse?.data?.[0];


  // Get base remuneration from user's position
  // Note: PositionRemuneration is deprecated, using monetaryValues instead
  const baseRemunerationFromPosition = selectedUser?.position?.monetaryValues?.find(
    (mv) => mv.current
  )?.value || selectedUser?.position?.remunerations?.[0]?.value || 0;

  // Update base remuneration when user changes
  React.useEffect(() => {
    if (baseRemunerationFromPosition > 0 && !isEditing) {
      form.setValue("baseRemuneration", baseRemunerationFromPosition);
    }
  }, [baseRemunerationFromPosition, isEditing, form]);

  // Calculate estimated net salary
  const watchedValues = form.watch();
  const baseRemuneration = watchedValues.baseRemuneration || 0;
  // Note: bonusId is not part of the form schema, bonuses are linked separately via payrollId
  const selectedBonus = initialData?.bonus;
  const bonusValue = toNumber(selectedBonus?.finalValue) || 0;
  const estimatedGrossSalary = baseRemuneration + bonusValue;

  const handleSubmit = (data: PayrollCreateFormData | PayrollUpdateFormData) => {
    onSubmit(data);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {isEditing ? "Editar Folha de Pagamento" : "Nova Folha de Pagamento"}
              </h2>
              <p className="text-muted-foreground">
                {isEditing
                  ? "Modifique os dados da folha de pagamento"
                  : "Crie uma nova folha de pagamento para um funcionário"
                }
              </p>
            </div>

            <div className="flex gap-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  <IconX className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={isLoading}>
                <IconDeviceFloppy className="h-4 w-4 mr-2" />
                {isLoading
                  ? "Salvando..."
                  : isEditing
                  ? "Salvar Alterações"
                  : "Criar Folha"
                }
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column - Basic Information */}
            <div className="space-y-6">
              {/* Employee Selection */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <IconUser className="h-5 w-5" />
                    <CardTitle>Funcionário</CardTitle>
                  </div>
                  <CardDescription>
                    Selecione o funcionário para a folha de pagamento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Funcionário</FormLabel>
                        <FormControl>
                          <UserSelector
                            value={field.value}
                            onChange={(userId) => {
                              field.onChange(userId);
                              setSelectedUserId(userId || "");
                            }}
                            placeholder="Selecione um funcionário"
                            disabled={isEditing} // Don't allow changing user in edit mode
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Display selected user info */}
                  {selectedUser && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <div className="grid gap-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Nome:</span>
                          <span className="text-sm">{selectedUser.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Setor:</span>
                          <span className="text-sm">{selectedUser.sector?.name || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Cargo:</span>
                          <span className="text-sm">{selectedUser.position?.name || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Period Selection */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <IconCalendar className="h-5 w-5" />
                    <CardTitle>Período</CardTitle>
                  </div>
                  <CardDescription>
                    Defina o período de referência da folha (26-25)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ano</FormLabel>
                          <FormControl>
                            <Select
                              value={String(field.value)}
                              onValueChange={(value) => {
                                const year = parseInt(value);
                                field.onChange(year);
                              }}
                              disabled={isEditing}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((year) => (
                                  <SelectItem key={year} value={String(year)}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="month"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mês</FormLabel>
                          <FormControl>
                            <Select
                              value={String(field.value)}
                              onValueChange={(value) => {
                                const month = parseInt(value);
                                field.onChange(month);
                                setSelectedMonth(month);
                              }}
                              disabled={isEditing}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                  <SelectItem key={month} value={String(month)}>
                                    {new Date(2024, month - 1).toLocaleDateString("pt-BR", {
                                      month: "long"
                                    })}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4 p-3 bg-muted rounded text-sm">
                    <strong>Período de referência:</strong> 26/{selectedMonth - 1 || 12} à 25/{selectedMonth}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Financial Information */}
            <div className="space-y-6">
              {/* Base Remuneration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <IconCurrencyReal className="h-5 w-5" />
                    <CardTitle>Remuneração Base</CardTitle>
                  </div>
                  <CardDescription>
                    Salário base do funcionário para o período
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="baseRemuneration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Base</FormLabel>
                        <FormControl>
                          <Input
                            type="currency"
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="R$ 0,00"
                          />
                        </FormControl>
                        <FormDescription>
                          {baseRemunerationFromPosition > 0 && (
                            <span className="text-sm text-muted-foreground">
                              Valor sugerido pelo cargo: {formatCurrency(baseRemunerationFromPosition)}
                            </span>
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Bonus Display (Read-only) */}
              {selectedBonus && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <IconCalculator className="h-5 w-5 text-green-600" />
                      <CardTitle>Bônus Vinculado</CardTitle>
                    </div>
                    <CardDescription>
                      Bônus já vinculado a esta folha de pagamento
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-medium text-green-800 mb-2">Detalhes do Bônus</h4>
                      <div className="grid gap-2 text-sm">
                        <div className="flex justify-between">
                          <span>Valor final:</span>
                          <span className="font-medium">{formatCurrency(toNumber(selectedBonus.finalValue))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Valor base:</span>
                          <span>{formatCurrency(toNumber(selectedBonus.baseValue))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Multiplicador:</span>
                          <span>{selectedBonus.multiplier || 1}x</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tarefas ponderadas:</span>
                          <span>{toNumber(selectedBonus.weightedTaskCount) || selectedBonus.weightedTaskCount || 0}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      * Bônus são gerenciados separadamente na seção de bônus
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Estimated Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <IconCalculator className="h-5 w-5" />
                    <CardTitle>Estimativa</CardTitle>
                  </div>
                  <CardDescription>
                    Cálculo estimado do salário bruto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Salário Base:</span>
                      <span>{formatCurrency(baseRemuneration)}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>+ Bônus:</span>
                      <span>{formatCurrency(bonusValue)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Salário Bruto:</span>
                      <span className="text-blue-600">{formatCurrency(estimatedGrossSalary)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      * Descontos podem ser aplicados posteriormente
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}