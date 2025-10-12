/**
 * Dashboard Header Component Tests
 *
 * Tests for the DashboardHeader component including:
 * - Title and breadcrumbs rendering
 * - Action buttons functionality
 * - Date range selector
 * - Last updated timestamp
 * - Button interactions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { DashboardHeader } from "../DashboardHeader";

// Mock the page header component
vi.mock("@/components/ui/page-header-with-favorite", () => ({
  PageHeaderWithFavorite: ({
    title,
    breadcrumbs,
  }: {
    title: string;
    breadcrumbs: Array<{ label: string; href?: string }>;
  }) => (
    <div>
      <h1>{title}</h1>
      <nav>
        {breadcrumbs.map((crumb, idx) => (
          <span key={idx}>{crumb.label}</span>
        ))}
      </nav>
    </div>
  ),
}));

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
  );
};

describe("DashboardHeader", () => {
  const mockHandlers = {
    onRefresh: vi.fn(),
    onExport: vi.fn(),
    onShare: vi.fn(),
    onDateRangeChange: vi.fn(),
    onFilterClick: vi.fn(),
    onSettingsClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render with default title", () => {
      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Dashboard de Estatísticas")).toBeInTheDocument();
    });

    it("should render with custom title", () => {
      render(<DashboardHeader {...mockHandlers} title="Custom Dashboard" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Custom Dashboard")).toBeInTheDocument();
    });

    it("should render breadcrumbs", () => {
      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Início")).toBeInTheDocument();
      expect(screen.getByText("Estatísticas")).toBeInTheDocument();
    });
  });

  describe("Date Range Selector", () => {
    it("should render date range button with default selection", () => {
      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Últimos 30 dias")).toBeInTheDocument();
    });

    it("should open date range dropdown when clicked", async () => {
      const user = userEvent.setup();

      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const dateButton = screen.getByText("Últimos 30 dias");
      await user.click(dateButton);

      await waitFor(() => {
        expect(screen.getByText("Hoje")).toBeInTheDocument();
        expect(screen.getByText("Ontem")).toBeInTheDocument();
        expect(screen.getByText("Últimos 7 dias")).toBeInTheDocument();
        expect(screen.getByText("Este mês")).toBeInTheDocument();
        expect(screen.getByText("Mês passado")).toBeInTheDocument();
      });
    });

    it("should call onDateRangeChange when a preset is selected", async () => {
      const user = userEvent.setup();

      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const dateButton = screen.getByText("Últimos 30 dias");
      await user.click(dateButton);

      const todayOption = await screen.findByText("Hoje");
      await user.click(todayOption);

      await waitFor(() => {
        expect(mockHandlers.onDateRangeChange).toHaveBeenCalled();
        const call = mockHandlers.onDateRangeChange.mock.calls[0];
        expect(call[0]).toBeInstanceOf(Date);
        expect(call[1]).toBeInstanceOf(Date);
      });
    });

    it("should update button text when different preset is selected", async () => {
      const user = userEvent.setup();

      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const dateButton = screen.getByText("Últimos 30 dias");
      await user.click(dateButton);

      const last7DaysOption = await screen.findByText("Últimos 7 dias");
      await user.click(last7DaysOption);

      await waitFor(() => {
        expect(screen.getByText("Últimos 7 dias")).toBeInTheDocument();
      });
    });

    it("should highlight selected preset", async () => {
      const user = userEvent.setup();

      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const dateButton = screen.getByText("Últimos 30 dias");
      await user.click(dateButton);

      // The default preset should be highlighted
      const defaultOption = screen.getByText("Últimos 30 dias");
      const parentElement = defaultOption.closest('[role="menuitem"]');
      expect(parentElement).toHaveClass("bg-accent");
    });
  });

  describe("Last Updated Timestamp", () => {
    it("should display last updated timestamp when provided", () => {
      const lastUpdated = new Date("2025-01-15T10:30:00");

      render(<DashboardHeader {...mockHandlers} lastUpdated={lastUpdated} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/Atualizado:/)).toBeInTheDocument();
      expect(screen.getByText(/10:30/)).toBeInTheDocument();
    });

    it("should not display timestamp when not provided", () => {
      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      expect(screen.queryByText(/Atualizado:/)).not.toBeInTheDocument();
    });

    it("should format timestamp in Brazilian Portuguese", () => {
      const lastUpdated = new Date("2025-01-15T14:25:30");

      render(<DashboardHeader {...mockHandlers} lastUpdated={lastUpdated} />, {
        wrapper: createWrapper(),
      });

      const timestamp = screen.getByText(/Atualizado:/);
      expect(timestamp.textContent).toContain("14:25");
    });
  });

  describe("Action Buttons", () => {
    it("should render filter button when handler is provided", () => {
      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const buttons = screen.getAllByRole("button");
      const filterButton = buttons.find((btn) =>
        btn.querySelector('svg[class*="IconFilter"]')
      );
      expect(filterButton).toBeInTheDocument();
    });

    it("should call onFilterClick when filter button is clicked", async () => {
      const user = userEvent.setup();

      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const buttons = screen.getAllByRole("button");
      const filterButton = buttons.find((btn) =>
        btn.querySelector('svg[class*="IconFilter"]')
      );

      if (filterButton) {
        await user.click(filterButton);
        expect(mockHandlers.onFilterClick).toHaveBeenCalledTimes(1);
      }
    });

    it("should not render filter button when handler is not provided", () => {
      const { onFilterClick, ...handlersWithoutFilter } = mockHandlers;

      render(<DashboardHeader {...handlersWithoutFilter} />, {
        wrapper: createWrapper(),
      });

      const buttons = screen.getAllByRole("button");
      const filterButton = buttons.find((btn) =>
        btn.querySelector('svg[class*="IconFilter"]')
      );
      expect(filterButton).toBeUndefined();
    });
  });

  describe("Refresh Button", () => {
    it("should render refresh button", () => {
      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const buttons = screen.getAllByRole("button");
      const refreshButton = buttons.find((btn) =>
        btn.querySelector('svg[class*="IconRefresh"]')
      );
      expect(refreshButton).toBeInTheDocument();
    });

    it("should call onRefresh when refresh button is clicked", async () => {
      const user = userEvent.setup();

      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const buttons = screen.getAllByRole("button");
      const refreshButton = buttons.find((btn) =>
        btn.querySelector('svg[class*="IconRefresh"]')
      );

      if (refreshButton) {
        await user.click(refreshButton);
        expect(mockHandlers.onRefresh).toHaveBeenCalledTimes(1);
      }
    });

    it("should disable refresh button when isRefreshing is true", () => {
      render(<DashboardHeader {...mockHandlers} isRefreshing={true} />, {
        wrapper: createWrapper(),
      });

      const buttons = screen.getAllByRole("button");
      const refreshButton = buttons.find((btn) =>
        btn.querySelector('svg[class*="IconRefresh"]')
      );

      expect(refreshButton).toBeDisabled();
    });

    it("should show spinning animation when refreshing", () => {
      render(<DashboardHeader {...mockHandlers} isRefreshing={true} />, {
        wrapper: createWrapper(),
      });

      const refreshIcon = document.querySelector('svg[class*="IconRefresh"]');
      expect(refreshIcon).toHaveClass("animate-spin");
    });

    it("should not show spinning animation when not refreshing", () => {
      render(<DashboardHeader {...mockHandlers} isRefreshing={false} />, {
        wrapper: createWrapper(),
      });

      const refreshIcon = document.querySelector('svg[class*="IconRefresh"]');
      expect(refreshIcon).not.toHaveClass("animate-spin");
    });
  });

  describe("Export Button", () => {
    it("should render export button", () => {
      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Exportar")).toBeInTheDocument();
    });

    it("should show export options when clicked", async () => {
      const user = userEvent.setup();

      render(<DashboardHeader {...mockHandlers} />, {
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

    it("should call onExport when PDF option is clicked", async () => {
      const user = userEvent.setup();

      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const exportButton = screen.getByText("Exportar");
      await user.click(exportButton);

      const pdfOption = await screen.findByText("Exportar como PDF");
      await user.click(pdfOption);

      expect(mockHandlers.onExport).toHaveBeenCalledTimes(1);
    });

    it("should call onExport when Excel option is clicked", async () => {
      const user = userEvent.setup();

      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const exportButton = screen.getByText("Exportar");
      await user.click(exportButton);

      const excelOption = await screen.findByText("Exportar como Excel");
      await user.click(excelOption);

      expect(mockHandlers.onExport).toHaveBeenCalledTimes(1);
    });

    it("should call onExport when CSV option is clicked", async () => {
      const user = userEvent.setup();

      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const exportButton = screen.getByText("Exportar");
      await user.click(exportButton);

      const csvOption = await screen.findByText("Exportar como CSV");
      await user.click(csvOption);

      expect(mockHandlers.onExport).toHaveBeenCalledTimes(1);
    });
  });

  describe("Share Button", () => {
    it("should render share button", () => {
      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Compartilhar")).toBeInTheDocument();
    });

    it("should call onShare when clicked", async () => {
      const user = userEvent.setup();

      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const shareButton = screen.getByText("Compartilhar");
      await user.click(shareButton);

      expect(mockHandlers.onShare).toHaveBeenCalledTimes(1);
    });
  });

  describe("Settings Button", () => {
    it("should render settings button", () => {
      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) =>
        btn.querySelector('svg[class*="IconSettings"]')
      );
      expect(settingsButton).toBeInTheDocument();
    });

    it("should call onSettingsClick when clicked", async () => {
      const user = userEvent.setup();

      render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const buttons = screen.getAllByRole("button");
      const settingsButton = buttons.find((btn) =>
        btn.querySelector('svg[class*="IconSettings"]')
      );

      if (settingsButton) {
        await user.click(settingsButton);
        expect(mockHandlers.onSettingsClick).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe("Responsive Behavior", () => {
    it("should render all action buttons in a flex container", () => {
      const { container } = render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const actionContainer = container.querySelector(".flex.items-center.gap-2");
      expect(actionContainer).toBeInTheDocument();
    });

    it("should wrap content when screen is narrow", () => {
      const { container } = render(<DashboardHeader {...mockHandlers} />, {
        wrapper: createWrapper(),
      });

      const mainContainer = container.querySelector(".flex.items-center.justify-between.gap-4.flex-wrap");
      expect(mainContainer).toBeInTheDocument();
    });
  });
});
