/**
 * Data Explorer Page
 *
 * Interactive data exploration with query builder,
 * pivot tables, and custom data analysis.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IconRefresh, IconDownload, IconFilter, IconPlus, IconTrash, IconDatabase } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';

interface QueryFilter {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export default function DataExplorerPage() {
  const [selectedTable, setSelectedTable] = useState('tasks');
  const [selectedFields, setSelectedFields] = useState<string[]>(['id', 'title', 'status']);
  const [filters, setFilters] = useState<QueryFilter[]>([]);
  const [groupBy, setGroupBy] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [limit, setLimit] = useState<number>(100);

  // Available tables
  const tables = [
    { value: 'tasks', label: 'Tasks' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'orders', label: 'Orders' },
    { value: 'employees', label: 'Employees' },
    { value: 'customers', label: 'Customers' }
  ];

  // Available fields for selected table
  const fieldsByTable: Record<string, Array<{ value: string; label: string; type: string }>> = {
    tasks: [
      { value: 'id', label: 'ID', type: 'number' },
      { value: 'title', label: 'Title', type: 'string' },
      { value: 'status', label: 'Status', type: 'string' },
      { value: 'priority', label: 'Priority', type: 'string' },
      { value: 'assignee', label: 'Assignee', type: 'string' },
      { value: 'created_at', label: 'Created At', type: 'date' },
      { value: 'completed_at', label: 'Completed At', type: 'date' }
    ],
    inventory: [
      { value: 'id', label: 'ID', type: 'number' },
      { value: 'name', label: 'Name', type: 'string' },
      { value: 'quantity', label: 'Quantity', type: 'number' },
      { value: 'price', label: 'Price', type: 'number' },
      { value: 'category', label: 'Category', type: 'string' }
    ]
  };

  const availableFields = fieldsByTable[selectedTable] || [];

  // Operators based on field type
  const getOperators = (type: string) => {
    switch (type) {
      case 'number':
        return ['=', '!=', '>', '<', '>=', '<='];
      case 'string':
        return ['=', '!=', 'contains', 'starts with', 'ends with'];
      case 'date':
        return ['=', '!=', 'before', 'after'];
      default:
        return ['=', '!='];
    }
  };

  // Sample query results
  const sampleResults = [
    { id: 1, title: 'Implement feature A', status: 'In Progress', priority: 'High', assignee: 'João Silva' },
    { id: 2, title: 'Fix bug B', status: 'Completed', priority: 'Medium', assignee: 'Maria Santos' },
    { id: 3, title: 'Review code C', status: 'Pending', priority: 'Low', assignee: 'Pedro Costa' },
    { id: 4, title: 'Deploy to production', status: 'In Progress', priority: 'High', assignee: 'João Silva' },
    { id: 5, title: 'Update documentation', status: 'Pending', priority: 'Medium', assignee: 'Ana Silva' }
  ];

  const addFilter = () => {
    setFilters([...filters, {
      id: Date.now().toString(),
      field: availableFields[0]?.value || '',
      operator: '=',
      value: ''
    }]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<QueryFilter>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const toggleField = (field: string) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter(f => f !== field));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const runQuery = () => {
    console.log('Running query...', {
      table: selectedTable,
      fields: selectedFields,
      filters,
      groupBy,
      sortBy,
      sortOrder,
      limit
    });
  };

  const exportResults = (format: 'csv' | 'json' | 'excel') => {
    console.log(`Exporting as ${format}...`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Explorer</h1>
          <p className="text-muted-foreground mt-1">
            Build custom queries and explore your data
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <IconRefresh className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Builder */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconDatabase className="h-5 w-5" />
                <CardTitle>Query Builder</CardTitle>
              </div>
              <CardDescription>Configure your data query</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Select Table */}
              <div className="space-y-2">
                <Label>Data Source</Label>
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map(table => (
                      <SelectItem key={table.value} value={table.value}>
                        {table.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Select Fields */}
              <div className="space-y-2">
                <Label>Fields to Display</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                  {availableFields.map(field => (
                    <div key={field.value} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedFields.includes(field.value)}
                        onCheckedChange={() => toggleField(field.value)}
                      />
                      <label className="text-sm cursor-pointer flex-1">
                        {field.label}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {field.type}
                        </Badge>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Filters</Label>
                  <Button size="sm" variant="outline" onClick={addFilter}>
                    <IconPlus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {filters.map((filter) => {
                    const field = availableFields.find(f => f.value === filter.field);
                    const operators = field ? getOperators(field.type) : ['='];

                    return (
                      <div key={filter.id} className="flex gap-2 items-start p-2 border rounded-md">
                        <div className="flex-1 space-y-2">
                          <Select
                            value={filter.field}
                            onValueChange={(value) => updateFilter(filter.id, { field: value })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableFields.map(f => (
                                <SelectItem key={f.value} value={f.value}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={filter.operator}
                            onValueChange={(value) => updateFilter(filter.id, { operator: value })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {operators.map(op => (
                                <SelectItem key={op} value={op}>
                                  {op}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={filter.value}
                            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                            placeholder="Value"
                            className="h-8"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFilter(filter.id)}
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {filters.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No filters applied
                    </div>
                  )}
                </div>
              </div>

              {/* Sort */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map(field => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Order</Label>
                  <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Limit */}
              <div className="space-y-2">
                <Label>Result Limit</Label>
                <Input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  min={1}
                  max={10000}
                />
              </div>

              <Button className="w-full" onClick={runQuery}>
                <IconFilter className="h-4 w-4 mr-2" />
                Run Query
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Query Results</CardTitle>
                  <CardDescription>
                    {sampleResults.length} rows returned
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportResults('csv')}>
                    <IconDownload className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportResults('json')}>
                    <IconDownload className="h-4 w-4 mr-2" />
                    JSON
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportResults('excel')}>
                    <IconDownload className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectedFields.map(field => {
                        const fieldDef = availableFields.find(f => f.value === field);
                        return (
                          <TableHead key={field}>
                            {fieldDef?.label || field}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleResults.map((row, idx) => (
                      <TableRow key={idx}>
                        {selectedFields.map(field => (
                          <TableCell key={field}>
                            {(row as any)[field]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Query SQL Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Query</CardTitle>
              <CardDescription>SQL equivalent of your query</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-muted rounded-md text-sm overflow-x-auto">
                <code>
                  {`SELECT ${selectedFields.join(', ') || '*'}
FROM ${selectedTable}
${filters.length > 0 ? `WHERE ${filters.map(f => `${f.field} ${f.operator} '${f.value}'`).join(' AND ')}` : ''}
${groupBy ? `GROUP BY ${groupBy}` : ''}
ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
LIMIT ${limit};`}
                </code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
