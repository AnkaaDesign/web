import { z } from "zod";
import type { Item, User } from "../../../../types";

// =====================
// VALIDATION ERROR TYPES
// =====================

export interface ValidationError {
  field: string;
  message: string;
  type: "required" | "invalid" | "stock" | "business" | "price" | "quantity";
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

export interface StageValidationResult {
  canProceed: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
  summary?: string;
}

// =====================
// FORM SCHEMAS FOR VALIDATION
// =====================

// Stage 1 validation schema
export const stage1ValidationSchema = z.object({
  withdrawerId: z.string().min(1, "Usuário retirador deve ser selecionado"),
  withdrawerName: z.string().min(2, "Nome do retirador deve ter pelo menos 2 caracteres"),
  willReturn: z.boolean(),
  observations: z.string().max(500, "Observações devem ter no máximo 500 caracteres").optional(),
});

// Stage 2 item validation schema
export const stage2ItemSchema = z.object({
  itemId: z.string().uuid("ID do item inválido"),
  quantity: z.number().positive("Quantidade deve ser positiva").min(0.01, "Quantidade mínima é 0.01"),
  unitPrice: z.number().min(0, "Preço unitário não pode ser negativo").optional().nullable(),
});

// Stage 2 validation schema
export const stage2ValidationSchema = z.object({
  selectedItems: z.array(stage2ItemSchema).min(1, "Pelo menos um item deve ser selecionado"),
  willReturn: z.boolean(),
});

// Complete form validation schema
export const completeFormValidationSchema = z.object({
  withdrawerName: z.string().min(2, "Nome do retirador deve ter pelo menos 2 caracteres"),
  willReturn: z.boolean(),
  notes: z.string().max(500, "Observações devem ter no máximo 500 caracteres").optional(),
  items: z.array(stage2ItemSchema).min(1, "Pelo menos um item deve ser selecionado"),
});

// =====================
// VALIDATION CONTEXT TYPES
// =====================

export interface ValidationContext {
  availableItems?: Item[];
  selectedUser?: User | null;
  allowNegativeStock?: boolean;
  maxQuantityPerItem?: number;
  minPriceThreshold?: number;
  maxPriceThreshold?: number;
}

// =====================
// STAGE 1 VALIDATION
// =====================

export function validateStage1(
  data: {
    withdrawerId?: string;
    withdrawerName?: string;
    willReturn?: boolean;
    observations?: string;
  },
  context: ValidationContext = {},
): StageValidationResult {
  const errors: ValidationError[] = [];

  // Check required fields
  if (!data.withdrawerId && !data.withdrawerName) {
    errors.push({
      field: "withdrawerId",
      message: "Usuário retirador deve ser selecionado",
      type: "required",
    });
  }

  // Validate withdrawer name if provided
  if (data.withdrawerName && data.withdrawerName.trim().length < 2) {
    errors.push({
      field: "withdrawerName",
      message: "Nome do retirador deve ter pelo menos 2 caracteres",
      type: "invalid",
    });
  }

  // Validate observations length
  if (data.observations && data.observations.length > 500) {
    errors.push({
      field: "observations",
      message: "Observações devem ter no máximo 500 caracteres",
      type: "invalid",
    });
  }

  // Business rule validations
  if (context.selectedUser) {
    // Check if user is active
    if (context.selectedUser.status !== "ACTIVE") {
      errors.push({
        field: "withdrawerId",
        message: "Usuário selecionado está inativo",
        type: "business",
      });
    }

    // Check user permissions (if needed for external withdrawals)
    if (context.selectedUser.sector?.privileges === "EXTERNAL") {
      errors.push({
        field: "withdrawerId",
        message: "Usuários externos não podem fazer retiradas diretas",
        type: "business",
      });
    }
  }

  return {
    canProceed: errors.length === 0,
    errors,
    summary: errors.length > 0 ? `${errors.length} erro(s) encontrado(s)` : "Validação bem-sucedida",
  };
}

// =====================
// STAGE 2 VALIDATION
// =====================

export function validateStage2(
  data: {
    selectedItems: Array<{
      itemId: string;
      quantity: number;
      unitPrice?: number | null;
    }>;
    willReturn: boolean;
  },
  context: ValidationContext = {},
): StageValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check if at least one item is selected
  if (!data.selectedItems || data.selectedItems.length === 0) {
    errors.push({
      field: "items",
      message: "Pelo menos um item deve ser selecionado",
      type: "required",
    });

    return {
      canProceed: false,
      errors,
      summary: "Nenhum item selecionado",
    };
  }

  // Validate each selected item
  for (let i = 0; i < data.selectedItems.length; i++) {
    const item = data.selectedItems[i];
    const fieldPrefix = `items[${i}]`;

    // Validate item ID
    if (!item.itemId) {
      errors.push({
        field: `${fieldPrefix}.itemId`,
        message: `Item ${i + 1}: ID do item é obrigatório`,
        type: "required",
      });
      continue;
    }

    // Find item in available items
    const availableItem = context.availableItems?.find((ai) => ai.id === item.itemId);

    if (!availableItem) {
      errors.push({
        field: `${fieldPrefix}.itemId`,
        message: `Item ${i + 1}: Item não encontrado ou indisponível`,
        type: "invalid",
      });
      continue;
    }

    // Validate quantity
    if (!item.quantity || item.quantity <= 0) {
      errors.push({
        field: `${fieldPrefix}.quantity`,
        message: `${availableItem.name}: Quantidade deve ser maior que zero`,
        type: "quantity",
      });
    } else {
      // Check stock availability
      if (!context.allowNegativeStock && availableItem.quantity < item.quantity) {
        errors.push({
          field: `${fieldPrefix}.quantity`,
          message: `${availableItem.name}: Estoque insuficiente (disponível: ${availableItem.quantity})`,
          type: "stock",
        });
      }

      // Check maximum quantity per item
      if (context.maxQuantityPerItem && item.quantity > context.maxQuantityPerItem) {
        errors.push({
          field: `${fieldPrefix}.quantity`,
          message: `${availableItem.name}: Quantidade máxima permitida é ${context.maxQuantityPerItem}`,
          type: "business",
        });
      }

      // Warning for low stock after withdrawal
      const remainingStock = availableItem.quantity - item.quantity;
      if (remainingStock >= 0 && remainingStock <= (availableItem.reorderPoint || 5)) {
        warnings.push({
          field: `${fieldPrefix}.quantity`,
          message: `${availableItem.name}: Estoque ficará baixo após a retirada (${remainingStock} restantes)`,
          type: "stock",
        });
      }
    }

    // Validate price (only if willReturn is false)
    if (!data.willReturn) {
      if (item.unitPrice === undefined || item.unitPrice === null || item.unitPrice <= 0) {
        errors.push({
          field: `${fieldPrefix}.unitPrice`,
          message: `${availableItem.name}: Preço deve ser definido para itens sem devolução`,
          type: "price",
        });
      } else {
        // Price validation ranges
        if (context.minPriceThreshold && item.unitPrice < context.minPriceThreshold) {
          warnings.push({
            field: `${fieldPrefix}.unitPrice`,
            message: `${availableItem.name}: Preço abaixo do valor mínimo sugerido (R$ ${context.minPriceThreshold.toFixed(2)})`,
            type: "price",
          });
        }

        if (context.maxPriceThreshold && item.unitPrice > context.maxPriceThreshold) {
          warnings.push({
            field: `${fieldPrefix}.unitPrice`,
            message: `${availableItem.name}: Preço acima do valor máximo sugerido (R$ ${context.maxPriceThreshold.toFixed(2)})`,
            type: "price",
          });
        }

        // Compare with current item price if available
        const currentPrice = availableItem.prices?.[0]?.value;
        if (currentPrice && Math.abs(item.unitPrice - currentPrice) > currentPrice * 0.5) {
          warnings.push({
            field: `${fieldPrefix}.unitPrice`,
            message: `${availableItem.name}: Preço muito diferente do preço atual (R$ ${currentPrice.toFixed(2)})`,
            type: "price",
          });
        }
      }
    }
  }

  // Business rule: Check for duplicate items
  const itemIds = data.selectedItems.map((item) => item.itemId);
  const duplicateIds = itemIds.filter((id, index) => itemIds.indexOf(id) !== index);

  if (duplicateIds.length > 0) {
    errors.push({
      field: "items",
      message: "Não é possível selecionar o mesmo item mais de uma vez",
      type: "business",
    });
  }

  return {
    canProceed: errors.length === 0,
    errors,
    warnings,
    summary: errors.length > 0 ? `${errors.length} erro(s) em ${data.selectedItems.length} item(s)` : `${data.selectedItems.length} item(s) validado(s) com sucesso`,
  };
}

// =====================
// STAGE 3/FINAL VALIDATION
// =====================

export function validateCompleteForm(
  data: {
    withdrawerName: string;
    willReturn: boolean;
    notes?: string;
    items: Array<{
      itemId: string;
      quantity: number;
      unitPrice?: number | null;
    }>;
  },
  context: ValidationContext = {},
): StageValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Run Stage 1 validation
  const stage1Result = validateStage1(
    {
      withdrawerName: data.withdrawerName,
      willReturn: data.willReturn,
      observations: data.notes,
    },
    context,
  );

  errors.push(...stage1Result.errors);

  // Run Stage 2 validation
  const stage2Result = validateStage2(
    {
      selectedItems: data.items,
      willReturn: data.willReturn,
    },
    context,
  );

  errors.push(...stage2Result.errors);
  if (stage2Result.warnings) {
    warnings.push(...stage2Result.warnings);
  }

  // Additional complete form validations
  const totalValue = !data.willReturn
    ? data.items.reduce((sum, item) => {
        return sum + (item.unitPrice || 0) * item.quantity;
      }, 0)
    : 0;

  // Warning for high-value transactions
  if (!data.willReturn && totalValue > 10000) {
    warnings.push({
      field: "total",
      message: `Valor total elevado: R$ ${totalValue.toFixed(2)}. Confirme os preços.`,
      type: "business",
    });
  }

  return {
    canProceed: errors.length === 0,
    errors,
    warnings,
    summary: errors.length > 0 ? `${errors.length} erro(s) impedem a criação da retirada` : `Formulário válido - ${data.items.length} item(s), total: R$ ${totalValue.toFixed(2)}`,
  };
}

// =====================
// STOCK VALIDATION HELPERS
// =====================

export function checkStockAvailability(item: Item, requestedQuantity: number, allowNegativeStock = false): ValidationError | null {
  if (requestedQuantity <= 0) {
    return {
      field: "quantity",
      message: "Quantidade deve ser maior que zero",
      type: "quantity",
    };
  }

  if (!allowNegativeStock && item.quantity < requestedQuantity) {
    return {
      field: "quantity",
      message: `Estoque insuficiente para ${item.name}. Disponível: ${item.quantity}`,
      type: "stock",
    };
  }

  return null;
}

export function validateItemPrice(item: Item, price: number | null | undefined, willReturn: boolean): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!willReturn) {
    if (price === undefined || price === null || price <= 0) {
      errors.push({
        field: "unitPrice",
        message: `Preço deve ser definido para ${item.name}`,
        type: "price",
      });
    }
  }

  return errors;
}

// =====================
// BUSINESS RULE VALIDATIONS
// =====================

export function validateBusinessRules(
  data: {
    withdrawerName: string;
    willReturn: boolean;
    items: Array<{
      itemId: string;
      quantity: number;
      unitPrice?: number | null;
    }>;
  },
  context: ValidationContext = {},
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Maximum items per withdrawal
  if (data.items.length > 50) {
    errors.push({
      field: "items",
      message: "Máximo de 50 itens por retirada",
      type: "business",
    });
  }

  // Check for restricted items (could be expanded based on business needs)
  if (context.availableItems) {
    const restrictedItems = data.items.filter((selectedItem) => {
      const item = context.availableItems?.find((ai) => ai.id === selectedItem.itemId);
      return item?.category?.name?.toLowerCase().includes("controlado");
    });

    if (restrictedItems.length > 0) {
      errors.push({
        field: "items",
        message: "Alguns itens selecionados requerem aprovação especial",
        type: "business",
      });
    }
  }

  return errors;
}

// =====================
// VALIDATION SUMMARY FUNCTIONS
// =====================

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

  if (errorsByType.required) {
    messages.push("Campos obrigatórios:");
    errorsByType.required.forEach((error) => {
      messages.push(`  • ${error.message}`);
    });
  }

  if (errorsByType.stock) {
    messages.push("Problemas de estoque:");
    errorsByType.stock.forEach((error) => {
      messages.push(`  • ${error.message}`);
    });
  }

  if (errorsByType.price) {
    messages.push("Problemas de preço:");
    errorsByType.price.forEach((error) => {
      messages.push(`  • ${error.message}`);
    });
  }

  if (errorsByType.business) {
    messages.push("Regras de negócio:");
    errorsByType.business.forEach((error) => {
      messages.push(`  • ${error.message}`);
    });
  }

  if (errorsByType.invalid || errorsByType.quantity) {
    messages.push("Dados inválidos:");
    [...(errorsByType.invalid || []), ...(errorsByType.quantity || [])].forEach((error) => {
      messages.push(`  • ${error.message}`);
    });
  }

  return messages.join("\n");
}

// =====================
// UTILITY FUNCTIONS
// =====================

export function createValidationError(field: string, message: string, type: ValidationError["type"] = "invalid"): ValidationError {
  return { field, message, type };
}

export function validateFieldRequired<T>(value: T | undefined | null, fieldName: string): ValidationError | null {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0)) {
    return createValidationError(fieldName, `${fieldName} é obrigatório`, "required");
  }
  return null;
}

// =====================
// EXPORTED VALIDATION FUNCTIONS
// =====================

export const externalWithdrawalFormValidation = {
  validateStage1,
  validateStage2,
  validateCompleteForm,
  checkStockAvailability,
  validateItemPrice,
  validateBusinessRules,
  getValidationSummary,
  createValidationError,
  validateFieldRequired,
  schemas: {
    stage1: stage1ValidationSchema,
    stage2: stage2ValidationSchema,
    complete: completeFormValidationSchema,
  },
};

// Make default export available
export default externalWithdrawalFormValidation;
