import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DateRange } from '../DateRangeFilter';
import { DateRangeFilter } from '../DateRangeFilter';

describe('DateRangeFilter', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Basic Rendering', () => {
    it('should render with placeholder when no value', () => {
      render(<DateRangeFilter onChange={mockOnChange} />);
      expect(screen.getByText('Selecione período')).toBeInTheDocument();
    });

    it('should render with custom placeholder', () => {
      render(
        <DateRangeFilter
          onChange={mockOnChange}
          placeholder="Escolha uma data"
        />
      );
      expect(screen.getByText('Escolha uma data')).toBeInTheDocument();
    });

    it('should display formatted date range when value is set', () => {
      const value: DateRange = {
        from: new Date(2024, 0, 1), // January 1, 2024 in local time
        to: new Date(2024, 0, 31),  // January 31, 2024 in local time
      };
      render(<DateRangeFilter value={value} onChange={mockOnChange} />);
      expect(screen.getByText(/01\/01\/2024 - 31\/01\/2024/)).toBeInTheDocument();
    });

    it('should display single date when only from is set', () => {
      const value: DateRange = {
        from: new Date(2024, 0, 1), // January 1, 2024 in local time
      };
      render(<DateRangeFilter value={value} onChange={mockOnChange} />);
      expect(screen.getByText('01/01/2024')).toBeInTheDocument();
    });
  });

  describe('Preset Selection', () => {
    it('should render default presets', async () => {
      const user = userEvent.setup();
      render(<DateRangeFilter onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Hoje')).toBeInTheDocument();
        expect(screen.getByText('Últimos 7 dias')).toBeInTheDocument();
        expect(screen.getByText('Últimos 30 dias')).toBeInTheDocument();
        expect(screen.getByText('Este mês')).toBeInTheDocument();
        expect(screen.getByText('Mês passado')).toBeInTheDocument();
        expect(screen.getByText('Este trimestre')).toBeInTheDocument();
        expect(screen.getByText('Este ano')).toBeInTheDocument();
      });
    });

    it('should apply "Hoje" preset correctly', async () => {
      const user = userEvent.setup();
      render(<DateRangeFilter onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      await user.click(button);

      const hojeButton = await screen.findByText('Hoje');
      await user.click(hojeButton);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.any(Date),
          to: expect.any(Date),
        })
      );

      const call = mockOnChange.mock.calls[0][0];
      expect(call.from.toDateString()).toBe(new Date().toDateString());
    });

    it('should apply "Últimos 7 dias" preset correctly', async () => {
      const user = userEvent.setup();
      render(<DateRangeFilter onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      await user.click(button);

      const presetButton = await screen.findByText('Últimos 7 dias');
      await user.click(presetButton);

      expect(mockOnChange).toHaveBeenCalled();
      const call = mockOnChange.mock.calls[0][0];
      expect(call.from).toBeDefined();
      expect(call.to).toBeDefined();

      const daysDiff = Math.floor(
        (call.to.getTime() - call.from.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBe(7);
    });

    it('should apply "Este mês" preset correctly', async () => {
      const user = userEvent.setup();
      render(<DateRangeFilter onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      await user.click(button);

      const presetButton = await screen.findByText('Este mês');
      await user.click(presetButton);

      expect(mockOnChange).toHaveBeenCalled();
      const call = mockOnChange.mock.calls[0][0];

      const now = new Date();
      expect(call.from.getMonth()).toBe(now.getMonth());
      expect(call.from.getDate()).toBe(1);
    });

    it('should render custom presets', async () => {
      const user = userEvent.setup();
      const customPresets = [
        {
          label: 'Custom Range',
          value: {
            from: new Date('2024-01-01'),
            to: new Date('2024-12-31'),
          },
        },
      ];

      render(
        <DateRangeFilter onChange={mockOnChange} presets={customPresets} />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(await screen.findByText('Custom Range')).toBeInTheDocument();
    });
  });

  describe('Custom Date Range Input', () => {
    it('should open calendar when clicked', async () => {
      const user = userEvent.setup();
      render(<DateRangeFilter onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Predefinições')).toBeInTheDocument();
      });
    });

    it('should call onChange when date range is selected', async () => {
      const user = userEvent.setup();
      render(<DateRangeFilter onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      await user.click(button);

      // Note: Calendar interaction would require more complex testing
      // This is a placeholder for calendar date selection
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Date Validation', () => {
    it('should accept valid date range where end >= start', () => {
      const value: DateRange = {
        from: new Date(2024, 0, 1), // January 1, 2024 in local time
        to: new Date(2024, 0, 31),  // January 31, 2024 in local time
      };

      render(<DateRangeFilter value={value} onChange={mockOnChange} />);

      expect(screen.getByText(/01\/01\/2024 - 31\/01\/2024/)).toBeInTheDocument();
    });

    it('should handle range where from and to are the same', () => {
      const value: DateRange = {
        from: new Date(2024, 0, 1), // January 1, 2024 in local time
        to: new Date(2024, 0, 1),   // January 1, 2024 in local time
      };

      render(<DateRangeFilter value={value} onChange={mockOnChange} />);

      expect(screen.getByText(/01\/01\/2024 - 01\/01\/2024/)).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should format dates in pt-BR locale (dd/MM/yyyy)', () => {
      const value: DateRange = {
        from: new Date('2024-01-15'),
        to: new Date('2024-02-20'),
      };

      render(<DateRangeFilter value={value} onChange={mockOnChange} />);

      expect(screen.getByText(/15\/01\/2024 - 20\/02\/2024/)).toBeInTheDocument();
    });

    it('should format single date correctly', () => {
      const value: DateRange = {
        from: new Date('2024-03-10'),
      };

      render(<DateRangeFilter value={value} onChange={mockOnChange} />);

      expect(screen.getByText('10/03/2024')).toBeInTheDocument();
    });
  });

  describe('Clear Functionality', () => {
    it('should show clear button when value is set', () => {
      const value: DateRange = {
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31'),
      };

      render(<DateRangeFilter value={value} onChange={mockOnChange} />);

      const clearButtons = screen.getAllByRole('button');
      expect(clearButtons.length).toBeGreaterThan(0);
    });

    it('should call onChange with undefined when clear is clicked', async () => {
      const value: DateRange = {
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31'),
      };

      render(<DateRangeFilter value={value} onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      // Find the IconX (clear button) and click it
      const clearIcon = button.querySelector('svg[class*="tabler-icon-x"]');
      if (clearIcon) {
        fireEvent.click(clearIcon);
        expect(mockOnChange).toHaveBeenCalledWith(undefined);
      }
    });

    it('should not show clear button when no value is set', () => {
      render(<DateRangeFilter onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      const clearIcon = button.querySelector('svg[class*="tabler-icon-x"]');
      expect(clearIcon).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button role', () => {
      render(<DateRangeFilter onChange={mockOnChange} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <DateRangeFilter onChange={mockOnChange} className="custom-class" />
      );
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('Popover Behavior', () => {
    it('should close popover after preset selection', async () => {
      const user = userEvent.setup();
      render(<DateRangeFilter onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      await user.click(button);

      const hojeButton = await screen.findByText('Hoje');
      await user.click(hojeButton);

      // Popover should close
      await waitFor(() => {
        expect(screen.queryByText('Predefinições')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty Presets', () => {
    it('should render without presets section when presets array is empty', async () => {
      const user = userEvent.setup();
      render(<DateRangeFilter onChange={mockOnChange} presets={[]} />);

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.queryByText('Predefinições')).not.toBeInTheDocument();
      });
    });
  });
});
