import { useState, useCallback } from "react";
import type { BatchOperationResult } from "../../types";

interface UseBatchResultDialogReturn<TSuccess = any, TFailed = any> {
  isOpen: boolean;
  result: BatchOperationResult<TSuccess, TFailed> | null;
  openDialog: (result: BatchOperationResult<TSuccess, TFailed>) => void;
  closeDialog: () => void;
}

export function useBatchResultDialog<TSuccess = any, TFailed = any>(): UseBatchResultDialogReturn<TSuccess, TFailed> {
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<BatchOperationResult<TSuccess, TFailed> | null>(null);

  const openDialog = useCallback((result: BatchOperationResult<TSuccess, TFailed>) => {
    setResult(result);
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    // Clear result after animation completes
    setTimeout(() => setResult(null), 200);
  }, []);

  return {
    isOpen,
    result,
    openDialog,
    closeDialog,
  };
}
