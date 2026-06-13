import { useMemo, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconUsers, IconPlus, IconEdit, IconTrash, IconLoader2, IconId, IconCake, IconReceiptTax, IconCoin } from "@tabler/icons-react";

import type { Dependent } from "../../../types/dependent";
import { dependentCreateSchema, type DependentCreateFormData, type DependentUpdateFormData } from "../../../schemas/dependent";
import { DEPENDENT_RELATIONSHIP_LABELS } from "../../../constants";
import { useDependents, useDependentMutations } from "../../../hooks/human-resources/use-dependents";
import { formatCPF, formatDate } from "../../../utils";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormCombobox } from "@/components/ui/form-combobox";
import { FormSwitch } from "@/components/ui/form-switch";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { CPFInput } from "@/components/ui/cpf-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface DependentsCardProps {
  userId: string;
  className?: string;
}

export function DependentsCard({ userId, className }: DependentsCardProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Dependent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dependent | null>(null);

  const { data: response, isLoading } = useDependents(
    {
      userIds: [userId],
      orderBy: { name: "asc" },
      limit: 100,
    } as any,
    { enabled: !!userId },
  );

  const dependents = response?.data || [];
  const mutations = useDependentMutations();

  const relationshipOptions = useMemo(() => Object.entries(DEPENDENT_RELATIONSHIP_LABELS).map(([value, label]) => ({ value, label })), []);

  const form = useForm<DependentCreateFormData>({
    resolver: zodResolver(dependentCreateSchema as any),
    mode: "onTouched",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: {
      userId,
      name: "",
      cpf: null,
      birthDate: undefined as any,
      relationship: "" as any,
      irrfDeduction: true,
      salarioFamilia: false,
      notes: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  const openCreateDialog = () => {
    setEditingDependent(null);
    form.reset({
      userId,
      name: "",
      cpf: null,
      birthDate: undefined as any,
      relationship: "" as any,
      irrfDeduction: true,
      salarioFamilia: false,
      notes: "",
    });
    setIsFormOpen(true);
  };

  const openEditDialog = (dependent: Dependent) => {
    setEditingDependent(dependent);
    form.reset({
      userId: dependent.userId,
      name: dependent.name,
      cpf: dependent.cpf ?? null,
      birthDate: new Date(dependent.birthDate),
      relationship: dependent.relationship,
      irrfDeduction: dependent.irrfDeduction,
      salarioFamilia: dependent.salarioFamilia,
      notes: dependent.notes ?? "",
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: DependentCreateFormData) => {
    try {
      // Normalize optional fields (empty string → null)
      const cleaned = {
        ...data,
        userId,
        cpf: data.cpf?.trim() ? data.cpf : null,
        notes: data.notes?.trim() ? data.notes.trim() : null,
      };

      if (editingDependent) {
        await mutations.updateAsync({ id: editingDependent.id, data: cleaned as DependentUpdateFormData });
      } else {
        await mutations.createAsync(cleaned);
      }

      setIsFormOpen(false);
      setEditingDependent(null);
    } catch (error) {
      // Error toast is handled by the API client
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting dependent form:", error);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await mutations.deleteAsync(deleteTarget.id);
    } catch (error) {
      // Error toast is handled by the API client
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting dependent:", error);
      }
    }
    setDeleteTarget(null);
  };

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <IconUsers className="h-5 w-5 text-muted-foreground" />
          Dependentes
        </CardTitle>
        <Button variant="outline" size="sm" onClick={openCreateDialog}>
          <IconPlus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : dependents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dependente cadastrado</p>
        ) : (
          <div className="space-y-3">
            {dependents.map((dependent) => (
              <div key={dependent.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate">{dependent.name}</p>
                    <Badge variant="secondary">{DEPENDENT_RELATIONSHIP_LABELS[dependent.relationship] || dependent.relationship}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <IconCake className="h-4 w-4" />
                      {formatDate(dependent.birthDate)}
                    </span>
                    {dependent.cpf && (
                      <span className="flex items-center gap-1">
                        <IconId className="h-4 w-4" />
                        {formatCPF(dependent.cpf)}
                      </span>
                    )}
                  </div>
                  {(dependent.irrfDeduction || dependent.salarioFamilia) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {dependent.irrfDeduction && (
                        <Badge variant="outline" className="gap-1">
                          <IconReceiptTax className="h-3 w-3" />
                          Dedução IRRF
                        </Badge>
                      )}
                      {dependent.salarioFamilia && (
                        <Badge variant="outline" className="gap-1">
                          <IconCoin className="h-3 w-3" />
                          Salário-Família
                        </Badge>
                      )}
                    </div>
                  )}
                  {dependent.notes && <p className="text-xs text-muted-foreground">{dependent.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(dependent)} title="Editar dependente">
                    <IconEdit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(dependent)} title="Remover dependente">
                    <IconTrash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingDependent(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDependent ? "Editar Dependente" : "Adicionar Dependente"}</DialogTitle>
            <DialogDescription>
              {editingDependent ? "Atualize as informações do dependente" : "Preencha as informações do dependente do colaborador"}
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Nome <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="Nome completo do dependente" disabled={isSubmitting} transparent={true} maxLength={200} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CPF + Birth date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <CPFInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => <DateTimeInput field={field as any} label="Data de Nascimento" mode="date" disabled={isSubmitting} required />}
                />
              </div>

              {/* Relationship */}
              <FormCombobox name="relationship" label="Parentesco" placeholder="Selecione o parentesco" options={relationshipOptions} disabled={isSubmitting} required />

              {/* Eligibility switches */}
              <div className="grid grid-cols-1 gap-3">
                <FormSwitch<DependentCreateFormData> name="irrfDeduction" label="Dedução IRRF" description="Elegível à dedução de IRRF" disabled={isSubmitting} />
                <FormSwitch<DependentCreateFormData> name="salarioFamilia" label="Salário-Família" description="Elegível ao salário-família" disabled={isSubmitting} />
              </div>

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ""} placeholder="Observações sobre o dependente (opcional)" disabled={isSubmitting} rows={3} maxLength={1000} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingDependent ? "Salvar" : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover dependente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o dependente "{deleteTarget?.name}"? Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
