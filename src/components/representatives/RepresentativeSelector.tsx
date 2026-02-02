import React, { useState, useEffect } from 'react';
import { IconPlus, IconUser, IconPhone, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { representativeService } from '@/services/representativeService';
import type { Representative } from '@/types/representative';
import {
  RepresentativeRole,
  REPRESENTATIVE_ROLE_LABELS,
  REPRESENTATIVE_ROLE_COLORS,
} from '@/types/representative';
import { RepresentativeForm } from './RepresentativeForm';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RepresentativeSelectorProps {
  customerId: string;
  value: string[]; // Array of representative IDs
  onChange: (representativeIds: string[]) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  multiple?: boolean;
  allowedRoles?: RepresentativeRole[];
}

export const RepresentativeSelector: React.FC<RepresentativeSelectorProps> = ({
  customerId,
  value = [],
  onChange,
  error,
  helperText,
  disabled,
  label = 'Representantes',
  required = false,
  multiple = true,
  allowedRoles,
}) => {
  const { toast } = useToast();

  // State
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RepresentativeRole | null>(null);

  // Load representatives for the customer
  useEffect(() => {
    if (customerId) {
      loadRepresentatives();
    }
  }, [customerId]);

  const loadRepresentatives = async () => {
    setLoading(true);
    try {
      const reps = await representativeService.getByCustomer(customerId);

      // Filter by allowed roles if specified
      const filteredReps = allowedRoles
        ? reps.filter(r => allowedRoles.includes(r.role))
        : reps;

      setRepresentatives(filteredReps);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar representantes',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (newValue: string) => {
    if (multiple) {
      // For multiple selection, toggle the selected value
      if (value.includes(newValue)) {
        onChange(value.filter(id => id !== newValue));
      } else {
        onChange([...value, newValue]);
      }
    } else {
      onChange([newValue]);
    }
  };

  const handleRemove = (representativeId: string) => {
    onChange(value.filter(id => id !== representativeId));
  };

  const handleCreateNew = () => {
    setCreateDialogOpen(true);
  };

  const handleRepresentativeCreated = (representative: Representative) => {
    setCreateDialogOpen(false);
    setSelectedRole(null);
    loadRepresentatives();

    // Auto-select the newly created representative
    if (multiple) {
      onChange([...value, representative.id]);
    } else {
      onChange([representative.id]);
    }

    toast({
      title: 'Representante criado e selecionado',
      variant: 'success'
    });
  };

  const renderSelectedValues = () => {
    if (!multiple || value.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {value.map((id) => {
          const representative = representatives.find(r => r.id === id);
          if (!representative) return null;

          return (
            <Badge
              key={id}
              variant="secondary"
              className="pr-1"
            >
              {representative.name} ({REPRESENTATIVE_ROLE_LABELS[representative.role]})
              {!disabled && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(id);
                  }}
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                >
                  <IconX className="h-3 w-3" />
                </button>
              )}
            </Badge>
          );
        })}
      </div>
    );
  };

  // Group representatives by role
  const groupedRepresentatives = representatives.reduce((acc, rep) => {
    if (!acc[rep.role]) {
      acc[rep.role] = [];
    }
    acc[rep.role].push(rep);
    return acc;
  }, {} as Record<RepresentativeRole, Representative[]>);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="representative-selector" className={cn(error && "text-destructive")}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>

        {!multiple ? (
          // Single select using standard Select component
          <Select
            value={value[0] || ''}
            onValueChange={handleChange}
            disabled={disabled || loading}
          >
            <SelectTrigger
              id="representative-selector"
              className={cn(error && "border-destructive")}
            >
              <SelectValue placeholder="Selecione um representante" />
            </SelectTrigger>
            <SelectContent>
              {/* Option to create new representative */}
              <div
                className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent border-b mb-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateNew();
                }}
              >
                <IconPlus className="mr-2 h-4 w-4" />
                <span>Criar Novo Representante</span>
              </div>

              {/* No representatives message */}
              {representatives.length === 0 && !loading && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  Nenhum representante cadastrado para este cliente
                </div>
              )}

              {/* Representatives grouped by role */}
              {Object.entries(groupedRepresentatives).map(([role, reps]) => (
                <div key={role}>
                  <div className="px-2 py-1.5 text-sm font-semibold">
                    {REPRESENTATIVE_ROLE_LABELS[role as RepresentativeRole]}
                  </div>
                  {reps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id} className="pl-6">
                      <div className="flex items-center gap-2">
                        <IconUser className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="text-sm">{rep.name}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <IconPhone className="h-3 w-3" />
                            <span>{rep.phone}</span>
                            {rep.email && (
                              <>
                                <span>•</span>
                                <span>{rep.email}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        ) : (
          // Multiple select with custom dropdown
          <div>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-between",
                error && "border-destructive",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              disabled={disabled || loading}
              onClick={() => setCreateDialogOpen(true)}
            >
              <span className="text-left">
                {value.length > 0
                  ? `${value.length} representante(s) selecionado(s)`
                  : "Selecione representantes"}
              </span>
              <IconPlus className="ml-2 h-4 w-4" />
            </Button>

            {renderSelectedValues()}
          </div>
        )}

        {helperText && (
          <p className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}>
            {helperText}
          </p>
        )}
      </div>

      {/* Create Representative Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setSelectedRole(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {multiple ? "Gerenciar Representantes" : "Criar Novo Representante"}
            </DialogTitle>
          </DialogHeader>

          {multiple && !selectedRole && (
            <div className="space-y-4">
              {/* List of existing representatives with selection */}
              <div className="space-y-2">
                <Label>Representantes Disponíveis</Label>
                {representatives.length === 0 && !loading ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Nenhum representante cadastrado para este cliente
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {Object.entries(groupedRepresentatives).map(([role, reps]) => (
                      <div key={role}>
                        <div className="text-sm font-semibold py-1">
                          {REPRESENTATIVE_ROLE_LABELS[role as RepresentativeRole]}
                        </div>
                        {reps.map((rep) => (
                          <div
                            key={rep.id}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer",
                              value.includes(rep.id) && "bg-accent"
                            )}
                            onClick={() => handleChange(rep.id)}
                          >
                            <div className="flex items-center gap-2">
                              <IconUser className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="text-sm">{rep.name}</div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <IconPhone className="h-3 w-3" />
                                  <span>{rep.phone}</span>
                                  {rep.email && (
                                    <>
                                      <span>•</span>
                                      <span>{rep.email}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            {value.includes(rep.id) && (
                              <Badge variant="default" className="text-xs">
                                Selecionado
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Button to create new */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSelectedRole(RepresentativeRole.OWNER)}
              >
                <IconPlus className="mr-2 h-4 w-4" />
                Criar Novo Representante
              </Button>
            </div>
          )}

          {selectedRole ? (
            <RepresentativeForm
              customerId={customerId}
              onSuccess={handleRepresentativeCreated}
              onCancel={() => {
                setCreateDialogOpen(false);
                setSelectedRole(null);
              }}
            />
          ) : !multiple && (
            <div className="pt-2">
              <p className="text-sm mb-4">
                Selecione o tipo de representante que deseja criar:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(RepresentativeRole).map(([key, role]) => {
                  const existingRep = representatives.find(r => r.role === role);
                  const isAllowed = !allowedRoles || allowedRoles.includes(role);

                  return (
                    <Button
                      key={key}
                      variant="outline"
                      className="h-auto py-3 px-4 justify-start"
                      onClick={() => setSelectedRole(role)}
                      disabled={!!existingRep || !isAllowed}
                    >
                      <div className="text-left">
                        <div className="font-medium">
                          {REPRESENTATIVE_ROLE_LABELS[role]}
                        </div>
                        {existingRep && (
                          <div className="text-xs text-muted-foreground">
                            Já existe: {existingRep.name}
                          </div>
                        )}
                        {!isAllowed && (
                          <div className="text-xs text-muted-foreground">
                            Não permitido para esta tarefa
                          </div>
                        )}
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};