import React, { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  IconUsers,
  IconCalculator,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconBuilding,
  IconUserMinus,
  IconBriefcase,
  IconUserCheck,
  IconArrowUp,
  IconArrowDown,
  IconSelector
} from "@tabler/icons-react";
import { formatCurrency, getBonusPeriod, getCurrentPayrollPeriod, formatDate } from "../../../utils";
import { useUsers, useSectors, useTasks } from "../../../hooks";
import { calculateBonusForPosition } from "../../../utils/bonus";
import { cn } from "@/lib/utils";
import { TASK_STATUS, COMMISSION_STATUS, USER_STATUS } from "../../../constants";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "sonner";
import { BonusSimulationFilters } from "./bonus-simulation-filters";

// Position levels mapping
const POSITIONS = [
  "Junior I", "Junior II", "Junior III", "Junior IV",
  "Pleno I", "Pleno II", "Pleno III", "Pleno IV",
  "Senior I", "Senior II", "Senior III", "Senior IV"
];

// Export columns configuration
const EXPORT_COLUMNS: ExportColumn<SimulatedUser>[] = [
  { id: "payrollNumber", label: "Nº Folha", getValue: (user: SimulatedUser) => user.payrollNumber?.toString() || "-" },
  { id: "name", label: "Nome", getValue: (user: SimulatedUser) => user.name },
  { id: "sectorName", label: "Setor", getValue: (user: SimulatedUser) => user.sectorName || "-" },
  { id: "position", label: "Cargo", getValue: (user: SimulatedUser) => user.position },
  { id: "performanceLevel", label: "Performance", getValue: (user: SimulatedUser) => user.performanceLevel.toString() },
  { id: "bonusAmount", label: "Bônus", getValue: (user: SimulatedUser) => formatCurrency(user.bonusAmount) },
];

// Default visible columns (all columns)
const DEFAULT_VISIBLE_COLUMNS = new Set(["payrollNumber", "name", "sectorName", "position", "performanceLevel", "bonusAmount"]);

// Performance level selector with chevron buttons
interface PerformanceLevelSelectorProps {
  value: number;
  onChange: (value: number) => void;
  userId: string;
  isModified?: boolean;
  disabled?: boolean;
  className?: string;
}

function PerformanceLevelSelector({
  value,
  onChange,
  userId: _userId,
  isModified,
  disabled,
  className,
}: PerformanceLevelSelectorProps) {
  const handleDecrease = () => {
    const newValue = Math.max(0, value - 1);
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleIncrease = () => {
    const newValue = Math.min(5, value + 1);
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDecrease}
        disabled={disabled || value <= 0}
        className="h-7 w-7 p-0 hover:bg-muted"
        title="Diminuir nível"
      >
        <IconChevronLeft className="h-4 w-4" />
      </Button>
      <div
        className={cn(
          "flex items-center justify-center w-8 h-7 font-semibold text-sm",
          isModified ? "text-orange-600" : "text-foreground",
          disabled && "opacity-50"
        )}
        title={`Nível de desempenho: ${value} (0-5)`}
      >
        {value}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleIncrease}
        disabled={disabled || value >= 5}
        className="h-7 w-7 p-0 hover:bg-muted"
        title="Aumentar nível"
      >
        <IconChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface SimulatedUser {
  id: string;
  name: string;
  email: string;
  payrollNumber: number | null;
  originalPosition: string;
  originalPerformanceLevel: number;
  sectorId: string | null;
  sectorName: string | null;
  // Simulation fields
  position: string;
  performanceLevel: number;
  bonusAmount: number;
}

interface BonusSimulationInteractiveTableProps {
  className?: string;
  embedded?: boolean;
}

export function BonusSimulationInteractiveTable({ className, embedded: _embedded = false }: BonusSimulationInteractiveTableProps) {
  // State
  const [taskQuantity, setTaskQuantity] = useState<number>(0); // Will be set from current period
  const [originalTaskQuantity, setOriginalTaskQuantity] = useState<number>(0); // Store original for restore
  const [taskInput, setTaskInput] = useState<string>('0,0'); // String value for controlled input (Brazilian format) - 1 decimal
  const [averageInput, setAverageInput] = useState<string>('0,00'); // String value for controlled input (Brazilian format) - 2 decimals
  const [simulatedUsers, setSimulatedUsers] = useState<SimulatedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state - no default filters, show all eligible users
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [filters, setFilters] = useState({
    sectorIds: [] as string[],
    positionIds: [] as string[],
    includeUserIds: [] as string[],
    excludeUserIds: [] as string[],
    showOnlyEligible: true // Default to showing only eligible users
  });

  // Sorting state
  const [sortColumn, setSortColumn] = useState<'payrollNumber' | 'name' | 'sectorName' | 'position' | 'performanceLevel' | 'bonusAmount' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Get current bonus period for task counting
  // Get current payroll period (26th-25th cycle) - centralized utility
  // If today is Sept 26th or later, this returns October
  const { year: periodYear, month: periodMonth } = getCurrentPayrollPeriod();
  const currentPeriod = getBonusPeriod(periodYear, periodMonth);


  // Fetch sectors for filtering (Sector model has no status field)
  const { data: sectorsData } = useSectors({
    orderBy: { name: "asc" },
    limit: 100
  });

  // Fetch tasks for current period to get actual count
  // Ensure dates are set to exact times: 26th at 00:00:00.000 and 25th at 23:59:59.999
  const startDate = new Date(currentPeriod.startDate);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(currentPeriod.endDate);
  endDate.setHours(23, 59, 59, 999);

  const taskQuery = {
    where: {
      status: { in: [TASK_STATUS.COMPLETED, TASK_STATUS.INVOICED, TASK_STATUS.SETTLED] }, // Only count completed, invoiced, or settled tasks
      finishedAt: {
        gte: startDate,
        lte: endDate
      },
      commission: {
        in: [COMMISSION_STATUS.FULL_COMMISSION, COMMISSION_STATUS.PARTIAL_COMMISSION]
      }
    },
    limit: 1000, // Maximum allowed by API
    enabled: true // Always enabled to get the count
  };

  const { data: currentPeriodTasks } = useTasks(taskQuery);

  // Fetch all effected users for bonus simulation
  // Client-side filters will handle eligibility, sectors, positions, etc.
  const { data: usersData } = useUsers({
    where: {
      status: USER_STATUS.EFFECTED, // Only EFFECTED users (not dismissed, not inactive)
    },
    include: {
      position: true,
      sector: true
    },
    orderBy: { name: "asc" },
    limit: 100
  });

  // Set default task quantity from current period when data is available
  useEffect(() => {
    if (currentPeriodTasks?.data && currentPeriodTasks.success) {
      // Calculate weighted task count: full commission = 1.0, partial commission = 0.5
      const weightedTaskCount = currentPeriodTasks.data.reduce((sum, task) => {
        if (task.commission === COMMISSION_STATUS.FULL_COMMISSION) {
          return sum + 1.0;
        } else if (task.commission === COMMISSION_STATUS.PARTIAL_COMMISSION) {
          return sum + 0.5;
        }
        return sum;
      }, 0);

      // Only set if taskQuantity is still 0 (initial state)
      if (taskQuantity === 0) {
        setTaskQuantity(weightedTaskCount);
        setOriginalTaskQuantity(weightedTaskCount);
        setTaskInput(weightedTaskCount.toFixed(1).replace('.', ','));
      }
    }
  }, [currentPeriodTasks]);

  // Initialize simulated users from fetched data
  useEffect(() => {
    if (usersData?.data && usersData.data.length > 0) {
      // Calculate initial average for bonus calculation
      const eligibleCount = usersData.data.length;
      const initialAverage = eligibleCount > 0 ? taskQuantity / eligibleCount : 0;

      const users = usersData.data.map(user => {
        const initialPosition = user.position?.name || "Pleno I";
        const initialPerformanceLevel = user.performanceLevel || 3;

        // Calculate initial bonus immediately
        const initialBonus = calculateBonusForPosition(
          initialPosition,
          initialPerformanceLevel,
          initialAverage
        );

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          payrollNumber: user.payrollNumber || null,
          originalPosition: initialPosition,
          originalPerformanceLevel: initialPerformanceLevel,
          sectorId: user.sector?.id || null,
          sectorName: user.sector?.name || null,
          position: initialPosition,
          performanceLevel: initialPerformanceLevel,
          bonusAmount: initialBonus
        };
      });
      setSimulatedUsers(users);
      setIsLoading(false);
    }
  }, [usersData]); // Only reinitialize when usersData changes, not when taskQuantity changes

  // Apply filters to get visible users
  const filteredUsers = useMemo(() => {
    let filtered = simulatedUsers;

    // Apply eligibility filter
    // A user is eligible if:
    // 1. They have a bonifiable position
    // 2. They are EFFECTED status (already filtered in the query)
    // 3. They have a performance level > 0
    if (filters.showOnlyEligible) {
      filtered = filtered.filter(user => {
        // Find the original user data to check position bonifiable flag
        const originalUser = usersData?.data?.find(u => u.id === user.id);
        const isBonifiable = originalUser?.position?.bonifiable === true;
        const hasPerformanceLevel = user.performanceLevel > 0;

        return isBonifiable && hasPerformanceLevel;
      });
    }

    // Apply sector filter (only if sectors are explicitly selected)
    if (filters.sectorIds.length > 0) {
      filtered = filtered.filter(user =>
        user.sectorId && filters.sectorIds.includes(user.sectorId)
      );
    }

    // Apply position filter (only if positions are explicitly selected)
    if (filters.positionIds.length > 0) {
      filtered = filtered.filter(user => {
        // Find the user's position ID from the original data
        const originalUser = usersData?.data?.find(u => u.id === user.id);
        return originalUser?.positionId && filters.positionIds.includes(originalUser.positionId);
      });
    }

    // Apply include users filter (if specified, only show these users)
    if (filters.includeUserIds.length > 0) {
      filtered = filtered.filter(user =>
        filters.includeUserIds.includes(user.id)
      );
    }

    // Apply exclusion filter
    if (filters.excludeUserIds.length > 0) {
      filtered = filtered.filter(user =>
        !filters.excludeUserIds.includes(user.id)
      );
    }

    return filtered;
  }, [simulatedUsers, filters, usersData]);

  // Apply sorting to filtered users
  const sortedUsers = useMemo(() => {
    if (!sortColumn) return filteredUsers;

    const sorted = [...filteredUsers].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'payrollNumber':
          aValue = a.payrollNumber ?? -1;
          bValue = b.payrollNumber ?? -1;
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'sectorName':
          aValue = (a.sectorName || '').toLowerCase();
          bValue = (b.sectorName || '').toLowerCase();
          break;
        case 'position':
          aValue = a.position.toLowerCase();
          bValue = b.position.toLowerCase();
          break;
        case 'performanceLevel':
          aValue = a.performanceLevel;
          bValue = b.performanceLevel;
          break;
        case 'bonusAmount':
          aValue = a.bonusAmount;
          bValue = b.bonusAmount;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredUsers, sortColumn, sortDirection]);

  // Calculate metrics
  // For simulation: ALL filtered users are considered "eligible"
  const eligibleUserCount = filteredUsers.length;

  // Average is calculated using eligible users (not included users)
  // This matches how the backend calculates: total tasks / total eligible users
  const averageTasksPerUser = useMemo(() => {
    if (eligibleUserCount === 0) return 0;
    return taskQuantity / eligibleUserCount;
  }, [taskQuantity, eligibleUserCount]);

  const totalBonusAmount = useMemo(() =>
    sortedUsers.reduce((sum, user) => sum + user.bonusAmount, 0),
    [sortedUsers]
  );

  // Effect 1: Update average input when task quantity or eligible count changes
  // Don't overwrite if user is typing (check if current value matches calculated)
  useEffect(() => {
    if (eligibleUserCount === 0) {
      if (averageInput !== '0,00') {
        setAverageInput('0,00');
      }
      return;
    }

    const newAverage = taskQuantity / eligibleUserCount;

    // Only update if the current input value doesn't match (to avoid overwriting while typing)
    const currentParsed = parseFloat(averageInput.replace(',', '.'));
    const difference = Math.abs(currentParsed - newAverage);

    // If difference is significant (more than 0.001), update the display
    if (isNaN(currentParsed) || difference > 0.001) {
      setAverageInput(newAverage.toFixed(2).replace('.', ','));
    }
  }, [taskQuantity, eligibleUserCount, averageInput]);

  // Effect 2: Recalculate bonuses when average or filtered users change
  useEffect(() => {
    if (filteredUsers.length === 0) {
      return;
    }

    const currentAverage = eligibleUserCount > 0 ? taskQuantity / eligibleUserCount : 0;

    // Only update bonuses if needed (avoid unnecessary recalculations)
    setSimulatedUsers(prev => {
      // Check if any updates are needed
      const needsUpdate = prev.some(user => {
        const expectedBonus = filteredUsers.find(f => f.id === user.id) ?
          calculateBonusForPosition(user.position, user.performanceLevel, currentAverage) :
          0;
        return Math.abs(user.bonusAmount - expectedBonus) > 0.01; // Allow small rounding differences
      });

      if (!needsUpdate) return prev;

      return prev.map(user => {
        const isFiltered = filteredUsers.find(f => f.id === user.id);
        if (!isFiltered) {
          return { ...user, bonusAmount: 0 };
        }
        const bonus = calculateBonusForPosition(user.position, user.performanceLevel, currentAverage);
        return { ...user, bonusAmount: bonus };
      });
    });
  }, [taskQuantity, filteredUsers, eligibleUserCount]);

  // Handlers
  const handleTaskQuantityChange = (e: React.ChangeEvent<HTMLInputElement> | string) => {
    // Handle both event object and direct value
    let value = typeof e === 'string' ? e : e?.target?.value;

    if (value === undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Handler] No value received:', e);
      }
      return;
    }

    // Replace period with comma for Brazilian format
    value = value.replace('.', ',');

    // Allow empty string, numbers, and decimal commas while typing
    if (value === '' || value === ',' || /^\d*,?\d*$/.test(value)) {
      setTaskInput(value); // Update input string immediately for smooth typing

      // Only update taskQuantity if it's a valid number (not just a comma or empty)
      if (value !== '' && value !== ',') {
        const num = parseFloat(value.replace(',', '.'));
        if (!isNaN(num) && num >= 0) {
          setTaskQuantity(num);
        }
      } else if (value === '') {
        setTaskQuantity(0);
      }
    }
  };

  const handleAveragePerUserChange = (e: React.ChangeEvent<HTMLInputElement> | string) => {
    // Handle both event object and direct value
    let value = typeof e === 'string' ? e : e?.target?.value;

    if (value === undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Handler] No value received:', e);
      }
      return;
    }

    // Replace period with comma for Brazilian format
    value = value.replace('.', ',');

    // Allow empty string, numbers, and decimal commas while typing
    if (value === '' || value === ',' || /^\d*,?\d*$/.test(value)) {
      setAverageInput(value); // Update input string immediately for smooth typing

      // Only update taskQuantity if it's a valid number and we have eligible users
      if (value !== '' && value !== ',' && eligibleUserCount > 0) {
        const num = parseFloat(value.replace(',', '.'));
        if (!isNaN(num) && num >= 0) {
          // Update task quantity based on average (reverse calculation)
          // Formula: taskQuantity = average × eligible_users
          const newTaskQuantity = num * eligibleUserCount;
          setTaskQuantity(newTaskQuantity);
          setTaskInput(newTaskQuantity.toFixed(1).replace('.', ',')); // Format with 1 decimal, Brazilian format
        }
      } else if (value === '') {
        setTaskQuantity(0);
        setTaskInput('0');
      }
    }
  };

  const handleFiltersApply = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleFiltersReset = () => {
    setFilters({
      sectorIds: [],
      positionIds: [],
      includeUserIds: [],
      excludeUserIds: [],
      showOnlyEligible: true
    });
  };

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: typeof sortColumn) => {
    if (sortColumn !== column) {
      return <IconSelector className="h-4 w-4 opacity-50" />;
    }
    return sortDirection === 'asc'
      ? <IconArrowUp className="h-4 w-4" />
      : <IconArrowDown className="h-4 w-4" />;
  };

  const handlePositionChange = (userId: string, newPosition: string) => {
    setSimulatedUsers(prev => prev.map(user => {
      if (user.id === userId) {
        const bonus = calculateBonusForPosition(newPosition, user.performanceLevel, averageTasksPerUser);
        return { ...user, position: newPosition, bonusAmount: bonus };
      }
      return user;
    }));
  };

  const handlePerformanceLevelChange = (userId: string, newLevel: number) => {
    setSimulatedUsers(prev => prev.map(user => {
      if (user.id === userId) {
        const bonus = calculateBonusForPosition(user.position, newLevel, averageTasksPerUser);
        return { ...user, performanceLevel: newLevel, bonusAmount: bonus };
      }
      return user;
    }));
  };

  const hasManualFilters =
    filters.sectorIds.length > 0 ||
    filters.positionIds.length > 0 ||
    filters.includeUserIds.length > 0 ||
    filters.excludeUserIds.length > 0;

  const hasActiveFilters =
    hasManualFilters ||
    (!filters.showOnlyEligible && !hasManualFilters); // Only count eligibility as active if explicitly disabled

  const clearAllFilters = () => {
    setFilters({
      sectorIds: [],
      positionIds: [],
      includeUserIds: [],
      excludeUserIds: [],
      showOnlyEligible: true
    });
  };

  // Create filter badges for display (like items table)
  // Each sector, position, and user gets its own individual badge
  const activeFilters = useMemo(() => {
    const filterBadges: Array<{
      key: string;
      label: string;
      value: string;
      onRemove: () => void;
      icon?: React.ReactNode;
    }> = [];

    // Add individual sector filter badges
    filters.sectorIds.forEach(sectorId => {
      const sector = sectorsData?.data?.find(s => s.id === sectorId);
      if (sector) {
        filterBadges.push({
          key: `sector-${sectorId}`,
          label: "Setor",
          value: sector.name,
          onRemove: () => setFilters(prev => ({
            ...prev,
            sectorIds: prev.sectorIds.filter(id => id !== sectorId)
          })),
          icon: <IconBuilding className="h-3 w-3" />
        });
      }
    });

    // Add individual position filter badges
    filters.positionIds.forEach(positionId => {
      const position = usersData?.data?.find(u => u.positionId === positionId)?.position;
      if (position) {
        filterBadges.push({
          key: `position-${positionId}`,
          label: "Cargo",
          value: position.name,
          onRemove: () => setFilters(prev => ({
            ...prev,
            positionIds: prev.positionIds.filter(id => id !== positionId)
          })),
          icon: <IconBriefcase className="h-3 w-3" />
        });
      }
    });

    // Add individual included user filter badges
    filters.includeUserIds.forEach(userId => {
      const user = simulatedUsers.find(u => u.id === userId);
      if (user) {
        filterBadges.push({
          key: `include-${userId}`,
          label: "Incluir Usuário",
          value: user.name,
          onRemove: () => setFilters(prev => ({
            ...prev,
            includeUserIds: prev.includeUserIds.filter(id => id !== userId)
          })),
          icon: <IconUserCheck className="h-3 w-3" />
        });
      }
    });

    // Add individual excluded user filter badges
    filters.excludeUserIds.forEach(userId => {
      const user = simulatedUsers.find(u => u.id === userId);
      if (user) {
        filterBadges.push({
          key: `exclude-${userId}`,
          label: "Excluir Usuário",
          value: user.name,
          onRemove: () => setFilters(prev => ({
            ...prev,
            excludeUserIds: prev.excludeUserIds.filter(id => id !== userId)
          })),
          icon: <IconUserMinus className="h-3 w-3" />
        });
      }
    });

    // Add "Mostrar todos" badge if showOnlyEligible is false AND no manual filters are applied
    // Don't show this badge if eligibility was automatically disabled by applying other filters
    if (!filters.showOnlyEligible && !hasManualFilters) {
      filterBadges.push({
        key: 'show-all',
        label: "Exibir",
        value: "Todos os usuários",
        onRemove: () => setFilters(prev => ({ ...prev, showOnlyEligible: true })),
        icon: <IconUsers className="h-3 w-3" />
      });
    }

    return filterBadges;
  }, [filters, sectorsData?.data, simulatedUsers, usersData]);

  const restoreCurrentPeriodTasks = () => {
    setTaskQuantity(originalTaskQuantity);
    setTaskInput(originalTaskQuantity.toFixed(1).replace('.', ','));
    setAverageInput((originalTaskQuantity / eligibleUserCount).toFixed(2).replace('.', ','));
  };

  // Export handlers
  const handleExport = async (format: ExportFormat, users: SimulatedUser[], columns: ExportColumn<SimulatedUser>[]) => {
    // Add total row to users for export
    const usersWithTotal = [...users];

    switch (format) {
      case "csv":
        await exportToCSV(usersWithTotal, columns);
        break;
      case "excel":
        await exportToExcel(usersWithTotal, columns);
        break;
      case "pdf":
        await exportToPDF(usersWithTotal, columns);
        break;
    }

    toast.success(`Exportação ${format.toUpperCase()} concluída com sucesso!`);
  };

  const exportToCSV = async (users: SimulatedUser[], columns: ExportColumn<SimulatedUser>[]) => {
    // CSV headers from columns
    const headers = columns.map((col) => col.label);

    // Convert users to CSV rows
    const rows = users.map((user) => columns.map((col) => col.getValue(user)));

    // Add total row
    const totalRow = columns.map((col) => {
      if (col.id === "name") return "TOTAL";
      if (col.id === "bonusAmount") return formatCurrency(totalBonusAmount);
      return "";
    });
    rows.push(totalRow);

    // Create CSV content
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

    // Download CSV
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `simulacao-bonus-${formatDate(new Date()).replace(/\//g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (users: SimulatedUser[], columns: ExportColumn<SimulatedUser>[]) => {
    // Headers from columns
    const headers = columns.map((col) => col.label);

    // Convert users to rows
    const rows = users.map((user) => columns.map((col) => col.getValue(user)));

    // Add total row
    const totalRow = columns.map((col) => {
      if (col.id === "name") return "TOTAL";
      if (col.id === "bonusAmount") return formatCurrency(totalBonusAmount);
      return "";
    });
    rows.push(totalRow);

    // Create tab-separated values for Excel
    const excelContent = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");

    // Download as .xls file
    const blob = new Blob(["\ufeff" + excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `simulacao-bonus-${formatDate(new Date()).replace(/\//g, "-")}.xls`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async (users: SimulatedUser[], columns: ExportColumn<SimulatedUser>[]) => {
    // Calculate responsive font sizes
    const fontSize = "12px";
    const headerFontSize = "11px";
    const cellPadding = "8px 6px";
    const headerPadding = "10px 6px";

    // A4 optimized PDF with proper formatting matching task history
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Simulação de Bônus - ${formatDate(new Date())}</title>
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          html, body {
            height: 100vh;
            width: 100vw;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: white;
            font-size: ${fontSize};
            line-height: 1.2;
          }

          body {
            display: grid;
            grid-template-rows: auto 1fr auto;
            min-height: 100vh;
            padding: 0;
          }

          .header {
            margin-bottom: 12px;
            flex-shrink: 0;
          }

          .logo {
            width: 140px;
            height: auto;
            margin-bottom: 8px;
          }

          .header-info {
          }

          .header-title {
            font-size: 18px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 4px;
          }

          .info {
            color: #6b7280;
            font-size: 10px;
          }

          .info p {
            margin: 1px 0;
          }

          .content-wrapper {
            flex: 1;
            overflow: auto;
            min-height: 0;
            padding-bottom: 35px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: ${fontSize};
          }

          th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
            padding: ${headerPadding};
            border: 1px solid #e5e7eb;
            border-bottom: 1px solid #d1d5db;
            font-size: ${headerFontSize};
            text-transform: uppercase;
            letter-spacing: 0.03em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          td {
            padding: ${cellPadding};
            border-left: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb;
            border-top: none;
            vertical-align: middle;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }

          tbody tr:last-child {
            font-weight: 700;
            background-color: #f0fdf4;
          }

          .text-left { text-align: left; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }

          .font-medium { font-weight: 500; }
          .font-semibold { font-weight: 600; }

          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 9px;
            flex-shrink: 0;
            background: white;
          }

          .footer-left {
            flex: 1;
          }

          .footer-right {
            text-align: right;
          }

          @media print {
            @page {
              size: A4;
              margin: 8mm;
            }

            .footer {
              position: fixed;
              bottom: 6mm;
              left: 6mm;
              right: 6mm;
              background: white;
              font-size: 7px;
            }

            .content-wrapper {
              padding-bottom: 50px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Ankaa Logo" class="logo" />
          <h1 class="header-title">Simulação de Bônus</h1>
          <div class="header-info">
            <div class="info">
              <p><strong>Data:</strong> ${formatDate(new Date())}</p>
              <p><strong>Total de tarefas:</strong> ${taskQuantity.toFixed(1)}</p>
              <p><strong>Total de colaboradores:</strong> ${users.length}</p>
              <p><strong>Média por colaborador:</strong> ${averageTasksPerUser.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div class="content-wrapper">
          <table>
            <thead>
              <tr>
                ${columns.map((col) => `<th class="text-left">${col.label}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${users.map((user) => `
                <tr>
                  ${columns.map((col) => `<td class="text-left">${col.getValue(user)}</td>`).join("")}
                </tr>
              `).join("")}
              <tr>
                ${columns.map((col) => {
                  if (col.id === "name") return `<td class="text-left">TOTAL</td>`;
                  if (col.id === "bonusAmount") return `<td class="text-left">${formatCurrency(totalBonusAmount)}</td>`;
                  return `<td></td>`;
                }).join("")}
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer">
          <div class="footer-left">
            <p>Simulação de Bônus - Sistema Ankaa</p>
          </div>
          <div class="footer-right">
            <p><strong>Gerado em:</strong> ${formatDate(new Date())} ${new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      printWindow.focus();

      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
        };
      };
    }
  };

  const isTaskQuantityModified = taskQuantity !== originalTaskQuantity && originalTaskQuantity > 0;

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      {/* Header with Task Input and Summary */}
      <div className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          {/* Left side - Inputs */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Task Quantity Input */}
            <div className="flex flex-col" style={{ width: '120px' }}>
              <Label htmlFor="taskQuantity" className="text-sm font-medium mb-1.5">
                Tarefas
              </Label>
              <Input
                id="taskQuantity"
                type="text"
                inputMode="decimal"
                value={taskInput}
                onChange={handleTaskQuantityChange}
                className="h-10 text-center font-semibold bg-transparent"
                placeholder="0,0"
              />
            </div>

            {/* Eligible Users Count - All filtered/selected users */}
            <div className="flex flex-col" style={{ width: '120px' }}>
              <Label className="text-sm font-medium mb-1.5">
                Colaboradores
              </Label>
              <Input
                type="text"
                value={eligibleUserCount}
                readOnly
                className="h-10 text-center font-semibold bg-transparent cursor-default"
                title={`${eligibleUserCount} usuários elegíveis para cálculo (todos os filtrados/selecionados)`}
              />
            </div>

            {/* Average Tasks per User - Editable for Reverse Calculation */}
            <div className="flex flex-col" style={{ width: '120px' }}>
              <Label htmlFor="averagePerUser" className="text-sm font-medium mb-1.5">
                Média
              </Label>
              <Input
                id="averagePerUser"
                type="text"
                inputMode="decimal"
                value={averageInput}
                onChange={handleAveragePerUserChange}
                className="h-10 text-center font-semibold bg-transparent"
                placeholder="0,00"
                title="Digite a média desejada por usuário para calcular tarefas totais"
              />
            </div>

            {/* Total Bonus */}
            <div className="flex flex-col" style={{ width: '160px' }}>
              <Label className="text-sm font-medium mb-1.5">
                Total
              </Label>
              <Input
                type="text"
                value={formatCurrency(totalBonusAmount)}
                readOnly
                className="h-10 text-center font-semibold bg-transparent cursor-default text-green-600"
              />
            </div>
          </div>

          {/* Right side - Action Buttons */}
          <div className="flex flex-col">
            <Label className="text-sm font-medium mb-1.5 opacity-0">
              Ações
            </Label>
            <div className="flex gap-2 h-10">
              {isTaskQuantityModified && (
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={restoreCurrentPeriodTasks}
                  className="h-10"
                  title="Restaurar quantidade de tarefas do período atual"
                >
                  <IconCalculator className="h-4 w-4 mr-2" />
                  Restaurar
                </Button>
              )}
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                onClick={() => setShowFiltersModal(true)}
                className="h-10 gap-2"
              >
                <IconFilter className="h-4 w-4" />
                Filtrar
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 bg-background/20 text-white">
                    {activeFilters.length}
                  </Badge>
                )}
              </Button>
              <BaseExportPopover<SimulatedUser>
                className="h-10"
                currentItems={sortedUsers}
                totalRecords={sortedUsers.length}
                visibleColumns={DEFAULT_VISIBLE_COLUMNS}
                exportColumns={EXPORT_COLUMNS}
                defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
                onExport={handleExport}
                entityName="colaborador"
                entityNamePlural="colaboradores"
              />
            </div>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && (
          <FilterIndicators
            filters={activeFilters}
            onClearAll={clearAllFilters}
            className="px-1 py-1"
          />
        )}

        {/* Current Period Info - Only show when there's actual data and task quantity is not modified */}
        {!isTaskQuantityModified && currentPeriodTasks?.success && currentPeriodTasks.data && currentPeriodTasks.data.length > 0 && (() => {
          const fullCommissionCount = currentPeriodTasks.data.filter(
            t => t.commission === COMMISSION_STATUS.FULL_COMMISSION
          ).length;
          const partialCommissionCount = currentPeriodTasks.data.filter(
            t => t.commission === COMMISSION_STATUS.PARTIAL_COMMISSION
          ).length;
          const weightedCount = fullCommissionCount + (partialCommissionCount * 0.5);

          return (
            <div className="mt-4 p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg border border-blue-500/30">
              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                <IconCalculator className="h-4 w-4" />
                <span className="font-medium">
                  Período atual ({currentPeriod.startDate.toLocaleDateString('pt-BR')} a {currentPeriod.endDate.toLocaleDateString('pt-BR')}):
                </span>
                <Badge variant="outline" className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30">
                  {weightedCount.toFixed(1)} tarefas ponderadas
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ({fullCommissionCount} integral{fullCommissionCount !== 1 ? '' : ''} + {partialCommissionCount} parcial{partialCommissionCount !== 1 ? '' : ''})
                </span>
              </div>
            </div>
          );
        })()}
      </div>


      {/* Interactive Table with padding */}
      <div className="flex-1 min-h-0 p-4">
        <div className="h-full flex flex-col overflow-hidden rounded-lg border border-border">
          {isLoading ? (
            <div className="p-4">
              <div className="space-y-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : simulatedUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum usuário elegível encontrado
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <IconFilter className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium mb-2">Nenhum usuário encontrado</p>
              <p className="text-sm">Ajuste os filtros para ver os usuários elegíveis.</p>
              <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  Limpar Filtros
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Fixed Header Table */}
              <div className="border-b border-border overflow-hidden">
                <Table className="w-full table-fixed">
                  <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
                    <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                      <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-32 p-0 !border-r-0">
                        <button
                          onClick={() => handleSort('payrollNumber')}
                          className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                        >
                          <span className="truncate">Nº FOLHA</span>
                          {getSortIcon('payrollNumber')}
                        </button>
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted p-0 !border-r-0">
                        <button
                          onClick={() => handleSort('name')}
                          className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                        >
                          <span className="truncate">NOME</span>
                          {getSortIcon('name')}
                        </button>
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-48 p-0 !border-r-0">
                        <button
                          onClick={() => handleSort('sectorName')}
                          className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                        >
                          <span className="truncate">SETOR</span>
                          {getSortIcon('sectorName')}
                        </button>
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-48 p-0 !border-r-0">
                        <button
                          onClick={() => handleSort('position')}
                          className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                        >
                          <span className="truncate">CARGO</span>
                          {getSortIcon('position')}
                        </button>
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-44 p-0 !border-r-0">
                        <button
                          onClick={() => handleSort('performanceLevel')}
                          className="flex items-center justify-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer border-0 bg-transparent"
                        >
                          <span className="truncate">PERFORMANCE</span>
                          {getSortIcon('performanceLevel')}
                        </button>
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted w-36 p-0 !border-r-0">
                        <button
                          onClick={() => handleSort('bonusAmount')}
                          className="flex items-center justify-end gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer border-0 bg-transparent"
                        >
                          <span className="truncate">BÔNUS</span>
                          {getSortIcon('bonusAmount')}
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

            {/* Scrollable Body Table */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Table className="w-full table-fixed">
                <TableBody>
                  {sortedUsers.map((user, index) => (
                    <TableRow
                      key={user.id}
                      className={cn(
                        "transition-colors border-b border-border h-10",
                        index % 2 === 1 && "bg-muted/10",
                        "hover:bg-muted/20"
                      )}
                    >
                      <TableCell className="w-32 p-0">
                        <div className="px-4 py-2 text-sm text-muted-foreground font-medium truncate">
                          {user.payrollNumber || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="p-0">
                        <div className="px-4 py-2 font-medium truncate">
                          {user.name}
                        </div>
                      </TableCell>
                      <TableCell className="w-48 p-0">
                        <div className="px-4 py-2 text-sm text-muted-foreground truncate">
                          {user.sectorName || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="w-48 p-0">
                        <div className="px-3 py-1">
                          <Combobox
                            mode="single"
                            value={user.position}
                            onValueChange={(value) => {
                              if (value && typeof value === 'string') {
                                handlePositionChange(user.id, value);
                              }
                            }}
                            options={POSITIONS.map(pos => ({
                              value: pos,
                              label: pos
                            }))}
                            placeholder={user.position || "Selecione o cargo"}
                            emptyText="Nenhum cargo encontrado"
                            className="w-full"
                            renderValue={() => user.position || "Selecione o cargo"}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="w-44 p-0">
                        <div className="px-3 py-1 flex items-center justify-center">
                          <PerformanceLevelSelector
                            value={user.performanceLevel}
                            onChange={(newLevel) => handlePerformanceLevelChange(user.id, newLevel)}
                            userId={user.id}
                            isModified={user.performanceLevel !== user.originalPerformanceLevel}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="w-36 p-0">
                        <div className="px-4 py-2 text-right">
                          <span className={cn(
                            "font-bold",
                            user.bonusAmount > 0 ? 'text-green-600' : 'text-muted-foreground'
                          )}>
                            {formatCurrency(user.bonusAmount)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
          )}
        </div>
      </div>

      {/* Filters Modal */}
      <BonusSimulationFilters
        open={showFiltersModal}
        onOpenChange={setShowFiltersModal}
        filters={filters}
        onApply={handleFiltersApply}
        onReset={handleFiltersReset}
        sectors={sectorsData?.data || []}
      />
    </Card>
  );
}