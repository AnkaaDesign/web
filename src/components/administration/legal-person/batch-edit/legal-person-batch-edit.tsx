import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, X, Building } from "lucide-react";
import { formatCNPJ } from "../../../../utils";
import { z } from "zod";
import type { LegalPerson } from "../../../../types";

// Individual form field components
import { FantasyNameInput } from "../form/fantasy-name-input";
import { CorporateNameInput } from "../form/corporate-name-input";
import { FormInput } from "@/components/ui/form-input";
import { WebsiteInput } from "../form/website-input";
import { CityInput } from "@/components/ui/form-city-input";
import { StateSelector } from "@/components/ui/form-state-selector";

const batchEditSchema = z.object({
  fantasyName: z.string().optional(),
  corporateName: z.string().optional(),
  email: z.string().email("E-mail inválido").nullable().optional(),
  website: z.string().url("URL inválida").nullable().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

type BatchEditFormData = z.infer<typeof batchEditSchema>;

interface LegalPersonBatchEditProps {
  selectedLegalPersons: LegalPerson[];
  onSave: (data: BatchEditFormData, selectedIds: string[]) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function LegalPersonBatchEdit({ selectedLegalPersons, onSave, onCancel, isSubmitting = false }: LegalPersonBatchEditProps) {
  const [fieldsToUpdate, setFieldsToUpdate] = useState<Set<keyof BatchEditFormData>>(new Set());

  const form = useForm<BatchEditFormData>({
    resolver: zodResolver(batchEditSchema),
    defaultValues: {
      fantasyName: "",
      corporateName: "",
      email: "",
      website: "",
      city: "",
      state: "",
    },
  });

  const handleFieldToggle = (field: keyof BatchEditFormData, checked: boolean) => {
    const newFields = new Set(fieldsToUpdate);
    if (checked) {
      newFields.add(field);
    } else {
      newFields.delete(field);
      // Clear the field value when unchecked
      form.setValue(field, "" as any);
    }
    setFieldsToUpdate(newFields);
  };

  const handleSubmit = async (data: BatchEditFormData) => {
    // Only include fields that are selected for update
    const filteredData: Partial<BatchEditFormData> = {};
    fieldsToUpdate.forEach((field) => {
      if (data[field] !== "" && data[field] !== undefined) {
        filteredData[field] = data[field];
      }
    });

    if (Object.keys(filteredData).length === 0) {
      return; // No fields selected for update
    }

    const selectedIds = selectedLegalPersons.map((lp) => lp.id);
    await onSave(filteredData as BatchEditFormData, selectedIds);
  };

  const canSubmit = fieldsToUpdate.size > 0 && !isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Building className="h-5 w-5" />
          <span>Edição em Lote</span>
        </CardTitle>
        <CardDescription>Edite múltiplas pessoas jurídicas simultaneamente. Selecione os campos que deseja atualizar e forneça os novos valores.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Selected Legal Persons */}
        <div>
          <h3 className="text-sm font-medium mb-3">Pessoas Jurídicas Selecionadas ({selectedLegalPersons.length})</h3>
          <div className="flex flex-wrap gap-2">
            {selectedLegalPersons.map((legalPerson) => (
              <Badge key={legalPerson.id} variant="secondary" className="text-xs">
                {legalPerson.fantasyName}
                <span className="ml-1 font-mono">({formatCNPJ(legalPerson.cnpj)})</span>
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Company Information */}
            <div>
              <h3 className="text-sm font-medium mb-4">Informações da Empresa</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox checked={fieldsToUpdate.has("fantasyName")} onCheckedChange={(checked) => handleFieldToggle("fantasyName", checked as boolean)} className="mt-2" />
                  <div className="flex-1">
                    <FantasyNameInput />
                    {!fieldsToUpdate.has("fantasyName") && <div className="absolute inset-0 bg-muted/50 rounded-md"></div>}
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox checked={fieldsToUpdate.has("corporateName")} onCheckedChange={(checked) => handleFieldToggle("corporateName", checked as boolean)} className="mt-2" />
                  <div className="flex-1 relative">
                    <CorporateNameInput />
                    {!fieldsToUpdate.has("corporateName") && <div className="absolute inset-0 bg-muted/50 rounded-md"></div>}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Contact Information */}
            <div>
              <h3 className="text-sm font-medium mb-4">Informações de Contato</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox checked={fieldsToUpdate.has("email")} onCheckedChange={(checked) => handleFieldToggle("email", checked as boolean)} className="mt-2" />
                  <div className="flex-1 relative">
                    <FormInput<BatchEditFormData> name="email" type="email" label="E-mail" placeholder="Digite o e-mail" />
                    {!fieldsToUpdate.has("email") && <div className="absolute inset-0 bg-muted/50 rounded-md"></div>}
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox checked={fieldsToUpdate.has("website")} onCheckedChange={(checked) => handleFieldToggle("website", checked as boolean)} className="mt-2" />
                  <div className="flex-1 relative">
                    <WebsiteInput />
                    {!fieldsToUpdate.has("website") && <div className="absolute inset-0 bg-muted/50 rounded-md"></div>}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Location */}
            <div>
              <h3 className="text-sm font-medium mb-4">Localização</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start space-x-3">
                  <Checkbox checked={fieldsToUpdate.has("city")} onCheckedChange={(checked) => handleFieldToggle("city", checked as boolean)} className="mt-2" />
                  <div className="flex-1 relative">
                    <CityInput />
                    {!fieldsToUpdate.has("city") && <div className="absolute inset-0 bg-muted/50 rounded-md"></div>}
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox checked={fieldsToUpdate.has("state")} onCheckedChange={(checked) => handleFieldToggle("state", checked as boolean)} className="mt-2" />
                  <div className="flex-1 relative">
                    <StateSelector />
                    {!fieldsToUpdate.has("state") && <div className="absolute inset-0 bg-muted/50 rounded-md"></div>}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={onCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>

              <div className="flex items-center space-x-3">
                <span className="text-sm text-muted-foreground">
                  {fieldsToUpdate.size} campo{fieldsToUpdate.size !== 1 ? "s" : ""} selecionado
                  {fieldsToUpdate.size !== 1 ? "s" : ""}
                </span>
                <Button type="submit" disabled={!canSubmit} className="min-w-[120px]">
                  {isSubmitting ? (
                    <>Salvando...</>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
