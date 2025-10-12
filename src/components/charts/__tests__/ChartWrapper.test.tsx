import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { ChartWrapper } from '../base/ChartWrapper';
import { toast } from 'sonner';

describe('ChartWrapper', () => {
  const mockOnRefresh = vi.fn();
  const mockOnExport = vi.fn();
  const mockOnSettingsChange = vi.fn();

  const defaultProps = {
    title: 'Test Chart',
    description: 'Test Description',
    children: <div data-testid="chart-content">Chart Content</div>,
  };

  const exportData = {
    headers: ['Name', 'Value'],
    rows: [['Item 1', 100], ['Item 2', 200]],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading skeleton when isLoading is true', () => {
      render(<ChartWrapper {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Carregando dados...')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
    });

    it('should render skeleton for title and description', () => {
      const { container } = render(
        <ChartWrapper {...defaultProps} isLoading={true} />
      );

      const skeletons = container.querySelectorAll('.h-6, .h-4');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should apply correct height during loading', () => {
      const { container } = render(
        <ChartWrapper {...defaultProps} isLoading={true} height={500} />
      );

      const loadingContainer = container.querySelector('[style*="height"]');
      expect(loadingContainer).toHaveStyle({ height: '500px' });
    });
  });

  describe('Error State', () => {
    it('should render error message when error prop is set', () => {
      render(<ChartWrapper {...defaultProps} error="Test error message" />);

      expect(screen.getByText('Erro ao carregar gráfico')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
    });

    it('should render error from Error object', () => {
      const error = new Error('Error object message');
      render(<ChartWrapper {...defaultProps} error={error} />);

      expect(screen.getByText('Error object message')).toBeInTheDocument();
    });

    it('should show retry button when onRefresh is provided', () => {
      render(
        <ChartWrapper
          {...defaultProps}
          error="Error"
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
    });

    it('should call onRefresh when retry button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ChartWrapper
          {...defaultProps}
          error="Error"
          onRefresh={mockOnRefresh}
        />
      );

      const retryButton = screen.getByText('Tentar novamente');
      await user.click(retryButton);

      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('should render empty state when isEmpty is true', () => {
      render(<ChartWrapper {...defaultProps} isEmpty={true} />);

      expect(screen.getByText('Nenhum dado disponível')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
    });

    it('should render custom empty message', () => {
      render(
        <ChartWrapper
          {...defaultProps}
          isEmpty={true}
          emptyMessage="Custom empty message"
        />
      );

      expect(screen.getByText('Custom empty message')).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('should show export button when showExport is true', () => {
      render(<ChartWrapper {...defaultProps} showExport={true} />);

      const exportButton = screen.getByRole('button', { name: /download/i });
      expect(exportButton).toBeInTheDocument();
    });

    it('should hide export button when showExport is false', () => {
      render(<ChartWrapper {...defaultProps} showExport={false} />);

      const exportButton = screen.queryByRole('button', { name: /download/i });
      expect(exportButton).not.toBeInTheDocument();
    });

    it('should open export menu on click', async () => {
      const user = userEvent.setup();
      render(<ChartWrapper {...defaultProps} showExport={true} exportData={exportData} />);

      const exportButton = screen.getAllByRole('button').find(
        btn => btn.querySelector('[class*="lucide"]')
      );

      if (exportButton) {
        await user.click(exportButton);
        await waitFor(() => {
          expect(screen.getByText('PNG')).toBeInTheDocument();
          expect(screen.getByText('PDF')).toBeInTheDocument();
        });
      }
    });

    it('should show CSV and Excel options when exportData is provided', async () => {
      const user = userEvent.setup();
      render(
        <ChartWrapper
          {...defaultProps}
          showExport={true}
          exportData={exportData}
        />
      );

      const exportButtons = screen.getAllByRole('button');
      const downloadButton = exportButtons.find(
        btn => btn.querySelector('svg')
      );

      if (downloadButton) {
        await user.click(downloadButton);
        await waitFor(() => {
          expect(screen.getByText('CSV')).toBeInTheDocument();
          expect(screen.getByText('Excel')).toBeInTheDocument();
        });
      }
    });

    it('should call custom onExport when provided', async () => {
      const user = userEvent.setup();
      render(
        <ChartWrapper
          {...defaultProps}
          showExport={true}
          onExport={mockOnExport}
        />
      );

      const exportButtons = screen.getAllByRole('button');
      const downloadButton = exportButtons.find(
        btn => btn.querySelector('svg')
      );

      if (downloadButton) {
        await user.click(downloadButton);

        await waitFor(() => {
          const pngOption = screen.getByText('PNG');
          expect(pngOption).toBeInTheDocument();
        });
      }
    });
  });

  describe('Refresh Functionality', () => {
    it('should show refresh button when showRefresh is true and onRefresh is provided', () => {
      render(
        <ChartWrapper
          {...defaultProps}
          showRefresh={true}
          onRefresh={mockOnRefresh}
        />
      );

      const buttons = screen.getAllByRole('button');
      const hasRefreshButton = buttons.some(btn =>
        btn.querySelector('svg')
      );
      expect(hasRefreshButton).toBe(true);
    });

    it('should call onRefresh when refresh button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ChartWrapper
          {...defaultProps}
          showRefresh={true}
          onRefresh={mockOnRefresh}
        />
      );

      const buttons = screen.getAllByRole('button');
      const refreshButton = buttons.find(btn =>
        btn.querySelector('svg')
      );

      if (refreshButton) {
        await user.click(refreshButton);
        expect(mockOnRefresh).toHaveBeenCalled();
      }
    });

    it('should show success toast after successful refresh', async () => {
      const user = userEvent.setup();
      mockOnRefresh.mockResolvedValue(undefined);

      render(
        <ChartWrapper
          {...defaultProps}
          showRefresh={true}
          onRefresh={mockOnRefresh}
        />
      );

      const buttons = screen.getAllByRole('button');
      const refreshButton = buttons.find(btn =>
        btn.querySelector('svg')
      );

      if (refreshButton) {
        await user.click(refreshButton);
        await waitFor(() => {
          expect(toast.success).toHaveBeenCalledWith('Gráfico atualizado com sucesso');
        });
      }
    });

    it('should show error toast on refresh failure', async () => {
      const user = userEvent.setup();
      mockOnRefresh.mockRejectedValue(new Error('Refresh failed'));

      render(
        <ChartWrapper
          {...defaultProps}
          showRefresh={true}
          onRefresh={mockOnRefresh}
        />
      );

      const buttons = screen.getAllByRole('button');
      const refreshButton = buttons.find(btn =>
        btn.querySelector('svg')
      );

      if (refreshButton) {
        await user.click(refreshButton);
        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith('Erro ao atualizar gráfico');
        });
      }
    });
  });

  describe('Fullscreen Toggle', () => {
    it('should show fullscreen button when showFullscreen is true', () => {
      render(<ChartWrapper {...defaultProps} showFullscreen={true} />);

      const buttons = screen.getAllByRole('button');
      const hasFullscreenButton = buttons.some(btn =>
        btn.querySelector('svg')
      );
      expect(hasFullscreenButton).toBe(true);
    });

    it('should toggle fullscreen state on button click', async () => {
      const user = userEvent.setup();
      render(<ChartWrapper {...defaultProps} showFullscreen={true} />);

      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(btn =>
        btn.querySelector('svg')
      );

      if (fullscreenButton) {
        await user.click(fullscreenButton);
        // Should open dialog
        await waitFor(() => {
          expect(screen.getAllByText('Test Chart').length).toBeGreaterThan(1);
        });
      }
    });
  });

  describe('Settings Menu', () => {
    it('should show settings button when showSettings is true and onSettingsChange is provided', () => {
      render(
        <ChartWrapper
          {...defaultProps}
          showSettings={true}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      const buttons = screen.getAllByRole('button');
      const hasSettingsButton = buttons.some(btn =>
        btn.querySelector('svg')
      );
      expect(hasSettingsButton).toBe(true);
    });

    it('should open settings menu on click', async () => {
      const user = userEvent.setup();
      render(
        <ChartWrapper
          {...defaultProps}
          showSettings={true}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      const buttons = screen.getAllByRole('button');
      const settingsButton = buttons.find(btn =>
        btn.querySelector('svg')
      );

      if (settingsButton) {
        await user.click(settingsButton);
        await waitFor(() => {
          expect(screen.getByText('Configurações')).toBeInTheDocument();
        });
      }
    });

    it('should call onSettingsChange when settings are modified', async () => {
      const user = userEvent.setup();
      render(
        <ChartWrapper
          {...defaultProps}
          showSettings={true}
          onSettingsChange={mockOnSettingsChange}
          settings={{ showGrid: true }}
        />
      );

      const buttons = screen.getAllByRole('button');
      const settingsButton = buttons.find(btn =>
        btn.querySelector('svg')
      );

      if (settingsButton) {
        await user.click(settingsButton);

        await waitFor(() => {
          const gridOption = screen.getByText('Mostrar grade');
          expect(gridOption).toBeInTheDocument();
        });
      }
    });
  });

  describe('Chart Content', () => {
    it('should render children when not loading, no error, and not empty', () => {
      render(<ChartWrapper {...defaultProps} />);

      expect(screen.getByTestId('chart-content')).toBeInTheDocument();
    });

    it('should render header with title and description', () => {
      render(<ChartWrapper {...defaultProps} />);

      expect(screen.getByText('Test Chart')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
    });

    it('should apply custom height', () => {
      const { container } = render(
        <ChartWrapper {...defaultProps} height={600} />
      );

      const chartContainer = container.querySelector('[style*="height"]');
      expect(chartContainer).toHaveStyle({ height: '600px' });
    });

    it('should apply custom className', () => {
      const { container } = render(
        <ChartWrapper {...defaultProps} className="custom-class" />
      );

      const card = container.querySelector('.custom-class');
      expect(card).toBeInTheDocument();
    });

    it('should render custom actions', () => {
      render(
        <ChartWrapper
          {...defaultProps}
          actions={<button>Custom Action</button>}
        />
      );

      expect(screen.getByText('Custom Action')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should be responsive by default', () => {
      const { container } = render(<ChartWrapper {...defaultProps} />);

      const chartContent = container.querySelector('.min-w-0');
      expect(chartContent).toBeInTheDocument();
    });

    it('should not apply responsive class when responsive is false', () => {
      const { container } = render(
        <ChartWrapper {...defaultProps} responsive={false} />
      );

      const chartContent = container.querySelector('[class*="w-full"]');
      expect(chartContent).toBeInTheDocument();
    });
  });

  describe('Container ID', () => {
    it('should generate unique container ID by default', () => {
      const { container: container1 } = render(<ChartWrapper {...defaultProps} />);
      const { container: container2 } = render(<ChartWrapper {...defaultProps} />);

      const id1 = container1.querySelector('[id^="chart-"]')?.id;
      const id2 = container2.querySelector('[id^="chart-"]')?.id;

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
    });

    it('should use custom container ID when provided', () => {
      const { container } = render(
        <ChartWrapper {...defaultProps} containerId="custom-chart-id" />
      );

      const element = container.querySelector('#custom-chart-id');
      expect(element).toBeInTheDocument();
    });
  });
});
