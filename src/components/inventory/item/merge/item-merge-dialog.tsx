import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle, IconArrowRight, IconCheck, IconLoader2, IconInfoCircle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { Item } from "../../../../types";
import { formatCurrency } from "../../../../utils";

interface ConflictField {
  field: string;
  label: string;
  values: Array<{ itemId: string; itemName: string; value: any; formatted?: string }>;
  type: "single" | "number" | "array" | "boolean";
}

interface MergeResolution {
  field: string;
  action: "select" | "sum" | "max" | "custom" | "combine";
  selectedItemId?: string;
  customValue?: any;
  selectedIds?: string[];
}

interface ItemMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Item[];
  onMerge: (targetItemId: string, resolutions: Record<string, any>) => Promise<void>;
}

export function ItemMergeDialog({ open, onOpenChange, items, onMerge }: ItemMergeDialogProps) {
  const [targetItemId, setTargetItemId] = useState<string>("");
  const [resolutions, setResolutions] = useState<Map<string, MergeResolution>>(new Map());
  const [customValues, setCustomValues] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Detect conflicts between items
  const conflicts = useMemo((): ConflictField[] => {
    if (items.length < 2) return [];

    const conflictFields: ConflictField[] = [];
    const fieldsToCheck = [
      { field: "name", label: "Nome", type: "single" as const },
      { field: "uniCode", label: "Código Único", type: "single" as const },
      { field: "quantity", label: "Quantidade", type: "number" as const },
      { field: "maxQuantity", label: "Quantidade Máxima", type: "number" as const },
      { field: "reorderPoint", label: "Ponto de Reposição", type: "number" as const },
      { field: "reorderQuantity", label: "Quantidade de Reposição", type: "number" as const },
      { field: "boxQuantity", label: "Quantidade por Caixa", type: "number" as const },
      { field: "icms", label: "ICMS (%)", type: "number" as const },
      { field: "ipi", label: "IPI (%)", type: "number" as const },
      { field: "totalPrice", label: "Preço Total", type: "number" as const },
      { field: "monthlyConsumption", label: "Consumo Mensal", type: "number" as const },
      { field: "estimatedLeadTime", label: "Lead Time Estimado", type: "number" as const },
      { field: "barcodes", label: "Códigos de Barras", type: "array" as const },
      { field: "shouldAssignToUser", label: "Atribuir ao Usuário", type: "boolean" as const },
      { field: "isActive", label: "Ativo", type: "boolean" as const },
      { field: "brandId", label: "Marca", type: "single" as const },
      { field: "categoryId", label: "Categoria", type: "single" as const },
      { field: "supplierId", label: "Fornecedor", type: "single" as const },
    ];

    for (const { field, label, type } of fieldsToCheck) {
      const values = items
        .map((item) => {
          const value = (item as any)[field];
          let formatted: string | undefined;

          if (value === null || value === undefined) return null;

          // Format value for display
          if (type === "number" && typeof value === "number") {
            if (field === "totalPrice") {
              formatted = formatCurrency(value);
            } else if (field === "icms" || field === "ipi") {
              formatted = `${value}%`;
            } else {
              formatted = value.toString();
            }
          } else if (type === "array" && Array.isArray(value)) {
            formatted = value.length > 0 ? value.join(", ") : "Nenhum";
          } else if (type === "boolean") {
            formatted = value ? "Sim" : "Não";
          } else {
            formatted = String(value);
          }

          return {
            itemId: item.id,
            itemName: item.name,
            value,
            formatted,
          };
        })
        .filter((v) => v !== null) as Array<{ itemId: string; itemName: string; value: any; formatted?: string }>;

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
  }, [items]);

  // Auto-select first item as target if not set
  useMemo(() => {
    if (items.length > 0 && !targetItemId) {
      setTargetItemId(items[0].id);
    }
  }, [items, targetItemId]);

  // Get preview of merged result
  const mergedPreview = useMemo(() => {
    if (!targetItemId) return null;

    const target = items.find((i) => i.id === targetItemId);
    if (!target) return null;

    const preview: Record<string, any> = { ...target };

    // Apply resolutions
    resolutions.forEach((resolution, field) => {
      switch (resolution.action) {
        case "select":
          if (resolution.selectedItemId) {
            const selectedItem = items.find((i) => i.id === resolution.selectedItemId);
            if (selectedItem) {
              preview[field] = (selectedItem as any)[field];
            }
          }
          break;
        case "sum":
          preview[field] = items.reduce((sum, item) => sum + ((item as any)[field] || 0), 0);
          break;
        case "max":
          preview[field] = Math.max(...items.map((item) => (item as any)[field] || 0));
          break;
        case "custom":
          preview[field] = resolution.customValue;
          break;
        case "combine":
          if (resolution.selectedIds) {
            const arrays = items
              .filter((item) => resolution.selectedIds!.includes(item.id))
              .map((item) => (item as any)[field] || [])
              .flat();
            preview[field] = [...new Set(arrays)]; // Remove duplicates
          }
          break;
      }
    });

    return preview;
  }, [targetItemId, items, resolutions]);

  const handleResolutionChange = (field: string, resolution: MergeResolution) => {
    setResolutions(new Map(resolutions.set(field, resolution)));
  };

  const handleCustomValueChange = (field: string, value: string) => {
    setCustomValues(new Map(customValues.set(field, value)));
  };

  const handleMerge = async () => {
    if (!targetItemId || isLoading) return;

    setIsLoading(true);
    try {
      // Build resolution object
      const resolvedData: Record<string, any> = {};

      resolutions.forEach((resolution, field) => {
        switch (resolution.action) {
          case "select":
            if (resolution.selectedItemId) {
              const selectedItem = items.find((i) => i.id === resolution.selectedItemId);
              if (selectedItem) {
                resolvedData[field] = (selectedItem as any)[field];
              }
            }
            break;
          case "sum":
            resolvedData[field] = items.reduce((sum, item) => sum + ((item as any)[field] || 0), 0);
            break;
          case "max":
            resolvedData[field] = Math.max(...items.map((item) => (item as any)[field] || 0));
            break;
          case "custom":
            resolvedData[field] = resolution.customValue;
            break;
          case "combine":
            if (resolution.selectedIds) {
              const arrays = items
                .filter((item) => resolution.selectedIds!.includes(item.id))
                .map((item) => (item as any)[field] || [])
                .flat();
              resolvedData[field] = [...new Set(arrays)];
            }
            break;
        }
      });

      await onMerge(targetItemId, resolvedData);
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
          <DialogTitle>Mesclar Itens</DialogTitle>
          <DialogDescription>
            Consolide {items.length} itens em um único. O item principal receberá todas as quantidades, pedidos e histórico dos demais.
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
                    <li>O item principal será mantido e receberá todos os dados</li>
                    <li>Os outros itens serão removidos após transferir seus dados</li>
                    <li>Quantidades serão somadas automaticamente</li>
                    <li>Todos os pedidos, movimentações, histórico e relações serão preservados</li>
                    <li>Você pode resolver conflitos entre campos diferentes</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Target Item Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Item Principal</Label>
              <p className="text-sm text-muted-foreground">
                Selecione o item que será mantido. Os demais itens serão consolidados nele e depois removidos.
              </p>
              <RadioGroup value={targetItemId} onValueChange={setTargetItemId}>
                {items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-2 rounded-md border border-border p-3 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value={item.id} id={`target-${item.id}`} />
                    <Label htmlFor={`target-${item.id}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.name}</span>
                        <div className="flex gap-2">
                          {item.uniCode && <Badge variant="secondary">{item.uniCode}</Badge>}
                          <Badge variant="outline">Qtd: {item.quantity}</Badge>
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

                    {conflict.type === "number" && (
                      <div className="space-y-2">
                        <RadioGroup
                          value={resolutions.get(conflict.field)?.action}
                          onValueChange={(action) => {
                            if (action === "sum" || action === "max") {
                              handleResolutionChange(conflict.field, { field: conflict.field, action: action as any });
                            }
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="sum" id={`${conflict.field}-sum`} />
                            <Label htmlFor={`${conflict.field}-sum`} className="cursor-pointer">
                              Somar todos os valores (Total:{" "}
                              {conflict.values.reduce((sum, v) => sum + (typeof v.value === "number" ? v.value : 0), 0)})
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="max" id={`${conflict.field}-max`} />
                            <Label htmlFor={`${conflict.field}-max`} className="cursor-pointer">
                              Usar o maior valor (Máximo: {Math.max(...conflict.values.map((v) => (typeof v.value === "number" ? v.value : 0)))})
                            </Label>
                          </div>
                          {conflict.values.map((value) => (
                            <div key={value.itemId} className="flex items-center space-x-2">
                              <RadioGroupItem
                                value={`select-${value.itemId}`}
                                id={`${conflict.field}-${value.itemId}`}
                                onClick={() =>
                                  handleResolutionChange(conflict.field, {
                                    field: conflict.field,
                                    action: "select",
                                    selectedItemId: value.itemId,
                                  })
                                }
                              />
                              <Label htmlFor={`${conflict.field}-${value.itemId}`} className="cursor-pointer flex items-center gap-2">
                                <span>{value.itemName}:</span>
                                <Badge variant="outline">{value.formatted}</Badge>
                              </Label>
                            </div>
                          ))}
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="custom" id={`${conflict.field}-custom`} />
                            <Label htmlFor={`${conflict.field}-custom`} className="cursor-pointer">
                              Valor personalizado
                            </Label>
                          </div>
                        </RadioGroup>
                        {resolutions.get(conflict.field)?.action === "custom" && (
                          <Input
                            type="number"
                            placeholder="Digite o valor personalizado"
                            value={customValues.get(conflict.field) || ""}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              handleCustomValueChange(conflict.field, e.target.value);
                              handleResolutionChange(conflict.field, {
                                field: conflict.field,
                                action: "custom",
                                customValue: isNaN(value) ? null : value,
                              });
                            }}
                          />
                        )}
                      </div>
                    )}

                    {conflict.type === "single" && (
                      <RadioGroup
                        value={resolutions.get(conflict.field)?.selectedItemId}
                        onValueChange={(itemId) =>
                          handleResolutionChange(conflict.field, {
                            field: conflict.field,
                            action: "select",
                            selectedItemId: itemId,
                          })
                        }
                      >
                        {conflict.values.map((value) => (
                          <div key={value.itemId} className="flex items-center space-x-2">
                            <RadioGroupItem value={value.itemId} id={`${conflict.field}-${value.itemId}`} />
                            <Label htmlFor={`${conflict.field}-${value.itemId}`} className="cursor-pointer flex items-center gap-2">
                              <span>{value.itemName}:</span>
                              <Badge variant="outline">{value.formatted}</Badge>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {conflict.type === "boolean" && (
                      <RadioGroup
                        value={resolutions.get(conflict.field)?.selectedItemId}
                        onValueChange={(itemId) =>
                          handleResolutionChange(conflict.field, {
                            field: conflict.field,
                            action: "select",
                            selectedItemId: itemId,
                          })
                        }
                      >
                        {conflict.values.map((value) => (
                          <div key={value.itemId} className="flex items-center space-x-2">
                            <RadioGroupItem value={value.itemId} id={`${conflict.field}-${value.itemId}`} />
                            <Label htmlFor={`${conflict.field}-${value.itemId}`} className="cursor-pointer flex items-center gap-2">
                              <span>{value.itemName}:</span>
                              <Badge variant={value.value ? "default" : "secondary"}>{value.formatted}</Badge>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {conflict.type === "array" && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Selecione quais valores manter:</p>
                        {conflict.values.map((value) => (
                          <div key={value.itemId} className="flex items-start space-x-2">
                            <Checkbox
                              id={`${conflict.field}-${value.itemId}`}
                              checked={resolutions.get(conflict.field)?.selectedIds?.includes(value.itemId)}
                              onCheckedChange={(checked) => {
                                const currentIds = resolutions.get(conflict.field)?.selectedIds || [];
                                const newIds = checked
                                  ? [...currentIds, value.itemId]
                                  : currentIds.filter((id) => id !== value.itemId);

                                handleResolutionChange(conflict.field, {
                                  field: conflict.field,
                                  action: "combine",
                                  selectedIds: newIds,
                                });
                              }}
                            />
                            <Label htmlFor={`${conflict.field}-${value.itemId}`} className="cursor-pointer">
                              <div>
                                <span className="font-medium">{value.itemName}</span>
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
                    <Label className="text-muted-foreground">Nome</Label>
                    <p className="font-medium">{mergedPreview.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Código</Label>
                    <p className="font-medium">{mergedPreview.uniCode || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Quantidade</Label>
                    <p className="font-medium">{mergedPreview.quantity}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Preço Total</Label>
                    <p className="font-medium">{mergedPreview.totalPrice ? formatCurrency(mergedPreview.totalPrice) : "N/A"}</p>
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
          <Button onClick={handleMerge} disabled={isLoading || hasUnresolvedConflicts || !targetItemId}>
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
