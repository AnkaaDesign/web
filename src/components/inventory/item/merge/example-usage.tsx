/**
 * Example usage of ItemMergeDialog
 *
 * This file demonstrates how to integrate the ItemMergeDialog component
 * into your application for merging items.
 */

import { useState } from "react";
import { ItemMergeDialog } from "./item-merge-dialog";
import { Button } from "@/components/ui/button";
import type { Item } from "../../../../types";
import { itemService } from "../../../../api-client";
import { toast } from "sonner";

export function ItemMergeExample() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);

  // Example: Handle merge operation
  const handleMerge = async (targetItemId: string, resolutions: Record<string, any>) => {
    try {
      // Call your API merge endpoint
      const response = await itemService.merge(targetItemId, {
        sourceItemIds: selectedItems.filter(item => item.id !== targetItemId).map(item => item.id),
        resolutions,
      });

      if (response.success) {
        toast.success("Itens mesclados com sucesso!");
        // Refresh your items list
        // refetchItems();
      } else {
        toast.error(response.message || "Erro ao mesclar itens");
      }
    } catch (error) {
      console.error("Merge error:", error);
      toast.error("Erro ao mesclar itens");
      throw error;
    }
  };

  // Example: Open dialog with selected items
  const openMergeDialog = () => {
    if (selectedItems.length < 2) {
      toast.error("Selecione pelo menos 2 itens para mesclar");
      return;
    }
    setIsDialogOpen(true);
  };

  return (
    <div>
      <Button onClick={openMergeDialog} disabled={selectedItems.length < 2}>
        Mesclar Itens Selecionados ({selectedItems.length})
      </Button>

      <ItemMergeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        items={selectedItems}
        onMerge={handleMerge}
      />
    </div>
  );
}

/**
 * Integration Notes:
 *
 * 1. The component expects an array of Item objects with all relations populated
 *    that you want to display in the conflict resolution.
 *
 * 2. The onMerge callback receives:
 *    - targetItemId: The ID of the item that will be kept
 *    - resolutions: An object containing the resolved values for conflicting fields
 *
 * 3. You need to implement the merge endpoint in your API:
 *    POST /api/items/:targetId/merge
 *    Body: {
 *      sourceItemIds: string[],
 *      resolutions: Record<string, any>
 *    }
 *
 * 4. The component handles:
 *    - Target item selection
 *    - Conflict detection and display
 *    - Resolution UI for different field types (number, string, array, boolean)
 *    - Preview of merged result
 *    - Loading states
 *    - Validation (ensures all conflicts are resolved)
 *
 * 5. Conflict resolution strategies available:
 *    - For numbers: sum, max, select from item, or custom value
 *    - For strings: select from one of the items
 *    - For arrays: combine selected values (removes duplicates)
 *    - For booleans: select from one of the items
 */
