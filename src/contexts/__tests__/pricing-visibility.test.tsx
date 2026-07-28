// @vitest-environment jsdom
/**
 * Regression tests for the show/hide-values (eye) toggle.
 *
 * The bug these guard against: currency is printed by formatCurrency*(), plain string
 * helpers that read the flag as a module value and are NOT React-subscribed. If nothing
 * re-renders on toggle, every page keeps the string it produced on its last render and
 * the eye button looks dead. The app-wide mechanism is `usePricingVisible()` in App(),
 * which re-creates the route elements — an UPDATE (state survives), not a remount.
 *
 * `FakeApp` below mirrors that structure deliberately: route elements created INSIDE the
 * subscribed component. `StaleApp` mirrors the old broken structure — elements hoisted
 * out of render, so React bails out at the reference-equal element and the toggle never
 * reaches the page.
 */
import { describe, it, expect, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { PricingProvider, usePricingVisible } from "../pricing-context";
import { setPricingVisible, togglePricingVisible } from "@/utils/pricing-visibility";
import { formatCurrency } from "@/utils";

/** A page that formats currency and holds unsaved local state (a typed-in draft). */
function Page() {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <div data-testid="value">{formatCurrency(1234.5)}</div>
      <input data-testid="draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
    </div>
  );
}

function FakeApp() {
  usePricingVisible();
  return (
    <MemoryRouter initialEntries={["/x"]}>
      <PricingProvider>
        <Routes>
          <Route path="/x" element={<Page />} />
        </Routes>
      </PricingProvider>
    </MemoryRouter>
  );
}

// Route element created ONCE, outside render — the shape that made the toggle dead.
const hoistedElement = <Page />;
function StaleApp() {
  usePricingVisible();
  return (
    <MemoryRouter initialEntries={["/x"]}>
      <PricingProvider>
        <Routes>
          <Route path="/x" element={hoistedElement} />
        </Routes>
      </PricingProvider>
    </MemoryRouter>
  );
}

const toggle = async () => {
  await act(async () => {
    togglePricingVisible();
  });
};

afterEach(() => {
  cleanup();
  setPricingVisible(false);
});

describe("pricing visibility toggle", () => {
  it("starts masked", () => {
    render(<FakeApp />);
    expect(screen.getByTestId("value").textContent).toBe("R$ ••••••");
  });

  it("reveals values across the routed tree when toggled", async () => {
    render(<FakeApp />);
    await toggle();
    expect(screen.getByTestId("value").textContent).toContain("1.234,50");
  });

  it("re-masks on the second toggle", async () => {
    render(<FakeApp />);
    await toggle();
    await toggle();
    expect(screen.getByTestId("value").textContent).toBe("R$ ••••••");
  });

  it("updates rather than remounts — in-progress form state survives", async () => {
    render(<FakeApp />);
    fireEvent.change(screen.getByTestId("draft"), { target: { value: "rascunho" } });
    await toggle();
    expect(screen.getByTestId("value").textContent).toContain("1.234,50");
    expect((screen.getByTestId("draft") as HTMLInputElement).value).toBe("rascunho");
  });

  it("mirrors the flag onto <html> so the CSS blur backstop stays in sync", async () => {
    render(<FakeApp />);
    expect(document.documentElement.classList.contains("prices-hidden")).toBe(true);
    await toggle();
    expect(document.documentElement.classList.contains("prices-hidden")).toBe(false);
  });

  it("does NOT reach a page whose element is hoisted out of render (the original bug)", async () => {
    render(<StaleApp />);
    await toggle();
    // Documents WHY App() must create the route elements in its own render: React bails
    // out at a reference-equal element, so this page never re-formats.
    expect(screen.getByTestId("value").textContent).toBe("R$ ••••••");
  });
});
