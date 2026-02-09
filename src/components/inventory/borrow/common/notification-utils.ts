import { toast } from "sonner";
import { type Borrow, type Item, type User } from "../../../../types";
import { BORROW_STATUS } from "../../../../constants";
import { isBefore, isToday, isTomorrow } from "../../../../utils";
import { differenceInDays } from "date-fns";

/**
 * Types for notification configurations
 */
export interface NotificationConfig {
  title: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
}

export interface BorrowNotificationData {
  borrow: Borrow & {
    item?: Item;
    borrower?: User;
  };
}

/**
 * Notification utility functions for borrow management
 */

/**
 * Send a notification about an overdue borrow
 */
export function notifyOverdueBorrow(data: BorrowNotificationData): void {
  const { borrow } = data;
  const daysOverdue = borrow.returnedAt ? differenceInDays(new Date(), new Date(borrow.returnedAt)) : 0;

  const itemName = borrow.item?.name || "Item";
  const borrowerName = borrow.borrower?.name || "Usuário";

  toast.error(`Empréstimo em atraso!`, {
    description: `${itemName} emprestado para ${borrowerName} está ${daysOverdue} ${daysOverdue === 1 ? "dia" : "dias"} em atraso.`,
    duration: 5000,
  });
}

/**
 * Send a notification for successful borrow creation
 * Note: This function is kept for backward compatibility but is no longer used
 * as the API client now handles CREATE operation toasts automatically
 */
export function notifyBorrowCreated(_data: BorrowNotificationData): void {
  // Removed redundant toast - API client handles this
  // const { borrow } = data;
  // const itemName = borrow.item?.name || "Item";
  // const returnDate = borrow.returnedAt ? formatDate(new Date(borrow.returnedAt)) : "data não definida";
  // toast.success("Empréstimo criado com sucesso!", {
  //   description: `${itemName} foi emprestado. Devolução prevista: ${returnDate}`,
  //   duration: 4000,
  // });
}

/**
 * Send a notification for successful return
 */
export function notifyBorrowReturned(data: BorrowNotificationData & { condition?: string }): void {
  const { borrow, condition } = data;
  const itemName = borrow.item?.name || "Item";
  const borrowerName = borrow.borrower?.name || "Usuário";

  toast.success("Item devolvido com sucesso!", {
    description: `${itemName} foi devolvido por ${borrowerName}${condition ? ` em condição ${condition.toLowerCase()}` : ""}.`,
    duration: 4000,
  });
}

/**
 * Send a reminder notification for upcoming returns
 */
export function notifyUpcomingReturn(data: BorrowNotificationData): void {
  const { borrow } = data;
  const itemName = borrow.item?.name || "Item";
  const borrowerName = borrow.borrower?.name || "Usuário";
  const returnDate = borrow.returnedAt ? new Date(borrow.returnedAt) : null;

  if (!returnDate) return;

  let message = "";
  if (isToday(returnDate)) {
    message = `${itemName} emprestado para ${borrowerName} deve ser devolvido hoje.`;
  } else if (isTomorrow(returnDate)) {
    message = `${itemName} emprestado para ${borrowerName} deve ser devolvido amanhã.`;
  } else {
    const daysUntilReturn = differenceInDays(returnDate, new Date());
    message = `${itemName} emprestado para ${borrowerName} deve ser devolvido em ${daysUntilReturn} dias.`;
  }

  toast.warning("Lembrete de devolução", {
    description: message,
    duration: 5000,
  });
}

/**
 * Send a batch notification for multiple overdue borrows
 */
export function notifyMultipleOverdueBorrows(borrows: BorrowNotificationData[]): void {
  const count = borrows.length;

  if (count === 0) return;

  const itemsList = borrows
    .slice(0, 3)
    .map(({ borrow }) => borrow.item?.name || "Item")
    .join(", ");

  const moreCount = count > 3 ? ` e mais ${count - 3}` : "";

  toast.error(`${count} ${count === 1 ? "empréstimo em atraso" : "empréstimos em atraso"}`, {
    description: `Itens: ${itemsList}${moreCount}`,
    duration: 6000,
  });
}

/**
 * Send error notification for borrow operations
 */
export function notifyBorrowError(error: string | Error, operation: "create" | "return" | "update" | "delete"): void {
  const operations = {
    create: "criar o empréstimo",
    return: "devolver o item",
    update: "atualizar o empréstimo",
    delete: "excluir o empréstimo",
  };

  const errorMessage = error instanceof Error ? error.message : error;

  toast.error(`Erro ao ${operations[operation]}`, {
    description: errorMessage || "Ocorreu um erro inesperado. Tente novamente.",
    duration: 5000,
  });
}

/**
 * Check if a borrow is overdue
 */
export function isBorrowOverdue(borrow: Borrow): boolean {
  if (borrow.status !== BORROW_STATUS.ACTIVE || !borrow.returnedAt) {
    return false;
  }
  return isBefore(new Date(borrow.returnedAt), new Date());
}

/**
 * Check if a borrow is due soon (within specified days)
 */
export function isBorrowDueSoon(borrow: Borrow, daysThreshold: number = 3): boolean {
  if (borrow.status !== BORROW_STATUS.ACTIVE || !borrow.returnedAt) {
    return false;
  }

  const returnDate = new Date(borrow.returnedAt);
  const daysUntilReturn = differenceInDays(returnDate, new Date());

  return daysUntilReturn >= 0 && daysUntilReturn <= daysThreshold;
}

/**
 * Get notification priority based on borrow status
 */
export function getBorrowNotificationPriority(borrow: Borrow): "high" | "medium" | "low" {
  if (isBorrowOverdue(borrow)) {
    const daysOverdue = borrow.returnedAt ? differenceInDays(new Date(), new Date(borrow.returnedAt)) : 0;
    return daysOverdue > 7 ? "high" : "medium";
  }

  if (isBorrowDueSoon(borrow, 1)) {
    return "medium";
  }

  if (isBorrowDueSoon(borrow, 3)) {
    return "low";
  }

  return "low";
}

/**
 * Format notification message for borrow status
 */
export function formatBorrowNotificationMessage(borrow: Borrow & { item?: Item; borrower?: User }): string {
  const itemName = borrow.item?.name || "Item";
  const borrowerName = borrow.borrower?.name || "Usuário";

  if (isBorrowOverdue(borrow)) {
    const daysOverdue = borrow.returnedAt ? differenceInDays(new Date(), new Date(borrow.returnedAt)) : 0;
    return `${itemName} emprestado para ${borrowerName} está ${daysOverdue} ${daysOverdue === 1 ? "dia" : "dias"} em atraso.`;
  }

  if (borrow.returnedAt) {
    const returnDate = new Date(borrow.returnedAt);
    if (isToday(returnDate)) {
      return `${itemName} emprestado para ${borrowerName} deve ser devolvido hoje.`;
    }
    if (isTomorrow(returnDate)) {
      return `${itemName} emprestado para ${borrowerName} deve ser devolvido amanhã.`;
    }
    const daysUntilReturn = differenceInDays(returnDate, new Date());
    if (daysUntilReturn > 0) {
      return `${itemName} emprestado para ${borrowerName} deve ser devolvido em ${daysUntilReturn} dias.`;
    }
  }

  return `${itemName} emprestado para ${borrowerName}.`;
}

/**
 * Schedule notification for upcoming return
 * Note: This is a placeholder for future implementation with a notification service
 */
export function scheduleReturnReminder(_borrow: BorrowNotificationData, _daysBefore: number = 1): void {
  // This would integrate with a backend notification service
  // For now, we just log the intention
}

/**
 * Cancel scheduled notifications for a borrow
 * Note: This is a placeholder for future implementation with a notification service
 */
export function cancelBorrowNotifications(_borrowId: string): void {
  // This would integrate with a backend notification service
  // For now, we just log the intention
}

/**
 * Batch process overdue notifications
 */
export function processOverdueNotifications(borrows: (Borrow & { item?: Item; borrower?: User })[]): void {
  const overdueBorrows = borrows.filter(isBorrowOverdue);

  if (overdueBorrows.length === 0) return;

  if (overdueBorrows.length === 1) {
    notifyOverdueBorrow({ borrow: overdueBorrows[0] });
  } else {
    notifyMultipleOverdueBorrows(overdueBorrows.map((borrow) => ({ borrow })));
  }
}

/**
 * Batch process upcoming return notifications
 */
export function processUpcomingReturnNotifications(borrows: (Borrow & { item?: Item; borrower?: User })[], daysThreshold: number = 3): void {
  const upcomingReturns = borrows.filter((borrow) => isBorrowDueSoon(borrow, daysThreshold));

  upcomingReturns.forEach((borrow) => {
    notifyUpcomingReturn({ borrow });
  });
}
