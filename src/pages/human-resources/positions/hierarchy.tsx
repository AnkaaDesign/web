import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IconBriefcase, IconGripVertical, IconCheck, IconX } from "@tabler/icons-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
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
import { PageHeaderWithFavorite } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { usePositions, usePositionMutations } from "@/hooks";

interface Position {
  id: string;
  name: string;
  hierarchy: number | null;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 p-4 bg-card border rounded-lg hover:bg-muted/50 transition-colors"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <IconGripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 flex items-center gap-4">
        <span className="font-mono text-sm text-muted-foreground min-w-[3rem]">#{index + 1}</span>
        <span className="font-medium">{position.name}</span>
      </div>
    </div>
  );
}

export const PositionHierarchyPage = () => {
  usePageTracker({ title: "Hierarquia de Cargos", icon: "briefcase" });
  const navigate = useNavigate();
  const { data: positionsData, isLoading } = usePositions({ orderBy: { hierarchy: "asc" } });
  const { update } = usePositionMutations();

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
      // Update each position with its new hierarchy value (index + 1)
      const updatePromises = positions.map((position, index) =>
        update({
          id: position.id,
          data: { hierarchy: index + 1 },
        }),
      );

      await Promise.all(updatePromises);
      toast.success("Hierarquia de cargos atualizada com sucesso");
      setHasChanges(false);
    } catch (error) {
      console.error("Error updating hierarchy:", error);
      toast.error("Erro ao atualizar hierarquia de cargos");
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
      <div className="flex flex-col h-full space-y-4">
        <PageHeaderWithFavorite
          title="Hierarquia de Cargos"
          icon={IconBriefcase}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos" },
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

        <Card className="flex-1 min-h-0 flex flex-col">
          <CardHeader>
            <CardTitle>Organizar Hierarquia</CardTitle>
            <CardDescription>Arraste os cargos para reorganizar a hierarquia. O cargo no topo tem a maior prioridade.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
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
    </PrivilegeRoute>
  );
};
