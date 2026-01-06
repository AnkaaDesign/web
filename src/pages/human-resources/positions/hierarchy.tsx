import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IconBriefcase, IconGripVertical, IconCheck, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { usePositions, usePositionBatchMutations } from "@/hooks";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";

interface Position {
  id: string;
  name: string;
  hierarchy: number | null;
  remuneration: number | null;
}

interface SortableRowProps {
  position: Position;
  index: number;
}

function SortableRow({ position, index }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: position.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "N/A";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 p-2 bg-card border rounded-lg hover:bg-muted/50 transition-colors cursor-grab active:cursor-grabbing"
    >
      <IconGripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="font-mono text-xs text-muted-foreground min-w-[2.5rem]">#{index + 1}</span>
      <span className="font-medium flex-1">{position.name}</span>
      <span className="text-sm text-muted-foreground">{formatCurrency(position.remuneration)}</span>
    </div>
  );
}

export const PositionHierarchyPage = () => {
  usePageTracker({ title: "Hierarquia de Cargos", icon: "briefcase" });
  const navigate = useNavigate();
  const { data: positionsData, isLoading } = usePositions({ orderBy: { hierarchy: "asc" } });
  const { batchUpdateAsync } = usePositionBatchMutations();

  const [positions, setPositions] = useState<Position[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (positionsData?.data) {
      // Sort positions by hierarchy, nulls at the end
      const sorted = [...positionsData.data].sort((a, b) => {
        if (a.hierarchy === null && b.hierarchy === null) return 0;
        if (a.hierarchy === null) return 1;
        if (b.hierarchy === null) return -1;
        return a.hierarchy - b.hierarchy;
      });
      setPositions(sorted);
    }
  }, [positionsData]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPositions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        setHasChanges(true);
        return newItems;
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update ALL positions with their hierarchy value based on current order
      const result = await batchUpdateAsync({
        positions: positions.map((position, index) => ({
          id: position.id,
          data: { hierarchy: index + 1 },
        })),
      });

      // Show success toast
      if (result?.data) {
        const { totalSuccess, totalFailed } = result.data;
        if (totalFailed === 0) {
          toast.success(`Hierarquia atualizada com sucesso! ${totalSuccess} ${totalSuccess === 1 ? "cargo atualizado" : "cargos atualizados"}.`);
        } else {
          toast.warning(`${totalSuccess} ${totalSuccess === 1 ? "cargo atualizado" : "cargos atualizados"}, mas ${totalFailed} ${totalFailed === 1 ? "falhou" : "falharam"}.`);
        }
      } else {
        toast.success("Hierarquia atualizada com sucesso!");
      }

      setHasChanges(false);

      // Navigate back to positions list after successful save
      setTimeout(() => {
        navigate(routes.humanResources.positions.root);
      }, 1000);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating hierarchy:", error);
      }
      toast.error("Erro ao atualizar hierarquia. Por favor, tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm("Você tem alterações não salvas. Deseja realmente cancelar?")) {
        navigate(routes.humanResources.positions.root);
      }
    } else {
      navigate(routes.humanResources.positions.root);
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            title="Hierarquia de Cargos"
            icon={IconBriefcase}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Recursos Humanos", href: routes.humanResources.root },
              { label: "Cargos", href: routes.humanResources.positions.root },
              { label: "Hierarquia" },
            ]}
            actions={[
              {
                key: "cancel",
                label: "Cancelar",
                icon: IconX,
                onClick: handleCancel,
                variant: "outline" as const,
                disabled: isSaving,
              },
              {
                key: "save",
                label: isSaving ? "Salvando..." : "Salvar Hierarquia",
                icon: IconCheck,
                onClick: handleSave,
                variant: "default" as const,
                disabled: !hasChanges || isSaving,
              },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <Card className="flex-1 min-h-0 flex flex-col mt-4">
            <CardContent className="flex-1 flex flex-col overflow-hidden p-4">
            {isLoading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={positions.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    {positions.map((position, index) => (
                      <SortableRow key={position.id} position={position} index={index} />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
