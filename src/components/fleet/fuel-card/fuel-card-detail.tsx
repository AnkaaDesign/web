import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
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
import { formatCurrency } from "../../../utils";
import {
  FUEL_CARD_STATUS,
  FUEL_CARD_STATUS_LABELS,
  FUEL_CARD_TYPE_LABELS,
  FUEL_CARD_PROVIDER_LABELS
} from "../../../constants";
import { useFuelCard, useFuelCardActions } from "../../../hooks";
import {
  CreditCard,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  Pause,
  Lock,
  Unlock,
  User,
  Car,
  DollarSign,
  Calendar,
  AlertTriangle,
  History,
  ArrowLeft,
  Activity
} from "lucide-react";

interface FuelCardDetailProps {
  fuelCardId: string;
  onEdit?: (fuelCard: any) => void;
  onBack?: () => void;
}

export function FuelCardDetail({ fuelCardId, onEdit, onBack }: FuelCardDetailProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch fuel card details
  const { data: fuelCard, isLoading, error } = useFuelCard(fuelCardId, {
    include: {
      assignedUser: true,
      assignedVehicle: true,
      fuels: {
        include: {
          vehicle: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  // Fuel card actions
  const { activate, deactivate, suspend, block, unblock, deleteFuelCard } = useFuelCardActions();

  const handleAction = async (action: string) => {
    if (!fuelCard) return;

    try {
      switch (action) {
        case "activate":
          await activate.mutateAsync(fuelCard.id);
          break;
        case "deactivate":
          await deactivate.mutateAsync(fuelCard.id);
          break;
        case "suspend":
          await suspend.mutateAsync(fuelCard.id);
          break;
        case "block":
          await block.mutateAsync(fuelCard.id);
          break;
        case "unblock":
          await unblock.mutateAsync(fuelCard.id);
          break;
        case "delete":
          setDeleteDialogOpen(true);
          break;
      }
    } catch (error) {
      console.error(`Erro ao executar ação ${action}:`, error);
    }
  };

  const handleDelete = async () => {
    if (fuelCard) {
      try {
        await deleteFuelCard.mutateAsync(fuelCard.id);
        setDeleteDialogOpen(false);
        if (onBack) onBack();
      } catch (error) {
        console.error("Erro ao deletar cartão:", error);
      }
    }
  };

  // Helper functions
  const getStatusBadge = (status: string) => {
    const variants = {
      [FUEL_CARD_STATUS.ACTIVE]: "default" as const,
      [FUEL_CARD_STATUS.INACTIVE]: "secondary" as const,
      [FUEL_CARD_STATUS.SUSPENDED]: "destructive" as const,
      [FUEL_CARD_STATUS.EXPIRED]: "outline" as const,
      [FUEL_CARD_STATUS.BLOCKED]: "destructive" as const,
    };
    return (
      <Badge variant={variants[status as keyof typeof variants]} className="text-sm">
        {FUEL_CARD_STATUS_LABELS[status as keyof typeof FUEL_CARD_STATUS_LABELS]}
      </Badge>
    );
  };

  const formatCardNumber = (cardNumber: string) => {
    if (cardNumber.length <= 4) return cardNumber;
    if (cardNumber.length <= 8) return `${cardNumber.slice(0, 4)} ${cardNumber.slice(4)}`;
    if (cardNumber.length <= 12) return `${cardNumber.slice(0, 4)} ${cardNumber.slice(4, 8)} ${cardNumber.slice(8)}`;
    return `${cardNumber.slice(0, 4)} ${cardNumber.slice(4, 8)} ${cardNumber.slice(8, 12)} ${cardNumber.slice(12)}`;
  };

  const getAvailableActions = (card: any) => {
    const actions = [];

    switch (card.status) {
      case FUEL_CARD_STATUS.INACTIVE:
        actions.push({ label: "Ativar", action: "activate", icon: Play });
        break;
      case FUEL_CARD_STATUS.ACTIVE:
        actions.push({ label: "Desativar", action: "deactivate", icon: Pause });
        actions.push({ label: "Suspender", action: "suspend", icon: AlertTriangle });
        actions.push({ label: "Bloquear", action: "block", icon: Lock });
        break;
      case FUEL_CARD_STATUS.SUSPENDED:
        actions.push({ label: "Ativar", action: "activate", icon: Play });
        actions.push({ label: "Bloquear", action: "block", icon: Lock });
        break;
      case FUEL_CARD_STATUS.BLOCKED:
        actions.push({ label: "Desbloquear", action: "unblock", icon: Unlock });
        break;
    }

    return actions;
  };

  // Calculate consumption statistics
  const consumptionStats = React.useMemo(() => {
    if (!fuelCard?.fuels) return null;

    const totalVolume = fuelCard.fuels.reduce((sum, fuel) => sum + fuel.quantity, 0);
    const totalCost = fuelCard.fuels.reduce((sum, fuel) => sum + fuel.totalPrice, 0);
    const avgPricePerLiter = totalVolume > 0 ? totalCost / totalVolume : 0;

    return {
      totalVolume,
      totalCost,
      avgPricePerLiter,
      fuelCount: fuelCard.fuels.length,
    };
  }, [fuelCard?.fuels]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Erro ao carregar detalhes do cartão: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!fuelCard) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Cartão de combustível não encontrado.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold flex items-center space-x-2">
              <CreditCard className="h-6 w-6 text-primary" />
              <span className="font-mono">{formatCardNumber(fuelCard.cardNumber)}</span>
              {getStatusBadge(fuelCard.status)}
            </h1>
            <p className="text-muted-foreground">
              {FUEL_CARD_TYPE_LABELS[fuelCard.type]} - {FUEL_CARD_PROVIDER_LABELS[fuelCard.provider]}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <>
                <DropdownMenuItem onClick={() => onEdit(fuelCard)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {getAvailableActions(fuelCard).map((action) => (
              <DropdownMenuItem
                key={action.action}
                onClick={() => handleAction(action.action)}
              >
                <action.icon className="h-4 w-4 mr-2" />
                {action.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleAction("delete")}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes do Cartão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Número:</span>
                  <div className="font-mono text-lg">{formatCardNumber(fuelCard.cardNumber)}</div>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Status:</span>
                  <div className="mt-1">{getStatusBadge(fuelCard.status)}</div>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Tipo:</span>
                  <div>{FUEL_CARD_TYPE_LABELS[fuelCard.type]}</div>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Bandeira:</span>
                  <div>{FUEL_CARD_PROVIDER_LABELS[fuelCard.provider]}</div>
                </div>
              </div>

              <Separator />

              {/* Limits */}
              <div>
                <h4 className="font-medium mb-3 flex items-center space-x-2">
                  <DollarSign className="h-4 w-4" />
                  <span>Limites</span>
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Limite Diário:</span>
                    <div className="text-lg">
                      {fuelCard.dailyLimit ? formatCurrency(fuelCard.dailyLimit) : "Sem limite"}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Limite Mensal:</span>
                    <div className="text-lg">
                      {fuelCard.monthlyLimit ? formatCurrency(fuelCard.monthlyLimit) : "Sem limite"}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Assignment */}
              <div>
                <h4 className="font-medium mb-3">Atribuição</h4>
                <div className="space-y-3">
                  {fuelCard.assignedUser ? (
                    <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{fuelCard.assignedUser.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {fuelCard.assignedUser.email}
                          {fuelCard.assignedUser.cpf && ` • CPF: ${fuelCard.assignedUser.cpf}`}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3 p-3 border border-dashed rounded-lg">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <span className="text-muted-foreground">Nenhum usuário atribuído</span>
                    </div>
                  )}

                  {fuelCard.assignedVehicle ? (
                    <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                      <Car className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {fuelCard.assignedVehicle.plate} - {fuelCard.assignedVehicle.model}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {fuelCard.assignedVehicle.year} • {fuelCard.assignedVehicle.manufacturer}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3 p-3 border border-dashed rounded-lg">
                      <Car className="h-5 w-5 text-muted-foreground" />
                      <span className="text-muted-foreground">Nenhum veículo atribuído</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Criado em:</span>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(fuelCard.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
                {fuelCard.updatedAt !== fuelCard.createdAt && (
                  <div>
                    <span className="text-muted-foreground">Atualizado em:</span>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{new Date(fuelCard.updatedAt).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Fuel Records */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <History className="h-5 w-5" />
                <span>Últimos Abastecimentos</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fuelCard.fuels && fuelCard.fuels.length > 0 ? (
                <div className="space-y-3">
                  {fuelCard.fuels.map((fuel, index) => (
                    <div key={fuel.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {fuel.quantity}L • {formatCurrency(fuel.totalPrice)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {fuel.vehicle ? `${fuel.vehicle.plate} - ${fuel.vehicle.model}` : "Veículo não informado"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>{new Date(fuel.createdAt).toLocaleDateString('pt-BR')}</div>
                        <div>{new Date(fuel.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum abastecimento registrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Statistics Sidebar */}
        <div className="space-y-6">
          {/* Consumption Statistics */}
          {consumptionStats && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estatísticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Total de Abastecimentos:</span>
                  <div className="text-2xl font-bold">{consumptionStats.fuelCount}</div>
                </div>
                <Separator />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Volume Total:</span>
                  <div className="text-xl font-semibold">{consumptionStats.totalVolume.toFixed(1)}L</div>
                </div>
                <Separator />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Valor Total:</span>
                  <div className="text-xl font-semibold">{formatCurrency(consumptionStats.totalCost)}</div>
                </div>
                <Separator />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Preço Médio/L:</span>
                  <div className="text-xl font-semibold">{formatCurrency(consumptionStats.avgPricePerLiter)}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {onEdit && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => onEdit(fuelCard)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Cartão
                </Button>
              )}
              {getAvailableActions(fuelCard).map((action) => (
                <Button
                  key={action.action}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleAction(action.action)}
                >
                  <action.icon className="h-4 w-4 mr-2" />
                  {action.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cartão{" "}
              <span className="font-mono font-semibold">
                {formatCardNumber(fuelCard.cardNumber)}
              </span>
              ? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}