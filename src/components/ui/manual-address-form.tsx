import React from "react";
import { Input } from "./input";
import { Label } from "./label";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { IconMapPin, IconBuilding } from "@tabler/icons-react";
import { cn } from "../../lib/utils";
import type { AddressComponents } from "./google-places-autocomplete";

export interface ManualAddressData extends AddressComponents {
  businessName?: string;
  phoneNumber?: string;
  website?: string;
}

interface ManualAddressFormProps {
  value?: ManualAddressData;
  onChange?: (address: ManualAddressData) => void;
  onSubmit?: (address: ManualAddressData) => void;
  className?: string;
  showBusinessFields?: boolean;
  disabled?: boolean;
  errors?: Partial<Record<keyof ManualAddressData, string>>;
  required?: Partial<Record<keyof ManualAddressData, boolean>>;
}

export function ManualAddressForm({ value = {}, onChange, onSubmit, className, showBusinessFields = true, disabled = false, errors = {}, required = {} }: ManualAddressFormProps) {
  // Handle field changes
  const handleFieldChange = (field: keyof ManualAddressData, fieldValue: string) => {
    const newAddress = {
      ...value,
      [field]: fieldValue,
    };

    // Auto-generate formatted address
    if (field === "route" || field === "streetNumber" || field === "neighborhood" || field === "city" || field === "state") {
      newAddress.formattedAddress = generateFormattedAddress(newAddress);
    }

    onChange?.(newAddress);
  };

  // Generate formatted address from components
  const generateFormattedAddress = (address: ManualAddressData): string => {
    const parts = [];

    if (address.route) {
      let streetPart = address.route;
      if (address.streetNumber) {
        streetPart += `, ${address.streetNumber}`;
      }
      parts.push(streetPart);
    }

    if (address.neighborhood) {
      parts.push(address.neighborhood);
    }

    if (address.city) {
      parts.push(address.city);
    }

    if (address.state) {
      parts.push(address.state);
    }

    if (address.postalCode) {
      parts.push(`CEP ${address.postalCode}`);
    }

    return parts.join(", ");
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const addressWithFormatted = {
      ...value,
      formattedAddress: value.formattedAddress || generateFormattedAddress(value),
    };

    onSubmit?.(addressWithFormatted);
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <IconMapPin className="h-5 w-5" />
          Endereço Manual
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Business Information */}
          {showBusinessFields && (
            <div className="space-y-4 p-4 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <IconBuilding className="h-4 w-4" />
                Informações do Estabelecimento (Opcional)
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="businessName">
                    Nome do Estabelecimento
                    {required.businessName && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="businessName"
                    value={value.businessName || ""}
                    onChange={(e) => handleFieldChange("businessName", e.target.value)}
                    placeholder="Nome da empresa ou local"
                    disabled={disabled}
                    className={errors.businessName ? "border-red-500" : ""}
                  />
                  {errors.businessName && <p className="text-sm text-red-600">{errors.businessName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">
                    Telefone
                    {required.phoneNumber && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="phoneNumber"
                    value={value.phoneNumber || ""}
                    onChange={(e) => handleFieldChange("phoneNumber", e.target.value)}
                    placeholder="(11) 99999-9999"
                    disabled={disabled}
                    className={errors.phoneNumber ? "border-red-500" : ""}
                  />
                  {errors.phoneNumber && <p className="text-sm text-red-600">{errors.phoneNumber}</p>}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="website">
                    Website
                    {required.website && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="website"
                    type="url"
                    value={value.website || ""}
                    onChange={(e) => handleFieldChange("website", e.target.value)}
                    placeholder="https://exemplo.com.br"
                    disabled={disabled}
                    className={errors.website ? "border-red-500" : ""}
                  />
                  {errors.website && <p className="text-sm text-red-600">{errors.website}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Address Information */}
          <div className="space-y-4">
            <div className="text-sm font-medium text-muted-foreground">Endereço</div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="route">
                  Rua/Logradouro
                  {required.route && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="route"
                  value={value.route || ""}
                  onChange={(e) => handleFieldChange("route", e.target.value)}
                  placeholder="Rua das Flores"
                  disabled={disabled}
                  className={errors.route ? "border-red-500" : ""}
                />
                {errors.route && <p className="text-sm text-red-600">{errors.route}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="streetNumber">
                  Número
                  {required.streetNumber && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="streetNumber"
                  value={value.streetNumber || ""}
                  onChange={(e) => handleFieldChange("streetNumber", e.target.value)}
                  placeholder="Número"
                  disabled={disabled}
                  className={errors.streetNumber ? "border-red-500" : ""}
                />
                {errors.streetNumber && <p className="text-sm text-red-600">{errors.streetNumber}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="neighborhood">
                  Bairro
                  {required.neighborhood && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="neighborhood"
                  value={value.neighborhood || ""}
                  onChange={(e) => handleFieldChange("neighborhood", e.target.value)}
                  placeholder="Centro"
                  disabled={disabled}
                  className={errors.neighborhood ? "border-red-500" : ""}
                />
                {errors.neighborhood && <p className="text-sm text-red-600">{errors.neighborhood}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">
                  CEP
                  {required.postalCode && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="postalCode"
                  value={value.postalCode || ""}
                  onChange={(e) => handleFieldChange("postalCode", e.target.value)}
                  placeholder="01234-567"
                  disabled={disabled}
                  className={errors.postalCode ? "border-red-500" : ""}
                />
                {errors.postalCode && <p className="text-sm text-red-600">{errors.postalCode}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="city">
                  Cidade
                  {required.city && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="city"
                  value={value.city || ""}
                  onChange={(e) => handleFieldChange("city", e.target.value)}
                  placeholder="São Paulo"
                  disabled={disabled}
                  className={errors.city ? "border-red-500" : ""}
                />
                {errors.city && <p className="text-sm text-red-600">{errors.city}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">
                  Estado
                  {required.state && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="state"
                  value={value.state || ""}
                  onChange={(e) => handleFieldChange("state", e.target.value)}
                  placeholder="SP"
                  disabled={disabled}
                  className={errors.state ? "border-red-500" : ""}
                />
                {errors.state && <p className="text-sm text-red-600">{errors.state}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">
                País
                {required.country && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="country"
                value={value.country || "Brasil"}
                onChange={(e) => handleFieldChange("country", e.target.value)}
                placeholder="Brasil"
                disabled={disabled}
                className={errors.country ? "border-red-500" : ""}
              />
              {errors.country && <p className="text-sm text-red-600">{errors.country}</p>}
            </div>
          </div>

          {/* Generated Address Preview */}
          {(value.route || value.city) && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
              <Label className="text-sm font-medium">Endereço Formatado:</Label>
              <p className="text-sm text-muted-foreground">{value.formattedAddress || generateFormattedAddress(value)}</p>
            </div>
          )}

          {/* Submit Button */}
          {onSubmit && (
            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={disabled}>
                Salvar Endereço
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

// Helper component for standalone usage
export function ManualAddressFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialValue,
  showBusinessFields = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (address: ManualAddressData) => void;
  initialValue?: ManualAddressData;
  showBusinessFields?: boolean;
}) {
  const [address, setAddress] = React.useState<ManualAddressData>(initialValue || {});

  const handleSubmit = (addressData: ManualAddressData) => {
    onSubmit(addressData);
    onOpenChange(false);
  };

  React.useEffect(() => {
    if (initialValue) {
      setAddress(initialValue);
    }
  }, [initialValue]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <ManualAddressForm value={address} onChange={setAddress} onSubmit={handleSubmit} showBusinessFields={showBusinessFields} />

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
