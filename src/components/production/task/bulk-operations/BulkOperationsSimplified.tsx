import React, { useState, forwardRef, useImperativeHandle } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useTaskBatchMutations, useFiles } from "../../../../hooks";
import { toast } from "sonner";
import { IconPhoto, IconFileText, IconPalette, IconCut, IconLoader2 } from "@tabler/icons-react";
import { CUT_TYPE, CUT_ORIGIN } from "../../../../constants";
import { Input } from "@/components/ui/input";

// Type definitions for the operations
type BulkOperationType = "arts" | "documents" | "paints" | "cuttingPlans";

interface AdvancedBulkActionsHandlerProps {
  selectedTaskIds: Set<string>;
  onClearSelection: () => void;
}

export const AdvancedBulkActionsHandler = forwardRef<
  { openModal: (type: BulkOperationType, taskIds: string[]) => void },
  AdvancedBulkActionsHandlerProps
>(({ selectedTaskIds: _selectedTaskIds, onClearSelection }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [operationType, setOperationType] = useState<BulkOperationType | null>(null);
  const [currentTaskIds, setCurrentTaskIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [selectedArtIds, setSelectedArtIds] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState<"budget" | "invoice" | "receipt">("budget");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [generalPaintId, setGeneralPaintId] = useState<string | null>(null);
  const [logoPaintIds, setLogoPaintIds] = useState<string[]>([]);
  const [cutType, setCutType] = useState<CUT_TYPE>(CUT_TYPE.VINYL);
  const [cutQuantity, setCutQuantity] = useState(1);
  const [cutFileId, setCutFileId] = useState<string | null>(null);

  const { batchUpdateAsync } = useTaskBatchMutations();

  // Fetch files for selection
  const { data: filesData } = useFiles({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const files = filesData?.data || [];
  const fileOptions: ComboboxOption[] = files.map(file => ({
    value: file.id,
    label: String(file.name || "Sem nome"),
  }));

  // Filter options by type
  const artworkOptions = fileOptions.filter((_opt, index) => {
    const file = files[index];
    if (!file || !file.name) return false;
    return String(file.name).match(/\.(jpg|jpeg|png|gif|svg|pdf|ai|eps)$/i);
  });

  const documentOptions = fileOptions;

  const resetForm = () => {
    setSelectedArtIds([]);
    setSelectedDocumentIds([]);
    setGeneralPaintId(null);
    setLogoPaintIds([]);
    setCutType(CUT_TYPE.VINYL);
    setCutQuantity(1);
    setCutFileId(null);
    setDocumentType("budget");
  };

  // Expose the openModal method to parent component
  useImperativeHandle(ref, () => ({
    openModal: (type: BulkOperationType, taskIds: string[]) => {
      setOperationType(type);
      setCurrentTaskIds(taskIds);
      resetForm();
      setIsOpen(true);
    },
  }), []);

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false);
      setOperationType(null);
      setCurrentTaskIds([]);
      resetForm();
    }
  };

  const handleSubmit = async () => {
    if (!operationType || currentTaskIds.length === 0) return;

    setIsSubmitting(true);

    try {
      const updateData: any = {};

      switch (operationType) {
        case "arts":
          if (selectedArtIds.length > 0) {
            updateData.artworkIds = selectedArtIds;
          }
          break;

        case "documents":
          if (selectedDocumentIds.length > 0) {
            const idFieldMap: Record<string, string> = {
              budget: "budgetIds",
              invoice: "invoiceIds",
              receipt: "receiptIds",
            };
            updateData[idFieldMap[documentType]] = selectedDocumentIds;
          }
          break;

        case "paints":
          if (generalPaintId) {
            updateData.paintId = generalPaintId;
          }
          if (logoPaintIds.length > 0) {
            updateData.paintIds = logoPaintIds;
          }
          break;

        case "cuttingPlans":
          const cut: any = {
            type: cutType,
            quantity: cutQuantity,
            origin: CUT_ORIGIN.PLAN,
          };
          if (cutFileId) {
            cut.fileId = cutFileId;
          }
          updateData.cuts = [cut];
          break;
      }

      // Check if we have any updates to make
      if (Object.keys(updateData).length === 0) {
        toast.warning("Nenhuma alteração selecionada");
        return;
      }

      // Prepare batch update
      const batchRequest = {
        tasks: currentTaskIds.map(id => ({
          id,
          data: updateData,
        })),
      };

      await batchUpdateAsync(batchRequest);

      toast.success(
        `Operação concluída! ${currentTaskIds.length} ${
          currentTaskIds.length === 1 ? "tarefa atualizada" : "tarefas atualizadas"
        }`
      );

      handleClose();
      onClearSelection();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Bulk operation error:", error);
      }
      toast.error("Erro ao executar operação em lote");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModalTitle = () => {
    if (!operationType) return "";
    const titles: Record<BulkOperationType, string> = {
      arts: "Adicionar Layouts",
      documents: "Adicionar Documentos",
      paints: "Adicionar Tintas",
      cuttingPlans: "Adicionar Plano de Corte",
    };
    return titles[operationType];
  };

  const getModalIcon = () => {
    if (!operationType) return null;
    const icons: Record<BulkOperationType, React.ReactNode> = {
      arts: <IconPhoto className="h-5 w-5" />,
      documents: <IconFileText className="h-5 w-5" />,
      paints: <IconPalette className="h-5 w-5" />,
      cuttingPlans: <IconCut className="h-5 w-5" />,
    };
    return icons[operationType];
  };

  const renderOperationContent = () => {
    if (!operationType) return null;

    switch (operationType) {
      case "arts":
        return (
          <div className="space-y-4">
            <div>
              <Label>Selecionar Layouts Existentes</Label>
              <Combobox
                mode="multiple"
                value={selectedArtIds}
                onValueChange={(value) => setSelectedArtIds(Array.isArray(value) ? value : [])}
                options={artworkOptions}
                placeholder="Selecione arquivos de arte..."
                disabled={isSubmitting}
                searchable
              />
              <p className="text-sm text-muted-foreground mt-2">
                Selecione arquivos de arte já enviados ao sistema
              </p>
            </div>
          </div>
        );

      case "documents":
        return (
          <div className="space-y-4">
            <div>
              <Label>Tipo de Documento</Label>
              <Select
                value={documentType}
                onValueChange={(value: any) => setDocumentType(value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">Orçamento</SelectItem>
                  <SelectItem value="invoice">Nota Fiscal</SelectItem>
                  <SelectItem value="receipt">Recibo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Selecionar Documento</Label>
              <Combobox
                mode="single"
                value={selectedDocumentIds[0] || undefined}
                onValueChange={(value: string | string[] | null | undefined) => setSelectedDocumentIds(value ? [String(value)] : [])}
                options={documentOptions}
                placeholder="Selecione um documento..."
                disabled={isSubmitting}
                searchable
              />
              <Alert className="mt-2">
                <AlertDescription>
                  Documentos permitem apenas seleção única. O mesmo documento será adicionado a todas as tarefas.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        );

      case "paints":
        return (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                A funcionalidade de adicionar tintas em lote não está disponível nesta interface simplificada.
                Por favor, edite cada tarefa individualmente para adicionar tintas.
              </AlertDescription>
            </Alert>
          </div>
        );

      case "cuttingPlans":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Corte</Label>
                <Select
                  value={cutType}
                  onValueChange={(value: CUT_TYPE) => setCutType(value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CUT_TYPE.VINYL}>Vinil</SelectItem>
                    <SelectItem value={CUT_TYPE.STENCIL}>Estêncil</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={cutQuantity.toString()}
                  onChange={(value) => {
                    const numValue = typeof value === 'string' ? parseInt(value) : typeof value === 'number' ? value : 1;
                    setCutQuantity(isNaN(numValue) ? 1 : numValue);
                  }}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <Label>Arquivo de Corte (Opcional)</Label>
              <Combobox
                mode="single"
                value={cutFileId || undefined}
                onValueChange={(value) => setCutFileId(value ? String(value) : null)}
                options={fileOptions}
                placeholder="Selecione um arquivo..."
                disabled={isSubmitting}
                searchable
                clearable
              />
            </div>

            <Alert>
              <AlertDescription>
                Será criado um plano de corte individual para cada tarefa selecionada,
                todos com as mesmas configurações.
              </AlertDescription>
            </Alert>
          </div>
        );

      default:
        return null;
    }
  };

  const canSubmit = () => {
    if (!operationType || isSubmitting) return false;

    switch (operationType) {
      case "arts":
        return selectedArtIds.length > 0;
      case "documents":
        return selectedDocumentIds.length > 0;
      case "paints":
        return false; // Paints bulk operation is not available
      case "cuttingPlans":
        return true; // Cutting plans are always valid (file is optional)
      default:
        return false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getModalIcon()}
            {getModalTitle()}
          </DialogTitle>
          <DialogDescription>
            {currentTaskIds.length} {currentTaskIds.length === 1 ? "tarefa selecionada" : "tarefas selecionadas"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="py-1">
            {renderOperationContent()}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit()}
          >
            {isSubmitting ? (
              <>
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                Aplicando...
              </>
            ) : (
              "Aplicar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

AdvancedBulkActionsHandler.displayName = "AdvancedBulkActionsHandler";