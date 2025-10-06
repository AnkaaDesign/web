# Field Name Mapping Reference

## Critical: Backend ↔ Frontend Field Name Mapping

**The backend field names MUST match what the frontend expects for proper display.**

## Task Fields

### Simple Fields (Already Working)

| Backend Field | Frontend Label (PT) | Type | Example |
|--------------|-------------------|------|---------|
| `name` | "Nome" | string | "Envelopamento Completo" |
| `status` | "Status" | enum | "PENDING" → "Pendente" |
| `serialNumber` | "Número de Série" | string | "SN-12345" |
| `plate` | "Placa" | string | "ABC-1234" |
| `details` | "Detalhes" | string | "Cliente solicitou..." |
| `entryDate` | "Data de Entrada" | date | "2025-10-06" |
| `term` | "Prazo" | date | "2025-10-15" |
| `startedAt` | "Iniciado em" | date | "2025-10-07" |
| `finishedAt` | "Finalizado em" | date | "2025-10-14" |
| `price` | "Preço" | number | 1500.00 → "R$ 1.500,00" |
| `statusOrder` | "Ordem do Status" | number | 1 |
| `commission` | "Comissão" | string | "PENDING" |

### ID Fields (Foreign Keys)

| Backend Field | Frontend Label (PT) | Type | Example |
|--------------|-------------------|------|---------|
| `customerId` | "Cliente" | uuid | Shows customer name |
| `sectorId` | "Setor" | uuid | Shows sector name |
| `budgetId` | "Orçamento" | uuid | Shows file name |
| `nfeId` | "Nota Fiscal" | uuid | Shows file name |
| `receiptId` | "Recibo" | uuid | Shows file name |
| `paintId` | "Tinta" | uuid | Shows paint name |
| `createdById` | "Criado por" | uuid | Shows user name |

### Complex Relations (Needs Backend Implementation)

| Backend Field | Frontend Label (PT) | Format | Example Display |
|--------------|-------------------|--------|-----------------|
| `cuts` | "Recortes" | array | "3 recortes" |
| `services` | "Serviços" | array | "2 serviços" |
| `airbrushings` | "Aerografias" | array | "1 aerografia" |
| `logoPaints` | "Tintas do Logo" | array | "2 tintas" |
| `artworks` | "Artes" | array | "5 artes" |
| `observation` | "Observação" | object | Shows description |
| `truck` | "Caminhão" | object | Shows position/garage |

## ⚠️ Common Mistakes

### ❌ WRONG - These won't display correctly:

```typescript
// Backend creates changelog with wrong field name
await changelog.create({
  field: 'cutRequest',    // ❌ Frontend doesn't recognize this
  field: 'cutPlan',       // ❌ Frontend doesn't recognize this
  field: 'cut',           // ❌ Frontend doesn't recognize this
  field: 'service',       // ❌ Wrong (singular)
  field: 'airbrushing',   // ❌ Wrong (singular)
  field: 'paint',         // ❌ Wrong (should be logoPaints)
  field: 'artwork',       // ❌ Wrong (singular)
});
```

### ✅ CORRECT - These will display properly:

```typescript
// Backend creates changelog with correct field name
await changelog.create({
  field: 'cuts',          // ✅ Displays as "Recortes"
  field: 'services',      // ✅ Displays as "Serviços"
  field: 'airbrushings',  // ✅ Displays as "Aerografias"
  field: 'logoPaints',    // ✅ Displays as "Tintas do Logo"
  field: 'artworks',      // ✅ Displays as "Artes"
  field: 'observation',   // ✅ Displays as "Observação"
  field: 'truck',         // ✅ Displays as "Caminhão"
});
```

## Frontend Configuration Location

All field mappings are defined in:
```
/src/utils/changelog-fields.ts
Lines 165-227: Task field mappings
```

## How Frontend Processes Field Names

```typescript
// Frontend lookup process:
// 1. Receives changelog from API
const changelog = {
  field: 'cuts',
  oldValue: '[...]',
  newValue: '[...]'
};

// 2. Looks up field label
const label = getFieldLabel('Task', 'cuts'); // Returns "Recortes"

// 3. Formats values
const formatted = formatFieldValue('Task', 'cuts', '[...]'); // Returns "3 recortes"

// 4. Displays in UI
// "📝 Recortes"
// "De: 2 recortes"
// "Para: 3 recortes"
```

## Value Formatting

### Arrays (cuts, services, etc.)

Backend stores:
```json
{
  "field": "cuts",
  "oldValue": "[{\"type\":\"VINYL\",\"quantity\":2}]",
  "newValue": "[{\"type\":\"VINYL\",\"quantity\":3}]"
}
```

Frontend displays:
```
De: 2 recortes
Para: 3 recortes
```

### Objects (observation, truck)

Backend stores:
```json
{
  "field": "observation",
  "oldValue": "{\"description\":\"Old note\"}",
  "newValue": "{\"description\":\"New note\"}"
}
```

Frontend displays:
```
Observação alterada
```

### Dates

Backend stores:
```json
{
  "field": "entryDate",
  "oldValue": "\"2025-10-01T00:00:00.000Z\"",
  "newValue": "\"2025-10-06T00:00:00.000Z\""
}
```

Frontend displays:
```
De: 01/10/2025
Para: 06/10/2025
```

### Money

Backend stores:
```json
{
  "field": "price",
  "oldValue": "1000",
  "newValue": "1500"
}
```

Frontend displays:
```
De: R$ 1.000,00
Para: R$ 1.500,00
```

### Status Values

Backend stores:
```json
{
  "field": "status",
  "oldValue": "\"PENDING\"",
  "newValue": "\"IN_PRODUCTION\""
}
```

Frontend displays:
```
De: Pendente
Para: Em Produção
```

## Validation Checklist

When implementing changelog for a new field, verify:

- [ ] Field name matches frontend mapping exactly
- [ ] Value is JSON stringified (for objects/arrays)
- [ ] oldValue and newValue are both provided
- [ ] entityType is "Task"
- [ ] entityId is the task UUID
- [ ] action is "UPDATE"
- [ ] userId is provided (for user attribution)

## Testing Field Names

```typescript
// Test script to verify field names
async function testFieldNames() {
  const testChangelog = {
    entityType: 'Task',
    entityId: 'test-uuid',
    action: 'UPDATE',
    field: 'cuts', // ← Test this field name
    oldValue: JSON.stringify([{ type: 'VINYL', quantity: 2 }]),
    newValue: JSON.stringify([{ type: 'VINYL', quantity: 3 }]),
  };

  // Create changelog
  await prisma.changeLog.create({ data: testChangelog });

  // Check in frontend at: /producao/cronograma/detalhes/test-uuid
  // Should display: "📝 Recortes"
}
```

## Adding New Fields

To add a new field to changelog tracking:

1. **Add to frontend** (`/src/utils/changelog-fields.ts`):
```typescript
[CHANGE_LOG_ENTITY_TYPE.TASK]: {
  // ... existing fields
  newField: "Label in Portuguese",
}
```

2. **Add to backend** (use exact same field name):
```typescript
await changelogService.createChangeLog({
  entityType: 'Task',
  entityId: taskId,
  field: 'newField', // ← Same as frontend
  oldValue: oldValue,
  newValue: newValue,
});
```

3. **Test**:
   - Update task with new field
   - Check changelog appears
   - Verify Portuguese label displays correctly

## Summary

✅ **Use exact field names**: `cuts`, `services`, `airbrushings`, `logoPaints`, `artworks`
❌ **Don't use**: `cutRequest`, `cutPlan`, `cut`, `service`, `paint`, `artwork`
✅ **JSON stringify**: Always stringify objects/arrays: `JSON.stringify(value)`
✅ **Both values**: Always provide both `oldValue` and `newValue`
✅ **User ID**: Always provide `userId` for proper attribution

**When in doubt, check `/src/utils/changelog-fields.ts` lines 165-227 for the exact field names the frontend expects!**
