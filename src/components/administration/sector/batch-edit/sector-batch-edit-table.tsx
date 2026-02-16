import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { IconCheck, IconLoader2 } from "@tabler/icons-react";

import type { Sector } from "../../../../types";
import { sectorBatchUpdateSchema, type SectorBatchUpdateFormData } from "../../../../schemas";
import { SECTOR_PRIVILEGES_LABELS, SECTOR_PRIVILEGES } from "../../../../constants";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SectorBatchEditTableProps {
  sectors: Sector[];
  onSubmit: (data: SectorBatchUpdateFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export function SectorBatchEditTable({ sectors, onSubmit, isSubmitting = false }: SectorBatchEditTableProps) {
  const [_validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});

  const form = useForm<SectorBatchUpdateFormData>({
    resolver: zodResolver(sectorBatchUpdateSchema),
    defaultValues: {
      sectors: sectors.map((sector) => ({
        id: sector.id,
        data: {
          name: sector.name,
          privileges: sector.privileges,
        },
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "sectors",
  });

  // Validate individual sector names
  const validateSectorName = (name: string, index: number): string[] => {
    const errors: string[] = [];
    const trimmedName = name.trim();

    if (!trimmedName) {
      errors.push("Nome é obrigatório");
    } else if (trimmedName.length < 2) {
      errors.push("Nome deve ter pelo menos 2 caracteres");
    } else if (trimmedName.length > 100) {
      errors.push("Nome deve ter no máximo 100 caracteres");
    }

    // Check for duplicates
    const watchedSectors = form.watch("sectors");
    const duplicateIndex = watchedSectors.findIndex((s, i) => i !== index && s.data.name?.trim().toLowerCase() === trimmedName.toLowerCase());

    if (duplicateIndex !== -1) {
      errors.push(`Nome duplicado com setor na linha ${duplicateIndex + 1}`);
    }

    return errors;
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    // Validate all sectors
    const newValidationErrors: Record<number, string[]> = {};
    let hasErrors = false;

    data.sectors.forEach((sectorData, index) => {
      const errors = validateSectorName(sectorData.data.name ?? "", index);
      if (errors.length > 0) {
        newValidationErrors[index] = errors;
        hasErrors = true;
      }
    });

    setValidationErrors(newValidationErrors);

    if (hasErrors) {
      return;
    }

    // Filter out sectors that haven't changed
    const changedSectors = data.sectors.filter((sectorData, index) => {
      const original = sectors[index];
      if (!original) return false;
      return sectorData.data.name !== original.name || sectorData.data.privileges !== original.privileges;
    });

    if (changedSectors.length === 0) {
      return;
    }

    await onSubmit({ sectors: changedSectors });
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ScrollArea className="h-[calc(100vh-300px)] border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[300px]">Nome</TableHead>
                <TableHead className="w-[200px]">Privilégios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Input
                        value={form.watch(`sectors.${index}.data.name`) ?? ''}
                        onChange={(value) => form.setValue(`sectors.${index}.data.name`, value as string)}
                        placeholder="Nome do setor"
                        disabled={isSubmitting}
                      />
                    </TableCell>
                    <TableCell>
                      <Combobox
                        value={form.watch(`sectors.${index}.data.privileges`)}
                        onValueChange={(value) => form.setValue(`sectors.${index}.data.privileges`, value as keyof typeof SECTOR_PRIVILEGES)}
                        disabled={isSubmitting}
                        options={Object.entries(SECTOR_PRIVILEGES_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        placeholder="Selecione o privilégio"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCheck className="h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </form>
    </Form>
  );
}
