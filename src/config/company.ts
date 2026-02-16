/**
 * Centralized company information used across the application.
 * This is static branding/contact data for Ankaa Design.
 *
 * Used by:
 * - Budget public page (src/pages/public/budget/[id].tsx)
 * - Budget PDF generator (src/utils/budget-pdf-generator.ts)
 */
export const COMPANY_INFO = {
  name: "Ankaa Design",
  address: "Rua: Luis Carlos Zani, 2493 - Santa Paula, Ibipora-PR",
  phone: "43 9 8428-3228",
  phoneClean: "5543984283228",
  website: "ankaadesign.com.br",
  websiteUrl: "https://ankaadesign.com.br",
  directorName: "Sergio Rodrigues",
  directorTitle: "Diretor Comercial",
} as const;

/**
 * Brand colors used in budgets and PDFs.
 * Deep forest green matching the reference PDF template.
 */
export const BRAND_COLORS = {
  primaryGreen: "#0a5c1e",
  textDark: "#1a1a1a",
  textGray: "#666666",
} as const;
