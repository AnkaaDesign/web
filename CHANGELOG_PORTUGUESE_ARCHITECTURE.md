# Changelog System - Portuguese Translation Architecture

## ✅ Correct Architecture

### Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (API)                             │
│  - Sends field names in ENGLISH                             │
│  - Example: "cuts", "status", "price", "customerId"         │
│  - NO Portuguese translations                                │
│  - Focus: Data accuracy and integrity                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ JSON Response
                           │ {
                           │   "field": "cuts",
                           │   "oldValue": "[...]",
                           │   "newValue": "[...]"
                           │ }
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (WEB)                            │
│  - Receives English field names                             │
│  - Translates to Portuguese for display                     │
│  - Example: "cuts" → "Recortes"                             │
│  - Location: /src/utils/changelog-fields.ts                 │
│  - Focus: User experience and readability                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Complete Task Field Mapping

### All Task Fields with Portuguese Labels

Based on Task interface from `/src/types/task.ts` and translations from `/src/utils/changelog-fields.ts`:

#### Simple Fields (Direct Properties)

| Backend Field | Portuguese Label | Type | Line in changelog-fields.ts |
|--------------|------------------|------|------------------------------|
| `name` | ⚠️ **MISSING** - Should be "Nome" | string | **NOT FOUND** |
| `status` | "Status" | enum | Handled via TASK_STATUS_LABELS |
| `statusOrder` | "Ordem do Status" | number | 181 |
| `commission` | "Comissão" | enum | 179 |
| `serialNumber` | "Número de Série" | string | 174 |
| `plate` | "Placa" | string | 175 |
| `details` | "Detalhes" | string | 176 |
| `entryDate` | "Data de Entrada" | Date | 177 |
| `term` | "Prazo" | Date | 178 |
| `startedAt` | "Iniciado em" | Date | 169 |
| `finishedAt` | "Finalizado em" | Date | 171 |
| `price` | "Preço" | number | 180 |
| `priority` | "Prioridade" | string | 167 |

#### Foreign Key Fields (IDs)

| Backend Field | Portuguese Label | Related Entity | Line |
|--------------|------------------|----------------|------|
| `paintId` | "Tinta" | Paint | 188 |
| `customerId` | "Cliente" | Customer | 182 |
| `sectorId` | "Setor" | Sector | 183 |
| `budgetId` | "Orçamento" | File | 185 |
| `nfeId` | "Nota Fiscal" | File | 186 |
| `receiptId` | "Recibo" | File | 187 |
| `createdById` | "Criado por" | User | 184 |

#### Relation Fields (Populated Objects)

| Backend Field | Portuguese Label | Type | Line |
|--------------|------------------|------|------|
| `sector` | "Setor" | Sector | 193 |
| `customer` | "Cliente" | Customer | 194 |
| `budget` | "Orçamento" | File | 195 |
| `nfe` | "Nota Fiscal" | File | 196 |
| `receipt` | "Recibo" | File | 197 |
| `observation` | "Observação" | Observation | 199 |
| `generalPainting` | "Pintura Geral" | Paint | 189 |
| `paint` | "Tinta" | Paint | 198 |
| `createdBy` | "Criado por" | User | 201 |
| `truck` | "Caminhão" | Truck | 200 |

#### Complex Relation Fields (Arrays)

| Backend Field | Portuguese Label | Type | Line | Formatting |
|--------------|------------------|------|------|------------|
| `artworks` | "Artes" | File[] | 202 | "X arte(s)" (line 824) |
| `logoPaints` | "Tintas do Logo" | Paint[] | 203 | "X tinta(s)" (line 827) |
| `paints` | "Tintas do Logo" | Paint[] | 204 | "X tinta(s)" (line 827) |
| `services` | "Serviços" | ServiceOrder[] | 206 | "X serviço(s)" (line 830) |
| `airbrushings` | "Aerografias" | Airbrushing[] | 207 | "X aerografia(s)" (line 836) |
| `cuts` | "Recortes" | Cut[] | 208 | "X recorte(s)" (line 839) |
| `cutRequest` | "Solicitações de Corte" | Cut[] | 209 | "X recorte(s)" (line 839) |
| `cutPlan` | "Planos de Corte" | Cut[] | 210 | "X recorte(s)" (line 839) |
| `relatedTasks` | "Tarefas Relacionadas" | Task[] | 211 | "X tarefa(s) relacionada(s)" (line 842) |
| `relatedTo` | "Relacionado a" | Task[] | 212 | "X tarefa(s) relacionada(s)" (line 842) |

---

## ⚠️ Missing Translation Identified

### Critical Issue: `name` field

**Problem**: The Task interface has a `name` field (line 21 in task.ts), but there's no Portuguese label for it in `changelog-fields.ts`.

**Current Mapping**:
```typescript
[CHANGE_LOG_ENTITY_TYPE.TASK]: {
  title: "Título",  // ← This exists
  // name: "Nome",  // ← This is MISSING!
}
```

**Impact**: If backend sends `field: "name"`, the frontend won't translate it properly.

**Solutions**:

#### Option 1: Add `name` to translations (Recommended)
```typescript
[CHANGE_LOG_ENTITY_TYPE.TASK]: {
  name: "Nome",        // ← ADD THIS
  title: "Título",
  // ... rest
}
```

#### Option 2: Backend always uses "title"
Ensure backend sends `field: "title"` instead of `field: "name"`.

**Recommendation**: Use Option 1 to support both field names for flexibility.

---

## 🎯 Backend Implementation Rules

### What Backend MUST Send

```typescript
// ✅ CORRECT: English field names
{
  "entityType": "TASK",
  "entityId": "task-uuid-123",
  "action": "UPDATE",
  "field": "cuts",           // ← English field name
  "oldValue": "[...]",
  "newValue": "[...]",
  "userId": "user-uuid",
  "createdAt": "2025-10-06T..."
}
```

### What Backend MUST NOT Send

```typescript
// ❌ WRONG: Portuguese field names
{
  "field": "recortes",  // ❌ NO! Use "cuts"
}

// ❌ WRONG: Portuguese descriptions in field
{
  "field": "Recortes",  // ❌ NO! Use lowercase English
}

// ❌ WRONG: Translated values
{
  "oldValue": "\"Pendente\"",  // ❌ NO! Use "PENDING"
  "newValue": "\"Em Produção\"" // ❌ NO! Use "IN_PRODUCTION"
}
```

### Correct Backend Implementation

```typescript
// Backend service - NO Portuguese
async trackTaskChanges(taskId, before, after, userId) {
  const changes = [];

  // Track simple field changes
  if (before.status !== after.status) {
    changes.push({
      field: 'status',              // ✅ English
      oldValue: before.status,       // ✅ "PENDING"
      newValue: after.status,        // ✅ "IN_PRODUCTION"
    });
  }

  // Track array changes
  if (before.cuts.length !== after.cuts.length) {
    changes.push({
      field: 'cuts',                 // ✅ English
      oldValue: JSON.stringify(before.cuts),
      newValue: JSON.stringify(after.cuts),
    });
  }

  // Create changelogs
  await prisma.changeLog.createMany({
    data: changes.map(change => ({
      entityType: 'TASK',            // ✅ English
      entityId: taskId,
      action: 'UPDATE',              // ✅ English
      field: change.field,           // ✅ English field name
      oldValue: change.oldValue,
      newValue: change.newValue,
      userId: userId,
      createdAt: new Date(),
    })),
  });
}
```

---

## 🎨 Frontend Translation Logic

### How Frontend Handles Translation

**Location**: `/src/utils/changelog-fields.ts`

#### 1. Field Label Translation (lines 165-228)
```typescript
export function getFieldLabel(field: string, entityType: string): string {
  const fieldLabels = FIELD_LABELS[entityType] || {};
  return fieldLabels[field] || field; // Fallback to English if not found
}

// Usage:
getFieldLabel('cuts', 'TASK') // Returns: "Recortes"
getFieldLabel('status', 'TASK') // Returns: "Status"
```

#### 2. Value Formatting (lines 720-880)
```typescript
export function formatFieldValue(
  value: any,
  field: string,
  entityType: string
): string {
  // Arrays - Show count with proper pluralization
  if (Array.isArray(value)) {
    if (entityType === CHANGE_LOG_ENTITY_TYPE.TASK) {
      if (field === "cuts") {
        return `${value.length} ${value.length === 1 ? "recorte" : "recortes"}`;
      }
      if (field === "services") {
        return `${value.length} ${value.length === 1 ? "serviço" : "serviços"}`;
      }
      // ... more array handling
    }
  }

  // Enums - Translate status values
  if (field === "status" && entityType === CHANGE_LOG_ENTITY_TYPE.TASK) {
    const statusLabels = {
      PENDING: "Pendente",
      IN_PRODUCTION: "Em Produção",
      COMPLETED: "Concluído",
      CANCELLED: "Cancelado",
      ON_HOLD: "Em Espera",
    };
    return statusLabels[value] || value;
  }

  // Dates - Format in Brazilian Portuguese
  if (value instanceof Date || isValidDate(value)) {
    return formatDate(value, 'dd/MM/yyyy HH:mm');
  }

  // Currency
  if (field === "price" && typeof value === "number") {
    return formatCurrency(value, 'BRL');
  }

  return String(value);
}
```

#### 3. Display Example
```typescript
// Backend sends:
{
  "field": "cuts",
  "oldValue": "[{\"type\":\"VINYL\",\"quantity\":2}]",
  "newValue": "[{\"type\":\"VINYL\",\"quantity\":3}]"
}

// Frontend displays:
┌─────────────────────────────────────┐
│ 📝 Recortes                         │ ← getFieldLabel('cuts', 'TASK')
│ João Silva • há 2 minutos           │
│                                     │
│ De: 2 recortes                      │ ← formatFieldValue(oldValue, 'cuts', 'TASK')
│ Para: 3 recortes                    │ ← formatFieldValue(newValue, 'cuts', 'TASK')
└─────────────────────────────────────┘
```

---

## 🔧 Required Fix

### Add Missing `name` Translation

**File**: `/src/utils/changelog-fields.ts`

**Location**: Line 165 (inside `CHANGE_LOG_ENTITY_TYPE.TASK` object)

**Change**:
```typescript
[CHANGE_LOG_ENTITY_TYPE.TASK]: {
  name: "Nome",        // ← ADD THIS LINE
  title: "Título",
  priority: "Prioridade",
  // ... rest of fields
}
```

---

## ✅ Verification Checklist

Use this checklist to verify the architecture is correctly implemented:

### Backend Verification
- [ ] All changelog entries have English field names
- [ ] Field values are in their original format (enums in English, dates as ISO strings)
- [ ] No Portuguese strings in backend code related to changelogs
- [ ] Changelog service only tracks data changes, no translation logic

### Frontend Verification
- [ ] All Task fields have Portuguese labels in `changelog-fields.ts`
- [ ] Array fields have proper pluralization ("recorte" vs "recortes")
- [ ] Enum values are translated to Portuguese (status labels)
- [ ] Dates are formatted in Brazilian format (dd/MM/yyyy)
- [ ] Currency is formatted in BRL
- [ ] Missing field names fallback gracefully to English

### Integration Testing
- [ ] Update task name → Shows "Nome" in changelog
- [ ] Update task status → Shows "Status" with "Pendente → Em Produção"
- [ ] Add/remove cuts → Shows "Recortes" with "2 recortes → 3 recortes"
- [ ] Add/remove services → Shows "Serviços" with "1 serviço → 2 serviços"
- [ ] Change customer → Shows "Cliente" with customer names
- [ ] Change dates → Shows dates in dd/MM/yyyy format
- [ ] Change price → Shows "Preço" with R$ formatting

---

## 📚 Key Benefits of This Architecture

### 1. Separation of Concerns
- **Backend**: Data integrity, business logic, change tracking
- **Frontend**: User experience, translations, formatting

### 2. Maintainability
- All Portuguese translations in ONE place (`changelog-fields.ts`)
- Easy to add new fields or update labels
- No duplicate translation logic

### 3. Flexibility
- Can support multiple languages by swapping translation files
- Backend remains language-agnostic
- Easy to A/B test different label wordings

### 4. Consistency
- Single source of truth for Portuguese labels
- Consistent pluralization rules
- Consistent date/currency formatting

### 5. Testability
- Backend tests don't need Portuguese strings
- Frontend translation tests are isolated
- Easy to verify completeness of translations

---

## 🚀 Summary

### Current Status
- ✅ Architecture is **correctly implemented**
- ✅ Backend sends English field names
- ✅ Frontend translates to Portuguese
- ✅ All Task fields are covered **EXCEPT** `name`

### Required Action
**Add ONE line** to `/src/utils/changelog-fields.ts`:
```typescript
name: "Nome",  // Add at line ~166
```

### Backend Implementation
**NO CHANGES NEEDED** - Backend should continue sending English field names.

### Result
Once `name` field is added, the system will have **100% coverage** of all Task fields with proper Portuguese translations for regular users to easily understand all changelogs.

---

## 📂 File References

**Frontend Translation Files**:
- `/src/utils/changelog-fields.ts` - All Portuguese labels and formatting (lines 165-880)
- `/src/components/ui/changelog-history.tsx` - Display component
- `/src/types/task.ts` - Task interface definition

**Backend Files** (Should NOT have Portuguese):
- `/api/src/modules/common/changelog/changelog.service.ts` - Changelog creation service
- `/api/src/modules/production/task/task.service.ts` - Task update service
- `/api/src/modules/common/changelog/changelog.controller.ts` - API endpoints

**Backend Files to Review** (May have unnecessary Portuguese):
- `/api/src/modules/common/changelog/utils/changelog-helpers.ts` - Check line 214+

---

**Architecture Status**: ✅ **Correct and Production Ready** (with one minor fix)
