import { UseFormReturn } from "react-hook-form";
import type { DriverCreateFormData, DriverUpdateFormData } from "../../../../schemas";
import { BRAZILIAN_STATES } from "../../../../constants";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { FormCityInput } from "@/components/ui/form-city-input";
import { FormInput } from "@/components/ui/form-input";

interface AddressSectionProps {
  form: UseFormReturn<DriverCreateFormData | DriverUpdateFormData>;
}

export function AddressSection({ form }: AddressSectionProps) {
  const brazilianStates = Object.values(BRAZILIAN_STATES);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Endereço</CardTitle>
        <CardDescription>Endereço residencial do motorista</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Address */}
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Logradouro</FormLabel>
                <FormControl>
                  <Input placeholder="Rua, Avenida, etc." {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Address Number */}
          <FormField
            control={form.control}
            name="addressNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número</FormLabel>
                <FormControl>
                  <Input placeholder="123" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Address Complement */}
          <FormField
            control={form.control}
            name="addressComplement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Complemento</FormLabel>
                <FormControl>
                  <Input placeholder="Apartamento, Bloco, etc." {...field} value={field.value || ""} />
                </FormControl>
                <FormDescription>Apartamento, casa, bloco, etc. (opcional)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Neighborhood */}
          <FormField
            control={form.control}
            name="neighborhood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bairro</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do bairro" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* City */}
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade</FormLabel>
                <FormControl>
                  <FormCityInput placeholder="Nome da cidade" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* State */}
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    options={brazilianStates.map((state) => ({
                      value: state,
                      label: state,
                    }))}
                    placeholder="UF"
                    searchable
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ZIP Code */}
          <FormInput<DriverCreateFormData | DriverUpdateFormData>
            type="cep"
            name="zipCode"
            label="CEP"
            placeholder="00000-000"
            addressFieldName="address"
            neighborhoodFieldName="neighborhood"
            cityFieldName="city"
            stateFieldName="state"
            description="Formato: 00000-000"
          />
        </div>
      </CardContent>
    </Card>
  );
}
