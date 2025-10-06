import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { SmartSearchInput } from "@/components/ui/smart-search-input";
import { SearchFiltersPanel } from "@/components/ui/search-filters-panel";
import { SearchEmptyStates, CompactEmptyState } from "@/components/ui/search-empty-states";
import { HighlightedCell, HIGHLIGHT_PRESETS } from "@/utils/search-highlighting";
import {
  IconSearch,
  IconFilter,
  IconUser,
  IconBox,
  IconUsers,
  IconTruck,
  IconClipboardList,
  IconRefresh,
  IconDownload,
  IconUpload,
  IconSettings,
  IconBulb,
  IconCode,
} from "@tabler/icons-react";
import { useAdvancedSearch } from "@/hooks/use-advanced-search";
import type { SearchField, SearchSuggestion } from "@/hooks/use-advanced-search";
import { createSearchContext, createSuggestionFetcher, suggestionBuilders } from "@/utils/search-suggestions";
import { CommonFilterFields } from "@/utils/table-filter-utils";
import type { FilterFieldDefinition } from "@/utils/table-filter-utils";

// Mock data for demo
const mockItems = [
  { id: "1", name: "Parafuso Phillips M6x20", barcodes: ["7891234567890"], brand: { name: "Vonder" }, category: { name: "Parafusos" }, supplier: { name: "Ferragens ABC" } },
  { id: "2", name: "Tinta Acrílica Branca 18L", barcodes: ["7891234567891"], brand: { name: "Coral" }, category: { name: "Tintas" }, supplier: { name: "Tintas Ltda" } },
  { id: "3", name: "Lixa d'água 220", barcodes: ["7891234567892"], brand: { name: "Norton" }, category: { name: "Abrasivos" }, supplier: { name: "Abrasivos SA" } },
  { id: "4", name: "Primer Automotivo Cinza", barcodes: ["7891234567893"], brand: { name: "Suvinil" }, category: { name: "Primers" }, supplier: { name: "Tintas Ltda" } },
  { id: "5", name: "Verniz Marítimo Transparente", barcodes: ["7891234567894"], brand: { name: "Coral" }, category: { name: "Vernizes" }, supplier: { name: "Tintas Ltda" } },
];

const mockUsers = [
  { id: "1", name: "João Silva", email: "joao@empresa.com", cpf: "12345678901", position: { name: "Pintor" }, sector: { name: "Produção" } },
  { id: "2", name: "Maria Santos", email: "maria@empresa.com", cpf: "98765432100", position: { name: "Supervisora" }, sector: { name: "Produção" } },
  { id: "3", name: "Carlos Oliveira", email: "carlos@empresa.com", cpf: "11122233344", position: { name: "Auxiliar" }, sector: { name: "Estoque" } },
];

const mockCustomers = [
  { id: "1", name: "Empresa ABC Ltda", fantasyName: "ABC", cpf: null, cnpj: "12345678000100", email: "contato@abc.com" },
  { id: "2", name: "João da Silva", fantasyName: null, cpf: "12345678901", cnpj: null, email: "joao@email.com" },
  { id: "3", name: "Indústria XYZ SA", fantasyName: "XYZ", cpf: null, cnpj: "98765432000111", email: "vendas@xyz.com" },
];

const mockTasks = [
  {
    id: "1",
    name: "Pintura Caminhão Mercedes",
    description: "Repintura completa",
    customer: { name: "Transportadora ABC", fantasyName: "ABC" },
    user: { name: "João Silva" },
    sector: { name: "Pintura" },
    services: [{ name: "Pintura Completa" }],
  },
  {
    id: "2",
    name: "Manutenção Scania R450",
    description: "Revisão geral",
    customer: { name: "Logística XYZ", fantasyName: "XYZ" },
    user: { name: "Carlos Oliveira" },
    sector: { name: "Mecânica" },
    services: [{ name: "Revisão" }],
  },
];

// Mock entity hooks
const mockEntityHooks = {
  items: {
    getMany: async (params: any) => ({ data: mockItems.filter((item) => !params.searchingFor || item.name.toLowerCase().includes(params.searchingFor.toLowerCase())) }),
  },
  users: {
    getMany: async (params: any) => ({ data: mockUsers.filter((user) => !params.searchingFor || user.name.toLowerCase().includes(params.searchingFor.toLowerCase())) }),
  },
  customers: {
    getMany: async (params: any) => ({ data: mockCustomers.filter((customer) => !params.searchingFor || customer.name.toLowerCase().includes(params.searchingFor.toLowerCase())) }),
  },
  tasks: {
    getMany: async (params: any) => ({ data: mockTasks.filter((task) => !params.searchingFor || task.name.toLowerCase().includes(params.searchingFor.toLowerCase())) }),
  },
};

// Filter field definitions for demo
const demoFilterFields: FilterFieldDefinition[] = [
  {
    ...CommonFilterFields.name,
    key: "name",
    label: "Nome do produto",
  },
  {
    key: "category",
    label: "Categoria",
    dataType: "select",
    operators: ["equals", "in"],
    options: [
      { value: "parafusos", label: "Parafusos" },
      { value: "tintas", label: "Tintas" },
      { value: "abrasivos", label: "Abrasivos" },
      { value: "primers", label: "Primers" },
      { value: "vernizes", label: "Vernizes" },
    ],
  },
  {
    key: "brand",
    label: "Marca",
    dataType: "multiSelect",
    operators: ["in", "notIn"],
    options: [
      { value: "vonder", label: "Vonder" },
      { value: "coral", label: "Coral" },
      { value: "norton", label: "Norton" },
      { value: "suvinil", label: "Suvinil" },
    ],
  },
  {
    key: "price",
    label: "Preço",
    dataType: "range",
    operators: ["between", "greaterThan", "lessThan"],
    validation: { min: 0, max: 10000 },
  },
  {
    key: "inStock",
    label: "Em estoque",
    dataType: "boolean",
    operators: ["equals"],
  },
  {
    ...CommonFilterFields.createdAt,
    label: "Data de cadastro",
  },
];

export default function SearchSystemDemo() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [simulateError, setSimulateError] = useState(false);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [demoData, setDemoData] = useState(mockItems);

  // Search configuration
  const searchFields: SearchField[] = [
    { key: "searchingFor", label: "Busca Geral", weight: 1 },
    { key: "name", label: "Nome", weight: 0.9 },
    { key: "barcodes", label: "Código de Barras", weight: 0.8, exactMatch: true },
    { key: "description", label: "Descrição", weight: 0.6 },
  ];

  // Create suggestion fetcher
  const fetchSuggestions = useMemo(() => {
    return createSuggestionFetcher(mockEntityHooks, ["items", "users", "customers", "tasks"]);
  }, []);

  // Initialize search hook
  const searchHook = useAdvancedSearch({
    searchFields,
    searchDebounceMs: 150,
    minSearchLength: 1,
    maxSuggestions: 8,
    enableSuggestions: true,
    enableHistory: true,
    historyStorageKey: "demo-search-history",
    fetchSuggestions: simulateError
      ? async () => {
          throw new Error("Simulated search error");
        }
      : async (query) => {
          if (simulateLoading) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
          return fetchSuggestions(query);
        },
    tableStateOptions: {
      namespace: "search-demo",
      defaultPageSize: 10,
      defaultFilters: {},
    },
  });

  const { searchQuery, debouncedSearchQuery, isSearching, suggestions, showSuggestions, currentEmptyState, clearSearch } = searchHook;

  // Filter demo data based on search
  const filteredData = useMemo(() => {
    if (!debouncedSearchQuery) return demoData;
    return demoData.filter(
      (item) =>
        item.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        item.barcodes.some((barcode) => barcode.includes(debouncedSearchQuery)) ||
        item.brand.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        item.category.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()),
    );
  }, [demoData, debouncedSearchQuery]);

  const lookupData = {
    categories: [
      { id: "parafusos", name: "Parafusos" },
      { id: "tintas", name: "Tintas" },
      { id: "abrasivos", name: "Abrasivos" },
    ],
    brands: [
      { id: "vonder", name: "Vonder" },
      { id: "coral", name: "Coral" },
      { id: "norton", name: "Norton" },
    ],
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Sistema de Busca Avançado</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">Demonstração completa do sistema de busca com sugestões, filtros, destacamento de texto e estados vazios.</p>
      </div>

      {/* Main Demo Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconSearch className="h-5 w-5" />
            Busca Interativa
          </CardTitle>
          <CardDescription>Digite para ver sugestões em tempo real e filtros avançados em ação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SmartSearchInput
                searchHook={searchHook}
                placeholder="Buscar produtos, usuários, clientes..."
                showHistory={true}
                showShortcuts={true}
                maxVisibleSuggestions={6}
                onSuggestionSelect={(suggestion) => {
                  console.log("Suggestion selected:", suggestion);
                }}
                onSearchSubmit={(query) => {
                  console.log("Search submitted:", query);
                }}
              />
            </div>
            <SearchFiltersPanel
              searchHook={searchHook}
              filterFields={demoFilterFields}
              enablePresets={true}
              showActiveFilters={true}
              showCount={true}
              lookupData={lookupData}
              title="Filtros"
            />
          </div>

          {/* Demo Controls */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setSimulateError(!simulateError)}>
              {simulateError ? "Desativar" : "Simular"} Erro
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSimulateLoading(!simulateLoading)}>
              {simulateLoading ? "Desativar" : "Simular"} Loading
            </Button>
            <Button variant="outline" size="sm" onClick={() => searchHook.clearHistory()}>
              Limpar Histórico
            </Button>
            <Button variant="outline" size="sm" onClick={() => searchHook.tableState.clearAllFilters()}>
              Limpar Filtros
            </Button>
          </div>

          {/* Search State Info */}
          {(searchQuery || isSearching) && (
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Busca: "{searchQuery}"</Badge>
              {isSearching && <Badge variant="secondary">Buscando...</Badge>}
              <Badge variant="outline">{filteredData.length} resultado(s)</Badge>
            </div>
          )}

          {/* Results Table */}
          {filteredData.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fornecedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <HighlightedCell query={debouncedSearchQuery} config={HIGHLIGHT_PRESETS.primary}>
                          {item.name}
                        </HighlightedCell>
                      </TableCell>
                      <TableCell>
                        <HighlightedCell query={debouncedSearchQuery} config={HIGHLIGHT_PRESETS.secondary}>
                          {item.barcodes[0]}
                        </HighlightedCell>
                      </TableCell>
                      <TableCell>
                        <HighlightedCell query={debouncedSearchQuery}>{item.brand.name}</HighlightedCell>
                      </TableCell>
                      <TableCell>
                        <HighlightedCell query={debouncedSearchQuery}>{item.category.name}</HighlightedCell>
                      </TableCell>
                      <TableCell>
                        <HighlightedCell query={debouncedSearchQuery}>{item.supplier.name}</HighlightedCell>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <SearchEmptyStates
              query={debouncedSearchQuery}
              filters={searchHook.tableState.filters}
              error={simulateError ? new Error("Erro simulado na busca") : null}
              isLoading={simulateLoading && isSearching}
              totalItems={mockItems.length}
              onRetry={() => setSimulateError(false)}
              onClearSearch={clearSearch}
              onClearFilters={() => searchHook.tableState.clearAllFilters()}
              onCreateNew={() => alert("Criar novo item")}
              onSuggestionClick={(suggestion) => {
                searchHook.setSearchQuery(suggestion);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Documentation Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="search">Busca</TabsTrigger>
          <TabsTrigger value="filters">Filtros</TabsTrigger>
          <TabsTrigger value="highlighting">Destaque</TabsTrigger>
          <TabsTrigger value="states">Estados Vazios</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBulb className="h-5 w-5" />
                Funcionalidades do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Busca Inteligente</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <IconSearch className="h-4 w-4 text-primary" />
                      Debouncing automático (150ms)
                    </li>
                    <li className="flex items-center gap-2">
                      <IconSearch className="h-4 w-4 text-primary" />
                      Sugestões em tempo real
                    </li>
                    <li className="flex items-center gap-2">
                      <IconSearch className="h-4 w-4 text-primary" />
                      Histórico de buscas
                    </li>
                    <li className="flex items-center gap-2">
                      <IconSearch className="h-4 w-4 text-primary" />
                      Navegação por teclado
                    </li>
                    <li className="flex items-center gap-2">
                      <IconSearch className="h-4 w-4 text-primary" />
                      Busca multi-campo
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Filtros Avançados</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <IconFilter className="h-4 w-4 text-primary" />
                      Filtros dinâmicos por tipo
                    </li>
                    <li className="flex items-center gap-2">
                      <IconFilter className="h-4 w-4 text-primary" />
                      Indicadores visuais ativos
                    </li>
                    <li className="flex items-center gap-2">
                      <IconFilter className="h-4 w-4 text-primary" />
                      Presets salvos
                    </li>
                    <li className="flex items-center gap-2">
                      <IconFilter className="h-4 w-4 text-primary" />
                      Filtros rápidos
                    </li>
                    <li className="flex items-center gap-2">
                      <IconFilter className="h-4 w-4 text-primary" />
                      Estado na URL
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Arquitetura Técnica</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <IconCode className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <h4 className="font-medium">Hooks Personalizados</h4>
                  <p className="text-sm text-muted-foreground">useAdvancedSearch, useUnifiedTableState</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <IconSettings className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <h4 className="font-medium">Estado na URL</h4>
                  <p className="text-sm text-muted-foreground">Sincronização automática com parâmetros da URL</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <IconRefresh className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <h4 className="font-medium">Performance</h4>
                  <p className="text-sm text-muted-foreground">Debouncing, memoização e otimizações</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sistema de Sugestões</CardTitle>
              <CardDescription>Sugestões inteligentes baseadas em múltiplas entidades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(suggestionBuilders).map(([key, builder]) => (
                    <div key={key} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {builder.icon}
                        <h4 className="font-medium">{builder.categoryLabel}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Busca em:{" "}
                        {builder
                          .getSearchableText({ name: "Exemplo", id: "1" } as any)
                          .slice(0, 2)
                          .join(", ")}
                        ...
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Estado Atual da Busca</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-sm overflow-x-auto">
                      {JSON.stringify(
                        {
                          searchQuery,
                          debouncedSearchQuery,
                          isSearching,
                          suggestionsCount: suggestions.length,
                          showSuggestions,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="filters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sistema de Filtros</CardTitle>
              <CardDescription>Filtros tipados e dinâmicos com validação</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Tipos de Filtro Disponíveis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Badge variant="outline">String</Badge>
                    <Badge variant="outline">Number</Badge>
                    <Badge variant="outline">Boolean</Badge>
                    <Badge variant="outline">Date</Badge>
                    <Badge variant="outline">Date Range</Badge>
                    <Badge variant="outline">Select</Badge>
                    <Badge variant="outline">Multi Select</Badge>
                    <Badge variant="outline">Range</Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Filtros Ativos</h4>
                  {searchHook.tableState.hasActiveFilters ? (
                    <div className="flex flex-wrap gap-2">
                      {searchHook.tableState.filterIndicators.map((indicator) => (
                        <Badge key={indicator.id} variant="secondary" className="flex items-center gap-1">
                          {indicator.icon}
                          {indicator.label}: {indicator.value}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Nenhum filtro ativo</p>
                  )}
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Estado dos Filtros</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-sm overflow-x-auto">{JSON.stringify(searchHook.tableState.filters, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="highlighting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Destaque de Texto</CardTitle>
              <CardDescription>Sistema de realce de texto em resultados de busca</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Presets de Destaque</h4>
                  <div className="space-y-3">
                    {Object.entries(HIGHLIGHT_PRESETS).map(([key, preset]) => (
                      <div key={key} className="flex items-center gap-4 p-3 border rounded-lg">
                        <code className="text-sm font-mono">{key}</code>
                        <HighlightedCell query="demo" config={preset} className="flex-1">
                          Este é um texto de demonstração para o preset {key}
                        </HighlightedCell>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Funcionalidades</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Destaque automático de termos de busca</li>
                    <li>• Múltiplos estilos de destaque</li>
                    <li>• Destaque de múltiplas consultas</li>
                    <li>• Destaque com contexto</li>
                    <li>• Componente de célula de tabela</li>
                    <li>• Hook para gerenciamento de estado</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="states" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estados Vazios</CardTitle>
              <CardDescription>Estados diferentes para situações de busca vazia</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Estado Compacto</h4>
                  <div className="border rounded-lg">
                    <CompactEmptyState query="texto de exemplo" type="no-results" onClear={() => alert("Limpar busca")} />
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Estados Disponíveis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h5 className="font-medium mb-2">Sem Resultados</h5>
                      <p className="text-sm text-muted-foreground">Quando a busca não retorna resultados</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h5 className="font-medium mb-2">Erro</h5>
                      <p className="text-sm text-muted-foreground">Quando ocorre erro na busca</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h5 className="font-medium mb-2">Carregando</h5>
                      <p className="text-sm text-muted-foreground">Durante o processo de busca</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h5 className="font-medium mb-2">Sem Dados</h5>
                      <p className="text-sm text-muted-foreground">Quando não há dados para mostrar</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Estado Atual</h4>
                  {currentEmptyState ? (
                    <div className="bg-muted p-4 rounded-lg">
                      <pre className="text-sm overflow-x-auto">{JSON.stringify(currentEmptyState, null, 2)}</pre>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Nenhum estado vazio ativo</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        <p>Sistema de Busca Avançado - Ankaa Project</p>
        <p>Demonstração completa das funcionalidades de busca, filtros e navegação.</p>
      </div>
    </div>
  );
}
