import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconCheck, IconLoader2 } from "@tabler/icons-react";

import type { Warning } from "../../../../types";
import { warningBatchUpdateSchema } from "../../../../schemas";
import { WARNING_SEVERITY_LABELS, WARNING_CATEGORY_LABELS } from "../../../../constants";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WarningBatchEditTableProps {
  warnings: Warning[];
  onSubmit: (data: any) => Promise<void>;
  isSubmitting?: boolean;
}

export function WarningBatchEditTable({ warnings, onSubmit, isSubmitting = false }: WarningBatchEditTableProps) {
  const form = useForm({
    resolver: zodResolver(warningBatchUpdateSchema),
    mode: "onChange",
    defaultValues: {
      warnings: warnings.map((warning: Warning) => ({
        id: warning.id,
        data: {
          severity: warning.severity,
          category: warning.category,
          followUpDate: new Date(warning.followUpDate),
          isActive: warning.isActive,
        },
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "warnings",
  });

  const handleSubmit = form.handleSubmit(async (data: any) => {
    // Filter out warnings that haven't changed
    const changedWarnings = data.warnings.filter((warningData: any, index: number) => {
      const original = warnings[index];
      return (
        warningData.data.severity !== original.severity ||
        warningData.data.category !== original.category ||
        warningData.data.followUpDate.getTime() !== new Date(original.followUpDate).getTime() ||
        warningData.data.isActive !== original.isActive
      );
    });

    if (changedWarnings.length === 0) {
      return;
    }

    await onSubmit({ warnings: changedWarnings });
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ScrollArea className="h-[calc(100vh-300px)] border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[200px]">Colaborador</TableHead>
                <TableHead className="w-[150px]">Severidade</TableHead>
                <TableHead className="w-[150px]">Categoria</TableHead>
                <TableHead className="w-[180px]">Data Acompanhamento</TableHead>
                <TableHead className="w-[100px] text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field: any, index: number) => {
                const originalWarning = warnings[index];

                return (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{originalWarning.collaborator?.name || "-"}</TableCell>
                    <TableCell>
                      <Combobox
                        value={form.watch(`warnings.${index}.data.severity`)}
                        onValueChange={(value) => form.setValue(`warnings.${index}.data.severity`, value as any)}
                        disabled={isSubmitting}
                        options={Object.entries(WARNING_SEVERITY_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        placeholder="Selecione a severidade"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Combobox
                        value={form.watch(`warnings.${index}.data.category`)}
                        onValueChange={(value) => form.setValue(`warnings.${index}.data.category`, value as any)}
                        disabled={isSubmitting}
                        options={Object.entries(WARNING_CATEGORY_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        placeholder="Selecione a categoria"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <DateTimeInput
                        mode="date"
                        context="followUp"
                        value={form.watch(`warnings.${index}.data.followUpDate`)}
                        onChange={(date: Date | null) => form.setValue(`warnings.${index}.data.followUpDate`, date || new Date())}
                        disabled={isSubmitting}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={form.watch(`warnings.${index}.data.isActive`)}
                        onCheckedChange={(checked) => form.setValue(`warnings.${index}.data.isActive`, checked)}
                        disabled={isSubmitting}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
            {isSubmitting ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCheck className="h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </form>
    </Form>
  );
}
