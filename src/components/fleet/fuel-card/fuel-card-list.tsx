import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  FUEL_CARD_TYPE,
  FUEL_CARD_PROVIDER,
  FUEL_CARD_STATUS_LABELS,
  FUEL_CARD_TYPE_LABELS,
  FUEL_CARD_PROVIDER_LABELS
} from "../../../constants";
import { useFuelCards, useFuelCardActions } from "../../../hooks";
import {
  CreditCard,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  Pause,
  Lock,
  Unlock,
  Search,
  Filter,
  Plus,
  User,
  Car,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FuelCardListProps {
  onEdit?: (fuelCard: any) => void;
  onCreate?: () => void;
}

export function FuelCardList({ onEdit, onCreate }: FuelCardListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [providerFilter, setProviderFilter] = useState<string>("ALL");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);

  // Fetch fuel cards
  const { data: fuelCards, isLoading, error } = useFuelCards({
    searchingFor: searchTerm,
    where: {
      ...(statusFilter !== "ALL" && { status: statusFilter }),
      ...(typeFilter !== "ALL" && { type: typeFilter }),
      ...(providerFilter !== "ALL" && { provider: providerFilter }),
    },
    include: {
      assignedUser: true,
      assignedVehicle: true,
    },
    orderBy: { cardNumber: "asc" },
  });

  // Fuel card actions
  const { activate, deactivate, suspend, block, unblock, deleteFuelCard } = useFuelCardActions();

  const handleAction = async (action: string, card: any) => {
    try {
      switch (action) {
        case "activate":
          await activate.mutateAsync(card.id);
          break;
        case "deactivate":
          await deactivate.mutateAsync(card.id);
          break;
        case "suspend":
          await suspend.mutateAsync(card.id);
          break;
        case "block":
          await block.mutateAsync(card.id);
          break;
        case "unblock":
          await unblock.mutateAsync(card.id);
          break;
        case "delete":
          setSelectedCard(card);
          setDeleteDialogOpen(true);
          break;
      }
    } catch (error) {
      console.error(`Erro ao executar ação ${action}:`, error);
    }
  };

  const handleDelete = async () => {
    if (selectedCard) {
      try {
        await deleteFuelCard.mutateAsync(selectedCard.id);
        setDeleteDialogOpen(false);
        setSelectedCard(null);
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
      <Badge variant={variants[status as keyof typeof variants]}>
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

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Erro ao carregar cartões de combustível: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Cartões de Combustível</h2>
          <p className="text-muted-foreground">
            Gerencie os cartões de combustível da frota
          </p>
        </div>
        {onCreate && (
          <Button onClick={onCreate} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Novo Cartão</span>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                {Object.values(FUEL_CARD_STATUS).map((status) => (
                  <SelectItem key={status} value={status}>
                    {FUEL_CARD_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os tipos</SelectItem>
                {Object.values(FUEL_CARD_TYPE).map((type) => (
                  <SelectItem key={type} value={type}>
                    {FUEL_CARD_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Provider Filter */}
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Bandeira" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as bandeiras</SelectItem>
                {Object.values(FUEL_CARD_PROVIDER).map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {FUEL_CARD_PROVIDER_LABELS[provider]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Fuel Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-4"></div>
                <div className="h-3 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fuelCards?.data?.map((card) => (
            <Card key={card.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span className="font-mono text-lg">
                      {formatCardNumber(card.cardNumber)}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onEdit && (
                        <>
                          <DropdownMenuItem onClick={() => onEdit(card)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {getAvailableActions(card).map((action) => (
                        <DropdownMenuItem
                          key={action.action}
                          onClick={() => handleAction(action.action, card)}
                        >
                          <action.icon className="h-4 w-4 mr-2" />
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleAction("delete", card)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(card.status)}
                  <Badge variant="outline">
                    {FUEL_CARD_TYPE_LABELS[card.type]}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Provider */}
                <div>
                  <span className="text-sm font-medium">Bandeira:</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {FUEL_CARD_PROVIDER_LABELS[card.provider]}
                  </span>
                </div>

                {/* Limits */}
                {(card.dailyLimit || card.monthlyLimit) && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Limites:</span>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {card.dailyLimit && (
                        <div>Diário: {formatCurrency(card.dailyLimit)}</div>
                      )}
                      {card.monthlyLimit && (
                        <div>Mensal: {formatCurrency(card.monthlyLimit)}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Assignments */}
                <div className="space-y-2">
                  {card.assignedUser && (
                    <div className="flex items-center space-x-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{card.assignedUser.name}</span>
                    </div>
                  )}
                  {card.assignedVehicle && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span>{card.assignedVehicle.plate} - {card.assignedVehicle.model}</span>
                    </div>
                  )}
                  {!card.assignedUser && !card.assignedVehicle && (
                    <div className="text-sm text-muted-foreground italic">
                      Não atribuído
                    </div>
                  )}
                </div>

                {/* Timestamps */}
                <Separator />
                <div className="text-xs text-muted-foreground">
                  <div>Criado: {new Date(card.createdAt).toLocaleDateString('pt-BR')}</div>
                  {card.updatedAt !== card.createdAt && (
                    <div>Atualizado: {new Date(card.updatedAt).toLocaleDateString('pt-BR')}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {fuelCards?.data?.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum cartão encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== "ALL" || typeFilter !== "ALL" || providerFilter !== "ALL"
                ? "Tente ajustar os filtros para encontrar cartões."
                : "Você ainda não criou nenhum cartão de combustível."}
            </p>
            {onCreate && (
              <Button onClick={onCreate} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Criar primeiro cartão</span>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cartão{" "}
              <span className="font-mono font-semibold">
                {selectedCard && formatCardNumber(selectedCard.cardNumber)}
              </span>
              ? Esta ação não pode ser desfeita.
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