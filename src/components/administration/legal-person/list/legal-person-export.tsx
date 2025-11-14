import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, FileSpreadsheet, X } from "lucide-react";
import { formatCNPJ, formatDate } from "../../../../utils";
import type { LegalPerson } from "../../../../types";

interface LegalPersonExportProps {
  legalPersons: LegalPerson[];
  onExport: (selectedData: ExportData[], format: ExportFormat) => Promise<void>;
  onCancel: () => void;
  isExporting?: boolean;
}

interface ExportField {
  key: keyof LegalPerson | "formattedCnpj" | "formattedCreatedAt" | "formattedUpdatedAt" | "phonesList";
  label: string;
  description?: string;
}

interface ExportData {
  [key: string]: any;
}

type ExportFormat = "csv" | "xlsx";

const EXPORT_FIELDS: ExportField[] = [
  { key: "fantasyName", label: "Nome Fantasia", description: "Nome comercial da empresa" },
  { key: "corporateName", label: "Razão Social", description: "Nome oficial da empresa" },
  { key: "formattedCnpj", label: "CNPJ", description: "CNPJ formatado" },
  { key: "email", label: "E-mail", description: "E-mail de contato" },
  { key: "website", label: "Website", description: "Site da empresa" },
  { key: "phonesList", label: "Telefones", description: "Lista de telefones" },
  { key: "address", label: "Endereço", description: "Street" },
  { key: "addressNumber", label: "Número", description: "Número do endereço" },
  { key: "addressComplement", label: "Complemento", description: "Complemento do endereço" },
  { key: "neighborhood", label: "Bairro", description: "Bairro" },
  { key: "city", label: "Cidade", description: "Cidade" },
  { key: "state", label: "Estado", description: "Estado (UF)" },
  { key: "zipCode", label: "CEP", description: "Código postal" },
  { key: "formattedCreatedAt", label: "Data de Cadastro", description: "Data de criação" },
  { key: "formattedUpdatedAt", label: "Última Atualização", description: "Data da última modificação" },
];

export function LegalPersonExport({ legalPersons, onExport, onCancel, isExporting = false }: LegalPersonExportProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(["fantasyName", "corporateName", "formattedCnpj", "email", "city", "state"]));
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");

  const handleFieldToggle = (fieldKey: string, checked: boolean) => {
    const newFields = new Set(selectedFields);
    if (checked) {
      newFields.add(fieldKey);
    } else {
      newFields.delete(fieldKey);
    }
    setSelectedFields(newFields);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFields(new Set(EXPORT_FIELDS.map((field) => field.key)));
    } else {
      setSelectedFields(new Set());
    }
  };

  const prepareExportData = (): ExportData[] => {
    return legalPersons.map((legalPerson) => {
      const exportItem: ExportData = {};

      selectedFields.forEach((fieldKey) => {
        switch (fieldKey) {
          case "formattedCnpj":
            exportItem["CNPJ"] = formatCNPJ(legalPerson.cnpj);
            break;
          case "formattedCreatedAt":
            exportItem["Data de Cadastro"] = formatDate(legalPerson.createdAt);
            break;
          case "formattedUpdatedAt":
            exportItem["Última Atualização"] = formatDate(legalPerson.updatedAt);
            break;
          case "phonesList":
            exportItem["Telefones"] = legalPerson.phones.join(", ");
            break;
          default:
            const field = EXPORT_FIELDS.find((f) => f.key === fieldKey);
            if (field) {
              exportItem[field.label] = legalPerson[fieldKey as keyof LegalPerson] || "";
            }
        }
      });

      return exportItem;
    });
  };

  const handleExport = async () => {
    if (selectedFields.size === 0) return;

    const exportData = prepareExportData();
    await onExport(exportData, exportFormat);
  };

  const canExport = selectedFields.size > 0 && !isExporting;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileSpreadsheet className="h-5 w-5" />
          <span>Exportar Pessoas Jurídicas</span>
        </CardTitle>
        <CardDescription>Selecione os campos que deseja incluir na exportação e o formato do arquivo.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {legalPersons.length} pessoa{legalPersons.length !== 1 ? "s" : ""} jurídica
            {legalPersons.length !== 1 ? "s" : ""} será{legalPersons.length !== 1 ? "ão" : ""} exportada
            {legalPersons.length !== 1 ? "s" : ""}
          </span>
          <Badge variant="secondary">
            {selectedFields.size} campo{selectedFields.size !== 1 ? "s" : ""} selecionado
            {selectedFields.size !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Field Selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Campos para Exportação</h3>
            <Checkbox checked={selectedFields.size === EXPORT_FIELDS.length} onCheckedChange={handleSelectAll} className="mr-2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
            {EXPORT_FIELDS.map((field) => (
              <div key={field.key} className="flex items-start space-x-3">
                <Checkbox checked={selectedFields.has(field.key)} onCheckedChange={(checked) => handleFieldToggle(field.key, checked as boolean)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <label className="text-sm font-medium cursor-pointer">{field.label}</label>
                  {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Format Selection */}
        <div>
          <h3 className="text-sm font-medium mb-3">Formato do Arquivo</h3>
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="radio" value="xlsx" checked={exportFormat === "xlsx"} onChange={(e) => setExportFormat(e.target.value as ExportFormat)} className="sr-only" />
              <div className={`w-4 h-4 rounded-full border-2 ${exportFormat === "xlsx" ? "border-primary bg-primary" : "border-muted-foreground"}`} />
              <span className="text-sm">Excel (.xlsx)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="radio" value="csv" checked={exportFormat === "csv"} onChange={(e) => setExportFormat(e.target.value as ExportFormat)} className="sr-only" />
              <div className={`w-4 h-4 rounded-full border-2 ${exportFormat === "csv" ? "border-primary bg-primary" : "border-muted-foreground"}`} />
              <span className="text-sm">CSV (.csv)</span>
            </label>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>

          <Button onClick={handleExport} disabled={!canExport} className="min-w-[140px]">
            {isExporting ? (
              <>Exportando...</>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar {exportFormat.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
