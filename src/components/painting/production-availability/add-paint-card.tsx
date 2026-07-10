import { IconPlus } from "@tabler/icons-react";

import { Card } from "@/components/ui/card";

import { AddPaintCombobox } from "./add-paint-combobox";
import type { AddPaintPayload } from "./types";

interface AddPaintCardProps {
  existingIds: Set<string>;
  onAdd: (paint: AddPaintPayload) => void;
  /** Bumped by the parent after each add to remount + clear the search. */
  resetKey: number;
}

/** First card in the row: adds a paint to the plan, styled like a paint card. */
export function AddPaintCard({ existingIds, onAdd, resetKey }: AddPaintCardProps) {
  return (
    <Card className="flex w-[300px] flex-shrink-0 flex-col justify-center gap-3 border-2 border-dashed bg-muted/10 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed">
          <IconPlus className="h-4 w-4" />
        </span>
        Adicionar tinta
      </div>
      <AddPaintCombobox
        resetKey={resetKey}
        existingIds={existingIds}
        onAdd={onAdd}
        className="w-full"
      />
      <p className="text-[11px] text-muted-foreground">Entra com 10,8 L (3 galões). Ajuste depois.</p>
    </Card>
  );
}
