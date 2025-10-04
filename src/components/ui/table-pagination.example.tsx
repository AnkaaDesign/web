import * as React from "react";
import { TablePagination, SimpleTablePagination, useTablePagination, type TablePaginationMeta } from "./table-pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Button } from "./button";

// Mock data for examples
const mockData = Array.from({ length: 247 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  description: `Description for item ${i + 1}`,
}));

// Example 1: Basic TablePagination
export function BasicTablePaginationExample() {
  const [currentPage, setCurrentPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [isLoading, setIsLoading] = React.useState(false);

  const totalRecords = mockData.length;
  const totalPages = Math.ceil(totalRecords / pageSize);

  const meta: TablePaginationMeta = {
    page: currentPage,
    totalPages,
    totalRecords,
    hasNextPage: currentPage < totalPages - 1,
    hasPreviousPage: currentPage > 0,
    pageSize,
    startItem: totalRecords === 0 ? 0 : currentPage * pageSize + 1,
    endItem: Math.min((currentPage + 1) * pageSize, totalRecords),
  };

  const handlePageChange = (page: number) => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setCurrentPage(page);
      setIsLoading(false);
    }, 500);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setIsLoading(true);
    setTimeout(() => {
      setPageSize(newPageSize);
      setCurrentPage(0); // Reset to first page
      setIsLoading(false);
    }, 500);
  };

  const currentData = mockData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic TablePagination Example</CardTitle>
        <CardDescription>Full-featured pagination with all options enabled</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mock table */}
        <div className="border rounded-lg">
          <div className="grid grid-cols-3 gap-4 p-4 border-b font-medium">
            <div>ID</div>
            <div>Name</div>
            <div>Description</div>
          </div>
          {currentData.map((item) => (
            <div key={item.id} className="grid grid-cols-3 gap-4 p-4 border-b last:border-b-0">
              <div>{item.id}</div>
              <div>{item.name}</div>
              <div className="text-muted-foreground">{item.description}</div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <TablePagination
          meta={meta}
          isLoading={isLoading}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onError={(error) => console.error("Pagination error:", error)}
          pageSizeOptions={[10, 20, 50, 100]}
          showPageInfo={true}
          showPageSizeSelector={true}
          showGoToPage={true}
          showFirstLastButtons={true}
          enableKeyboardNavigation={true}
          size="default"
        />
      </CardContent>
    </Card>
  );
}

// Example 2: Simple TablePagination
export function SimpleTablePaginationExample() {
  const [currentPage, setCurrentPage] = React.useState(0);
  const pageSize = 15;
  const totalRecords = 89;
  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simple TablePagination Example</CardTitle>
        <CardDescription>Minimal pagination with just navigation buttons</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border rounded-lg text-center text-muted-foreground">
          Showing page {currentPage + 1} of {totalPages}
        </div>

        <SimpleTablePagination currentPage={currentPage} totalPages={totalPages} totalRecords={totalRecords} pageSize={pageSize} onPageChange={setCurrentPage} size="sm" />
      </CardContent>
    </Card>
  );
}

// Example 3: Using the hook with mock query
export function HookBasedPaginationExample() {
  const [queryParams, setQueryParams] = React.useState({
    page: 0,
    pageSize: 25,
  });
  const [isLoading, setIsLoading] = React.useState(false);

  // Mock query result
  const mockQueryResult = {
    data: {
      data: mockData.slice(queryParams.page * queryParams.pageSize, (queryParams.page + 1) * queryParams.pageSize),
      meta: {
        totalRecords: mockData.length,
        page: queryParams.page,
        hasNextPage: (queryParams.page + 1) * queryParams.pageSize < mockData.length,
      },
    },
    isLoading,
    isFetching: false,
    error: null,
  };

  const pagination = useTablePagination(mockQueryResult, {
    defaultPageSize: queryParams.pageSize,
    onPageChange: (page) => {
      setIsLoading(true);
      setTimeout(() => {
        setQueryParams((prev) => ({ ...prev, page }));
        setIsLoading(false);
      }, 300);
    },
    onPageSizeChange: (pageSize) => {
      setIsLoading(true);
      setTimeout(() => {
        setQueryParams({ page: 0, pageSize });
        setIsLoading(false);
      }, 300);
    },
    onError: (error) => {
      console.error("Pagination error:", error);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hook-based Pagination Example</CardTitle>
        <CardDescription>Using useTablePagination hook for easier integration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mock table */}
        <div className="border rounded-lg">
          <div className="grid grid-cols-2 gap-4 p-4 border-b font-medium">
            <div>Item</div>
            <div>Status</div>
          </div>
          {pagination.data.map((item: any) => (
            <div key={item.id} className="grid grid-cols-2 gap-4 p-4 border-b last:border-b-0">
              <div>{item.name}</div>
              <div className="text-green-600">Active</div>
            </div>
          ))}
        </div>

        {/* Render pagination using the hook */}
        {pagination.renderPagination({
          size: "default",
          showFirstLastButtons: true,
          showGoToPage: pagination.meta.totalPages > 10,
        })}

        {/* Debug info */}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Debug Info</summary>
          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
            {JSON.stringify(
              {
                currentPage: pagination.meta.page,
                pageSize: pagination.meta.pageSize,
                totalRecords: pagination.meta.totalRecords,
                totalPages: pagination.meta.totalPages,
                dataLength: pagination.data.length,
                isLoading: pagination.isLoading,
                isEmpty: pagination.isEmpty,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}

// Example 4: Different sizes and states
export function PaginationStatesExample() {
  const [selectedExample, setSelectedExample] = React.useState<"loading" | "error" | "empty" | "outOfBounds">("loading");

  const baseMeta: TablePaginationMeta = {
    page: 0,
    totalPages: 5,
    totalRecords: 100,
    hasNextPage: true,
    hasPreviousPage: false,
    pageSize: 20,
    startItem: 1,
    endItem: 20,
  };

  const examples = {
    loading: {
      meta: baseMeta,
      isLoading: true,
      error: null,
    },
    error: {
      meta: baseMeta,
      isLoading: false,
      error: "Falha ao carregar dados do servidor",
    },
    empty: {
      meta: { ...baseMeta, totalRecords: 0, totalPages: 0, startItem: 0, endItem: 0 },
      isLoading: false,
      error: null,
    },
    outOfBounds: {
      meta: { ...baseMeta, page: 10 }, // Page 10 when total pages is 5
      isLoading: false,
      error: null,
    },
  };

  const currentExample = examples[selectedExample];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagination States Example</CardTitle>
        <CardDescription>Different loading states and edge cases</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* State selector */}
        <div className="flex gap-2 flex-wrap">
          {Object.keys(examples).map((state) => (
            <Button key={state} variant={selectedExample === state ? "default" : "outline"} size="sm" onClick={() => setSelectedExample(state as any)}>
              {state.charAt(0).toUpperCase() + state.slice(1)}
            </Button>
          ))}
        </div>

        {/* Size examples */}
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-2">Small Size</h4>
            <TablePagination
              meta={currentExample.meta}
              isLoading={currentExample.isLoading}
              error={currentExample.error}
              size="sm"
              onPageChange={() => {}}
              onPageSizeChange={() => {}}
            />
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Default Size</h4>
            <TablePagination
              meta={currentExample.meta}
              isLoading={currentExample.isLoading}
              error={currentExample.error}
              size="default"
              onPageChange={() => {}}
              onPageSizeChange={() => {}}
            />
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Large Size</h4>
            <TablePagination
              meta={currentExample.meta}
              isLoading={currentExample.isLoading}
              error={currentExample.error}
              size="lg"
              onPageChange={() => {}}
              onPageSizeChange={() => {}}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Example 5: Accessibility demonstration
export function AccessibilityExample() {
  const [currentPage, setCurrentPage] = React.useState(0);
  const [announcements, setAnnouncements] = React.useState<string[]>([]);

  const meta: TablePaginationMeta = {
    page: currentPage,
    totalPages: 8,
    totalRecords: 156,
    hasNextPage: currentPage < 7,
    hasPreviousPage: currentPage > 0,
    pageSize: 20,
    startItem: currentPage * 20 + 1,
    endItem: Math.min((currentPage + 1) * 20, 156),
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Announce page change for screen readers
    const announcement = `Navegando para página ${page + 1} de ${meta.totalPages}`;
    setAnnouncements((prev) => [...prev.slice(-4), announcement]); // Keep last 5 announcements
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accessibility Example</CardTitle>
        <CardDescription>Demonstrates ARIA labels, keyboard navigation, and screen reader support</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Screen reader announcements */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcements[announcements.length - 1]}
        </div>

        {/* Instructions */}
        <div className="p-4 bg-muted rounded-lg text-sm">
          <h4 className="font-medium mb-2">Accessibility Features:</h4>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Use Tab to navigate between pagination controls</li>
            <li>• Use Ctrl/Cmd + Arrow keys for quick navigation</li>
            <li>• All buttons have descriptive ARIA labels</li>
            <li>• Current page is announced as "current page"</li>
            <li>• Screen readers announce page changes</li>
            <li>• Disabled states are properly communicated</li>
          </ul>
        </div>

        <TablePagination meta={meta} onPageChange={handlePageChange} onPageSizeChange={() => {}} enableKeyboardNavigation={true} showFirstLastButtons={true} showGoToPage={true} />

        {/* Announcements log (for demonstration) */}
        {announcements.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Screen Reader Announcements:</h4>
            <div className="p-2 bg-muted rounded text-xs max-h-24 overflow-y-auto">
              {announcements.map((announcement, index) => (
                <div key={index} className="py-1">
                  {announcement}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main example component that shows all examples
export function TablePaginationExamples() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">TablePagination Component Examples</h1>
        <p className="text-muted-foreground">Comprehensive examples showing all features and use cases of the TablePagination component.</p>
      </div>

      <BasicTablePaginationExample />
      <SimpleTablePaginationExample />
      <HookBasedPaginationExample />
      <PaginationStatesExample />
      <AccessibilityExample />
    </div>
  );
}
