import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconFlask, IconPlus, IconCurrencyDollar, IconWeight, IconCalculator, IconAlertCircle, IconList, IconTrash, IconExternalLink } from "@tabler/icons-react";

import type { Paint, PaintFormula } from "../../../../types";
import { formatCurrency } from "../../../../utils";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useAuth } from "@/contexts/auth-context";
import { deletePaintFormula } from "@/api-client/paint";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FormulaCardSkeleton } from "@/components/ui/formula-card-skeleton";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
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
import { cn } from "@/lib/utils";

interface PaintFormulasCardProps {
  paint: Paint;
  className?: string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onFormulaDeleted?: () => void;
}

export function PaintFormulasCard({ paint, className, isLoading = false, error = null, onRetry, onFormulaDeleted }: PaintFormulasCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; formula: PaintFormula } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<PaintFormula | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Permission checks
  const isWarehouseUser = user?.sector?.privileges === SECTOR_PRIVILEGES.WAREHOUSE;
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;
  const showPrices = !isWarehouseUser;
  const canDelete = isAdmin;

  const handleCreateFormula = () => {
    // Navigate to paint edit page starting at step 2 (formulation)
    navigate(routes.painting.catalog.edit(paint.id) + `?step=2`);
  };

  const handleFormulaClick = (formulaId: string) => {
    // Navigate to formula calculator page
    navigate(routes.painting.catalog.formulaDetails(paint.id, formulaId));
  };

  const handleContextMenu = (e: React.MouseEvent, formula: PaintFormula) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, formula });
  };

  const handleOpenInNewTab = () => {
    if (contextMenu) {
      window.open(routes.painting.catalog.formulaDetails(paint.id, contextMenu.formula.id), "_blank");
      setContextMenu(null);
    }
  };

  const handleDeleteClick = () => {
    if (contextMenu) {
      setDeleteDialog(contextMenu.formula);
      setContextMenu(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    setIsDeleting(true);
    try {
      await deletePaintFormula(deleteDialog.id);
      setDeleteDialog(null);
      onFormulaDeleted?.();
    } catch (error) {
      console.error("Failed to delete formula:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasFormulas = paint.formulas && paint.formulas.length > 0;

  // Show loading skeleton
  if (isLoading) {
    return <FormulaCardSkeleton className={className} itemCount={3} />;
  }

  // Show error state
  if (error) {
    return (
      <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
        <CardHeader className="pb-6 flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
          <IconFlask className="h-5 w-5 text-muted-foreground" />
          Fórmulas
        </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex-1 flex items-center justify-center">
          <div className="text-center py-8 space-y-4">
            <IconAlertCircle className="h-12 w-12 mx-auto text-destructive/50" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">Erro ao carregar fórmulas</p>
              <p className="text-xs text-muted-foreground">{error.message || "Não foi possível carregar as fórmulas desta tinta"}</p>
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="transition-all duration-200">
                Tentar Novamente
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6 flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <IconFlask className="h-5 w-5 text-muted-foreground" />
          Fórmulas ({paint.formulas?.length || 0})
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 space-y-4 flex-1 overflow-y-auto">
        {hasFormulas ? (
          <>
            {[...paint.formulas!].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((formula, index) => (
              <div key={formula.id}>
                <div
                  className="bg-muted/50 rounded-lg p-4 hover:bg-muted/70 transition-all duration-200 cursor-pointer"
                  onClick={() => handleFormulaClick(formula.id)}
                  onContextMenu={(e) => handleContextMenu(e, formula)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <h4 className="font-medium">{formula.description}</h4>
                      <div className="flex flex-wrap gap-4 text-sm">
                        {showPrices && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <IconCurrencyDollar className="h-4 w-4" />
                            <span>{formatCurrency(formula.pricePerLiter)}/L</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <IconWeight className="h-4 w-4" />
                          <span>{Number(formula.density).toFixed(3)} g/ml</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <IconFlask className="h-4 w-4" />
                          <span>{formula.components?.length || 0} componentes</span>
                        </div>
                      </div>
                    </div>
                    {formula.components && formula.components.length > 0 && (
                      <Badge variant="outline" className="ml-2">
                        <IconCalculator className="h-3 w-3 mr-1" />
                        Calculadora
                      </Badge>
                    )}
                  </div>
                </div>
                {index < paint.formulas!.length - 1 && <Separator className="my-3" />}
              </div>
            ))}

            <div className="pt-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(routes.painting.catalog.formulas(paint.id))} className="flex-1">
                <IconList className="h-4 w-4 mr-2" />
                Mostrar Todos
              </Button>
              <Button variant="outline" size="sm" onClick={handleCreateFormula} className="flex-1">
                <IconPlus className="h-4 w-4 mr-2" />
                Nova Fórmula
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-8 space-y-4">
            <div className="animate-in fade-in-50 duration-300">
              <IconFlask className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Nenhuma fórmula cadastrada</p>
                <p className="text-xs text-muted-foreground">Crie a primeira fórmula para esta tinta e comece a produzir</p>
              </div>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => navigate(routes.painting.catalog.formulas(paint.id))}>
                <IconList className="h-4 w-4 mr-2" />
                Mostrar Todos
              </Button>
              <Button variant="outline" size="sm" onClick={handleCreateFormula}>
                <IconPlus className="h-4 w-4 mr-2" />
                Criar Primeira Fórmula
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Context Menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent
          position={contextMenu}
          isOpen={!!contextMenu}
          className="w-48"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem onClick={handleOpenInNewTab}>
            <IconExternalLink className="mr-2 h-4 w-4" />
            Abrir em nova aba
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive focus:text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a fórmula "{deleteDialog?.description}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
