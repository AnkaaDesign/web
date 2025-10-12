import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
  addDays,
  differenceInDays,
  differenceInMonths,
  format as formatDate,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { StatisticsFilters } from '../../api-client/statistics-inventory.service';

/**
 * Date Helper Utilities
 * Provides date manipulation and formatting functions for statistics
 */

/**
 * Get date range for a specific period type
 */
export const getDateRangeForPeriod = (
  period: StatisticsFilters['period'],
  referenceDate: Date = new Date()
): { from: Date; to: Date } => {
  const now = referenceDate;

  switch (period) {
    case 'day':
      return {
        from: startOfDay(now),
        to: endOfDay(now),
      };
    case 'week':
      return {
        from: startOfWeek(now, { locale: ptBR }),
        to: endOfWeek(now, { locale: ptBR }),
      };
    case 'month':
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
      };
    case 'quarter':
      return {
        from: startOfQuarter(now),
        to: endOfQuarter(now),
      };
    case 'year':
      return {
        from: startOfYear(now),
        to: endOfYear(now),
      };
    case 'custom':
    default:
      // Return last 30 days as default
      return {
        from: startOfDay(subDays(now, 30)),
        to: endOfDay(now),
      };
  }
};

/**
 * Get previous period date range for comparison
 */
export const getPreviousPeriodDateRange = (
  dateRange: { from: Date; to: Date }
): { from: Date; to: Date } => {
  const daysDiff = differenceInDays(dateRange.to, dateRange.from);

  return {
    from: subDays(dateRange.from, daysDiff + 1),
    to: subDays(dateRange.to, daysDiff + 1),
  };
};

/**
 * Get same period from previous year
 */
export const getYearAgoPeriodDateRange = (
  dateRange: { from: Date; to: Date }
): { from: Date; to: Date } => {
  return {
    from: subYears(dateRange.from, 1),
    to: subYears(dateRange.to, 1),
  };
};

/**
 * Format date range for display
 */
export const formatDateRange = (
  dateRange: { from: Date; to: Date },
  formatStr: string = 'dd/MM/yyyy'
): string => {
  const from = formatDate(dateRange.from, formatStr, { locale: ptBR });
  const to = formatDate(dateRange.to, formatStr, { locale: ptBR });
  return `${from} - ${to}`;
};

/**
 * Format date in Portuguese Brazilian format
 */
export const formatDatePtBR = (date: Date | string, formatStr: string = 'dd/MM/yyyy'): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDate(dateObj, formatStr, { locale: ptBR });
};

/**
 * Get period label in Portuguese
 */
export const getPeriodLabel = (period: StatisticsFilters['period']): string => {
  const labels: Record<string, string> = {
    day: 'Hoje',
    week: 'Esta Semana',
    month: 'Este Mês',
    quarter: 'Este Trimestre',
    year: 'Este Ano',
    custom: 'Período Personalizado',
  };
  return labels[period || 'custom'] || 'Período';
};

/**
 * Calculate number of periods between dates
 */
export const calculatePeriodCount = (
  dateRange: { from: Date; to: Date },
  period: 'day' | 'week' | 'month' | 'quarter' | 'year'
): number => {
  const { from, to } = dateRange;

  switch (period) {
    case 'day':
      return differenceInDays(to, from) + 1;
    case 'week':
      return Math.ceil(differenceInDays(to, from) / 7);
    case 'month':
      return differenceInMonths(to, from) + 1;
    case 'quarter':
      return Math.ceil(differenceInMonths(to, from) / 3);
    case 'year':
      return Math.ceil(differenceInMonths(to, from) / 12);
    default:
      return 0;
  }
};

/**
 * Get date intervals for charts
 */
export const getDateIntervals = (
  dateRange: { from: Date; to: Date },
  intervalType: 'day' | 'week' | 'month' = 'day'
): Date[] => {
  const intervals: Date[] = [];
  let currentDate = dateRange.from;

  while (currentDate <= dateRange.to) {
    intervals.push(new Date(currentDate));

    switch (intervalType) {
      case 'day':
        currentDate = addDays(currentDate, 1);
        break;
      case 'week':
        currentDate = addDays(currentDate, 7);
        break;
      case 'month':
        currentDate = addDays(currentDate, 30);
        break;
    }
  }

  return intervals;
};

/**
 * Check if date is in range
 */
export const isDateInRange = (
  date: Date,
  dateRange: { from: Date; to: Date }
): boolean => {
  return date >= dateRange.from && date <= dateRange.to;
};

/**
 * Get relative period description
 */
export const getRelativePeriodDescription = (
  dateRange: { from: Date; to: Date }
): string => {
  const daysDiff = differenceInDays(new Date(), dateRange.to);

  if (daysDiff === 0) {
    return 'Hoje';
  } else if (daysDiff === 1) {
    return 'Ontem';
  } else if (daysDiff <= 7) {
    return 'Últimos 7 dias';
  } else if (daysDiff <= 30) {
    return 'Últimos 30 dias';
  } else if (daysDiff <= 90) {
    return 'Últimos 3 meses';
  } else {
    return formatDateRange(dateRange);
  }
};

/**
 * Get quick date range presets
 */
export const getDateRangePresets = (): Array<{
  label: string;
  value: string;
  dateRange: { from: Date; to: Date };
}> => {
  const now = new Date();

  return [
    {
      label: 'Hoje',
      value: 'today',
      dateRange: {
        from: startOfDay(now),
        to: endOfDay(now),
      },
    },
    {
      label: 'Ontem',
      value: 'yesterday',
      dateRange: {
        from: startOfDay(subDays(now, 1)),
        to: endOfDay(subDays(now, 1)),
      },
    },
    {
      label: 'Últimos 7 dias',
      value: 'last7days',
      dateRange: {
        from: startOfDay(subDays(now, 6)),
        to: endOfDay(now),
      },
    },
    {
      label: 'Últimos 30 dias',
      value: 'last30days',
      dateRange: {
        from: startOfDay(subDays(now, 29)),
        to: endOfDay(now),
      },
    },
    {
      label: 'Esta semana',
      value: 'thisWeek',
      dateRange: {
        from: startOfWeek(now, { locale: ptBR }),
        to: endOfWeek(now, { locale: ptBR }),
      },
    },
    {
      label: 'Semana passada',
      value: 'lastWeek',
      dateRange: {
        from: startOfWeek(subWeeks(now, 1), { locale: ptBR }),
        to: endOfWeek(subWeeks(now, 1), { locale: ptBR }),
      },
    },
    {
      label: 'Este mês',
      value: 'thisMonth',
      dateRange: {
        from: startOfMonth(now),
        to: endOfMonth(now),
      },
    },
    {
      label: 'Mês passado',
      value: 'lastMonth',
      dateRange: {
        from: startOfMonth(subMonths(now, 1)),
        to: endOfMonth(subMonths(now, 1)),
      },
    },
    {
      label: 'Este trimestre',
      value: 'thisQuarter',
      dateRange: {
        from: startOfQuarter(now),
        to: endOfQuarter(now),
      },
    },
    {
      label: 'Trimestre passado',
      value: 'lastQuarter',
      dateRange: {
        from: startOfQuarter(subQuarters(now, 1)),
        to: endOfQuarter(subQuarters(now, 1)),
      },
    },
    {
      label: 'Este ano',
      value: 'thisYear',
      dateRange: {
        from: startOfYear(now),
        to: endOfYear(now),
      },
    },
    {
      label: 'Ano passado',
      value: 'lastYear',
      dateRange: {
        from: startOfYear(subYears(now, 1)),
        to: endOfYear(subYears(now, 1)),
      },
    },
  ];
};

/**
 * Validate if date range is valid
 */
export const isValidDateRange = (dateRange: { from: Date; to: Date }): boolean => {
  try {
    const { from, to } = dateRange;

    // Check if dates are valid
    if (!(from instanceof Date) || !(to instanceof Date)) {
      return false;
    }

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return false;
    }

    // From must be before or equal to
    if (from > to) {
      return false;
    }

    // Check if not too far in the future
    const maxFutureDate = addDays(new Date(), 365); // 1 year in future
    if (to > maxFutureDate) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};
