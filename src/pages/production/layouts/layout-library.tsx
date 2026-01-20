import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconPlus,
  IconDots,
  IconEye,
  IconCopy,
  IconTrash,
  IconListDetails,
  IconLayout,
  IconSearch,
  IconFilter,
} from "@tabler/icons-react";

import { layoutService } from "@/api-client/layout";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { routes, FAVORITE_PAGES } from "@/constants";

import type { Layout, LayoutSection } from "@/types";
import type { LayoutCreateFormData } from "@/schemas";

// Types
interface LayoutWithUsage extends Layout {
  sectionsCount?: number;
  usageCount?: number;
}

interface TruckUsageInfo {
  taskId?: string;
  truckPlate: string;
  customerName?: string;
  side: "left" | "right" | "back";
  status?: string;
}

// Layout Details Modal Component
function LayoutDetailsModal({
  open,
  onOpenChange,
  layout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: Layout | null;
}) {
  if (!layout) return null;

  const sections = layout.layoutSections || [];
  const totalWidth = sections.reduce((sum, s) => sum + s.width, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Layout Details</DialogTitle>
          <DialogDescription>
            ID: {layout.id.slice(0, 8)}... | Height: {layout.height}m | Total Width: {totalWidth.toFixed(2)}m
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {layout.photo && (
            <div>
              <Label>Photo</Label>
              <div className="mt-2 rounded-md border overflow-hidden">
                <img
                  src={layout.photo.url || "#"}
                  alt="Layout"
                  className="w-full h-auto max-h-96 object-contain"
                />
              </div>
            </div>
          )}
          <div>
            <Label>Sections ({sections.length})</Label>
            <div className="mt-2 space-y-2">
              {sections
                .sort((a, b) => a.position - b.position)
                .map((section) => (
                  <div
                    key={section.id}
                    className="flex items-center justify-between p-3 border rounded-md"
                  >
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">Position {section.position}</Badge>
                      <span className="text-sm">Width: {section.width}m</span>
                      {section.isDoor && (
                        <Badge variant="secondary">
                          Door (Height: {section.doorHeight}m)
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Layout Usage Modal Component
function LayoutUsageModal({
  open,
  onOpenChange,
  layoutId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layoutId: string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["layoutUsage", layoutId],
    queryFn: async () => {
      if (!layoutId) return null;
      const response = await layoutService.getLayoutUsage(layoutId);
      return response.data.data;
    },
    enabled: open && !!layoutId,
  });

  const trucks: TruckUsageInfo[] = data?.trucks || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Layout Usage</DialogTitle>
          <DialogDescription>
            Trucks currently using this layout
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
          {!isLoading && trucks.length === 0 && (
            <EmptyState
              title="No usage found"
              description="This layout is not currently assigned to any trucks."
              icon={<IconLayout size={48} />}
            />
          )}
          {!isLoading && trucks.length > 0 && (
            <div className="space-y-2">
              {trucks.map((truck, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{truck.truckPlate}</div>
                    {truck.customerName && (
                      <div className="text-sm text-muted-foreground">
                        Customer: {truck.customerName}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {truck.side === "left" ? "Left" : truck.side === "right" ? "Right" : "Back"}
                    </Badge>
                    {truck.status && <Badge>{truck.status}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Create Layout Modal Component
function CreateLayoutModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [height, setHeight] = useState("");
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [sections, setSections] = useState<
    Array<{
      width: string;
      isDoor: boolean;
      doorHeight: string;
      position: number;
    }>
  >([{ width: "", isDoor: false, doorHeight: "", position: 0 }]);

  const createMutation = useMutation({
    mutationFn: (data: LayoutCreateFormData) => layoutService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layouts"] });
      toast.success("Layout created successfully");
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to create layout");
    },
  });

  const resetForm = () => {
    setHeight("");
    setPhotoId(null);
    setSections([{ width: "", isDoor: false, doorHeight: "", position: 0 }]);
  };

  const addSection = () => {
    setSections([
      ...sections,
      { width: "", isDoor: false, doorHeight: "", position: sections.length },
    ]);
  };

  const removeSection = (index: number) => {
    if (sections.length > 1) {
      setSections(sections.filter((_, i) => i !== index));
    }
  };

  const updateSection = (index: number, field: string, value: any) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setSections(newSections);
  };

  const handleSubmit = () => {
    const layoutData: LayoutCreateFormData = {
      height: parseFloat(height),
      photoId: photoId,
      layoutSections: sections.map((s) => ({
        width: parseFloat(s.width),
        isDoor: s.isDoor,
        doorHeight: s.isDoor ? parseFloat(s.doorHeight) : null,
        position: s.position,
      })),
    };

    createMutation.mutate(layoutData);
  };

  const isValid =
    height &&
    parseFloat(height) > 0 &&
    sections.every(
      (s) =>
        s.width &&
        parseFloat(s.width) > 0 &&
        (!s.isDoor || (s.doorHeight && parseFloat(s.doorHeight) > 0))
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Layout</DialogTitle>
          <DialogDescription>
            Define the layout dimensions and sections
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="height">Height (meters)</Label>
            <Input
              id="height"
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="e.g., 2.5"
            />
          </div>
          <div>
            <Label>Photo Upload (Optional)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                // In a real implementation, you would upload the file and get the ID
                // For now, we'll just show the input
                const file = e.target.files?.[0];
                if (file) {
                  toast.info("Photo upload would be implemented here");
                }
              }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Sections</Label>
              <Button variant="outline" size="sm" onClick={addSection}>
                <IconPlus size={16} className="mr-1" />
                Add Section
              </Button>
            </div>
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div key={index} className="p-3 border rounded-md space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Section {index + 1}</span>
                    {sections.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSection(index)}
                      >
                        <IconTrash size={16} />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`width-${index}`}>Width (m)</Label>
                      <Input
                        id={`width-${index}`}
                        type="number"
                        step="0.1"
                        min="0"
                        max="20"
                        value={section.width}
                        onChange={(e) =>
                          updateSection(index, "width", e.target.value)
                        }
                        placeholder="e.g., 1.5"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={section.isDoor}
                          onChange={(e) =>
                            updateSection(index, "isDoor", e.target.checked)
                          }
                        />
                        <span className="text-sm">Is Door</span>
                      </label>
                    </div>
                  </div>
                  {section.isDoor && (
                    <div>
                      <Label htmlFor={`doorHeight-${index}`}>
                        Door Height (m)
                      </Label>
                      <Input
                        id={`doorHeight-${index}`}
                        type="number"
                        step="0.1"
                        min="0"
                        value={section.doorHeight}
                        onChange={(e) =>
                          updateSection(index, "doorHeight", e.target.value)
                        }
                        placeholder="e.g., 2.0"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Create Layout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Layout Library Page Component
export default function LayoutLibraryPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [usageFilter, setUsageFilter] = useState<"all" | "used" | "unused">("all");
  const [selectedLayout, setSelectedLayout] = useState<Layout | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [layoutToDelete, setLayoutToDelete] = useState<string | null>(null);

  // Fetch layouts
  const { data, isLoading, error } = useQuery({
    queryKey: ["layouts"],
    queryFn: async () => {
      const response = await layoutService.listLayouts({
        includeUsage: true,
        includeSections: true,
      });
      return response.data.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => layoutService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layouts"] });
      toast.success("Layout deleted successfully");
      setDeleteDialogOpen(false);
      setLayoutToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to delete layout");
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async (layout: Layout) => {
      const layoutData: LayoutCreateFormData = {
        height: layout.height,
        photoId: layout.photoId,
        layoutSections:
          layout.layoutSections?.map((s) => ({
            width: s.width,
            isDoor: s.isDoor,
            doorHeight: s.doorHeight,
            position: s.position,
          })) || [],
      };
      return layoutService.create(layoutData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layouts"] });
      toast.success("Layout duplicated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to duplicate layout");
    },
  });

  // Process layouts with computed fields
  const layouts: LayoutWithUsage[] = (data || []).map((layout) => ({
    ...layout,
    sectionsCount: layout.layoutSections?.length || 0,
    usageCount:
      (layout.trucksLeftSide?.length || 0) +
      (layout.trucksRightSide?.length || 0) +
      (layout.trucksBackSide?.length || 0),
  }));

  // Filter layouts
  const filteredLayouts = layouts.filter((layout) => {
    const matchesSearch =
      layout.height.toString().includes(searchQuery) ||
      layout.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesUsageFilter =
      usageFilter === "all" ||
      (usageFilter === "used" && layout.usageCount! > 0) ||
      (usageFilter === "unused" && layout.usageCount === 0);

    return matchesSearch && matchesUsageFilter;
  });

  // Action handlers
  const handleViewDetails = (layout: Layout) => {
    setSelectedLayout(layout);
    setDetailsModalOpen(true);
  };

  const handleViewUsage = (layout: Layout) => {
    setSelectedLayout(layout);
    setUsageModalOpen(true);
  };

  const handleDuplicate = (layout: Layout) => {
    duplicateMutation.mutate(layout);
  };

  const handleDelete = (layout: LayoutWithUsage) => {
    if (layout.usageCount === 0) {
      setLayoutToDelete(layout.id);
      setDeleteDialogOpen(true);
    } else {
      toast.error("Cannot delete layout that is in use");
    }
  };

  const confirmDelete = () => {
    if (layoutToDelete) {
      deleteMutation.mutate(layoutToDelete);
    }
  };

  // DataTable columns
  const columns = [
    {
      key: "id",
      header: "ID",
      accessor: (row: LayoutWithUsage) => (
        <span className="font-mono text-xs">{row.id.slice(0, 8)}...</span>
      ),
      sortable: true,
    },
    {
      key: "height",
      header: "Height (m)",
      accessor: (row: LayoutWithUsage) => (
        <span className="font-medium">{row.height.toFixed(2)}</span>
      ),
      sortable: true,
    },
    {
      key: "sectionsCount",
      header: "Sections",
      accessor: (row: LayoutWithUsage) => (
        <Badge variant="outline">{row.sectionsCount}</Badge>
      ),
      sortable: true,
    },
    {
      key: "usageCount",
      header: "Usage",
      accessor: (row: LayoutWithUsage) => (
        <Badge variant={row.usageCount! > 0 ? "default" : "secondary"}>
          {row.usageCount} truck{row.usageCount !== 1 ? "s" : ""}
        </Badge>
      ),
      sortable: true,
    },
    {
      key: "actions",
      header: "Actions",
      accessor: (row: LayoutWithUsage) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <IconDots size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleViewDetails(row)}>
              <IconEye size={16} className="mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleViewUsage(row)}>
              <IconListDetails size={16} className="mr-2" />
              View Usage
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleDuplicate(row)}>
              <IconCopy size={16} className="mr-2" />
              Duplicate Layout
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDelete(row)}
              disabled={row.usageCount! > 0}
              className={row.usageCount! > 0 ? "opacity-50" : "text-destructive"}
            >
              <IconTrash size={16} className="mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="list"
        title="Layout Library"
        breadcrumbs={[
          { label: "Home", href: routes.home },
          { label: "Production", href: routes.production.root },
          { label: "Layout Library" },
        ]}
        className="flex-shrink-0"
      />

      <div className="flex-1 min-h-0 pb-6 flex flex-col">
        <div className="bg-card rounded-lg border shadow-sm p-6 flex flex-col h-full">
          {/* Header with Create Button */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">All Layouts</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage layout templates for truck configurations
              </p>
            </div>
            <Button onClick={() => setCreateModalOpen(true)}>
              <IconPlus size={18} className="mr-2" />
              Create Layout
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <IconSearch
                size={18}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search by height or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <IconFilter size={18} className="text-muted-foreground" />
              <Select value={usageFilter} onValueChange={(value: any) => setUsageFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by usage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Layouts</SelectItem>
                  <SelectItem value="used">Used Only</SelectItem>
                  <SelectItem value="unused">Unused Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Failed to load layouts. Please try again later.
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && layouts.length === 0 && (
            <EmptyState
              title="No layouts found"
              description="Get started by creating your first layout template."
              icon={<IconLayout size={48} />}
              action={
                <Button onClick={() => setCreateModalOpen(true)}>
                  <IconPlus size={18} className="mr-2" />
                  Create First Layout
                </Button>
              }
            />
          )}

          {/* Data Table */}
          {!isLoading && !error && layouts.length > 0 && (
            <DataTable
              data={filteredLayouts}
              columns={columns}
              searchKey="height"
              searchPlaceholder="Search layouts..."
              showColumnToggle={true}
              pageSize={10}
              className="flex-1"
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <LayoutDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        layout={selectedLayout}
      />

      <LayoutUsageModal
        open={usageModalOpen}
        onOpenChange={setUsageModalOpen}
        layoutId={selectedLayout?.id || null}
      />

      <CreateLayoutModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the layout
              and all its sections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
