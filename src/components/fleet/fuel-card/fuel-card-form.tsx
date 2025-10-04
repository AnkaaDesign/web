import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, parseCurrency } from "../../../utils";
import { cn } from "@/lib/utils";
import {
  fuelCardCreateSchema,
  type FuelCardCreateFormData
} from "../../../schemas";
import {
  FUEL_CARD_STATUS,
  FUEL_CARD_TYPE,
  FUEL_CARD_PROVIDER,
  FUEL_CARD_STATUS_LABELS,
  FUEL_CARD_TYPE_LABELS,
  FUEL_CARD_PROVIDER_LABELS
} from "../../../constants";
import { useUsers, useVehicles } from "../../../hooks";
import { CreditCard, AlertTriangle, Car, User, DollarSign } from "lucide-react";

interface FuelCardFormProps {
  onSubmit: (data: FuelCardCreateFormData) => void | Promise<void>;
  defaultValues?: Partial<FuelCardCreateFormData>;
  isLoading?: boolean;
  isEdit?: boolean;
}

export function FuelCardForm({ onSubmit, defaultValues, isLoading, isEdit = false }: FuelCardFormProps) {
  const [cardNumberLength, setCardNumberLength] = useState(0);

  const { data: users } = useUsers({
    limit: 1000,
    orderBy: { name: "asc" },
    where: {
      status: "ACTIVE"
    }
  });

  const { data: vehicles } = useVehicles({
    limit: 1000,
    orderBy: { plate: "asc" },
    where: {
      status: "ACTIVE"
    }
  });

  const form = useForm<FuelCardCreateFormData>({
    resolver: zodResolver(fuelCardCreateSchema),
    defaultValues: {
      cardNumber: "",
      status: FUEL_CARD_STATUS.INACTIVE,
      type: FUEL_CARD_TYPE.GENERAL,
      provider: FUEL_CARD_PROVIDER.PETROBRAS,
      dailyLimit: undefined,
      monthlyLimit: undefined,
      assignedUserId: undefined,
      assignedVehicleId: undefined,
      isActive: false,
      ...defaultValues,
    },
    mode: "onChange",
  });

  // Watch form values for dynamic updates
  const currentCardNumber = form.watch("cardNumber");
  const currentStatus = form.watch("status");
  const currentType = form.watch("type");
  const currentProvider = form.watch("provider");
  const currentDailyLimit = form.watch("dailyLimit");
  const currentMonthlyLimit = form.watch("monthlyLimit");
  const currentAssignedUserId = form.watch("assignedUserId");
  const currentAssignedVehicleId = form.watch("assignedVehicleId");

  // Update card number length
  useEffect(() => {
    setCardNumberLength(currentCardNumber?.length || 0);
  }, [currentCardNumber]);

  const handleSubmit = async (data: FuelCardCreateFormData) => {
    try {
      // Validate card number length
      if (data.cardNumber.length < 8) {
        form.setError("cardNumber", {
          type: "minLength",
          message: "Número do cartão deve ter pelo menos 8 dígitos"
        });
        return;
      }

      // Validate limits if provided
      if (data.dailyLimit && data.monthlyLimit && data.dailyLimit * 30 > data.monthlyLimit) {
        form.setError("monthlyLimit", {
          type: "validation",
          message: "Limite mensal deve ser maior que 30x o limite diário"
        });
        return;
      }

      // Set isActive based on status
      data.isActive = data.status === FUEL_CARD_STATUS.ACTIVE;

      await onSubmit(data);
    } catch (error) {
      console.error("Erro ao salvar cartão de combustível:", error);
    }
  };

  // Helper function to get status badge
  const getStatusBadge = (status: string) => {
    const variants = {
      [FUEL_CARD_STATUS.ACTIVE]: "default" as const,
      [FUEL_CARD_STATUS.INACTIVE]: "secondary" as const,
      [FUEL_CARD_STATUS.SUSPENDED]: "destructive" as const,
      [FUEL_CARD_STATUS.EXPIRED]: "outline" as const,
      [FUEL_CARD_STATUS.BLOCKED]: "destructive" as const,
    };
    return (
      <Badge variant={variants[status as keyof typeof variants]} className="ml-2">
        {FUEL_CARD_STATUS_LABELS[status as keyof typeof FUEL_CARD_STATUS_LABELS]}
      </Badge>
    );
  };

  // Get assignment info for display
  const selectedUser = users?.data?.find(user => user.id === currentAssignedUserId);
  const selectedVehicle = vehicles?.data?.find(vehicle => vehicle.id === currentAssignedVehicleId);

  // Card number formatting
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 8) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
    if (cleaned.length <= 12) return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8)}`;
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)} ${cleaned.slice(12, 16)}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-4">
        <div className="flex items-center space-x-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <CardTitle>
            {isEdit ? "Editar Cartão de Combustível" : "Novo Cartão de Combustível"}
          </CardTitle>
        </div>
        {currentStatus && getStatusBadge(currentStatus)}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Card Information Section */}
            <div>
              <h3 className="text-lg font-medium mb-4">Informações do Cartão</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card Number */}
                <FormField
                  control={form.control}
                  name="cardNumber"
                  render={({ field, fieldState }) => {
                    const hasError = !!fieldState.error;
                    const isShort = field.value && field.value.length < 8;
                    const hasWarning = isShort;

                    return (
                      <FormItem>
                        <FormLabel>Número do Cartão *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              value={formatCardNumber(field.value || "")}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/\D/g, '');
                                if (cleaned.length <= 16) {
                                  field.onChange(cleaned);
                                }
                              }}
                              className={cn(
                                "pl-10 pr-10",
                                hasError && "border-destructive focus-visible:ring-destructive",
                                hasWarning && !hasError && "border-amber-500 focus-visible:ring-amber-500"
                              )}
                              placeholder="0000 0000 0000 0000"
                              title={
                                hasError
                                  ? fieldState.error?.message
                                  : hasWarning
                                    ? "Número do cartão muito curto"
                                    : undefined
                              }
                            />
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            {(hasError || hasWarning) && (
                              <AlertTriangle className={cn(
                                "absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4",
                                hasError ? "text-destructive" : "text-amber-500"
                              )} />
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                        {!hasError && hasWarning && (
                          <div className="text-xs text-amber-600 mt-1">
                            ⚠️ Número do cartão deve ter pelo menos 8 dígitos
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {cardNumberLength}/16 dígitos
                        </div>
                      </FormItem>
                    );
                  }}
                />

                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(FUEL_CARD_STATUS).map((status) => (
                            <SelectItem key={status} value={status}>
                              {FUEL_CARD_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Type */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(FUEL_CARD_TYPE).map((type) => (
                            <SelectItem key={type} value={type}>
                              {FUEL_CARD_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Provider */}
                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bandeira *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a bandeira" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(FUEL_CARD_PROVIDER).map((provider) => (
                            <SelectItem key={provider} value={provider}>
                              {FUEL_CARD_PROVIDER_LABELS[provider]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Limits Section */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span>Limites de Consumo</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Daily Limit */}
                <FormField
                  control={form.control}
                  name="dailyLimit"
                  render={({ field, fieldState }) => {
                    const hasError = !!fieldState.error;
                    const value = field.value;
                    const exceedsMax = value && value > 5000;
                    const belowMin = value && value < 50;
                    const hasWarning = exceedsMax || belowMin;

                    return (
                      <FormItem>
                        <FormLabel>Limite Diário</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              value={field.value ? formatCurrency(field.value) : ""}
                              onChange={(e) => {
                                try {
                                  const numericValue = parseCurrency(e.target.value);
                                  field.onChange(numericValue);
                                } catch (error) {
                                  console.warn("Invalid currency format:", e.target.value);
                                }
                              }}
                              className={cn(
                                "pl-8 pr-8",
                                hasError && "border-destructive focus-visible:ring-destructive",
                                hasWarning && !hasError && "border-amber-500 focus-visible:ring-amber-500"
                              )}
                              placeholder="R$ 0,00"
                              title={
                                hasError
                                  ? fieldState.error?.message
                                  : hasWarning
                                    ? "Atenção: verifique o valor inserido"
                                    : undefined
                              }
                            />
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            {(hasError || hasWarning) && (
                              <AlertTriangle className={cn(
                                "absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4",
                                hasError ? "text-destructive" : "text-amber-500"
                              )} />
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                        {!hasError && hasWarning && (
                          <div className="text-xs text-amber-600 mt-1">
                            {exceedsMax && "⚠️ Limite diário muito alto"}
                            {belowMin && "⚠️ Limite diário muito baixo"}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Limite recomendado: R$ 200 - R$ 1.000
                        </div>
                      </FormItem>
                    );
                  }}
                />

                {/* Monthly Limit */}
                <FormField
                  control={form.control}
                  name="monthlyLimit"
                  render={({ field, fieldState }) => {
                    const hasError = !!fieldState.error;
                    const value = field.value;
                    const dailyLimit = currentDailyLimit;
                    const exceedsRecommended = value && value > 50000;
                    const belowDaily = value && dailyLimit && value < dailyLimit * 15;
                    const hasWarning = exceedsRecommended || belowDaily;

                    return (
                      <FormItem>
                        <FormLabel>Limite Mensal</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              value={field.value ? formatCurrency(field.value) : ""}
                              onChange={(e) => {
                                try {
                                  const numericValue = parseCurrency(e.target.value);
                                  field.onChange(numericValue);
                                } catch (error) {
                                  console.warn("Invalid currency format:", e.target.value);
                                }
                              }}
                              className={cn(
                                "pl-8 pr-8",
                                hasError && "border-destructive focus-visible:ring-destructive",
                                hasWarning && !hasError && "border-amber-500 focus-visible:ring-amber-500"
                              )}
                              placeholder="R$ 0,00"
                              title={
                                hasError
                                  ? fieldState.error?.message
                                  : hasWarning
                                    ? "Atenção: verifique o valor inserido"
                                    : undefined
                              }
                            />
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            {(hasError || hasWarning) && (
                              <AlertTriangle className={cn(
                                "absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4",
                                hasError ? "text-destructive" : "text-amber-500"
                              )} />
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                        {!hasError && hasWarning && (
                          <div className="text-xs text-amber-600 mt-1">
                            {exceedsRecommended && "⚠️ Limite mensal muito alto"}
                            {belowDaily && "⚠️ Limite mensal parece baixo comparado ao diário"}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {dailyLimit ? `Sugerido: ~${formatCurrency(dailyLimit * 25)}` : "Limite recomendado: R$ 5.000 - R$ 25.000"}
                        </div>
                      </FormItem>
                    );
                  }}
                />
              </div>
            </div>

            <Separator />

            {/* Assignment Section */}
            <div>
              <h3 className="text-lg font-medium mb-4">Atribuição</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Assigned User */}
                <FormField
                  control={form.control}
                  name="assignedUserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>Usuário Responsável</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o usuário (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Nenhum usuário</SelectItem>
                          {users?.data?.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} {user.cpf && `(${user.cpf})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      {selectedUser && (
                        <div className="text-xs text-muted-foreground">
                          Selecionado: {selectedUser.name}
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                {/* Assigned Vehicle */}
                <FormField
                  control={form.control}
                  name="assignedVehicleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center space-x-2">
                        <Car className="h-4 w-4" />
                        <span>Veículo Atribuído</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o veículo (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Nenhum veículo</SelectItem>
                          {vehicles?.data?.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              {vehicle.plate} - {vehicle.model} ({vehicle.year})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      {selectedVehicle && (
                        <div className="text-xs text-muted-foreground">
                          Selecionado: {selectedVehicle.plate} - {selectedVehicle.model}
                        </div>
                      )}
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6">
              <Button type="submit" disabled={isLoading} className="min-w-[150px]">
                {isLoading ? "Salvando..." : isEdit ? "Atualizar Cartão" : "Criar Cartão"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}