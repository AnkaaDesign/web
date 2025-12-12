import { useEffect, useMemo, useState } from "react";
import { IconFilter, IconSearch } from "@tabler/icons-react";
import { parseISO } from "date-fns";

import { useSecullumHolidays } from "../../../../../hooks";
import type { SecullumHolidayData } from "../../../../../schemas";
import { debounce } from "../../../../../utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { LoadingSpinner } from "@/components/ui/loading";
import { HolidaysTable } from "./holidays-table";
import { HolidaysFilters } from "./holidays-filters";
import { HolidaysEmpty } from "./holidays-empty";

// Use the proper type from schemas
type SecullumHoliday = SecullumHolidayData;

interface HolidaysListProps {
  className?: string;
}

export function HolidaysList({ className }: HolidaysListProps) {
  const currentYear = new Date().getFullYear();

  const [displaySearchText, setDisplaySearchText] = useState("");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Fetch holidays for selected year
  const { data: holidaysData, isLoading } = useSecullumHolidays({ year: selectedYear });

  // State for URL params
  const [urlParams, setUrlParams] = useState(() => new URLSearchParams(window.location.search));

  // Get filter values from URL
  const searchText = urlParams.get("searchingFor") || "";
  const yearFilter = urlParams.get("year") || currentYear.toString();
  const monthFilter = urlParams.get("month") || "";

  // Listen for URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      setUrlParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, []);

  // Initialize display search text and year from URL
  useEffect(() => {
    setDisplaySearchText(searchText);
    setSelectedYear(parseInt(yearFilter));
  }, [searchText, yearFilter]);

  // Apply local filtering
  const filteredHolidays = useMemo(() => {
    // The axios response has data.data structure
    // holidaysData is the axios response, holidaysData.data is { success, message, data }
    // holidaysData.data.data is the actual holidays array
    if (!holidaysData?.data?.data) return [];

    // Get the holidays array from the nested response
    const holidaysArray = holidaysData.data.data;

    // Ensure holidays is an array
    let holidays = Array.isArray(holidaysArray) ? holidaysArray : [];

    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      holidays = holidays.filter((holiday) => holiday.Descricao?.toLowerCase().includes(searchLower));
    }

    // Filter by month
    if (monthFilter && monthFilter !== "all") {
      const month = parseInt(monthFilter);
      holidays = holidays.filter((holiday) => {
        try {
          const date = parseISO(holiday.Data);
          const holidayMonth = date.getMonth() + 1; // Convert to 1-based month
          return holidayMonth === month;
        } catch (e) {
          return false;
        }
      });
    }

    // Sort by date
    holidays = [...holidays].sort((a, b) => {
      try {
        const dateA = new Date(a.Data);
        const dateB = new Date(b.Data);
        return dateA.getTime() - dateB.getTime();
      } catch {
        return 0;
      }
    });

    return holidays;
  }, [holidaysData, searchText, monthFilter]);

  // Update search in URL with debounce
  const updateSearchParams = useMemo(
    () =>
      debounce((value: string) => {
        const params = new URLSearchParams(window.location.search);
        if (value) {
          params.set("searchingFor", value);
        } else {
          params.delete("searchingFor");
        }
        // Force a re-render by updating the window location
        const newUrl = `${window.location.pathname}?${params}`;
        window.history.replaceState({}, "", newUrl);
        // Trigger a custom event to force component update
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, 300),
    [],
  );

  const handleSearchChange = (value: string) => {
    setDisplaySearchText(value);
    updateSearchParams(value);
  };

  const handleFiltersApply = (filters: { year?: number; month?: number }) => {
    const params = new URLSearchParams(window.location.search);

    if (filters.year) {
      params.set("year", filters.year.toString());
      setSelectedYear(filters.year);
    } else {
      params.delete("year");
    }

    if (filters.month) {
      params.set("month", filters.month.toString());
    } else {
      params.delete("month");
    }

    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
    // Trigger popstate event to update URL params state
    window.dispatchEvent(new PopStateEvent("popstate"));
    setIsFilterModalOpen(false);
  };

  const clearFilter = (filterKey: string) => {
    const params = new URLSearchParams(window.location.search);
    params.delete(filterKey);

    if (filterKey === "year") {
      setSelectedYear(currentYear);
    }

    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
    // Trigger popstate event to update URL params state
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("searchingFor");
    params.delete("year");
    params.delete("month");
    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
    // Trigger popstate event to update URL params state
    window.dispatchEvent(new PopStateEvent("popstate"));
    setDisplaySearchText("");
    setSelectedYear(currentYear);
  };

  // Handle edit action (placeholder for now)
  const handleEdit = (holiday: SecullumHoliday) => {
    toast.info("Edição de feriado ainda não implementada");
  };

  // Build active filters array
  const activeFilters = [];
  if (searchText) {
    activeFilters.push({
      key: "searchingFor",
      label: "Busca",
      value: searchText,
      onRemove: () => {
        setDisplaySearchText("");
        clearFilter("searchingFor");
      },
    });
  }
  if (yearFilter && yearFilter !== currentYear.toString()) {
    activeFilters.push({
      key: "year",
      label: "Ano",
      value: yearFilter,
      onRemove: () => clearFilter("year"),
    });
  }
  if (monthFilter) {
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    activeFilters.push({
      key: "month",
      label: "Mês",
      value: monthNames[parseInt(monthFilter) - 1],
      onRemove: () => clearFilter("month"),
    });
  }

  // Check if we have active filters (excluding search)
  const hasActiveFilters = (yearFilter && yearFilter !== currentYear.toString()) || !!monthFilter;
  const filterCount = (yearFilter && yearFilter !== currentYear.toString() ? 1 : 0) + (monthFilter ? 1 : 0);

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border overflow-hidden", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden min-h-0">
        {/* Search and Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar feriados..."
              value={displaySearchText}
              onChange={(value) => handleSearchChange(typeof value === "string" ? value : "")}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setIsFilterModalOpen(true)}>
              <IconFilter className="h-4 w-4 mr-2" />
              Filtros{hasActiveFilters ? ` (${filterCount})` : ""}
            </Button>
          </div>
        </div>

        {/* Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} />}

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredHolidays.length === 0 ? (
          <HolidaysEmpty hasFilters={activeFilters.length > 0} />
        ) : (
          <div className="flex-1 overflow-auto rounded-md border border-border min-h-0">
            <HolidaysTable holidays={filteredHolidays} onEdit={handleEdit} />
          </div>
        )}
      </CardContent>

      {/* Filters Modal */}
      <HolidaysFilters
        open={isFilterModalOpen}
        onOpenChange={setIsFilterModalOpen}
        onApply={handleFiltersApply}
        currentYear={currentYear}
        selectedYear={parseInt(yearFilter)}
        selectedMonth={monthFilter && monthFilter !== "all" ? parseInt(monthFilter) : undefined}
      />
    </Card>
  );
}
