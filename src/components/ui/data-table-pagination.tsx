import React, { useEffect, useCallback } from "react";
import { ProductionPagination } from "./pagination-production";
import { usePaginationState, type PaginationMeta } from "@/hooks/use-pagination-state";

export interface DataTablePaginationProps {
  // Required data
  data: any[];
  totalRecords: number;

  // Query state
  isLoading?: boolean;
  isFetching?: boolean;
  error?: any;

  // Configuration
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  enableKeyboardNavigation?: boolean;

  // Styling
  className?: string;
  size?: "sm" | "default" | "lg";

  // Callbacks
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onDataChanged?: (newDataLength: number) => void;

  // URL integration
  namespace?: string;

  // Edge case handling
  autoCorrectOutOfBounds?: boolean;
  enableDeletionDetection?: boolean;
}

export function DataTablePagination({
  data,
  totalRecords,
  isLoading = false,
  isFetching = false,
  error,
  pageSizeOptions = [10, 20, 40, 50, 100],
  defaultPageSize = 40,
  enableKeyboardNavigation = true,
  className,
  size = "default",
  onPageChange,
  onPageSizeChange,
  onDataChanged,
  namespace,
  autoCorrectOutOfBounds = true,
  enableDeletionDetection = true,
}: DataTablePaginationProps) {
  // Track previous data length for deletion detection
  const [previousDataLength, setPreviousDataLength] = React.useState(data.length);
  const [previousTotalRecords, setPreviousTotalRecords] = React.useState(totalRecords);

  // Create pagination meta from props
  const meta: PaginationMeta = React.useMemo(() => {
    const pageSize = defaultPageSize; // This will be overridden by URL state
    const currentPage = 0; // This will be overridden by URL state
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

    return {
      page: currentPage,
      totalPages,
      totalRecords,
      hasNextPage: currentPage < totalPages - 1,
      hasPreviousPage: currentPage > 0,
      pageSize,
      startItem: totalRecords === 0 ? 0 : currentPage * pageSize + 1,
      endItem: Math.min((currentPage + 1) * pageSize, totalRecords),
    };
  }, [totalRecords, defaultPageSize]);

  // Use pagination state hook
  const pagination = usePaginationState(meta, {
    defaultPageSize,
    pageSizeOptions,
    namespace,
    autoCorrectPageOutOfBounds,
    isLoading: isLoading || isFetching,
    onPageChange,
    onPageSizeChange,
    onPageOutOfBounds: (requestedPage, maxPage) => {
      console.warn(`Pagination: Requested page ${requestedPage} is out of bounds (max: ${maxPage})`);
    },
  });

  // Deletion detection and page adjustment
  useEffect(() => {
    if (!enableDeletionDetection) return;

    // Detect when data is deleted
    const dataLengthChanged = data.length !== previousDataLength;
    const totalRecordsChanged = totalRecords !== previousTotalRecords;

    if (dataLengthChanged || totalRecordsChanged) {
      // Calculate how many items were deleted
      const deletedCount = Math.max(0, previousTotalRecords - totalRecords);

      if (deletedCount > 0) {
        console.log(`Detected deletion of ${deletedCount} items. Adjusting pagination...`);
        pagination.handleDataDeletion(deletedCount);
      }

      // Update tracking variables
      setPreviousDataLength(data.length);
      setPreviousTotalRecords(totalRecords);

      // Notify parent of data changes
      onDataChanged?.(data.length);
    }
  }, [data.length, totalRecords, previousDataLength, previousTotalRecords, enableDeletionDetection, pagination.handleDataDeletion, onDataChanged]);

  // Auto-adjust page when data changes and current page is out of bounds
  useEffect(() => {
    if (pagination.isPageOutOfBounds && !isLoading && totalRecords > 0) {
      console.log(`Current page ${pagination.page + 1} is out of bounds. Auto-adjusting...`);
      pagination.adjustPageAfterDeletion();
    }
  }, [pagination.isPageOutOfBounds, pagination.page, pagination.adjustPageAfterDeletion, isLoading, totalRecords]);

  // Handle empty state
  if (totalRecords === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Nenhum resultado encontrado</p>
          {error && <p className="text-sm text-destructive mt-2">Erro ao carregar dados: {error.message}</p>}
        </div>
      </div>
    );
  }

  // Handle loading state for initial load
  if (isLoading && data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  // Create the pagination meta with actual current state
  const currentMeta: PaginationMeta = {
    page: pagination.page,
    totalPages: pagination.totalPages,
    totalRecords,
    hasNextPage: pagination.hasNextPage,
    hasPreviousPage: pagination.hasPreviousPage,
    pageSize: pagination.pageSize,
    startItem: pagination.startItem,
    endItem: pagination.endItem,
  };

  return (
    <div className={className}>
      <ProductionPagination
        meta={currentMeta}
        pageSizeOptions={pageSizeOptions}
        isLoading={isLoading || isFetching}
        size={size}
        enableKeyboardNavigation={enableKeyboardNavigation}
        onPageChange={pagination.goToPage}
        onPageSizeChange={pagination.setPageSize}
        autoCorrectOutOfBounds={autoCorrectOutOfBounds}
        namespace={namespace}
        showPageInfo={true}
        showPageSizeSelector={true}
        showGoToPage={true}
        showFirstLastButtons={true}
      />

      {/* Debug info in development */}
      {process.env.NODE_ENV === "development" && (
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Debug Info</summary>
          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
            {JSON.stringify(
              {
                currentPage: pagination.page,
                pageSize: pagination.pageSize,
                totalRecords,
                totalPages: pagination.totalPages,
                dataLength: data.length,
                isLoading,
                isFetching,
                isPageOutOfBounds: pagination.isPageOutOfBounds,
                isEmpty: pagination.isEmpty,
              },
              null,
              2,
            )}
          </pre>
        </details>
      )}
    </div>
  );
}

// Hook for table components to use with queries
export function useTablePagination<TData = any>(
  queryResult: {
    data?: { data?: TData[]; meta?: { totalRecords?: number; page?: number; hasNextPage?: boolean } };
    isLoading?: boolean;
    isFetching?: boolean;
    error?: any;
  },
  options: {
    namespace?: string;
    defaultPageSize?: number;
    enableDeletionDetection?: boolean;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  } = {},
) {
  const { namespace, defaultPageSize = 40, enableDeletionDetection = true, onPageChange, onPageSizeChange } = options;

  const data = queryResult.data?.data || [];
  const totalRecords = queryResult.data?.meta?.totalRecords || 0;
  const isLoading = queryResult.isLoading || false;
  const isFetching = queryResult.isFetching || false;
  const error = queryResult.error;

  // Handle data refetch when pagination changes
  const handlePageChange = useCallback(
    (page: number) => {
      onPageChange?.(page);
    },
    [onPageChange],
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      onPageSizeChange?.(pageSize);
    },
    [onPageSizeChange],
  );

  return {
    // Pagination component props
    paginationProps: {
      data,
      totalRecords,
      isLoading,
      isFetching,
      error,
      defaultPageSize,
      namespace,
      enableDeletionDetection,
      onPageChange: handlePageChange,
      onPageSizeChange: handlePageSizeChange,
    },

    // Query state
    data,
    totalRecords,
    isLoading,
    isFetching,
    error,
    isEmpty: data.length === 0 && !isLoading,

    // Convenience render method
    renderPagination: (props?: Partial<DataTablePaginationProps>) => (
      <DataTablePagination
        {...{
          data,
          totalRecords,
          isLoading,
          isFetching,
          error,
          defaultPageSize,
          namespace,
          enableDeletionDetection,
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange,
        }}
        {...props}
      />
    ),
  };
}
