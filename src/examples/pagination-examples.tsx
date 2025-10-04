import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Import our pagination components
import { ProductionPagination } from "@/components/ui/pagination-production";
import { DataTablePagination, useTablePagination } from "@/components/ui/data-table-pagination";
import { SimplePagination } from "@/components/ui/pagination-production";
import { usePaginationState, type PaginationMeta } from "@/hooks/use-pagination-state";
import { PaginationStateRenderer, PaginationError, PaginationEmpty, PaginationTableSkeleton, NetworkStatusIndicator } from "@/components/ui/pagination-loading-states";

// Mock data for examples
interface MockItem {
  id: string;
  name: string;
  price: number;
  category: string;
  status: "active" | "inactive";
}

const generateMockData = (count: number): MockItem[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Item ${i + 1}`,
    price: Math.floor(Math.random() * 1000) + 10,
    category: ["Electronics", "Clothing", "Books", "Home"][Math.floor(Math.random() * 4)],
    status: Math.random() > 0.3 ? "active" : "inactive",
  }));
};

const TOTAL_ITEMS = 1247;
const ITEMS_PER_PAGE = 40;

// Example 1: Basic Production Pagination
export function BasicPaginationExample() {
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);

  const totalPages = Math.ceil(TOTAL_ITEMS / pageSize);

  const meta: PaginationMeta = {
    page: currentPage,
    totalPages,
    totalRecords: TOTAL_ITEMS,
    hasNextPage: currentPage < totalPages - 1,
    hasPreviousPage: currentPage > 0,
    pageSize,
    startItem: TOTAL_ITEMS === 0 ? 0 : currentPage * pageSize + 1,
    endItem: Math.min((currentPage + 1) * pageSize, TOTAL_ITEMS),
  };

  const handlePageChange = (page: number) => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentPage(page);
      setIsLoading(false);
    }, 300);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(0); // Reset to first page
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Production Pagination</CardTitle>
        <p className="text-sm text-muted-foreground">Full-featured pagination with URL state integration, keyboard navigation, and loading states.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm">Simulating {TOTAL_ITEMS} total items. Try keyboard shortcuts:</p>
            <div className="mt-2 space-x-2">
              <Badge variant="outline">Ctrl/Cmd + ← (previous)</Badge>
              <Badge variant="outline">Ctrl/Cmd + → (next)</Badge>
              <Badge variant="outline">Ctrl/Cmd + Home (first)</Badge>
              <Badge variant="outline">Ctrl/Cmd + End (last)</Badge>
            </div>
          </div>

          <ProductionPagination meta={meta} isLoading={isLoading} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} namespace="basic-example" />

          <div className="text-xs text-muted-foreground">
            Current state: Page {currentPage + 1}, Size {pageSize}, Loading: {isLoading.toString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Example 2: Data Table Integration
export function DataTableIntegrationExample() {
  const [data, setData] = useState<MockItem[]>(() => generateMockData(ITEMS_PER_PAGE));
  const [totalRecords, setTotalRecords] = useState(TOTAL_ITEMS);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Simulate API call
  const fetchData = async (page: number, pageSize: number) => {
    setIsFetching(true);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const startIndex = page * pageSize;
    const newData = generateMockData(Math.min(pageSize, totalRecords - startIndex));

    setData(newData);
    setIsFetching(false);
  };

  const handlePageChange = (page: number) => {
    fetchData(page, data.length);
  };

  const handlePageSizeChange = (pageSize: number) => {
    fetchData(0, pageSize);
  };

  // Simulate data deletion
  const deleteRandomItems = () => {
    const itemsToDelete = Math.floor(Math.random() * 5) + 1;
    const newTotal = Math.max(0, totalRecords - itemsToDelete);
    setTotalRecords(newTotal);

    // Update current page data
    const newData = data.slice(0, -itemsToDelete);
    setData(newData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Table Integration</CardTitle>
        <p className="text-sm text-muted-foreground">Pagination integrated with data fetching, automatic edge case handling, and deletion detection.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={deleteRandomItems} disabled={totalRecords === 0}>
              Simulate Deletion
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTotalRecords(TOTAL_ITEMS)}>
              Reset Data
            </Button>
          </div>

          {/* Mock table */}
          <div className="border rounded-lg">
            <div className="grid grid-cols-4 gap-4 p-4 border-b font-medium">
              <div>Name</div>
              <div>Price</div>
              <div>Category</div>
              <div>Status</div>
            </div>
            {isFetching ? (
              <div className="p-4">
                <PaginationTableSkeleton rows={5} columns={4} />
              </div>
            ) : (
              data.map((item) => (
                <div key={item.id} className="grid grid-cols-4 gap-4 p-4 border-b last:border-b-0">
                  <div>{item.name}</div>
                  <div>R$ {item.price.toFixed(2)}</div>
                  <div>{item.category}</div>
                  <div>
                    <Badge variant={item.status === "active" ? "default" : "secondary"}>{item.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>

          <DataTablePagination
            data={data}
            totalRecords={totalRecords}
            isLoading={isLoading}
            isFetching={isFetching}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            namespace="datatable-example"
            enableDeletionDetection={true}
          />

          <div className="text-xs text-muted-foreground">
            Total records: {totalRecords}, Current data length: {data.length}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Example 3: Loading States and Error Handling
export function LoadingStatesExample() {
  const [state, setState] = useState<"loading" | "error" | "empty" | "success" | "out-of-bounds">("success");
  const [hasFilters, setHasFilters] = useState(false);

  const mockError = new Error("Failed to fetch data from server");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loading States & Error Handling</CardTitle>
        <p className="text-sm text-muted-foreground">Comprehensive loading states, error handling, and empty states for different scenarios.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button variant={state === "loading" ? "default" : "outline"} size="sm" onClick={() => setState("loading")}>
              Loading
            </Button>
            <Button variant={state === "error" ? "default" : "outline"} size="sm" onClick={() => setState("error")}>
              Error
            </Button>
            <Button variant={state === "empty" ? "default" : "outline"} size="sm" onClick={() => setState("empty")}>
              Empty
            </Button>
            <Button variant={state === "out-of-bounds" ? "default" : "outline"} size="sm" onClick={() => setState("out-of-bounds")}>
              Out of Bounds
            </Button>
            <Button variant={state === "success" ? "default" : "outline"} size="sm" onClick={() => setState("success")}>
              Success
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="has-filters" checked={hasFilters} onChange={(e) => setHasFilters(e.target.checked)} />
            <label htmlFor="has-filters" className="text-sm">
              Has active filters (affects empty state)
            </label>
          </div>

          <Separator />

          <div className="min-h-[200px] border rounded-lg">
            <PaginationStateRenderer
              state={state}
              data={state === "success" ? generateMockData(5) : []}
              error={state === "error" ? mockError : undefined}
              totalRecords={state === "success" ? 100 : 0}
              currentPage={15}
              totalPages={10}
              hasFilters={hasFilters}
              onRetry={() => {
                console.log("Retrying...");
                setState("loading");
                setTimeout(() => setState("success"), 1000);
              }}
              onClearFilters={() => {
                console.log("Clearing filters...");
                setHasFilters(false);
                setState("success");
              }}
              onGoToLastPage={() => {
                console.log("Going to last page...");
                setState("success");
              }}
            />
          </div>

          <NetworkStatusIndicator isOnline={state !== "error"} />
        </div>
      </CardContent>
    </Card>
  );
}

// Example 4: Hook Usage with React Query
export function HookUsageExample() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(false);

  // Simulate React Query result
  const mockQueryResult = {
    data: {
      data: generateMockData(pageSize),
      meta: {
        totalRecords: 156,
        page,
        hasNextPage: page < Math.ceil(156 / pageSize) - 1,
      },
    },
    isLoading,
    isFetching: false,
    error: null,
  };

  const { paginationProps, renderPagination } = useTablePagination(mockQueryResult, {
    namespace: "hook-example",
    defaultPageSize: 20,
    onPageChange: (newPage) => {
      setIsLoading(true);
      setTimeout(() => {
        setPage(newPage);
        setIsLoading(false);
      }, 300);
    },
    onPageSizeChange: (newSize) => {
      setPageSize(newSize);
      setPage(0);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hook Usage with React Query</CardTitle>
        <p className="text-sm text-muted-foreground">Using the useTablePagination hook with simulated React Query integration.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
              {`const { paginationProps, renderPagination } = useTablePagination(queryResult, {
  namespace: "my-table",
  defaultPageSize: 20,
  onPageChange: (page) => refetch({ page }),
  onPageSizeChange: (size) => refetch({ page: 0, size }),
});`}
            </pre>
          </div>

          {renderPagination({
            size: "sm",
            className: "border-t pt-4",
          })}

          <div className="text-xs text-muted-foreground">
            Current: Page {page + 1}, Size {pageSize}, Loading: {isLoading.toString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Example 5: Simple Pagination for Basic Use Cases
export function SimplePaginationExample() {
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = 25;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simple Pagination</CardTitle>
        <p className="text-sm text-muted-foreground">Lightweight pagination component for basic use cases without URL state or advanced features.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <SimplePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} size="default" />

          <div className="text-center text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Examples Component
export default function PaginationExamples() {
  return (
    <div className="container mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-4">Production-Ready Pagination System</h1>
        <p className="text-muted-foreground mb-8">
          Comprehensive pagination components with URL state integration, keyboard navigation, loading states, and edge case handling for the Ankaa project.
        </p>
      </div>

      <div className="grid gap-8">
        <BasicPaginationExample />
        <DataTableIntegrationExample />
        <LoadingStatesExample />
        <HookUsageExample />
        <SimplePaginationExample />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Features Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Core Features</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✅ URL state integration with browser history</li>
                <li>✅ Keyboard navigation (Ctrl/Cmd + arrows, Home, End)</li>
                <li>✅ Server-side pagination support</li>
                <li>✅ Automatic page bounds correction</li>
                <li>✅ Page size selector with validation</li>
                <li>✅ Go-to-page input with validation</li>
                <li>✅ Responsive design for all screen sizes</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Edge Cases & Loading</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✅ Last page deletion handling</li>
                <li>✅ Empty results display</li>
                <li>✅ Network error handling with retry</li>
                <li>✅ Loading states for page changes</li>
                <li>✅ Out of bounds page detection</li>
                <li>✅ Total pages calculation</li>
                <li>✅ Brazilian Portuguese localization</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
