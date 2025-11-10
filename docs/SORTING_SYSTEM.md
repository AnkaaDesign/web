# Sistema de Ordenação Avançado - Ankaa

## Visão Geral

O sistema de ordenação avançado do Ankaa fornece funcionalidades abrangentes para ordenação de tabelas com suporte a múltiplas colunas, funções customizadas, persistência de estado em URL e feedback visual imediato.

## Características Principais

### 🎯 Funcionalidades Implementadas

- ✅ **Ordenação Multi-Coluna**: Suporte a ordenação simultânea por múltiplas colunas com prioridades
- ✅ **Persistência em URL**: Estado completo salvo e restaurado via parâmetros URL
- ✅ **Funções Customizadas**: Ordenação especializada para tipos brasileiros (CPF, CNPJ, nomes, moeda)
- ✅ **Tratamento de Valores Nulos**: Configuração flexível para posicionamento de valores null/undefined
- ✅ **Feedback Visual**: Indicadores claros de direção e ordem de ordenação
- ✅ **Feedback Imediato**: Sistema de notificações para operações de ordenação
- ✅ **Integração Backend**: Suporte para ordenação server-side e client-side
- ✅ **Atalhos de Teclado**: Ctrl+Click para multi-ordenação

## Arquitetura do Sistema

### Componentes Principais

```
/src/utils/table-sort-utils.ts         # Utilitários core de ordenação
/src/hooks/use-enhanced-table-sort.ts  # Hook principal para ordenação
/src/components/ui/table-sort-icon.tsx # Ícones visuais de ordenação
/src/components/ui/table-header-cell.tsx # Células de cabeçalho ordenáveis
/src/components/ui/table-sort-feedback.tsx # Sistema de feedback
/src/components/examples/advanced-sortable-table.tsx # Exemplo completo
```

## Uso Básico

### 1. Hook Principal

```typescript
import { useEnhancedTableSort } from "@/hooks/use-enhanced-table-sort";
import { SortableColumnConfig } from "@/utils/table-sort-utils";

const columns: SortableColumnConfig[] = [
  {
    key: "name",
    header: "Nome",
    sortable: true,
    customSortFunction: customSortFunctions.brazilianName,
    nullHandling: "last",
  },
  {
    key: "salary",
    header: "Salário",
    sortable: true,
    customSortFunction: customSortFunctions.currency,
    align: "right",
  },
];

const sortHook = useEnhancedTableSort({
  columns,
  sortConfigs: currentSortConfigs,
  onSortChange: (configs) => {
    // Atualizar estado/URL
  },
  enableMultiSort: true,
  enableCustomSorts: true,
  maxSortColumns: 3,
});
```

### 2. Componente de Cabeçalho

```typescript
import { SortableTableHeader } from "@/components/ui/sortable-table-header";

<SortableTableHeader
  columns={columns}
  visibleColumns={visibleColumns}
  onSort={sortHook.toggleSort}
  getSortDirection={sortHook.getSortDirection}
  getSortOrder={sortHook.getSortOrder}
  showMultipleSortOrder={sortHook.hasMultipleSort}
/>
```

### 3. Feedback Visual

```typescript
import { useSortFeedback, TableSortFeedback } from "@/components/ui/table-sort-feedback";

const feedbackHook = useSortFeedback({
  enableFeedback: true,
  feedbackDuration: 2000,
  feedbackVariant: "toast",
});

<TableSortFeedback
  config={feedbackHook.feedbackConfig}
  sortConfigs={sortHook.sortConfigs}
  columnLabels={sortHook.getColumnLabels()}
  onDismiss={feedbackHook.hideFeedback}
/>
```

## Configuração de Colunas

### Propriedades Disponíveis

```typescript
interface SortableColumnConfig {
  key: string; // Identificador único da coluna
  header: string; // Texto do cabeçalho
  sortable?: boolean; // Se a coluna é ordenável
  customSortFunction?: CustomSortFunction; // Função customizada
  nullHandling?: "first" | "last" | "default"; // Tratamento de nulos
  dataType?: "string" | "number" | "date" | "boolean" | "custom";
  accessor?: string | ((item: any) => any); // Como acessar o valor
  align?: "left" | "center" | "right";
  className?: string;
  tooltip?: string;
}
```

### Exemplo Detalhado

```typescript
const columns: SortableColumnConfig[] = [
  {
    key: "name",
    header: "Nome Completo",
    sortable: true,
    customSortFunction: customSortFunctions.brazilianName,
    accessor: "name",
    align: "left",
    tooltip: "Ordenação considera partículas brasileiras (da, de, dos)",
  },
  {
    key: "cpf",
    header: "CPF",
    sortable: true,
    customSortFunction: customSortFunctions.cpf,
    accessor: "cpf",
    dataType: "string",
  },
  {
    key: "salary",
    header: "Salário",
    sortable: true,
    customSortFunction: customSortFunctions.currency,
    accessor: "salary",
    align: "right",
    nullHandling: "last",
  },
  {
    key: "hireDate",
    header: "Data de Contratação",
    sortable: true,
    customSortFunction: customSortFunctions.date,
    accessor: "hireDate",
    align: "center",
    nullHandling: "last",
  },
];
```

## Funções de Ordenação Customizadas

### Funções Pré-definidas

```typescript
import { customSortFunctions } from "@/utils/table-sort-utils";

// Nomes brasileiros (considera partículas)
customSortFunctions.brazilianName;

// Documentos brasileiros
customSortFunctions.cpf;
customSortFunctions.cnpj;

// Valores monetários
customSortFunctions.currency;

// Datas com null handling
customSortFunctions.date;

// Prioridades (HIGH, MEDIUM, LOW)
customSortFunctions.priority;

// Quantidades numéricas
customSortFunctions.quantity;

// Status com ordem customizada
customSortFunctions.status(statusOrder);
```

### Função Customizada Própria

```typescript
const customSortFunction: CustomSortFunction = (a, b, direction) => {
  const aValue = extractValue(a);
  const bValue = extractValue(b);

  // Lógica de comparação personalizada
  const result = compareValues(aValue, bValue);

  return direction === "asc" ? result : -result;
};

const columnConfig: SortableColumnConfig = {
  key: "myField",
  header: "Meu Campo",
  sortable: true,
  customSortFunction,
};
```

## Integração com Estado de URL

### Configuração

```typescript
const tableState = useUnifiedTableState({
  defaultSort: [{ column: "name", direction: "asc" }],
  namespace: "employees",
  enableMultiSort: true,
});

// O estado é automaticamente sincronizado com a URL
// URL exemplo: /page?employees_sort=[{"column":"name","direction":"asc"}]
```

### Serialização Customizada

```typescript
// Conversão para formato de API
const apiParams = {
  orderBy: TableSortUtils.convertSortConfigsToOrderBy(sortConfigs),
  // [{"name": "asc"}, {"salary": "desc"}]
};

// Serialização para URL
const urlParam = TableSortUtils.serializeSortForUrl(sortConfigs);
// Para single sort: "name:asc"
// Para multi sort: JSON string
```

## Sistema de Feedback

### Tipos de Feedback

1. **Minimal**: Indicador simples com ícone e texto
2. **Detailed**: Informações expandidas sobre ordenação ativa
3. **Toast**: Notificação flutuante não-intrusiva

### Estados de Feedback

- **Loading**: Durante operações assíncronas
- **Success**: Confirmação de sucesso
- **Error**: Notificação de erro
- **Progress**: Para operações de longa duração

### Exemplo de Uso

```typescript
const feedbackHook = useSortFeedback({
  enableFeedback: true,
  feedbackDuration: 3000,
  feedbackVariant: "toast",
});

// Trigger feedback programaticamente
feedbackHook.showLoading("Aplicando ordenação...");
feedbackHook.showSuccess("Ordenação aplicada com sucesso!");
feedbackHook.showError("Erro ao aplicar ordenação");
```

## Tratamento de Valores Nulos

### Opções de Configuração

```typescript
interface NullHandlingOptions {
  first: "null/undefined aparecem primeiro";
  last: "null/undefined aparecem por último";
  default: "comportamento padrão do JavaScript";
}
```

### Exemplo Prático

```typescript
const columnConfig: SortableColumnConfig = {
  key: "optionalField",
  header: "Campo Opcional",
  sortable: true,
  nullHandling: "last", // Valores nulos sempre no final
};
```

## Performance e Otimização

### Ordenação Client-Side

```typescript
const sortedData = sortHook.sortData(rawData);
```

### Ordenação Server-Side

```typescript
const sortHook = useEnhancedTableSort({
  enableServerSort: true,
  onServerSort: (sortConfigs) => {
    // Enviar para API
    refetch({ orderBy: convertToApiFormat(sortConfigs) });
  },
});
```

### Ordenação Otimista

```typescript
const sortHook = useEnhancedTableSort({
  enableOptimisticSort: true,
  onOptimisticSort: (sortedData) => {
    // Atualização imediata da UI
    setDisplayData(sortedData);
  },
});
```

## Exemplos de Implementação

### Tabela Básica com Ordenação

```typescript
function BasicSortableTable() {
  const [data, setData] = useState(initialData);

  const tableState = useUnifiedTableState({
    defaultSort: [{ column: "name", direction: "asc" }],
  });

  const sortHook = useEnhancedTableSort({
    columns: columnConfigs,
    sortConfigs: tableState.sortConfigs,
    onSortChange: tableState.setSortConfigs,
  });

  const sortedData = useMemo(() => {
    return sortHook.sortData(data);
  }, [data, sortHook]);

  return (
    <Table>
      <SortableTableHeader
        columns={columnConfigs}
        visibleColumns={visibleColumns}
        onSort={sortHook.toggleSort}
        getSortDirection={sortHook.getSortDirection}
        getSortOrder={sortHook.getSortOrder}
      />
      <TableBody>
        {sortedData.map(item => (
          <TableRow key={item.id}>
            {/* Render cells */}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### Tabela Avançada com Multi-Sort

Ver exemplo completo em `/src/components/examples/advanced-sortable-table.tsx`

## Testes e Debugging

### Página de Teste

Acesse `/test-table-state` para ver o sistema completo em ação com:

- Dados mock variados
- Todas as funcionalidades de ordenação
- Feedback visual em tempo real
- Controles interativos para teste

### Logs de Debug

```typescript
// Enable debug logs
const sortHook = useEnhancedTableSort({
  onSortChange: (sortConfigs) => {
    console.log("Sort changed:", sortConfigs);
    console.log("URL param:", TableSortUtils.serializeSortForUrl(sortConfigs));
  },
});
```

## Padrões de Uso Recomendados

### 1. Sempre Use Configuração Tipada

```typescript
interface EmployeeFilters {
  department?: string;
  isActive?: boolean;
  salaryRange?: { min: number; max: number };
}

const tableState = useUnifiedTableState<EmployeeFilters>({
  defaultFilters: { isActive: true },
});
```

### 2. Defina Colunas Centralizadamente

```typescript
// constants/table-columns.ts
export const EMPLOYEE_COLUMNS: SortableColumnConfig[] = [
  // ... definições das colunas
];
```

### 3. Use Feedback Adequado ao Contexto

- **Operações rápidas**: variant="minimal"
- **Operações complexas**: variant="detailed"
- **Operações em background**: variant="toast"

### 4. Configure Limits Apropriados

```typescript
const sortHook = useEnhancedTableSort({
  maxSortColumns: 3, // Limite prático para UX
  enableMultiSort: true,
});
```

## Troubleshooting

### Problemas Comuns

1. **Ordenação não funciona**
   - Verificar se `sortable: true` na configuração da coluna
   - Confirmar se a função `onSort` está conectada corretamente

2. **Estado não persiste na URL**
   - Verificar se `enableUrlSync: true`
   - Confirmar namespace único para evitar conflitos

3. **Performance lenta**
   - Considerar ordenação server-side para grandes datasets
   - Usar `enableOptimisticSort` para feedback imediato

4. **Valores nulos não ordenam corretamente**
   - Configurar `nullHandling` apropriadamente
   - Verificar se dados estão normalizados

### Debug Avançado

```typescript
// Verificar estado interno
console.log("Sort configs:", sortHook.sortConfigs);
console.log("Active columns:", sortHook.getActiveSortColumns());
console.log("Column config map:", sortHook.columnConfigMap);

// Testar serialização
const urlParam = sortHook.serializeSortForUrl();
const parsed = TableSortUtils.parseSortFromUrl(urlParam);
console.log("Roundtrip test:", parsed);
```

## Conclusão

O sistema de ordenação avançado do Ankaa fornece uma base sólida e flexível para implementar funcionalidades de ordenação complexas mantendo a simplicidade de uso. Com suporte completo para persistência de estado, funções customizadas e feedback visual, o sistema atende tanto necessidades básicas quanto avançadas de ordenação em aplicações empresariais.

Para dúvidas ou sugestões de melhorias, consulte a documentação específica de cada componente ou entre em contato com a equipe de desenvolvimento.
