import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { IconId, IconMail, IconWorld, IconPhone, IconAddressBook } from "@tabler/icons-react";

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
  return (
    <div className="space-y-4">
      {/* Document Information */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconId className="h-4 w-4" />
          Documentação
        </Label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="hasCnpj" className="text-sm font-normal flex items-center gap-2">
              <IconId className="h-4 w-4 text-muted-foreground" />
              Tem CNPJ cadastrado
            </Label>
            <Switch id="hasCnpj" checked={hasCnpj ?? false} onCheckedChange={(checked) => onHasCnpjChange(checked)} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Contact Information */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconAddressBook className="h-4 w-4" />
          Informações de Contato
        </Label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="hasEmail" className="text-sm font-normal flex items-center gap-2">
              <IconMail className="h-4 w-4 text-muted-foreground" />
              Tem email cadastrado
            </Label>
            <Switch id="hasEmail" checked={hasEmail ?? false} onCheckedChange={(checked) => onHasEmailChange(checked)} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="hasSite" className="text-sm font-normal flex items-center gap-2">
              <IconWorld className="h-4 w-4 text-muted-foreground" />
              Tem site cadastrado
            </Label>
            <Switch id="hasSite" checked={hasSite ?? false} onCheckedChange={(checked) => onHasSiteChange(checked)} />
          </div>

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
