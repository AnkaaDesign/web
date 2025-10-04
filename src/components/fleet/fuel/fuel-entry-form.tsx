import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconGasStation, IconLoader2, IconArrowLeft, IconCheck, IconTruck, IconReceipt } from "@tabler/icons-react";
import type { FuelCreateFormData } from "../../../schemas";
import { fuelCreateSchema } from "../../../schemas";
import {
  FUEL_TYPE,
  FUEL_TRANSACTION_TYPE,
  FUEL_ENTRY_STATUS,
  FUEL_TYPE_LABELS,
  FUEL_TRANSACTION_TYPE_LABELS
} from "../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "../../../utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface FuelEntryFormProps {
  onSubmit: (data: FuelCreateFormData) => Promise<void>;
  vehicleId?: string;
  isLoading?: boolean;
}

export const FuelEntryForm = ({ onSubmit, vehicleId, isLoading = false }: FuelEntryFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const form = useForm<FuelCreateFormData>({
    resolver: zodResolver(fuelCreateSchema),
    defaultValues: {
      transactionType: FUEL_TRANSACTION_TYPE.REFUEL,
      fuelType: FUEL_TYPE.DIESEL,
      quantity: 0,
      pricePerLiter: 0,
      fuelDate: new Date(),
      vehicleId: vehicleId || "",
      status: FUEL_ENTRY_STATUS.PENDING,
      location: "",
      notes: "",
      receiptNumber: "",
      supplier: "",
    },
  });

  const watchedQuantity = form.watch("quantity");
  const watchedPricePerLiter = form.watch("pricePerLiter");
  const totalCost = watchedQuantity && watchedPricePerLiter ? watchedQuantity * watchedPricePerLiter : 0;

  const handleSubmit = async (data: FuelCreateFormData) => {
    try {
      setIsSubmitting(true);

      // Calculate total cost
      const dataWithTotal = {
        ...data,
        totalCost: data.quantity * data.pricePerLiter,
      };

      await onSubmit(dataWithTotal);
      toast.success("Abastecimento registrado com sucesso!");
      navigate("/fleet/fuel");
    } catch (error) {
      console.error("Erro ao registrar abastecimento:", error);
      toast.error("Erro ao registrar abastecimento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/fleet/fuel");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Registrar Abastecimento"
        subtitle="Registre um novo abastecimento de combustível"
        icon={<IconGasStation className="w-6 h-6" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              <IconArrowLeft className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={form.handleSubmit(handleSubmit)}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? (
                <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <IconCheck className="w-4 h-4 mr-2" />
              )}
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconGasStation className="w-5 h-5" />
                  Informações Básicas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="transactionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Transação</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(FUEL_TRANSACTION_TYPE).map((type) => (
                            <SelectItem key={type} value={type}>
                              {FUEL_TRANSACTION_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fuelType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Combustível</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o combustível" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(FUEL_TYPE).map((type) => (
                            <SelectItem key={type} value={type}>
                              {FUEL_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fuelDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data do Abastecimento</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ""}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Veículo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ID do veículo"
                          {...field}
                          disabled={!!vehicleId}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Quantity and Cost */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconReceipt className="w-5 h-5" />
                  Quantidade e Custo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade (Litros)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1000"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pricePerLiter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço por Litro (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          max="50"
                          placeholder="0.000"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {totalCost > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total:</span>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(totalCost)}
                      </span>
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="odometer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Odômetro (km)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="9999999"
                          placeholder="Ex: 123456"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Adicionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local do Abastecimento</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Posto Ipiranga, Rua X"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fornecedor/Posto</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Ipiranga, Shell, BR"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="receiptNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do Recibo/Nota</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: NF-123456"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações adicionais sobre o abastecimento..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
};