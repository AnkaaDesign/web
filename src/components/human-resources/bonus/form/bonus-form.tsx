import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "../../../../utils";
import { bonusCreateSchema, bonusUpdateSchema } from "../../../../schemas";
import type { BonusCreateFormData, BonusUpdateFormData } from "../../../../schemas";
import type { Bonus, User } from "../../../../types";
import { IconDeviceFloppy, IconX, IconCurrencyDollar } from "@tabler/icons-react";

interface BonusFormProps {
  bonus?: Bonus;
  users?: User[];
  isLoading?: boolean;
  onSubmit: (data: BonusCreateFormData | BonusUpdateFormData) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

export function BonusForm({
  bonus,
  users = [],
  isLoading = false,
  onSubmit,
  onCancel,
  className
}: BonusFormProps) {
  const isEdit = !!bonus;
  const schema = isEdit ? bonusUpdateSchema : bonusCreateSchema;

  const form = useForm<BonusCreateFormData | BonusUpdateFormData>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          year: bonus.year,
          month: bonus.month,
          userId: bonus.userId,
          performanceLevel: bonus.performanceLevel,
          baseBonus: typeof bonus.baseBonus === 'number' ? bonus.baseBonus : bonus.baseBonus.toNumber(),
        }
      : {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          performanceLevel: 0,
          baseBonus: 0,
        },
  });

  const watchedValues = form.watch();

  const handleSubmit = async (data: BonusCreateFormData | BonusUpdateFormData) => {
    await onSubmit(data);
  };

  const generateMonthOptions = () => {
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    return monthNames.map((name, index) => ({
      value: (index + 1).toString(),
      label: `${index + 1} - ${name}`,
    }));
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];

    for (let year = currentYear - 2; year <= currentYear + 1; year++) {
      years.push({
        value: year.toString(),
        label: year.toString(),
      });
    }

    return years;
  };

  const generatePerformanceLevels = () => {
    return Array.from({ length: 11 }, (_, i) => ({
      value: i.toString(),
      label: i === 0 ? "0 - Sem bonificação" : `${i}`,
    }));
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCurrencyDollar className="h-5 w-5 text-muted-foreground" />
          {isEdit ? "Editar Bonificação" : "Criar Bonificação"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            {/* Period Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Período</h3>
                <p className="text-sm text-muted-foreground">
                  Defina o período de referência da bonificação
                </p>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(Number(value))}
                        value={field.value !== undefined ? field.value.toString() : undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o ano" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {generateYearOptions().map((year) => (
                            <SelectItem key={year.value} value={year.value}>
                              {year.label}
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
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mês</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(Number(value))}
                        value={field.value !== undefined ? field.value.toString() : undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o mês" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {generateMonthOptions().map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                              {month.label}
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

            {/* Employee Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Funcionário</h3>
                <p className="text-sm text-muted-foreground">
                  Selecione o funcionário que receberá a bonificação
                </p>
              </div>
              <Separator />
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Funcionário</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um funcionário" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} - {user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Performance and Value Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Bonificação</h3>
                <p className="text-sm text-muted-foreground">
                  Configure o nível de performance e valor base da bonificação
                </p>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="performanceLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nível de Performance</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(Number(value))}
                        value={field.value !== undefined ? field.value.toString() : undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o nível" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {generatePerformanceLevels().map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
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
                  name="baseBonus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Base da Bonificação</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step={0.01}
                          min={0}
                          placeholder="0,00"
                          ref={field.ref}
                          onChange={(value: string | number | null) => field.onChange(typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) || 0 : 0))}
                          onBlur={field.onBlur}
                          value={field.value}
                        />
                      </FormControl>
                      {watchedValues.baseBonus !== undefined && watchedValues.baseBonus > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Valor formatado: {formatCurrency(watchedValues.baseBonus)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Period Display */}
            {watchedValues.year && watchedValues.month && (
              <div className="space-y-2">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Período da Bonificação:</p>
                  <p className="text-sm text-muted-foreground">
                    26/{watchedValues.month === 1 ? '12' : String(watchedValues.month - 1).padStart(2, '0')}/{watchedValues.month === 1 ? watchedValues.year - 1 : watchedValues.year} a 25/{String(watchedValues.month).padStart(2, '0')}/{watchedValues.year}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-6">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  <IconX className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={isLoading}>
                <IconDeviceFloppy className="h-4 w-4 mr-2" />
                {isLoading ? "Salvando..." : isEdit ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}