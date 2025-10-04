import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconEdit, IconTrash, IconDownload, IconArchive, IconCheck, IconInfoCircle } from "@tabler/icons-react";

import { useAdvancedTableSelection } from "@/hooks/use-advanced-table-selection";
import { BulkActionsBar, createCommonBulkActions } from "@/components/ui/bulk-actions-bar";
import { AdvancedSelectionControls, AdvancedTableHeaderCheckbox } from "@/components/ui/advanced-selection-controls";

// Mock data type
interface MockItem {
  id: string;
  name: string;
  category: string;
  price: number;
  status: "active" | "inactive";
  createdAt: Date;
}

// Generate mock data
const generateMockData = (count: number): MockItem[] => {
  const categories = ["Electronics", "Clothing", "Books", "Sports", "Home"];
  const statuses: ("active" | "inactive")[] = ["active", "inactive"];

  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index + 1}`,
    name: `Item ${index + 1}`,
    category: categories[index % categories.length],
    price: Math.round(Math.random() * 1000 * 100) / 100,
    status: statuses[index % 2],
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
  }));
};

export default function TestTableState() {
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Generate large dataset for testing
  const allData = useMemo(() => generateMockData(500), []);

  // Filter data based on search and status
  const filteredData = useMemo(() => {
    let filtered = allData;

    if (searchTerm) {
      filtered = filtered.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.category.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    return filtered;
  }, [allData, searchTerm, statusFilter]);

  // Paginate filtered data
  const currentPageData = useMemo(() => {
    const startIndex = currentPage * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  // Mock API functions for bulk actions
  const mockBulkActions = useMemo(() => {
    const onEdit = async (ids: string[]) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log("Edit items:", ids);
    };

    const onDelete = async (ids: string[]) => {
      // Simulate slow deletion with individual processing
      for (const id of ids) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        console.log("Deleted item:", id);
      }
    };

    const onExport = async (ids: string[]) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Export items:", ids);
    };

    const onArchive = async (ids: string[]) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      console.log("Archive items:", ids);
    };

    return createCommonBulkActions(onDelete, onEdit, onExport, onArchive);
  }, []);

  // Use advanced table selection
  const selection = useAdvancedTableSelection({
    currentPageData,
    allFilteredData: filteredData,
    totalCount: allData.length,
    getAllIds: async () => allData.map((item) => item.id),
    getAllFilteredIds: async () => filteredData.map((item) => item.id),
    onSelectionChange: (selectedIds, stats) => {
      console.log("Selection changed:", { selectedIds, stats });
    },
    maxSelection: 100, // Demo limit
  });

  // Handle row click with keyboard shortcuts
  const handleRowClick = (item: MockItem, event: React.MouseEvent) => {
    selection.handleRowSelection(item, event);
  };

  // Get current URL for debugging
  const currentUrl = window.location.search;

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Advanced Table Selection Test</h1>
        <Badge variant="outline" className="text-sm">
          {allData.length} total items
        </Badge>
      </div>

      {/* URL Debug */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current URL Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">{currentUrl || "No parameters"}</pre>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters & Search</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Search</label>
              <Input placeholder="Search items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="mt-1 w-full border border-border rounded px-3 py-2">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {filteredData.length} of {allData.length} items
            </div>
          </CardContent>
        </Card>

        {/* Selection Controls */}
        <AdvancedSelectionControls
          selectionStats={selection.selectionStats}
          onSelectAll={selection.handleSelectAll}
          onSelectAllFiltered={selection.handleSelectAllFiltered}
          onSelectAllAcrossPages={selection.handleSelectAllAcrossPages}
          onDeselectAll={selection.resetSelection}
          onInvertSelection={selection.invertSelection}
          onInvertSelectionFiltered={selection.invertSelectionFiltered}
          onShowSelectedOnly={selection.setShowSelectedOnly}
          showSelectedOnly={selection.showSelectedOnly}
          totalCount={allData.length}
          filteredCount={filteredData.length}
          compact={false}
          showKeyboardHints={true}
        />

        {/* Selection Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <IconInfoCircle className="h-5 w-5" />
              Selection Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Selected:</span>
                <Badge variant="default">{selection.selectionStats.selectedCount}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Current page:</span>
                <span>
                  {selection.selectionStats.selectedCurrentPageCount} / {selection.selectionStats.currentPageCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Mode:</span>
                <Badge variant="outline">{selection.selectionStats.selectionMode}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Show selected only:</span>
                <Badge variant={selection.showSelectedOnly ? "default" : "secondary"}>{selection.showSelectedOnly ? "Yes" : "No"}</Badge>
              </div>
            </div>

            {selection.hasSelection && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  <strong>Keyboard shortcuts:</strong>
                  <br />
                  • Ctrl+Click: Toggle individual
                  <br />
                  • Shift+Click: Select range
                  <br />• Click row: Regular selection
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selection.selectedIds}
        selectionStats={selection.selectionStats}
        actions={mockBulkActions}
        onDeselectAll={selection.resetSelection}
        onShowSelectedOnly={() => selection.setShowSelectedOnly(!selection.showSelectedOnly)}
        showSelectedOnly={selection.showSelectedOnly}
        position="top"
        showProgress={true}
      />

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Items Table</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <AdvancedTableHeaderCheckbox
                      selectionStats={selection.selectionStats}
                      onSelectAll={selection.handleSelectAll}
                      onSelectAllFiltered={selection.handleSelectAllFiltered}
                      onSelectAllAcrossPages={selection.handleSelectAllAcrossPages}
                      onDeselectAll={selection.resetSelection}
                      totalCount={allData.length}
                      filteredCount={filteredData.length}
                      showDropdown={true}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPageData.length > 0 ? (
                  currentPageData.map((item) => {
                    const isSelected = selection.isSelected(item.id);

                    return (
                      <TableRow
                        key={item.id}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-muted/50" : "hover:bg-muted/25"}`}
                        onClick={(e) => handleRowClick(item, e)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onCheckedChange={() => selection.handleRowSelection(item)} />
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>${item.price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === "active" ? "default" : "secondary"}>{item.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.createdAt.toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No items found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, filteredData.length)} of {filteredData.length} results
              {selection.hasSelection && <span className="ml-2 font-medium">({selection.selectionStats.selectedCount} selected)</span>}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(0);
                  }}
                  className="border border-border rounded px-2 py-1 text-sm"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage(currentPage - 1)}>
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(currentPage + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" onClick={() => selection.addToSelection(["item-1", "item-5", "item-10"])}>
              Select Items 1,5,10
            </Button>
            <Button variant="outline" onClick={() => selection.selectRange("item-1", "item-5")}>
              Select Range 1-5
            </Button>
            <Button variant="outline" onClick={() => selection.invertSelection()}>
              Invert Page Selection
            </Button>
            <Button variant="outline" onClick={() => setSearchTerm("Electronics")}>
              Filter Electronics
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feature Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconCheck className="h-5 w-5 text-green-600" />
            Feature Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-green-600" />
              <span>✓ URL state persistence</span>
            </div>
            <div className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-green-600" />
              <span>✓ Keyboard shortcuts (Shift+click, Ctrl+click)</span>
            </div>
            <div className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-green-600" />
              <span>✓ Cross-page selection</span>
            </div>
            <div className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-green-600" />
              <span>✓ Selection with filters/search active</span>
            </div>
            <div className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-green-600" />
              <span>✓ Clear visual feedback</span>
            </div>
            <div className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-green-600" />
              <span>✓ Bulk action capabilities</span>
            </div>
            <div className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-green-600" />
              <span>✓ Selection count and statistics</span>
            </div>
            <div className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-green-600" />
              <span>✓ Show selected only mode</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
