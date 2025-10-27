import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useFiles, useFileMutations, useFileBatchMutations } from "../../hooks";
import type { File } from "../../types";
import type { FileGetManyFormData } from "../../schemas";
import { routes } from "../../constants";
import { formatFileSize, getFileCategory, getFileDisplayName } from "../../utils/file";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconSearch, IconFilter, IconUpload } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/use-table-state";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";

interface FileListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

// Simple debounce utility with proper cleanup
function createDebounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  return debounced;
}

export function FileList({ className }: FileListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { update } = useFileMutations();
  const { batchDelete, batchUpdate } = useFileBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Single source of truth for search input - no dual state!
  const [searchInput, setSearchInput] = useState(() => searchParams.get("search") || "");
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Parse filters from URL
  const getFiltersFromUrl = (): Partial<FileGetManyFormData> => {
    const filters: Partial<FileGetManyFormData> = {
      limit: DEFAULT_PAGE_SIZE,
    };

    // Parse file type filters
    const fileType = searchParams.get("fileType");
    if (fileType) {
      filters.where = { ...filters.where, fileType };
    }

    // Parse boolean filters
    const showDeleted = searchParams.get("showDeleted");
    if (showDeleted === "true") {
      filters.showDeleted = true;
    }

    // Parse size filters
    const sizeMin = searchParams.get("sizeMin");
    const sizeMax = searchParams.get("sizeMax");
    if (sizeMin || sizeMax) {
      filters.sizeRange = {
        ...(sizeMin && { min: Number(sizeMin) }),
        ...(sizeMax && { max: Number(sizeMax) }),
      };
    }

    // Parse date range filters
    const createdAfter = searchParams.get("createdAfter");
    const createdBefore = searchParams.get("createdBefore");
    if (createdAfter || createdBefore) {
      filters.createdAt = {
        ...(createdAfter && { gte: new Date(createdAfter) }),
        ...(createdBefore && { lte: new Date(createdBefore) }),
      };
    }

    return filters;
  };

  const [filters, setFilters] = useState<Partial<FileGetManyFormData>>(() => {
    return getFiltersFromUrl();
  });

  // Create debounced search function once
  const debouncedUpdateUrl = useMemo(
    () =>
      createDebounce((search: string) => {
        setSearchParams(
          (prev) => {
            const params = new URLSearchParams(prev);
            if (search.trim()) {
              params.set("search", search.trim());
            } else {
              params.delete("search");
            }
            return params;
          },
          { replace: true },
        );
      }, 300),
    [setSearchParams],
  );

  // Handle search input changes
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value); // Immediate UI update
      debouncedUpdateUrl(value); // Debounced URL update
    },
    [debouncedUpdateUrl],
  );

  // Sync with URL changes (browser back/forward) - only when URL differs
  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    if (urlSearch !== searchInput) {
      setSearchInput(urlSearch);
    }
  }, [searchParams.get("search")]); // Only depend on the search param value

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedUpdateUrl.cancel();
    };
  }, [debouncedUpdateUrl]);

  // Query filters for API
  const queryFilters = useMemo(() => {
    const urlSearch = searchParams.get("search");
    return {
      ...filters,
      ...(urlSearch && { searchingFor: urlSearch }), // Use URL value, not input state
    };
  }, [filters, searchParams.get("search")]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<FileGetManyFormData>) => {
      setFilters(newFilters);

      // Update URL immediately when filters change
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);

          // Clear all filter params first
          const filterKeys = ["fileType", "showDeleted", "sizeMin", "sizeMax", "createdAfter", "createdBefore"];
          filterKeys.forEach((key) => params.delete(key));

          // Add new filter params
          const where = newFilters.where || {};
          if (where.fileType) params.set("fileType", where.fileType);
          if (newFilters.showDeleted) params.set("showDeleted", "true");

          // Add range filters
          if (newFilters.sizeRange?.min !== undefined) params.set("sizeMin", String(newFilters.sizeRange.min));
          if (newFilters.sizeRange?.max !== undefined) params.set("sizeMax", String(newFilters.sizeRange.max));

          // Add date filters
          if (newFilters.createdAt?.gte) params.set("createdAfter", newFilters.createdAt.gte.toISOString());
          if (newFilters.createdAt?.lte) params.set("createdBefore", newFilters.createdAt.lte.toISOString());

          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Handle clear all filters
  const handleClearAllFilters = useCallback(() => {
    const resetFilters: Partial<FileGetManyFormData> = {
      limit: DEFAULT_PAGE_SIZE,
    };
    setFilters(resetFilters);
    setSearchInput(""); // Clear search input

    // Clear URL params except sort
    setSearchParams(
      (prev) => {
        const sortParam = prev.get("sort");
        const newParams = new URLSearchParams();
        if (sortParam) {
          newParams.set("sort", sortParam);
        }
        return newParams;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  // Fetch files using the query with includes to show associations
  const queryFiltersWithInclude = useMemo(
    () => ({
      ...queryFilters,
      include: {
        tasksArtworks: true,
        customerLogo: true,
        supplierLogo: true,
        orderBudgets: true,
        orderInvoices: true,
        orderReceipts: true,
        taskBudgets: true,
        taskInvoices: true,
        taskReceipts: true,
        warning: true,
        observations: true,
      },
    }),
    [queryFilters],
  );

  const { data: filesData, isLoading, error } = useFiles(queryFiltersWithInclude);

  // Context menu handlers
  const handleBulkEdit = (files: File[]) => {
    if (files.length === 1) {
      // Single file - show alert (files route not yet implemented)
      alert("Visualização de arquivo em desenvolvimento");
    } else {
      // Multiple files - show info (no batch edit available for files)
      alert(`${files.length} arquivos selecionados`);
    }
  };

  const handleBulkDelete = async (files: File[]) => {
    try {
      const confirmed = window.confirm(`Tem certeza que deseja deletar ${files.length} arquivo${files.length > 1 ? "s" : ""}?`);

      if (!confirmed) return;

      const ids = files.map((file) => file.id);
      await batchDelete({ fileIds: ids });
    } catch (error) {
      console.error("Error deleting file(s):", error);
    }
  };

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar arquivos por nome, tipo..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <Button variant="outline" size="default" onClick={() => setShowFilterModal(true)} className="group">
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">Filtros</span>
            </Button>
            <Button variant="default" size="default" onClick={() => alert("Upload de arquivo em desenvolvimento")} className="group">
              <IconUpload className="h-4 w-4 mr-2" />
              <span>Upload</span>
            </Button>
          </div>
        </div>

        {/* File Grid/List */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Carregando arquivos...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-destructive">Erro ao carregar arquivos</div>
            </div>
          ) : !filesData?.data?.length ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Nenhum arquivo encontrado</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filesData.data.map((file) => (
                <div
                  key={file.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => alert("Visualização de arquivo em desenvolvimento")}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileTypeIcon filename={file.filename} mimeType={file.mimetype} size="sm" />
                    <div className="font-medium truncate flex-1">{getFileDisplayName(file, 25)}</div>
                  </div>
                  <div className="text-sm text-muted-foreground capitalize">{getFileCategory(file)}</div>
                  <div className="text-xs text-muted-foreground mt-2">{formatFileSize(file.size)}</div>
                  <div className="text-xs text-muted-foreground">{file.mimetype}</div>

                  {/* Show file associations if any */}
                  {file.tasksArtworks && file.tasksArtworks.length > 0 && (
                    <div className="text-xs text-blue-600 mt-1">
                      📋 {file.tasksArtworks.length} tarefa{file.tasksArtworks.length > 1 ? "s" : ""}
                    </div>
                  )}
                  {file.customerLogo && file.customerLogo.length > 0 && (
                    <div className="text-xs text-green-600 mt-1">
                      🏢 {file.customerLogo.length} cliente{file.customerLogo.length > 1 ? "s" : ""}
                    </div>
                  )}
                  {file.orderBudgets && file.orderBudgets.length > 0 && (
                    <div className="text-xs text-purple-600 mt-1">
                      📄 {file.orderBudgets.length} orçamento{file.orderBudgets.length > 1 ? "s" : ""}
                    </div>
                  )}
                  {file.warning && file.warning.length > 0 && (
                    <div className="text-xs text-red-600 mt-1">
                      ⚠️ {file.warning.length} aviso{file.warning.length > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
