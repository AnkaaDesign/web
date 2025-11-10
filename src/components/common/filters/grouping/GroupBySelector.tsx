import { useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconGripVertical, IconPlus, IconTrash } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface GroupByField {
  id: string;
  field: string;
  label: string;
  order?: number;
}

export interface GroupByFieldDefinition {
  field: string;
  label: string;
  dataType?: "string" | "number" | "date" | "boolean";
}

export interface GroupBySelectorProps {
  value: GroupByField[];
  onChange: (value: GroupByField[]) => void;
  availableFields: GroupByFieldDefinition[];
  maxGroups?: number;
  className?: string;
}

function SortableGroupItem({
  group,
  availableFields,
  onRemove,
}: {
  group: GroupByField;
  availableFields: GroupByFieldDefinition[];
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const fieldDef = availableFields.find((f) => f.field === group.field);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border rounded-lg bg-background"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <IconGripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="font-medium">{fieldDef?.label || group.field}</div>
        <div className="text-xs text-muted-foreground">Nível {(group.order || 0) + 1}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={onRemove}>
        <IconTrash className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function GroupBySelector({
  value,
  onChange,
  availableFields,
  maxGroups = 3,
  className,
}: GroupBySelectorProps) {
  const [selectedField, setSelectedField] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = value.findIndex((item) => item.id === active.id);
      const newIndex = value.findIndex((item) => item.id === over.id);

      const newValue = arrayMove(value, oldIndex, newIndex).map((item, index) => ({
        ...item,
        order: index,
      }));

      onChange(newValue);
    }
  };

  const addGroup = () => {
    if (!selectedField || value.length >= maxGroups) return;

    const fieldDef = availableFields.find((f) => f.field === selectedField);
    if (!fieldDef) return;

    const newGroup: GroupByField = {
      id: `group-${Date.now()}`,
      field: selectedField,
      label: fieldDef.label,
      order: value.length,
    };

    onChange([...value, newGroup]);
    setSelectedField("");
  };

  const removeGroup = (id: string) => {
    const newValue = value
      .filter((item) => item.id !== id)
      .map((item, index) => ({ ...item, order: index }));
    onChange(newValue);
  };

  const unusedFields = availableFields.filter(
    (field) => !value.some((group) => group.field === field.field)
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Agrupar por</CardTitle>
        <CardDescription>
          Selecione e ordene os campos para agrupar os dados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {value.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={value.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {value.map((group) => (
                  <SortableGroupItem
                    key={group.id}
                    group={group}
                    availableFields={availableFields}
                    onRemove={() => removeGroup(group.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {value.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum agrupamento definido</p>
            <p className="text-sm">Selecione um campo abaixo para começar</p>
          </div>
        )}

        {value.length < maxGroups && unusedFields.length > 0 && (
          <div className="flex gap-2">
            <Select value={selectedField} onValueChange={setSelectedField}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um campo..." />
              </SelectTrigger>
              <SelectContent>
                {unusedFields.map((field) => (
                  <SelectItem key={field.field} value={field.field}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addGroup} disabled={!selectedField}>
              <IconPlus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        )}

        {value.length >= maxGroups && (
          <p className="text-sm text-muted-foreground text-center">
            Máximo de {maxGroups} agrupamentos atingido
          </p>
        )}
      </CardContent>
    </Card>
  );
}
