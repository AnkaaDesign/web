// The public budget/dossiê links have two shapes and the difference is not
// cosmetic: with a customer segment the page renders ONLY that customer's
// services, subtotal and payment terms; without it, the complete document.
//
// This has regressed twice by callers substituting an arbitrary customer
// (`customerConfigs[0]`, the task's own customer, the string "all") to satisfy
// a required-string signature — producing a link that says "Completo" in the UI
// and shows one customer to the customer. These tests pin both shapes.
import { describe, it, expect } from "vitest";
import { routes } from "./routes";

describe("public customer document links", () => {
  it("includes the customer segment when one customer is selected", () => {
    expect(routes.customer.budget("cust-1", "quote-9")).toBe("/cliente/cust-1/orcamento/quote-9");
    expect(routes.customer.serviceReport("cust-1", "quote-9")).toBe("/cliente/cust-1/dossie/quote-9");
  });

  it("omits the customer segment for the complete view", () => {
    expect(routes.customer.budget(null, "quote-9")).toBe("/cliente/orcamento/quote-9");
    expect(routes.customer.serviceReport(null, "quote-9")).toBe("/cliente/dossie/quote-9");
  });

  it("treats undefined and empty string as the complete view, never as a customer", () => {
    expect(routes.customer.budget(undefined, "quote-9")).toBe("/cliente/orcamento/quote-9");
    expect(routes.customer.serviceReport("", "quote-9")).toBe("/cliente/dossie/quote-9");
  });

  it("keeps the two shapes distinguishable by segment count (no route ambiguity)", () => {
    const complete = routes.customer.serviceReport(null, ":id").split("/").filter(Boolean);
    const perCustomer = routes.customer.serviceReport(":customerId", ":id").split("/").filter(Boolean);
    expect(complete).toEqual(["cliente", "dossie", ":id"]);
    expect(perCustomer).toEqual(["cliente", ":customerId", "dossie", ":id"]);
  });
});
