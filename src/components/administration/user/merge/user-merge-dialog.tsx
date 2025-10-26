import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle, IconArrowRight, IconCheck, IconLoader2, IconUsers, IconInfoCircle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { User } from "@types";

interface ConflictField {
  field: string;
  label: string;
  values: Array<{ userId: string; userName: string; value: any; formatted?: string }>;
  type: "single" | "array" | "boolean";
}

interface MergeResolution {
  field: string;
  action: "select" | "custom" | "combine";
  selectedUserId?: string;
  customValue?: any;
  selectedIds?: string[];
}

interface UserMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  onMerge: (targetUserId: string, resolutions: Record<string, any>) => Promise<void>;
}

export function UserMergeDialog({ open, onOpenChange, users, onMerge }: UserMergeDialogProps) {
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [resolutions, setResolutions] = useState<Map<string, MergeResolution>>(new Map());
  const [customValues, setCustomValues] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Detect conflicts between users
  const conflicts = useMemo((): ConflictField[] => {
    if (users.length < 2) return [];

    const conflictFields: ConflictField[] = [];
    const fieldsToCheck = [
      { field: "name", label: "Nome", type: "single" as const },
      { field: "email", label: "Email", type: "single" as const },
      { field: "phone", label: "Telefone", type: "single" as const },
      { field: "cpf", label: "CPF", type: "single" as const },
      { field: "pis", label: "PIS", type: "single" as const },
      { field: "birth", label: "Data de Nascimento", type: "single" as const },
      { field: "status", label: "Status", type: "single" as const },
      { field: "positionId", label: "Cargo", type: "single" as const },
      { field: "sectorId", label: "Setor", type: "single" as const },
      { field: "managedSectorId", label: "Setor Gerenciado", type: "single" as const },
      { field: "address", label: "Endereço", type: "single" as const },
      { field: "addressNumber", label: "Número", type: "single" as const },
      { field: "addressComplement", label: "Complemento", type: "single" as const },
      { field: "neighborhood", label: "Bairro", type: "single" as const },
      { field: "city", label: "Cidade", type: "single" as const },
      { field: "state", label: "Estado", type: "single" as const },
      { field: "zipCode", label: "CEP", type: "single" as const },
      { field: "performanceLevel", label: "Nível de Desempenho", type: "single" as const },
      { field: "payrollNumber", label: "Número da Folha", type: "single" as const },
      { field: "avatarId", label: "Avatar", type: "single" as const },
      { field: "verified", label: "Verificado", type: "boolean" as const },
    ];

    for (const { field, label, type } of fieldsToCheck) {
      const values = users
        .map((user) => {
          const value = (user as any)[field];
          let formatted: string | undefined;

          if (value === null || value === undefined) return null;

          // Format value for display
          if (type === "array" && Array.isArray(value)) {
            formatted = value.length > 0 ? value.join(", ") : "Nenhum";
          } else if (type === "boolean") {
            formatted = value ? "Sim" : "Não";
          } else if (field === "birth" && value instanceof Date) {
            formatted = value.toLocaleDateString("pt-BR");
          } else if (field === "status") {
            formatted = value; // Keep status as-is for now
          } else {
            formatted = String(value);
          }

          return {
            userId: user.id,
            userName: user.name,
            value,
            formatted,
          };
        })
        .filter((v) => v !== null) as Array<{ userId: string; userName: string; value: any; formatted?: string }>;

      // Check if there's a conflict (different values)
      if (values.length > 1) {
        const hasConflict =
          type === "array"
            ? !values.every((v) => JSON.stringify(v.value) === JSON.stringify(values[0].value))
            : !values.every((v) => {
                // Special handling for dates
                if (v.value instanceof Date && values[0].value instanceof Date) {
                  return v.value.getTime() === values[0].value.getTime();
                }
                return v.value === values[0].value;
              });

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
  }, [users]);

  // Auto-select first user as target if not set
  useMemo(() => {
    if (users.length > 0 && !targetUserId) {
      setTargetUserId(users[0].id);
    }
  }, [users, targetUserId]);

  // Get preview of merged result
  const mergedPreview = useMemo(() => {
    if (!targetUserId) return null;

    const target = users.find((u) => u.id === targetUserId);
    if (!target) return null;

    const preview: Record<string, any> = { ...target };

    // Apply resolutions
    resolutions.forEach((resolution, field) => {
      switch (resolution.action) {
        case "select":
          if (resolution.selectedUserId) {
            const selectedUser = users.find((u) => u.id === resolution.selectedUserId);
            if (selectedUser) {
              preview[field] = (selectedUser as any)[field];
            }
          }
          break;
        case "custom":
          preview[field] = resolution.customValue;
          break;
        case "combine":
          if (resolution.selectedIds) {
            const arrays = users
              .filter((user) => resolution.selectedIds!.includes(user.id))
              .map((user) => (user as any)[field] || [])
              .flat();
            preview[field] = [...new Set(arrays)]; // Remove duplicates
          }
          break;
      }
    });

    return preview;
  }, [targetUserId, users, resolutions]);

  const handleResolutionChange = (field: string, resolution: MergeResolution) => {
    setResolutions(new Map(resolutions.set(field, resolution)));
  };

  const handleCustomValueChange = (field: string, value: string) => {
    setCustomValues(new Map(customValues.set(field, value)));
  };

  const handleMerge = async () => {
    if (!targetUserId || isLoading) return;

    setIsLoading(true);
    try {
      // Build resolution object
      const resolvedData: Record<string, any> = {};

      resolutions.forEach((resolution, field) => {
        switch (resolution.action) {
          case "select":
            if (resolution.selectedUserId) {
              const selectedUser = users.find((u) => u.id === resolution.selectedUserId);
              if (selectedUser) {
                resolvedData[field] = (selectedUser as any)[field];
              }
            }
            break;
          case "custom":
            resolvedData[field] = resolution.customValue;
            break;
          case "combine":
            if (resolution.selectedIds) {
              const arrays = users
                .filter((user) => resolution.selectedIds!.includes(user.id))
                .map((user) => (user as any)[field] || [])
                .flat();
              resolvedData[field] = [...new Set(arrays)];
            }
            break;
        }
      });

      await onMerge(targetUserId, resolvedData);
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
            Mesclar Usuários
          </DialogTitle>
          <DialogDescription>
            Consolide {users.length} usuários em um único. O usuário principal receberá todas as relações e histórico dos demais.
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
                    <li>O usuário principal será mantido e receberá todos os dados</li>
                    <li>Os outros usuários serão removidos após transferir seus dados</li>
                    <li>Todas as tarefas, atividades e relações serão preservadas</li>
                    <li>Você pode resolver conflitos entre campos diferentes</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Target User Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Usuário Principal</Label>
              <p className="text-sm text-muted-foreground">
                Selecione o usuário que será mantido. Os demais usuários serão consolidados nele e depois removidos.
              </p>
              <RadioGroup value={targetUserId} onValueChange={setTargetUserId}>
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center space-x-2 rounded-md border border-border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <RadioGroupItem value={user.id} id={`target-${user.id}`} />
                    <Label htmlFor={`target-${user.id}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{user.name}</p>
                          {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
                        </div>
                        <div className="flex gap-2">
                          {user.cpf && <Badge variant="secondary">{user.cpf}</Badge>}
                          {user.position && <Badge variant="outline">{user.position.name}</Badge>}
                          {user._count?.tasks && <Badge variant="outline">Tarefas: {user._count.tasks}</Badge>}
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
                        value={resolutions.get(conflict.field)?.selectedUserId}
                        onValueChange={(userId) =>
                          handleResolutionChange(conflict.field, {
                            field: conflict.field,
                            action: "select",
                            selectedUserId: userId,
                          })
                        }
                      >
                        {conflict.values.map((value) => (
                          <div key={value.userId} className="flex items-center space-x-2">
                            <RadioGroupItem value={value.userId} id={`${conflict.field}-${value.userId}`} />
                            <Label htmlFor={`${conflict.field}-${value.userId}`} className="cursor-pointer flex items-center gap-2">
                              <span>{value.userName}:</span>
                              <Badge variant="outline">{value.formatted}</Badge>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {conflict.type === "boolean" && (
                      <RadioGroup
                        value={resolutions.get(conflict.field)?.selectedUserId}
                        onValueChange={(userId) =>
                          handleResolutionChange(conflict.field, {
                            field: conflict.field,
                            action: "select",
                            selectedUserId: userId,
                          })
                        }
                      >
                        {conflict.values.map((value) => (
                          <div key={value.userId} className="flex items-center space-x-2">
                            <RadioGroupItem value={value.userId} id={`${conflict.field}-${value.userId}`} />
                            <Label htmlFor={`${conflict.field}-${value.userId}`} className="cursor-pointer flex items-center gap-2">
                              <span>{value.userName}:</span>
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
                          <div key={value.userId} className="flex items-start space-x-2">
                            <Checkbox
                              id={`${conflict.field}-${value.userId}`}
                              checked={resolutions.get(conflict.field)?.selectedIds?.includes(value.userId)}
                              onCheckedChange={(checked) => {
                                const currentIds = resolutions.get(conflict.field)?.selectedIds || [];
                                const newIds = checked
                                  ? [...currentIds, value.userId]
                                  : currentIds.filter((id) => id !== value.userId);

                                handleResolutionChange(conflict.field, {
                                  field: conflict.field,
                                  action: "combine",
                                  selectedIds: newIds,
                                });
                              }}
                            />
                            <Label htmlFor={`${conflict.field}-${value.userId}`} className="cursor-pointer">
                              <div>
                                <span className="font-medium">{value.userName}</span>
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
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{mergedPreview.email || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">CPF</Label>
                    <p className="font-medium">{mergedPreview.cpf || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Telefone</Label>
                    <p className="font-medium">{mergedPreview.phone || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p className="font-medium">{mergedPreview.status || "N/A"}</p>
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
          <Button onClick={handleMerge} disabled={isLoading || hasUnresolvedConflicts || !targetUserId}>
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
