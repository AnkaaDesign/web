import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle, IconArrowRight, IconCheck, IconLoader2, IconUsers, IconInfoCircle } from "@tabler/icons-react";
import type { Customer } from "../../../../types";

interface ConflictField {
  field: string;
  label: string;
  values: Array<{ customerId: string; customerName: string; value: any; formatted?: string }>;
  type: "single" | "array" | "boolean";
}

interface MergeResolution {
  field: string;
  action: "select" | "custom" | "combine";
  selectedCustomerId?: string;
  customValue?: any;
  selectedIds?: string[];
}

interface CustomerMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  onMerge: (targetCustomerId: string, resolutions: Record<string, any>) => Promise<void>;
}

export function CustomerMergeDialog({ open, onOpenChange, customers, onMerge }: CustomerMergeDialogProps) {
  const [targetCustomerId, setTargetCustomerId] = useState<string>("");
  const [resolutions, setResolutions] = useState<Map<string, MergeResolution>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Detect conflicts between customers
  const conflicts = useMemo((): ConflictField[] => {
    if (customers.length < 2) return [];

    const conflictFields: ConflictField[] = [];
    const fieldsToCheck = [
      { field: "fantasyName", label: "Nome Fantasia", type: "single" as const },
      { field: "corporateName", label: "Razão Social", type: "single" as const },
      { field: "cnpj", label: "CNPJ", type: "single" as const },
      { field: "cpf", label: "CPF", type: "single" as const },
      { field: "email", label: "Email", type: "single" as const },
      { field: "phones", label: "Telefones", type: "array" as const },
      { field: "address", label: "Endereço", type: "single" as const },
      { field: "addressNumber", label: "Número", type: "single" as const },
      { field: "addressComplement", label: "Complemento", type: "single" as const },
      { field: "neighborhood", label: "Bairro", type: "single" as const },
      { field: "city", label: "Cidade", type: "single" as const },
      { field: "state", label: "Estado", type: "single" as const },
      { field: "zipCode", label: "CEP", type: "single" as const },
      { field: "site", label: "Site", type: "single" as const },
      { field: "tags", label: "Tags", type: "array" as const },
      { field: "logoId", label: "Logo", type: "single" as const },
    ];

    for (const { field, label, type } of fieldsToCheck) {
      const values = customers
        .map((customer) => {
          const value = (customer as any)[field];
          let formatted: string | undefined;

          if (value === null || value === undefined) return null;

          // Format value for display
          if (Array.isArray(value)) {
            formatted = value.length > 0 ? value.join(", ") : "Nenhum";
          } else if (typeof value === "boolean") {
            formatted = value ? "Sim" : "Não";
          } else {
            formatted = String(value);
          }

          return {
            customerId: customer.id,
            customerName: customer.fantasyName,
            value,
            formatted,
          };
        })
        .filter((v) => v !== null) as Array<{ customerId: string; customerName: string; value: any; formatted?: string }>;

      // Check if there's a conflict (different values)
      if (values.length > 1) {
        const hasConflict =
          type === "array"
            ? !values.every((v) => JSON.stringify(v.value) === JSON.stringify(values[0].value))
            : !values.every((v) => v.value === values[0].value);

        if (hasConflict) {
          conflictFields.push({
            field,
            label,
            values,
            type,
          });
        }
      }
    }

    return conflictFields;
  }, [customers]);

  // Auto-select first customer as target if not set
  useMemo(() => {
    if (customers.length > 0 && !targetCustomerId) {
      setTargetCustomerId(customers[0].id);
    }
  }, [customers, targetCustomerId]);

  // Get preview of merged result
  const mergedPreview = useMemo(() => {
    if (!targetCustomerId) return null;

    const target = customers.find((c) => c.id === targetCustomerId);
    if (!target) return null;

    const preview: Record<string, any> = { ...target };

    // Apply resolutions
    resolutions.forEach((resolution, field) => {
      switch (resolution.action) {
        case "select":
          if (resolution.selectedCustomerId) {
            const selectedCustomer = customers.find((c) => c.id === resolution.selectedCustomerId);
            if (selectedCustomer) {
              preview[field] = (selectedCustomer as any)[field];
            }
          }
          break;
        case "custom":
          preview[field] = resolution.customValue;
          break;
        case "combine":
          if (resolution.selectedIds) {
            const arrays = customers
              .filter((customer) => resolution.selectedIds!.includes(customer.id))
              .map((customer) => (customer as any)[field] || [])
              .flat();
            preview[field] = [...new Set(arrays)]; // Remove duplicates
          }
          break;
      }
    });

    return preview;
  }, [targetCustomerId, customers, resolutions]);

  const handleResolutionChange = (field: string, resolution: MergeResolution) => {
    setResolutions(new Map(resolutions.set(field, resolution)));
  };

  const handleMerge = async () => {
    if (!targetCustomerId || isLoading) return;

    setIsLoading(true);
    try {
      // Build resolution object
      const resolvedData: Record<string, any> = {};

      resolutions.forEach((resolution, field) => {
        switch (resolution.action) {
          case "select":
            if (resolution.selectedCustomerId) {
              const selectedCustomer = customers.find((c) => c.id === resolution.selectedCustomerId);
              if (selectedCustomer) {
                resolvedData[field] = (selectedCustomer as any)[field];
              }
            }
            break;
          case "custom":
            resolvedData[field] = resolution.customValue;
            break;
          case "combine":
            if (resolution.selectedIds) {
              const arrays = customers
                .filter((customer) => resolution.selectedIds!.includes(customer.id))
                .map((customer) => (customer as any)[field] || [])
                .flat();
              resolvedData[field] = [...new Set(arrays)];
            }
            break;
        }
      });

      await onMerge(targetCustomerId, resolvedData);
      onOpenChange(false);
    } catch (error) {
      console.error("Merge failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasUnresolvedConflicts = conflicts.some((conflict) => !resolutions.has(conflict.field));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            Mesclar Clientes
          </DialogTitle>
          <DialogDescription>
            Consolide {customers.length} clientes em um único. O cliente principal receberá todas as tarefas e histórico dos demais.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Info Alert */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 p-4">
              <div className="flex gap-3">
                <IconInfoCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">Como funciona a mesclagem:</p>
                  <ul className="text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>O cliente principal será mantido e receberá todos os dados</li>
                    <li>Os outros clientes serão removidos após transferir seus dados</li>
                    <li>Todas as tarefas, histórico e relações serão preservados</li>
                    <li>Você pode resolver conflitos entre campos diferentes</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Target Customer Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Cliente Principal</Label>
              <p className="text-sm text-muted-foreground">
                Selecione o cliente que será mantido. Os demais clientes serão consolidados nele e depois removidos.
              </p>
              <RadioGroup value={targetCustomerId} onValueChange={setTargetCustomerId}>
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center space-x-2 rounded-md border border-border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <RadioGroupItem value={customer.id} id={`target-${customer.id}`} />
                    <Label htmlFor={`target-${customer.id}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{customer.fantasyName}</p>
                          {customer.corporateName && <p className="text-sm text-muted-foreground">{customer.corporateName}</p>}
                        </div>
                        <div className="flex gap-2">
                          {customer.cnpj && <Badge variant="secondary">{customer.cnpj}</Badge>}
                          {customer.cpf && <Badge variant="secondary">{customer.cpf}</Badge>}
                          {customer._count?.tasks && <Badge variant="outline">Tarefas: {customer._count.tasks}</Badge>}
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Conflicts Section */}
            {conflicts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <IconAlertTriangle className="h-5 w-5 text-warning" />
                  <h3 className="text-lg font-semibold">Conflitos Detectados</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Os seguintes campos possuem valores diferentes. Escolha como resolver cada conflito:
                </p>

                {conflicts.map((conflict) => (
                  <div key={conflict.field} className="space-y-3 rounded-lg border border-border p-4 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">{conflict.label}</Label>
                      {resolutions.has(conflict.field) && <IconCheck className="h-5 w-5 text-success" />}
                    </div>

                    {conflict.type === "single" && (
                      <RadioGroup
                        value={resolutions.get(conflict.field)?.selectedCustomerId}
                        onValueChange={(customerId) =>
                          handleResolutionChange(conflict.field, {
                            field: conflict.field,
                            action: "select",
                            selectedCustomerId: customerId,
                          })
                        }
                      >
                        {conflict.values.map((value) => (
                          <div key={value.customerId} className="flex items-center space-x-2">
                            <RadioGroupItem value={value.customerId} id={`${conflict.field}-${value.customerId}`} />
                            <Label htmlFor={`${conflict.field}-${value.customerId}`} className="cursor-pointer flex items-center gap-2">
                              <span>{value.customerName}:</span>
                              <Badge variant="outline">{value.formatted}</Badge>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {conflict.type === "array" && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Selecione quais valores manter:</p>
                        {conflict.values.map((value) => (
                          <div key={value.customerId} className="flex items-start space-x-2">
                            <Checkbox
                              id={`${conflict.field}-${value.customerId}`}
                              checked={resolutions.get(conflict.field)?.selectedIds?.includes(value.customerId)}
                              onCheckedChange={(checked) => {
                                const currentIds = resolutions.get(conflict.field)?.selectedIds || [];
                                const newIds = checked
                                  ? [...currentIds, value.customerId]
                                  : currentIds.filter((id) => id !== value.customerId);

                                handleResolutionChange(conflict.field, {
                                  field: conflict.field,
                                  action: "combine",
                                  selectedIds: newIds,
                                });
                              }}
                            />
                            <Label htmlFor={`${conflict.field}-${value.customerId}`} className="cursor-pointer">
                              <div>
                                <span className="font-medium">{value.customerName}</span>
                                <p className="text-sm text-muted-foreground">{value.formatted}</p>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Preview Section */}
            {mergedPreview && (
              <div className="space-y-3 rounded-lg border border-border p-4 bg-primary/5">
                <div className="flex items-center gap-2">
                  <IconArrowRight className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Pré-visualização do Resultado</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-muted-foreground">Nome Fantasia</Label>
                    <p className="font-medium">{mergedPreview.fantasyName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Razão Social</Label>
                    <p className="font-medium">{mergedPreview.corporateName || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">CNPJ</Label>
                    <p className="font-medium">{mergedPreview.cnpj || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">CPF</Label>
                    <p className="font-medium">{mergedPreview.cpf || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{mergedPreview.email || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cidade</Label>
                    <p className="font-medium">{mergedPreview.city || "N/A"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleMerge} disabled={isLoading || hasUnresolvedConflicts || !targetCustomerId}>
            {isLoading ? (
              <>
                <IconLoader2 className="h-4 w-4 animate-spin" />
                Mesclando...
              </>
            ) : (
              <>
                <IconCheck className="h-4 w-4" />
                Mesclar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
