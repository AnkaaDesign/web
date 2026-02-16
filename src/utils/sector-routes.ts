import { routes } from "../constants";
import type { User, AuthUser } from "../types";
import { SECTOR_PRIVILEGES } from "../constants";

// Type representing user for route determination (only needs sector.privileges)
type RouteUser = User | AuthUser;

/**
 * Get customer detail route based on user's sector
 * - Financial users go to /financeiro/clientes/detalhes/:id
 * - Admin and other users go to /administracao/clientes/detalhes/:id
 */
export function getCustomerDetailRoute(customerId: string, user: RouteUser | null | undefined): string {
  if (!user) {
    return routes.administration.customers.details(customerId);
  }

  // Check if user is from financial sector (and not admin)
  const isFinancialOnly =
    user.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL;

  if (isFinancialOnly) {
    return routes.financial.customers.details(customerId);
  }

  return routes.administration.customers.details(customerId);
}

/**
 * Get customer edit route based on user's sector
 */
export function getCustomerEditRoute(customerId: string, user: RouteUser | null | undefined): string {
  if (!user) {
    return routes.administration.customers.edit(customerId);
  }

  const isFinancialOnly =
    user.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL;

  if (isFinancialOnly) {
    return routes.financial.customers.edit(customerId);
  }

  return routes.administration.customers.edit(customerId);
}

/**
 * Get customer list route based on user's sector
 */
export function getCustomerListRoute(user: RouteUser | null | undefined): string {
  if (!user) {
    return routes.administration.customers.root;
  }

  const isFinancialOnly =
    user.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL;

  if (isFinancialOnly) {
    return routes.financial.customers.root;
  }

  return routes.administration.customers.root;
}
