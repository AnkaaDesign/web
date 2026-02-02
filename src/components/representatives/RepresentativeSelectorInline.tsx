import React, { useState, useEffect } from 'react';
import { Plus, User, Phone, X, AlertCircle } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { representativeService } from '@/services/representativeService';
import type { Representative, RepresentativeCreateInlineFormData } from '@/types/representative';
import {
  RepresentativeRole,
  REPRESENTATIVE_ROLE_LABELS,
  REPRESENTATIVE_ROLE_COLORS,
} from '@/types/representative';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RepresentativeSelectorInlineProps {
  customerId: string;
  value: string[]; // Array of representative IDs
  onChange: (representativeIds: string[]) => void;
  newRepresentatives?: RepresentativeCreateInlineFormData[];
  onNewRepresentativesChange?: (newReps: RepresentativeCreateInlineFormData[]) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  multiple?: boolean;
  allowedRoles?: RepresentativeRole[];
  inlineCreation?: boolean; // If true, representatives will be created inline with task submission
}

export const RepresentativeSelectorInline: React.FC<RepresentativeSelectorInlineProps> = ({
  customerId,
  value = [],
  onChange,
  newRepresentatives = [],
  onNewRepresentativesChange,
  error,
  helperText,
  disabled,
  label = 'Representantes',
  required = false,
  multiple = true,
  allowedRoles,
  inlineCreation = true,
}) => {
  const { toast } = useToast();

  // State
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RepresentativeRole | null>(null);

  // Form state for creating new representative
  const [newRepName, setNewRepName] = useState('');
  const [newRepPhone, setNewRepPhone] = useState('');
  const [newRepEmail, setNewRepEmail] = useState('');
  const [newRepPassword, setNewRepPassword] = useState('');

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

  const handleRemoveNewRepresentative = (index: number) => {
    if (onNewRepresentativesChange) {
      const updated = [...newRepresentatives];
      updated.splice(index, 1);
      onNewRepresentativesChange(updated);
    }
  };

  const handleCreateNew = () => {
    setCreateDialogOpen(true);
    setSelectedRole(null);
    setNewRepName('');
    setNewRepPhone('');
    setNewRepEmail('');
    setNewRepPassword('');
  };

  const handleSaveNewRepresentative = () => {
    if (!selectedRole || !newRepName || !newRepPhone) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha nome, telefone e função',
        variant: 'error'
      });
      return;
    }

    const newRep: RepresentativeCreateInlineFormData = {
      name: newRepName,
      phone: newRepPhone,
      role: selectedRole,
      email: newRepEmail || undefined,
      password: newRepPassword || undefined,
      isActive: true,
    };

    if (inlineCreation && onNewRepresentativesChange) {
      // Add to pending creation list
      onNewRepresentativesChange([...newRepresentatives, newRep]);

      toast({
        title: 'Representante adicionado',
        description: 'O representante será criado quando você salvar a tarefa',
        variant: 'success'
      });
    } else {
      // Create immediately (legacy mode)
      createRepresentativeNow(newRep);
    }

    setCreateDialogOpen(false);
    setSelectedRole(null);
    setNewRepName('');
    setNewRepPhone('');
    setNewRepEmail('');
    setNewRepPassword('');
  };

  const createRepresentativeNow = async (repData: RepresentativeCreateInlineFormData) => {
    try {
      const created = await representativeService.create({
        ...repData,
        customerId,
      });

      loadRepresentatives();

      // Auto-select the newly created representative
      if (multiple) {
        onChange([...value, created.id]);
      } else {
        onChange([created.id]);
      }

      toast({
        title: 'Representante criado e selecionado',
        variant: 'success'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao criar representante',
        description: error.message,
        variant: 'error'
      });
    }
  };

  const renderSelectedValues = () => {
    if (!multiple || (value.length === 0 && newRepresentatives.length === 0)) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {/* Existing representatives */}
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
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          );
        })}

        {/* New representatives (pending creation) */}
        {newRepresentatives.map((rep, index) => (
          <Badge
            key={`new-${index}`}
            variant="outline"
            className="pr-1 border-dashed border-2"
          >
            {rep.name} ({REPRESENTATIVE_ROLE_LABELS[rep.role]}) - Novo
            {!disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveNewRepresentative(index);
                }}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
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
              {value.length + newRepresentatives.length > 0
                ? `${value.length + newRepresentatives.length} representante(s) selecionado(s)`
                : "Selecione representantes"}
            </span>
            <Plus className="ml-2 h-4 w-4" />
          </Button>

          {renderSelectedValues()}
        </div>

        {inlineCreation && newRepresentatives.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {newRepresentatives.length} representante(s) serão criados quando você salvar a tarefa
            </AlertDescription>
          </Alert>
        )}

        {helperText && (
          <p className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}>
            {helperText}
          </p>
        )}
      </div>

      {/* Manage Representatives Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setSelectedRole(null);
            setNewRepName('');
            setNewRepPhone('');
            setNewRepEmail('');
            setNewRepPassword('');
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Representantes</DialogTitle>
          </DialogHeader>

          {!selectedRole ? (
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
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="text-sm">{rep.name}</div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" />
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
                        disabled={!isAllowed}
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
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rep-name">
                  Nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rep-name"
                  value={newRepName}
                  onChange={(e) => setNewRepName(e.target.value)}
                  placeholder="Nome completo do representante"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rep-phone">
                  Telefone <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rep-phone"
                  value={newRepPhone}
                  onChange={(e) => setNewRepPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rep-email">Email (opcional)</Label>
                <Input
                  id="rep-email"
                  type="email"
                  value={newRepEmail}
                  onChange={(e) => setNewRepEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rep-password">Senha (opcional)</Label>
                <Input
                  id="rep-password"
                  type="password"
                  value={newRepPassword}
                  onChange={(e) => setNewRepPassword(e.target.value)}
                  placeholder="Senha para acesso ao sistema"
                />
              </div>

              <div className="space-y-2">
                <Label>Função</Label>
                <p className="text-sm font-medium">{REPRESENTATIVE_ROLE_LABELS[selectedRole]}</p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedRole(null);
                    setNewRepName('');
                    setNewRepPhone('');
                    setNewRepEmail('');
                    setNewRepPassword('');
                  }}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveNewRepresentative}
                >
                  {inlineCreation ? 'Adicionar' : 'Criar e Selecionar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
