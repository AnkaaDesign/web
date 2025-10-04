/**
 * Example usage of PaintMergeDialog
 *
 * This file demonstrates how to integrate the PaintMergeDialog component
 * into your application for merging paints.
 */

import { useState } from "react";
import { PaintMergeDialog } from "./paint-merge-dialog";
import { Button } from "@/components/ui/button";
import type { Paint } from "../../../../types";
import { paintService } from "../../../../api-client";
import { toast } from "sonner";
import { IconPalette } from "@tabler/icons-react";

export function PaintMergeExample() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPaints, setSelectedPaints] = useState<Paint[]>([]);

  // Example: Handle merge operation
  const handleMerge = async (targetPaintId: string, resolutions: Record<string, any>) => {
    try {
      // Call your API merge endpoint
      const response = await paintService.merge(targetPaintId, {
        sourcePaintIds: selectedPaints.filter(paint => paint.id !== targetPaintId).map(paint => paint.id),
        resolutions,
      });

      if (response.success) {
        toast.success("Tintas mescladas com sucesso!");
        // Refresh your paints list
        // refetchPaints();
      } else {
        toast.error(response.message || "Erro ao mesclar tintas");
      }
    } catch (error) {
      console.error("Merge error:", error);
      toast.error("Erro ao mesclar tintas");
      throw error;
    }
  };

  // Example: Open dialog with selected paints
  const openMergeDialog = () => {
    if (selectedPaints.length < 2) {
      toast.error("Selecione pelo menos 2 tintas para mesclar");
      return;
    }
    setIsDialogOpen(true);
  };

  return (
    <div>
      <Button onClick={openMergeDialog} disabled={selectedPaints.length < 2}>
        <IconPalette className="h-4 w-4" />
        Mesclar Tintas Selecionadas ({selectedPaints.length})
      </Button>

      <PaintMergeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        paints={selectedPaints}
        onMerge={handleMerge}
      />
    </div>
  );
}

/**
 * Integration Notes:
 *
 * 1. The component expects an array of Paint objects with relevant data populated
 *    for displaying in the conflict resolution UI.
 *
 * 2. The onMerge callback receives:
 *    - targetPaintId: The ID of the paint that will be kept
 *    - resolutions: An object containing the resolved values for conflicting fields
 *
 * 3. You need to implement the merge endpoint in your API:
 *    POST /api/paints/:targetId/merge
 *    Body: {
 *      sourcePaintIds: string[],
 *      resolutions: Record<string, any>
 *    }
 *
 * 4. The component handles:
 *    - Target paint selection with color preview
 *    - Conflict detection and display
 *    - Resolution UI for different field types
 *    - Special handling for color (hex) fields with visual preview
 *    - Preview of merged result with color swatches
 *    - Loading states
 *    - Validation (ensures all conflicts are resolved)
 *
 * 5. Conflict resolution strategies available:
 *    - For colors: select from paint or custom hex value
 *    - For strings (name, code, etc.): select from one of the paints
 *    - For arrays (tags): combine selected values (removes duplicates)
 *    - For enums (finish, manufacturer, palette): select from one of the paints
 *
 * 6. The component includes special UI features for paints:
 *    - Color swatches for hex values
 *    - Formatted labels for enums (finish, manufacturer, palette)
 *    - Visual color preview in the merged result
 *    - Tag management with badges
 */
