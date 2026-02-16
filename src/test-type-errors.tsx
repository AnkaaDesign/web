// Test file to demonstrate TS2339 errors with Order entity
import type { Order, OrderItem } from '@/types/order';

// Example function that might have TS2339 errors
export function processOrder(order: Order) {
  // These lines would cause TS2339 errors if the properties don't exist on Order type

  // Example 1: Trying to access a property that doesn't exist
  // This would cause: TS2339: Property 'customerName' does not exist on type 'Order'
  // @ts-expect-error - Demonstrating missing property
  const customerName = order.customerName;

  // Example 2: Accessing nested property without null check
  // This could cause errors if supplier is optional
  // @ts-expect-error - Accessing optional property without check
  const supplierName = order.supplier.name; // supplier might be undefined

  // Example 3: Accessing array item without checking
  // @ts-expect-error - Accessing array without checking
  const firstItemName = order.items[0].item.name; // items might be undefined or empty

  // Example 4: Wrong property name
  // @ts-expect-error - Wrong property name
  const orderDate = order.orderDate; // Should be 'createdAt'

  // Example 5: Accessing property that might not be included
  // @ts-expect-error - _count might not be included
  const itemCount = order._count.items; // _count is optional

  return {
    customerName,
    supplierName,
    firstItemName,
    orderDate,
    itemCount
  };
}

// CORRECT way to handle the Order entity
export function processOrderCorrectly(order: Order) {
  // Fix 1: Use correct property or add to type definition if needed
  // If we need customer info, it should be added to the Order type or accessed through relations
  const orderId = order.id; // Use existing property

  // Fix 2: Use optional chaining for optional relations
  const supplierName = order.supplier?.fantasyName ?? 'No supplier';

  // Fix 3: Check array existence and length
  const firstItemName = order.items && order.items.length > 0
    ? order.items[0].item?.name ?? 'Unknown item'
    : 'No items';

  // Fix 4: Use correct property name from type definition
  const orderDate = order.createdAt;

  // Fix 5: Check optional properties before accessing
  const itemCount = order._count?.items ?? 0;

  // Fix 6: Handle all optional file arrays safely
  const hasInvoices = (order.invoices?.length ?? 0) > 0;
  const hasBudgets = (order.budgets?.length ?? 0) > 0;

  // Fix 7: Safely access nested optional properties
  const scheduleFrequency = order.orderSchedule?.frequency ?? null;

  return {
    orderId,
    supplierName,
    firstItemName,
    orderDate,
    itemCount,
    hasInvoices,
    hasBudgets,
    scheduleFrequency
  };
}

// Example with OrderItem
export function processOrderItem(item: OrderItem) {
  // Wrong way - might cause TS2339
  // @ts-expect-error - Wrong property access
  const productName = item.productName; // Doesn't exist

  // Correct way
  const itemName = item.item?.name ?? item.temporaryItemDescription ?? 'Unknown';
  const quantity = item.orderedQuantity;
  const isReceived = item.receivedAt !== null;

  return {
    itemName,
    quantity,
    isReceived
  };
}

// Type guard functions to ensure type safety
export function isOrderWithSupplier(order: Order): order is Order & { supplier: NonNullable<Order['supplier']> } {
  return order.supplier !== undefined && order.supplier !== null;
}

export function isOrderWithItems(order: Order): order is Order & { items: NonNullable<Order['items']> } {
  return order.items !== undefined && order.items !== null && order.items.length > 0;
}

// Using type guards for safe access
export function getSupplierInfo(order: Order) {
  if (isOrderWithSupplier(order)) {
    // Now TypeScript knows supplier is defined
    return {
      supplierName: order.supplier.fantasyName,
      supplierId: order.supplier.id,
      // Access other supplier properties safely
    };
  }
  return null;
}

// Example of handling API response
export function handleOrderResponse(response: any) {
  // Wrong way - no type checking
  // @ts-expect-error - Using any type
  const orderName = response.data.name; // Might not exist

  // Better way - type assertion with validation
  if (response && response.data && typeof response.data === 'object') {
    const order = response.data as Order;

    // Validate essential properties exist
    if (!order.id || !order.status) {
      throw new Error('Invalid order data');
    }

    return order;
  }

  throw new Error('Invalid response format');
}

// Extended type for specific use cases
interface OrderWithFullRelations extends Order {
  supplier: NonNullable<Order['supplier']>;
  items: NonNullable<Order['items']>;
  budgets: NonNullable<Order['budgets']>;
  invoices: NonNullable<Order['invoices']>;
}

// Function requiring full relations
export function generateOrderReport(order: OrderWithFullRelations) {
  // Now we can safely access all relations without optional chaining
  const report = {
    orderId: order.id,
    supplierName: order.supplier.fantasyName,
    itemCount: order.items.length,
    totalItems: order.items.reduce((sum, item) => sum + item.orderedQuantity, 0),
    hasBudgets: order.budgets.length > 0,
    hasInvoices: order.invoices.length > 0,
  };

  return report;
}