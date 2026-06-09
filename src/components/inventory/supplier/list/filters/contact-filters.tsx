import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { IconId, IconPhone, IconAddressBook } from "@tabler/icons-react";

interface ContactFiltersProps {
  hasCnpj?: boolean;
  onHasCnpjChange: (value: boolean | undefined) => void;
  hasEmail?: boolean;
  onHasEmailChange: (value: boolean | undefined) => void;
  hasSite?: boolean;
  onHasSiteChange: (value: boolean | undefined) => void;
  phoneContains?: string;
  onPhoneContainsChange: (value: string | undefined) => void;
}

export function ContactFilters({ hasCnpj, onHasCnpjChange, hasEmail, onHasEmailChange, hasSite, onHasSiteChange, phoneContains, onPhoneContainsChange }: ContactFiltersProps) {
  const selected: string[] = [];
  if (hasCnpj) selected.push("hasCnpj");
  if (hasEmail) selected.push("hasEmail");
  if (hasSite) selected.push("hasSite");

  const handleChange = (value: string | string[] | null | undefined) => {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    onHasCnpjChange(values.includes("hasCnpj") ? true : false);
    onHasEmailChange(values.includes("hasEmail") ? true : false);
    onHasSiteChange(values.includes("hasSite") ? true : false);
  };

  return (
    <div className="space-y-4">
      {/* Document & Contact Characteristics */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconAddressBook className="h-4 w-4" />
          Características
        </Label>
        <Combobox
          mode="multiple"
          value={selected}
          onValueChange={handleChange}
          options={[
            { value: "hasCnpj", label: "Tem CNPJ cadastrado" },
            { value: "hasEmail", label: "Tem email cadastrado" },
            { value: "hasSite", label: "Tem site cadastrado" },
          ]}
          placeholder="Selecione..."
          searchable={false}
          clearable
        />
      </div>

      <Separator />

      {/* Contact Information */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconId className="h-4 w-4" />
          Informações de Contato
        </Label>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="phoneContains" className="text-sm font-normal flex items-center gap-2">
              <IconPhone className="h-4 w-4 text-muted-foreground" />
              Buscar por telefone
            </Label>
            <Input
              id="phoneContains"
              type="text"
              placeholder="Digite parte do telefone..."
              value={phoneContains || ""}
              onChange={(value) => onPhoneContainsChange((value as string) || undefined)}
            />
            {phoneContains && <div className="text-xs text-muted-foreground">Buscando por: "{phoneContains}"</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
