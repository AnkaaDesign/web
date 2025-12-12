import React, { createContext, useContext, useState, useCallback } from "react";

interface PaintSelectionContextType {
  selectedPaintIds: Set<string>;
  isSelected: (paintId: string) => boolean;
  toggleSelection: (paintId: string) => void;
  selectMultiple: (paintIds: string[]) => void;
  clearSelection: () => void;
  selectedCount: number;
}

const PaintSelectionContext = createContext<PaintSelectionContextType | null>(null);

interface PaintSelectionProviderProps {
  children: React.ReactNode;
}

export function PaintSelectionProvider({ children }: PaintSelectionProviderProps) {
  const [selectedPaintIds, setSelectedPaintIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback(
    (paintId: string) => {
      return selectedPaintIds.has(paintId);
    },
    [selectedPaintIds],
  );

  const toggleSelection = useCallback((paintId: string) => {
    setSelectedPaintIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(paintId)) {
        newSet.delete(paintId);
      } else {
        newSet.add(paintId);
      }
      return newSet;
    });
  }, []);

  const selectMultiple = useCallback((paintIds: string[]) => {
    setSelectedPaintIds((prev) => {
      const newSet = new Set(prev);
      paintIds.forEach((id) => newSet.add(id));
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPaintIds(new Set());
  }, []);

  const selectedCount = selectedPaintIds.size;

  return (
    <PaintSelectionContext.Provider
      value={{
        selectedPaintIds,
        isSelected,
        toggleSelection,
        selectMultiple,
        clearSelection,
        selectedCount,
      }}
    >
      {children}
    </PaintSelectionContext.Provider>
  );
}

export function usePaintSelection() {
  const context = useContext(PaintSelectionContext);
  if (!context) {
    throw new Error("usePaintSelection must be used within a PaintSelectionProvider");
  }
  return context;
}
