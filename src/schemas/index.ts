// packages/schemas/src/index.ts

export * from "./common";
export * from "./secullum-absence";
export * from "./activity";
export * from "./activity-url-state";
export * from "./timeClockEntry";
export * from "./airbrushing";
export * from "./borrow";
export * from "./changelog";
export * from "./customer";
export * from "./cut";
export * from "./epi";
export * from "./externalOperation";
export * from "./file";
export * from "./goal";
export * from "./holiday";
export * from "./item";
export * from "./maintenance";
export * from "./measure";
export * from "./message";
export * from "./notification";
export * from "./notification-preference";
export * from "./observation";
export * from "./order-rule";
export * from "./order-schedule";
// Order exports (excluding order-schedule duplicates)
export {
  orderIncludeSchema,
  orderItemIncludeSchema,
  orderOrderBySchema,
  orderItemOrderBySchema,
  orderWhereSchema,
  orderItemWhereSchema,
  orderGetManySchema,
  orderItemGetManySchema,
  orderCreateSchema,
  orderUpdateSchema,
  orderItemCreateSchema,
  orderItemUpdateSchema,
  orderBatchCreateSchema,
  orderBatchUpdateSchema,
  orderBatchDeleteSchema,
  orderBatchPaymentSchema,
  orderItemBatchCreateSchema,
  orderItemBatchUpdateSchema,
  orderItemBatchDeleteSchema,
  orderGetByIdSchema,
  orderItemGetByIdSchema,
  orderQuerySchema,
  orderItemQuerySchema,
  mapOrderToFormData,
  mapOrderItemToFormData,
  // Types
  type OrderGetManyFormData,
  type OrderGetByIdFormData,
  type OrderQueryFormData,
  type OrderCreateFormData,
  type OrderUpdateFormData,
  type OrderBatchCreateFormData,
  type OrderBatchUpdateFormData,
  type OrderBatchDeleteFormData,
  type OrderBatchPaymentFormData,
  type OrderInclude,
  type OrderOrderBy,
  type OrderWhere,
  type OrderItemGetManyFormData,
  type OrderItemGetByIdFormData,
  type OrderItemQueryFormData,
  type OrderItemCreateFormData,
  type OrderItemUpdateFormData,
  type OrderItemBatchCreateFormData,
  type OrderItemBatchUpdateFormData,
  type OrderItemBatchDeleteFormData,
  type OrderItemInclude,
  type OrderItemOrderBy,
  type OrderItemWhere,
} from "./order";
export * from "./paint";
export * from "./position";
export * from "./preferences";
export * from "./statistics-preferences";
export * from "./responsible";
export * from "./secullum";
export * from "./warning";
export * from "./sector";
export * from "./serviceOrder";
export * from "./supplier";
export * from "./task";
export * from "./layout";
export * from "./user";
export * from "./dashboard";
export * from "./auth";
export * from "./server";
export * from "./bonus";
export * from "./bonusDiscount";
export * from "./payroll";
// Discount exports (to avoid naming conflicts with payroll and bonusDiscount)
export {
  discountIncludeSchema,
  calculationOrderBySchema as discountOrderBySchema,
  discountWhereSchema,
  discountGetManySchema,
  discountGetByIdSchema,
  discountQuerySchema,
  mapToDiscountFormData,
  // Types
  type DiscountGetManyFormData,
  type DiscountGetByIdFormData,
  type DiscountQueryFormData,
  type DiscountInclude,
  type DiscountOrderBy,
  type DiscountWhere,
} from "./discount";
export * from "./deployment";
export * from "./economic-activity";
export * from "./reconciliation";
export * from "./skill";
// Accounting area — Departamento Pessoal / Medicina do Trabalho
export * from "./salary-adjustment";
export * from "./user-position-history";
export * from "./admission";
export * from "./termination";
export * from "./employment-contract";
export * from "./medical-exam";
export * from "./leave";
export * from "./benefit";
export * from "./dependent";
export * from "./vacation";
export * from "./thirteenth";
export * from "./work-accident";
// Calendário/agenda + post-its (a5-calendar)
export * from "./agenda-event";
export * from "./postit";
