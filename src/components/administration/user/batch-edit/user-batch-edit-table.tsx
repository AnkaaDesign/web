import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { User, BatchOperationResult } from "../../../../types";
import { useUserBatchMutations } from "../../../../hooks";
import { UserBatchResultDialog } from "@/components/ui/batch-operation-result-dialog";
import { USER_STATUS, USER_STATUS_LABELS, routes } from "../../../../constants";
import type { UserBatchEditFormData } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { IconLoader2, IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { CpfCell } from "./cells/cpf-cell";
import { PhoneCell } from "./cells/phone-cell";
import { PositionCell } from "./cells/position-cell";
import { SectorCell } from "./cells/sector-cell";
import { ManagedSectorCell } from "./cells/managed-sector-cell";

// Schema for batch edit form - matches UserBatchEditFormData type
const userBatchEditSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      data: z
        .object({
          // Core fields
          name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome deve ter no máximo 100 caracteres").optional(),
          email: z.string().email("Email inválido").nullable().optional(),
          phone: z.string().nullable().optional(),
          cpf: z.string().nullable().optional(),

          // Relationships
          positionId: z.string().uuid("ID do cargo inválido").nullable().optional(),
          sectorId: z.string().uuid("ID do setor inválido").nullable().optional(),
          managedSectorId: z.string().uuid("ID do setor gerenciado inválido").nullable().optional(),

          // Status - use enum type that matches UserBatchEditFormData
          status: z.nativeEnum(USER_STATUS).optional(),
        })
        .partial(),
    }),
  ),
});

interface UserBatchEditTableProps {
  users: User[];
  onCancel: () => void;
}

export function UserBatchEditTable({ users, onCancel }: UserBatchEditTableProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchOperationResult<User, User> | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const { batchUpdate } = useUserBatchMutations();

  const form = useForm<UserBatchEditFormData>({
    resolver: zodResolver(userBatchEditSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      users: users.map((user) => ({
        id: user.id,
        data: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          cpf: user.cpf,
          positionId: user.positionId,
          sectorId: user.sectorId,
          managedSectorId: user.managedSectorId,
          status: user.status,
        },
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "users",
  });

  const handleSubmit = async (data: UserBatchEditFormData) => {
    // Filter out users with no changes
    const updatedUsers = data.users.filter((user) => {
      const originalUser = users.find((u) => u.id === user.id);
      if (!originalUser) return false;

      const hasChanges =
        user.data.name !== originalUser.name ||
        user.data.email !== originalUser.email ||
        user.data.phone !== originalUser.phone ||
        user.data.cpf !== originalUser.cpf ||
        user.data.positionId !== originalUser.positionId ||
        user.data.sectorId !== originalUser.sectorId ||
        user.data.managedSectorId !== originalUser.managedSectorId ||
        user.data.status !== originalUser.status;

      return hasChanges;
    });

    if (updatedUsers.length === 0) {
      toast.info("Nenhuma alteração detectada");
      return;
    }
    const batchPayload = { users: updatedUsers };
    setIsSubmitting(true);
    try {
      const result = (await batchUpdate(batchPayload)) as any;
      if (result?.data) {
        // Show the detailed result dialog
        setBatchResult(result.data);
        setShowResultDialog(true);

        const { totalSuccess, totalFailed } = result.data;

        // Only show simple toast for complete success
        if (totalFailed === 0 && totalSuccess > 0) {
          toast.success(`${totalSuccess} ${totalSuccess === 1 ? "usuário atualizado" : "usuários atualizados"} com sucesso`);
        }
      } else {
        // Even if we don't have detailed results, navigate back on apparent success
        toast.success("Usuários atualizados com sucesso");
        navigate(routes.administration.collaborators.root);
      }
    } catch (error) {
      console.error("Step 6 - Error during batch update:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        response: error && typeof error === "object" && "response" in error ? (error as any).response?.data : undefined,
        status: error && typeof error === "object" && "response" in error ? (error as any).response?.status : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });
      toast.error("Erro ao atualizar usuários em lote");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResultDialogClose = (open: boolean) => {
    setShowResultDialog(open);
    if (!open) {
      setBatchResult(null);
      // If there were no failures, navigate back to list
      if (batchResult && batchResult.totalFailed === 0 && batchResult.totalSuccess > 0) {
        navigate(routes.administration.collaborators.root);
      }
    }
  };

  return (
    <Form {...form}>
      <Card className="h-full flex flex-col">
        {/* Hidden submit button for page header to trigger */}
        <button id="user-batch-form-submit" type="button" onClick={form.handleSubmit(handleSubmit)} style={{ display: "none" }} disabled={isSubmitting} />
        <CardContent className="p-6 flex-1 overflow-hidden flex flex-col">
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h3 className="text-sm font-medium text-foreground">
                Editando {users.length} {users.length === 1 ? "usuário selecionado" : "usuários selecionados"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">As alterações serão aplicadas apenas aos campos modificados em cada usuário</p>
          </div>

          {/* Global Actions Panel - Commented out for simplicity as users will edit individually */}
          {/* Uncomment if you want to apply the same value to all users at once
          <div className="mb-6 p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-medium mb-3 text-blue-900 dark:text-blue-100">
              Ações Globais - Aplicar a Todos
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select onValueChange={(value) => handleGlobalUpdate("status", value === "none" ? null : value)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecionar status para todos" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(USER_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          */}

          {/* Users Table */}
          <div className="border border-border rounded-lg overflow-x-auto overflow-y-auto flex-1">
            <Table className={cn("w-full min-w-[1800px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-64">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Nome</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-72">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Email</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-48">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Telefone</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-48">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">CPF</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-56">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Cargo</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-56">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Setor</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-56">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Setor Gerenciado</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-40">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Status</span>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const user = users[index];

                  return (
                    <TableRow
                      key={field.id}
                      className={cn(
                        "cursor-default transition-colors border-b border-border",
                        // Alternating row colors
                        index % 2 === 1 && "bg-muted/10",
                        // Hover state that works with alternating colors
                        "hover:bg-muted/20",
                      )}
                    >
                      {/* Nome */}
                      <TableCell className="w-64 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormField
                            control={form.control}
                            name={`users.${index}.data.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    value={field.value || ""}
                                    onChange={(value) => {
                                      field.onChange(value);
                                    }}
                                    name={field.name}
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                    className="w-full h-8 border-muted-foreground/20"
                                    placeholder="Nome do usuário"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TableCell>

                      {/* Email */}
                      <TableCell className="w-72 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormField
                            control={form.control}
                            name={`users.${index}.data.email`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    value={field.value || ""}
                                    onChange={(value) => {
                                      field.onChange(value);
                                    }}
                                    name={field.name}
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                    type="email"
                                    className="w-full h-8 border-muted-foreground/20"
                                    placeholder="email@exemplo.com"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TableCell>

                      {/* Telefone */}
                      <TableCell className="w-48 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <PhoneCell control={form.control} index={index} />
                        </div>
                      </TableCell>

                      {/* CPF */}
                      <TableCell className="w-48 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <CpfCell control={form.control} index={index} />
                        </div>
                      </TableCell>

                      {/* Cargo */}
                      <TableCell className="w-56 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <PositionCell control={form.control} index={index} currentPositionName={user.position?.name} />
                        </div>
                      </TableCell>

                      {/* Setor */}
                      <TableCell className="w-56 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <SectorCell control={form.control} index={index} currentSectorName={user.sector?.name} />
                        </div>
                      </TableCell>

                      {/* Setor Gerenciado */}
                      <TableCell className="w-56 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <ManagedSectorCell control={form.control} index={index} currentSectorName={user.managedSector?.name} />
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="w-40 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormField
                            control={form.control}
                            name={`users.${index}.data.status`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Combobox
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    options={Object.entries(USER_STATUS_LABELS).map(([value, label]) => ({
                                      value,
                                      label,
                                    }))}
                                    placeholder="Status"
                                    searchable={false}
                                    clearable={false}
                                    className="w-full h-8 border-muted-foreground/20"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Batch Operation Result Dialog */}
      <UserBatchResultDialog open={showResultDialog} onOpenChange={handleResultDialogClose} result={batchResult} operationType="update" />
    </Form>
  );
}
