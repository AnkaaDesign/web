/**
 * DataTable Usage Example
 *
 * This file demonstrates how to use the production-ready DataTable component
 * with various features and configurations.
 */

import React from "react";
import { DataTable, DataTableColumn } from "./data-table";
import { Badge } from "./badge";
import { Button } from "./button";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

// Example data types
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "moderator";
  status: "active" | "inactive" | "pending";
  joinedAt: Date;
  lastLogin?: Date;
}

// Sample data
const sampleUsers: User[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    role: "admin",
    status: "active",
    joinedAt: new Date("2023-01-15"),
    lastLogin: new Date("2024-01-10"),
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "user",
    status: "active",
    joinedAt: new Date("2023-03-22"),
    lastLogin: new Date("2024-01-09"),
  },
  {
    id: "3",
    name: "Mike Johnson",
    email: "mike@example.com",
    role: "moderator",
    status: "inactive",
    joinedAt: new Date("2023-06-10"),
  },
  // Add more sample data...
];

// Column definitions with TypeScript generics
const userColumns: DataTableColumn<User>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center space-x-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={`https://avatar.vercel.sh/${row.original.email}`} />
          <AvatarFallback>
            {row.original.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-sm text-muted-foreground">{row.original.email}</div>
        </div>
      </div>
    ),
    enableSorting: true,
    enableColumnFilter: true,
    minWidth: 200,
    description: "User's full name and email",
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const roleColors = {
        admin: "bg-red-100 text-red-800",
        moderator: "bg-blue-100 text-blue-800",
        user: "bg-gray-100 text-gray-800",
      };
      return <Badge className={roleColors[row.original.role]}>{row.original.role}</Badge>;
    },
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "equals",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const statusColors = {
        active: "bg-green-100 text-green-800",
        inactive: "bg-gray-100 text-gray-800",
        pending: "bg-yellow-100 text-yellow-800",
      };
      return <Badge className={statusColors[row.original.status]}>{row.original.status}</Badge>;
    },
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: "equals",
  },
  {
    accessorKey: "joinedAt",
    header: "Joined",
    cell: ({ row }) => <div className="text-sm">{row.original.joinedAt.toLocaleDateString()}</div>,
    enableSorting: true,
    sortingFn: "datetime",
  },
  {
    accessorKey: "lastLogin",
    header: "Last Login",
    cell: ({ row }) => <div className="text-sm">{row.original.lastLogin ? row.original.lastLogin.toLocaleDateString() : "Never"}</div>,
    enableSorting: true,
    sortingFn: "datetime",
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm">
          Edit
        </Button>
        <Button variant="outline" size="sm">
          Delete
        </Button>
      </div>
    ),
    enableSorting: false,
    enableColumnFilter: false,
    enableHiding: false,
  },
];

// Example implementations

// 1. Basic DataTable
export function BasicDataTableExample() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Basic DataTable</h2>
      <DataTable data={sampleUsers} columns={userColumns} enableRowSelection={false} enableExport={false} height={400} />
    </div>
  );
}

// 2. Full-featured DataTable
export function FullFeaturedDataTableExample() {
  const [selectedUsers, setSelectedUsers] = React.useState<User[]>([]);

  const handleExport = (data: User[], options: any) => {
    console.log("Exporting data:", data, options);
    // Implement actual export logic here
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Full-Featured DataTable</h2>
      <DataTable
        data={sampleUsers}
        columns={userColumns}
        id="users-table"
        // Selection
        enableRowSelection={true}
        rowSelectionMode="multiple"
        onRowSelectionChange={setSelectedUsers}
        rowId="id"
        // Filtering
        enableGlobalFilter={true}
        globalFilterPlaceholder="Search users..."
        enableColumnFilters={true}
        // Sorting
        enableSorting={true}
        enableMultiSort={true}
        // Column features
        enableColumnResizing={true}
        enableColumnVisibility={true}
        columnResizeMode="onEnd"
        // Export
        enableExport={true}
        onExport={handleExport}
        exportFormats={["csv", "excel", "json"]}
        // UI
        height={600}
        showHeader={true}
        showFooter={true}
        showTableSettings={true}
        // Virtualization
        enableVirtualization={true}
        estimateRowHeight={() => 60}
        overscan={10}
        // Accessibility
        ariaLabel="Users management table"
        ariaDescription="A table for managing user accounts with sorting, filtering, and selection capabilities"
        // Row interactions
        onRowClick={(user) => console.log("Row clicked:", user)}
        onRowDoubleClick={(user) => console.log("Row double-clicked:", user)}
        // Custom empty state
        emptyMessage="No users found"
        emptyDescription="Try adjusting your search criteria"
      />
    </div>
  );
}

// 3. Loading state example
export function LoadingDataTableExample() {
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Loading State</h2>
      <DataTable data={isLoading ? [] : sampleUsers} columns={userColumns} isLoading={isLoading} loadingRowCount={8} height={400} />
    </div>
  );
}

// 4. Error state example
export function ErrorDataTableExample() {
  const error = new Error("Failed to fetch users from the server");

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Error State</h2>
      <DataTable data={[]} columns={userColumns} error={error} height={400} />
    </div>
  );
}

// 5. Custom toolbar and footer
export function CustomizedDataTableExample() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Customized DataTable</h2>
      <DataTable
        data={sampleUsers}
        columns={userColumns}
        height={500}
        renderCustomToolbar={() => (
          <div className="flex items-center space-x-2">
            <Button variant="default" size="sm">
              Add User
            </Button>
            <Button variant="outline" size="sm">
              Import
            </Button>
          </div>
        )}
        renderCustomFooter={() => <div className="text-xs text-muted-foreground">Last updated: {new Date().toLocaleString()}</div>}
      />
    </div>
  );
}

// 6. Small dataset without virtualization
export function SmallDataTableExample() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Small Dataset (No Virtualization)</h2>
      <DataTable
        data={sampleUsers.slice(0, 5)}
        columns={userColumns}
        enableVirtualization={false}
        enablePagination={true}
        pageSize={10}
        currentPage={1}
        totalPages={1}
        height="auto"
      />
    </div>
  );
}

// 7. Using the useDataTable hook
export function UseDataTableHookExample() {
  const { data, isLoading, error, updateData, setLoadingState, setErrorState } = useDataTable<User>(sampleUsers);

  const handleRefresh = async () => {
    setLoadingState(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      updateData([
        ...sampleUsers,
        {
          id: String(Date.now()),
          name: "New User",
          email: "new@example.com",
          role: "user",
          status: "active",
          joinedAt: new Date(),
        },
      ]);
    } catch (err) {
      setErrorState(err as Error);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">useDataTable Hook Example</h2>
      <div className="mb-4">
        <Button onClick={handleRefresh} disabled={isLoading}>
          Refresh Data
        </Button>
      </div>
      <DataTable data={data} columns={userColumns} isLoading={isLoading} error={error} height={400} />
    </div>
  );
}

// Export all examples for usage
export const DataTableExamples = {
  BasicDataTableExample,
  FullFeaturedDataTableExample,
  LoadingDataTableExample,
  ErrorDataTableExample,
  CustomizedDataTableExample,
  SmallDataTableExample,
  UseDataTableHookExample,
};

// Hook import (assuming it's exported from the main component)
import { useDataTable } from "./data-table";
