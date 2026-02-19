import { toast } from "@/components/ui/sonner";
import type { BatchOperationResult, BatchOperationSuccess, BatchOperationError } from '@types';

export interface BatchToastOptions {
  entityName: string; // e.g., "empréstimo", "atividade"
  entityNamePlural: string; // e.g., "empréstimos", "atividades"
  showDetails?: boolean;
  maxDetailsToShow?: number;
}

export interface DetailedBatchResult<T, U = unknown> extends BatchOperationResult<T, U> {
  successDetails?: BatchOperationSuccess<T>[];
  failedDetails?: BatchOperationError<U>[];
}

export function showBatchOperationToast<T, U = unknown>(result: DetailedBatchResult<T, U>, options: BatchToastOptions) {
  const { entityName, entityNamePlural, showDetails = true, maxDetailsToShow = 10 } = options;

  const { totalSuccess, totalFailed, successDetails = [], failedDetails = [] } = result;

  // Determine toast type and color based on results
  const hasSuccess = totalSuccess > 0;
  const hasFailures = totalFailed > 0;
  const isPartialSuccess = hasSuccess && hasFailures;
  const isComplete = hasSuccess && !hasFailures;
  const isCompleteFailure = !hasSuccess && hasFailures;

  // Build the main message
  let mainMessage = "";
  if (isComplete) {
    mainMessage = `${totalSuccess} ${totalSuccess === 1 ? entityName : entityNamePlural} criado${totalSuccess === 1 ? "" : "s"} com sucesso`;
  } else if (isCompleteFailure) {
    mainMessage = `${totalFailed} ${totalFailed === 1 ? entityName : entityNamePlural} falhou${totalFailed === 1 ? "" : "aram"}`;
  } else if (isPartialSuccess) {
    mainMessage = `${totalSuccess} ${totalSuccess === 1 ? entityName : entityNamePlural} criado${totalSuccess === 1 ? "" : "s"} com sucesso, ${totalFailed} falhou${totalFailed === 1 ? "" : "aram"}`;
  }

  // Build details if requested
  let detailsMessage = "";
  if (showDetails && (successDetails.length > 0 || failedDetails.length > 0)) {
    const details: string[] = [];

    // Add success details first
    const successesToShow = successDetails.slice(0, Math.min(maxDetailsToShow, successDetails.length));
    successesToShow.forEach((success) => {
      const itemName = success.itemName || `Item ${success.id || success.index}`;
      const userName = success.userName ? ` - ${success.userName}` : "";
      details.push(`✓ ${itemName}${userName}: sucesso`);
    });

    // Add failure details
    const remainingSpace = maxDetailsToShow - successesToShow.length;
    const failuresToShow = failedDetails.slice(0, Math.max(0, remainingSpace));
    failuresToShow.forEach((failure) => {
      const itemName = (failure.data as any)?.itemName || (failure.data as any)?.name || `Item ${failure.id || failure.index}`;
      const userName = (failure.data as any)?.userName ? ` - ${(failure.data as any).userName}` : "";
      details.push(`✗ ${itemName}${userName}: falha - ${failure.error}`);
    });

    if (details.length > 0) {
      detailsMessage = "\n\n" + details.join("\n");
    }

    // Add truncation notice if needed
    const totalDetails = successDetails.length + failedDetails.length;
    if (totalDetails > maxDetailsToShow) {
      detailsMessage += `\n... e mais ${totalDetails - maxDetailsToShow} ${totalDetails - maxDetailsToShow === 1 ? "item" : "itens"}`;
    }
  }

  const fullMessage = mainMessage + detailsMessage;

  // Show appropriate toast
  if (isComplete) {
    toast.success(mainMessage, detailsMessage || undefined, {
      duration: 5000,
    });
  } else if (isCompleteFailure) {
    toast.error(mainMessage, detailsMessage || undefined, {
      duration: 8000,
    });
  } else if (isPartialSuccess) {
    toast.warning(mainMessage, detailsMessage || undefined, {
      duration: 8000,
    });
  }
}

// Convenience function for borrow operations
export function showBorrowBatchToast<T, U = unknown>(result: DetailedBatchResult<T, U>, showDetails = true) {
  return showBatchOperationToast(result, {
    entityName: "empréstimo",
    entityNamePlural: "empréstimos",
    showDetails,
  });
}

// Convenience function for activity operations
export function showActivityBatchToast<T, U = unknown>(result: DetailedBatchResult<T, U>, showDetails = true) {
  return showBatchOperationToast(result, {
    entityName: "atividade",
    entityNamePlural: "atividades",
    showDetails,
  });
}

// Generic function for any entity
export function showGenericBatchToast<T, U = unknown>(result: DetailedBatchResult<T, U>, entityName: string, entityNamePlural: string, showDetails = true) {
  return showBatchOperationToast(result, {
    entityName,
    entityNamePlural,
    showDetails,
  });
}
