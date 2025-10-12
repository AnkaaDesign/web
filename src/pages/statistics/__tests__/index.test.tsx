/**
 * Statistics Dashboard Page Tests
 *
 * Tests for the main statistics dashboard page including:
 * - Page rendering
 * - Tab navigation
 * - Date range selection
 * - Auto-refresh functionality
 * - Manual refresh
 * - Export functionality
 * - Loading states
 * - Error states
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatisticsPage } from "../index";
import { toast } from "sonner";

// Mock dependencies
vi.mock("@/hooks/use-page-tracker", () => ({
  usePageTracker: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/hooks/dashboard", () => ({
  useUnifiedDashboard: vi.fn(() => ({
    data: {
      production: {
        activeTasks: 10,
        previousActiveTasks: 8,
        completedTasks: 5,
        previousCompletedTasks: 4,
      },
      inventory: {
        lowStockCount: 3,
        previousLowStockCount: 2,
        pendingOrders: 7,
        previousPendingOrders: 6,
      },
      hr: {
        totalEmployees: 50,
        previousTotalEmployees: 48,
      },
      financial: {
        monthlyRevenue: 100000,
        previousMonthlyRevenue: 95000,
        monthlyCosts: 60000,
        previousMonthlyCosts: 58000,
        profitMargin: 40,
        previousProfitMargin: 38,
      },
    },
    isLoading: false,
    error: null,
  })),
  useInventoryDashboard: vi.fn(() => ({
    data: {},
    isLoading: false,
    error: null,
  })),
  useProductionDashboard: vi.fn(() => ({
    data: {},
    isLoading: false,
    error: null,
  })),
  useHRDashboard: vi.fn(() => ({
    data: {},
    isLoading: false,
    error: null,
  })),
  useFinancialDashboard: vi.fn(() => ({
    data: {},
    isLoading: false,
    error: null,
  })),
}));

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("StatisticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe("Page Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      expect(container).toBeTruthy();
    });

    it("should render dashboard header with title", () => {
      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Dashboard de Estatísticas")).toBeInTheDocument();
    });

    it("should render breadcrumbs", () => {
      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Início")).toBeInTheDocument();
      expect(screen.getByText("Estatísticas")).toBeInTheDocument();
    });
  });

  describe("Tab Navigation", () => {
    it("should render all 5 tabs", () => {
      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByRole("tab", { name: /visão geral/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /estoque/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /produção/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /rh/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /financeiro/i })).toBeInTheDocument();
    });

    it("should have Overview tab selected by default", () => {
      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const overviewTab = screen.getByRole("tab", { name: /visão geral/i });
      expect(overviewTab).toHaveAttribute("data-state", "active");
    });

    it("should switch to Inventory tab when clicked", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const inventoryTab = screen.getByRole("tab", { name: /estoque/i });
      await user.click(inventoryTab);

      expect(inventoryTab).toHaveAttribute("data-state", "active");
    });

    it("should switch to Production tab when clicked", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const productionTab = screen.getByRole("tab", { name: /produção/i });
      await user.click(productionTab);

      expect(productionTab).toHaveAttribute("data-state", "active");
    });

    it("should switch to HR tab when clicked", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const hrTab = screen.getByRole("tab", { name: /rh/i });
      await user.click(hrTab);

      expect(hrTab).toHaveAttribute("data-state", "active");
    });

    it("should switch to Financial tab when clicked", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const financialTab = screen.getByRole("tab", { name: /financeiro/i });
      await user.click(financialTab);

      expect(financialTab).toHaveAttribute("data-state", "active");
    });
  });

  describe("Date Range Selector", () => {
    it("should render date range selector button", () => {
      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Últimos 30 dias")).toBeInTheDocument();
    });

    it("should open date range dropdown when clicked", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const dateRangeButton = screen.getByText("Últimos 30 dias");
      await user.click(dateRangeButton);

      // Check for date range options
      await waitFor(() => {
        expect(screen.getByText("Hoje")).toBeInTheDocument();
        expect(screen.getByText("Ontem")).toBeInTheDocument();
        expect(screen.getByText("Últimos 7 dias")).toBeInTheDocument();
        expect(screen.getByText("Este mês")).toBeInTheDocument();
        expect(screen.getByText("Mês passado")).toBeInTheDocument();
      });
    });

    it("should change date range when option is selected", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const dateRangeButton = screen.getByText("Últimos 30 dias");
      await user.click(dateRangeButton);

      const last7DaysOption = await screen.findByText("Últimos 7 dias");
      await user.click(last7DaysOption);

      await waitFor(() => {
        expect(screen.getByText("Últimos 7 dias")).toBeInTheDocument();
      });
    });
  });

  describe("Refresh Functionality", () => {
    it("should render manual refresh button", () => {
      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
    });

    it("should call refresh when manual refresh button is clicked", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const refreshButtons = screen.getAllByRole("button");
      const refreshButton = refreshButtons.find((btn) =>
        btn.querySelector('svg')
      );

      if (refreshButton) {
        await user.click(refreshButton);

        await waitFor(() => {
          expect(toast.success).toHaveBeenCalledWith(
            "Dashboard atualizado com sucesso"
          );
        });
      }
    });

    it("should show loading state during refresh", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const refreshButtons = screen.getAllByRole("button");
      const refreshButton = refreshButtons.find((btn) =>
        btn.querySelector('svg')
      );

      if (refreshButton) {
        await user.click(refreshButton);

        // Button should be disabled during refresh
        expect(refreshButton).toBeDisabled();
      }
    });

    it("should auto-refresh at configured intervals", async () => {
      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      // Fast-forward time by 5 minutes (default refresh interval)
      vi.advanceTimersByTime(5 * 60 * 1000);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });
    });
  });

  describe("Export Functionality", () => {
    it("should render export button", () => {
      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Exportar")).toBeInTheDocument();
    });

    it("should show export options when clicked", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const exportButton = screen.getByText("Exportar");
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText("Exportar como PDF")).toBeInTheDocument();
        expect(screen.getByText("Exportar como Excel")).toBeInTheDocument();
        expect(screen.getByText("Exportar como CSV")).toBeInTheDocument();
      });
    });

    it("should trigger export when option is selected", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const exportButton = screen.getByText("Exportar");
      await user.click(exportButton);

      const pdfOption = await screen.findByText("Exportar como PDF");
      await user.click(pdfOption);

      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith("Exportação em desenvolvimento");
      });
    });
  });

  describe("Action Buttons", () => {
    it("should render share button", () => {
      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Compartilhar")).toBeInTheDocument();
    });

    it("should render filter button", () => {
      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const buttons = screen.getAllByRole("button");
      const filterButton = buttons.find((btn) =>
        btn.querySelector('[class*="IconFilter"]')
      );
      expect(filterButton).toBeInTheDocument();
    });

    it("should render settings button", () => {
      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) =>
        btn.querySelector('[class*="IconSettings"]')
      );
      expect(settingsButton).toBeInTheDocument();
    });

    it("should show toast when filter button is clicked", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const buttons = screen.getAllByRole("button");
      const filterButton = buttons.find((btn) =>
        btn.querySelector('[class*="IconFilter"]')
      );

      if (filterButton) {
        await user.click(filterButton);

        await waitFor(() => {
          expect(toast.info).toHaveBeenCalledWith("Filtros em desenvolvimento");
        });
      }
    });

    it("should show toast when settings button is clicked", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) =>
        btn.querySelector('[class*="IconSettings"]')
      );

      if (settingsButton) {
        await user.click(settingsButton);

        await waitFor(() => {
          expect(toast.info).toHaveBeenCalledWith("Configurações em desenvolvimento");
        });
      }
    });
  });

  describe("Last Updated Timestamp", () => {
    it("should display last updated timestamp", () => {
      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/Atualizado:/i)).toBeInTheDocument();
    });

    it("should update timestamp after refresh", async () => {
      const user = userEvent.setup({ delay: null });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      const initialTimestamp = screen.getByText(/Atualizado:/i).textContent;

      // Wait a bit
      vi.advanceTimersByTime(1000);

      const refreshButtons = screen.getAllByRole("button");
      const refreshButton = refreshButtons.find((btn) =>
        btn.querySelector('svg')
      );

      if (refreshButton) {
        await user.click(refreshButton);

        await waitFor(() => {
          const newTimestamp = screen.getByText(/Atualizado:/i).textContent;
          expect(newTimestamp).not.toBe(initialTimestamp);
        });
      }
    });
  });

  describe("Loading States", () => {
    it("should show loading skeletons when data is loading", () => {
      const { useUnifiedDashboard } = require("@/hooks/dashboard");
      useUnifiedDashboard.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      // Loading skeletons should be present
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Error States", () => {
    it("should display error message when data fetch fails", () => {
      const { useUnifiedDashboard } = require("@/hooks/dashboard");
      useUnifiedDashboard.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Failed to fetch dashboard data"),
      });

      render(<StatisticsPage />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/erro/i)).toBeInTheDocument();
    });

    it("should show error toast when refresh fails", async () => {
      const user = userEvent.setup({ delay: null });

      const mockInvalidateQueries = vi.fn().mockRejectedValue(
        new Error("Network error")
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      queryClient.invalidateQueries = mockInvalidateQueries;

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );

      render(<StatisticsPage />, { wrapper });

      const refreshButtons = screen.getAllByRole("button");
      const refreshButton = refreshButtons.find((btn) =>
        btn.querySelector('svg')
      );

      if (refreshButton) {
        await user.click(refreshButton);

        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith("Erro ao atualizar dashboard");
        });
      }
    });
  });
});
