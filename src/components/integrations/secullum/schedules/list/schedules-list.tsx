import { useEffect, useMemo, useState } from "react";

import { useSecullumHorarios } from "../../../../../hooks";
import { debounce } from "../../../../../utils";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { SchedulesTable, type SecullumHorario } from "./schedules-table";
import { SchedulesEmpty } from "./schedules-empty";
import { Skeleton } from "@/components/ui/skeleton";

interface SchedulesListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 20;

export function SchedulesList({ className }: SchedulesListProps) {
  const [displaySearchText, setDisplaySearchText] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Fetch all schedules (Secullum API doesn't support pagination)
  const { data: schedulesData, isLoading } = useSecullumHorarios({ incluirDesativados: true });

  // State for URL params
  const [urlParams, setUrlParams] = useState(() => new URLSearchParams(window.location.search));

  // Get filter values from URL
  const searchText = urlParams.get("searchingFor") || "";

  // Listen for URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      setUrlParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, []);

  // Initialize display search text from URL
  useEffect(() => {
    setDisplaySearchText(searchText);
  }, [searchText]);

  // Reset page when search changes
  useEffect(() => {
    setPage(0);
  }, [searchText]);

  // Apply local filtering
  const filteredSchedules = useMemo(() => {
    if (!schedulesData?.data?.data) return [];

    const schedulesArray = schedulesData.data.data;

    // Ensure schedules is an array
    let schedules: SecullumHorario[] = Array.isArray(schedulesArray) ? schedulesArray : [];

    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      schedules = schedules.filter(
        (schedule) =>
          schedule.Descricao?.toLowerCase().includes(searchLower) ||
          schedule.Codigo?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by code
    schedules = [...schedules].sort((a, b) => {
      const codeA = a.Codigo || "";
      const codeB = b.Codigo || "";
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });

    return schedules;
  }, [schedulesData, searchText]);

  // Paginate the filtered results
  const paginatedSchedules = useMemo(() => {
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredSchedules.slice(startIndex, endIndex);
  }, [filteredSchedules, page, pageSize]);

  const totalRecords = filteredSchedules.length;
  const totalPages = Math.ceil(totalRecords / pageSize);

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
        const newUrl = `${window.location.pathname}?${params}`;
        window.history.replaceState({}, "", newUrl);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, 300),
    []
  );

  const handleSearchChange = (value: string) => {
    setDisplaySearchText(value);
    updateSearchParams(value);
  };

  const clearFilter = (filterKey: string) => {
    const params = new URLSearchParams(window.location.search);
    params.delete(filterKey);
    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("searchingFor");
    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setDisplaySearchText("");
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(0); // Reset to first page when page size changes
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

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <TableSearchInput
            value={displaySearchText}
            onChange={handleSearchChange}
            placeholder="Buscar horários..."
            isPending={displaySearchText !== searchText}
          />
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} />
        )}

        {/* Table with integrated pagination */}
        <div className="flex-1 min-h-0 overflow-auto">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : paginatedSchedules.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <SchedulesEmpty hasFilters={activeFilters.length > 0} />
            </div>
          ) : (
            <SchedulesTable
              schedules={paginatedSchedules}
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalRecords}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
