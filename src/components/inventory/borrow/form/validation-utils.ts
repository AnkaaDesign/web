import type { Item, User, Borrow } from "../../../../types";
import { BORROW_STATUS, SECTOR_PRIVILEGES, ITEM_CATEGORY_TYPE } from "../../../../constants";
import { hasPrivilege } from "../../../../utils";

/**
 * Validation error types
 */
export interface ValidationError {
  field: string;
  message: string;
  type: "stock" | "permission" | "business" | "data";
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Business rules configuration
 */
export interface BorrowValidationConfig {
  maxBorrowQuantity?: number;
  allowNegativeStock?: boolean;
  requireReturnDateForCertainItems?: boolean;
  maxActiveBorrowsPerUser?: number;
  allowBorrowWithExistingActiveBorrows?: boolean;
}

const DEFAULT_CONFIG: BorrowValidationConfig = {
  maxBorrowQuantity: 100,
  allowNegativeStock: false,
  requireReturnDateForCertainItems: false,
  maxActiveBorrowsPerUser: 10,
  allowBorrowWithExistingActiveBorrows: true,
};

/**
 * Check if user has permission to borrow items
 */
export function checkUserBorrowPermission(user: User | null): ValidationError | null {
  if (!user) {
    return {
      field: "user",
      message: "Usuário não encontrado",
      type: "permission",
    };
  }

  // Check if user is active
  if (user.status !== "ACTIVE") {
    return {
      field: "user",
      message: "Usuário inativo não pode fazer empréstimos",
      type: "permission",
    };
  }

  // Check if user has basic privileges at least
  if (!user.sector?.privileges) {
    return {
      field: "user",
      message: "Usuário sem permissões definidas",
      type: "permission",
    };
  }

  // External users might have restrictions
  if (user.sector.privileges === SECTOR_PRIVILEGES.EXTERNAL) {
    return {
      field: "user",
      message: "Usuários externos não podem fazer empréstimos diretos",
      type: "permission",
    };
  }

  return null;
}

/**
 * Check if the requested quantity is available in stock
 */
export function checkStockAvailability(item: Item | null, requestedQuantity: number, config: BorrowValidationConfig = DEFAULT_CONFIG): ValidationError | null {
  if (!item) {
    return {
      field: "item",
      message: "Item não encontrado",
      type: "data",
    };
  }

  if (requestedQuantity <= 0) {
    return {
      field: "quantity",
      message: "Quantidade deve ser maior que zero",
      type: "data",
    };
  }

  if (requestedQuantity > (config.maxBorrowQuantity || DEFAULT_CONFIG.maxBorrowQuantity!)) {
    return {
      field: "quantity",
      message: `Quantidade máxima permitida: ${config.maxBorrowQuantity || DEFAULT_CONFIG.maxBorrowQuantity}`,
      type: "business",
    };
  }

  const availableStock = item.quantity;
  if (availableStock < requestedQuantity && !config.allowNegativeStock) {
    return {
      field: "quantity",
      message: `Estoque insuficiente. Disponível: ${availableStock}`,
      type: "stock",
    };
  }

  return null;
}

/**
 * Check if user has active borrows that might limit new borrows
 */
export function checkUserActiveBorrows(user: User | null, userActiveBorrows: Borrow[], config: BorrowValidationConfig = DEFAULT_CONFIG): ValidationError | null {
  if (!user) {
    return {
      field: "user",
      message: "Usuário não encontrado",
      type: "data",
    };
  }

  const activeBorrowCount = userActiveBorrows.filter((borrow) => borrow.status === BORROW_STATUS.ACTIVE).length;

  if (activeBorrowCount >= (config.maxActiveBorrowsPerUser || DEFAULT_CONFIG.maxActiveBorrowsPerUser!)) {
    return {
      field: "user",
      message: `Limite de empréstimos ativos excedido. Máximo: ${config.maxActiveBorrowsPerUser || DEFAULT_CONFIG.maxActiveBorrowsPerUser}`,
      type: "business",
    };
  }

  if (!config.allowBorrowWithExistingActiveBorrows && activeBorrowCount > 0) {
    return {
      field: "user",
      message: "Usuário possui empréstimos ativos pendentes",
      type: "business",
    };
  }

  return null;
}

/**
 * Check if the same item is already borrowed by the user
 */
export function checkDuplicateBorrow(itemId: string, userId: string, userActiveBorrows: Borrow[]): ValidationError | null {
  const existingBorrow = userActiveBorrows.find((borrow) => borrow.itemId === itemId && borrow.userId === userId && borrow.status === BORROW_STATUS.ACTIVE);

  if (existingBorrow) {
    return {
      field: "item",
      message: "Este item já está emprestado para este usuário",
      type: "business",
    };
  }

  return null;
}

/**
 * Check if item requires special permissions to borrow (e.g., restricted items)
 */
export function checkItemBorrowRestrictions(item: Item | null, user: User | null): ValidationError | null {
  if (!item || !user) {
    return null; // Basic validation handled elsewhere
  }

  // Check if item is a PPE and user has PPE configuration
  if (item.category?.type === ITEM_CATEGORY_TYPE.PPE) {
    // Check if user has PPE size configured if required
    if (!user.ppeSize) {
      return {
        field: "item",
        message: "Usuário precisa ter configuração de EPI para emprestar este item",
        type: "business",
      };
    }
  }

  // Check if item is restricted to certain sectors
  // This could be extended based on business rules

  return null;
}

/**
 * Validate return date if provided
 */
export function validateReturnDate(returnedAt: Date | null | undefined): ValidationError | null {
  if (!returnedAt) {
    return null; // Return date is optional
  }

  const now = new Date();
  if (returnedAt < now) {
    return {
      field: "returnedAt",
      message: "Data de devolução não pode ser no passado",
      type: "data",
    };
  }

  // Could add maximum borrow duration validation here
  const maxBorrowDays = 365; // 1 year
  const maxReturnDate = new Date();
  maxReturnDate.setDate(maxReturnDate.getDate() + maxBorrowDays);

  if (returnedAt > maxReturnDate) {
    return {
      field: "returnedAt",
      message: `Data de devolução não pode exceder ${maxBorrowDays} dias`,
      type: "business",
    };
  }

  return null;
}

/**
 * Main validation function that runs all checks
 */
export function validateBorrowRequest(
  data: {
    item: Item | null;
    user: User | null;
    quantity: number;
    returnedAt?: Date | null;
  },
  context: {
    userActiveBorrows: Borrow[];
    currentUser: User | null; // The user making the request (not the borrower)
  },
  config: BorrowValidationConfig = DEFAULT_CONFIG,
): ValidationResult {
  const errors: ValidationError[] = [];

  // Check if current user has permission to create borrows
  if (!context.currentUser || !hasPrivilege(context.currentUser, SECTOR_PRIVILEGES.WAREHOUSE)) {
    errors.push({
      field: "permission",
      message: "Você não tem permissão para criar empréstimos",
      type: "permission",
    });
  }

  // Check user permissions
  const userPermissionError = checkUserBorrowPermission(data.user);
  if (userPermissionError) {
    errors.push(userPermissionError);
  }

  // Check stock availability
  const stockError = checkStockAvailability(data.item, data.quantity, config);
  if (stockError) {
    errors.push(stockError);
  }

  // Check user active borrows
  if (data.user) {
    const activeBorrowsError = checkUserActiveBorrows(data.user, context.userActiveBorrows, config);
    if (activeBorrowsError) {
      errors.push(activeBorrowsError);
    }

    // Check duplicate borrow
    if (data.item) {
      const duplicateError = checkDuplicateBorrow(data.item.id, data.user.id, context.userActiveBorrows);
      if (duplicateError) {
        errors.push(duplicateError);
      }
    }
  }

  // Check item restrictions
  const itemRestrictionError = checkItemBorrowRestrictions(data.item, data.user);
  if (itemRestrictionError) {
    errors.push(itemRestrictionError);
  }

  // Validate return date
  const returnDateError = validateReturnDate(data.returnedAt);
  if (returnDateError) {
    errors.push(returnDateError);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get validation summary message
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.isValid) {
    return "Validação bem-sucedida";
  }

  const errorsByType = result.errors.reduce(
    (acc, error) => {
      if (!acc[error.type]) {
        acc[error.type] = [];
      }
      acc[error.type].push(error);
      return acc;
    },
    {} as Record<string, ValidationError[]>,
  );

  const messages: string[] = [];

  if (errorsByType.permission) {
    messages.push("Problemas de permissão:");
    errorsByType.permission.forEach((error) => {
      messages.push(`  • ${error.message}`);
    });
  }

  if (errorsByType.stock) {
    messages.push("Problemas de estoque:");
    errorsByType.stock.forEach((error) => {
      messages.push(`  • ${error.message}`);
    });
  }

  if (errorsByType.business) {
    messages.push("Regras de negócio:");
    errorsByType.business.forEach((error) => {
      messages.push(`  • ${error.message}`);
    });
  }

  if (errorsByType.data) {
    messages.push("Dados inválidos:");
    errorsByType.data.forEach((error) => {
      messages.push(`  • ${error.message}`);
    });
  }

  return messages.join("\n");
}

/**
 * Check if a borrow can be returned
 */
export function canReturnBorrow(borrow: Borrow, currentUser: User | null): { canReturn: boolean; reason?: string } {
  if (!currentUser) {
    return { canReturn: false, reason: "Usuário não autenticado" };
  }

  if (borrow.status !== BORROW_STATUS.ACTIVE) {
    return { canReturn: false, reason: "Empréstimo já foi devolvido" };
  }

  // Check if user has permission to return borrows
  if (!hasPrivilege(currentUser, SECTOR_PRIVILEGES.WAREHOUSE)) {
    // Check if it's the same user returning their own borrow
    if (currentUser.id !== borrow.userId) {
      return { canReturn: false, reason: "Sem permissão para devolver empréstimos de outros usuários" };
    }
  }

  return { canReturn: true };
}

/**
 * Calculate available quantity considering active borrows
 */
export function calculateAvailableQuantity(item: Item, activeBorrows: Borrow[]): number {
  const totalBorrowed = activeBorrows.filter((borrow) => borrow.itemId === item.id && borrow.status === BORROW_STATUS.ACTIVE).reduce((sum, borrow) => sum + borrow.quantity, 0);

  return Math.max(0, item.quantity - totalBorrowed);
}

/**
 * Get borrow status message
 */
export function getBorrowStatusMessage(borrow: Borrow): string {
  if (borrow.status === BORROW_STATUS.RETURNED) {
    return `Devolvido em ${new Date(borrow.returnedAt!).toLocaleDateString("pt-BR")}`;
  }

  if (borrow.returnedAt && new Date(borrow.returnedAt) < new Date()) {
    return "Atrasado para devolução";
  }

  return "Ativo";
}
