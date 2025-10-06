# Changelog API - Frontend Team Summary

## Quick Overview

The Changelog API is **fully operational** and ready to use. The frontend already has complete display components configured - you just need to integrate them into your pages.

---

## What's Available

### Backend API Endpoints

All endpoints are live at `/api/changelogs`:

| Endpoint | Purpose | Example |
|----------|---------|---------|
| `GET /api/changelogs` | Get all changelogs (paginated) | `?entityType=TASK&entityId=abc-123&page=1&limit=20` |
| `GET /api/changelogs/entity/:type/:id` | Get history for specific entity | `/entity/TASK/abc-123?limit=50` |
| `GET /api/changelogs/task/:id/history` | Get task-specific history | `/task/abc-123/history` |
| `GET /api/changelogs/order/:id/history` | Get order-specific history | `/order/abc-123/history` |
| `GET /api/changelogs/date-range` | Get changes in date range | `?startDate=2025-10-01&endDate=2025-10-06` |

---

## Frontend Components Ready to Use

### 1. Changelog History Component

**Location**: `/src/components/ui/changelog-history.tsx`

**Usage**:
```tsx
import { ChangelogHistory } from "@/components/ui/changelog-history";

// In your page component
<ChangelogHistory
  entityType={CHANGE_LOG_ENTITY_TYPE.TASK}
  entityId={taskId}
  entityName={task.name}
  maxHeight="600px"
  limit={50}
/>
```

**What it does**:
- Fetches changelogs from the API
- Displays changes in a timeline format
- Shows field names in Portuguese
- Formats values (dates, currency, enums)
- Includes user information and timestamps
- Auto-refreshes on updates

---

### 2. Display Features

The component automatically handles:

- **Field name translation** (English → Portuguese)
  - `status` → "Status"
  - `price` → "Preço"
  - `serialNumber` → "Número de Série"
  - `cuts` → "Recortes"
  - And 100+ more...

- **Value formatting**
  - Dates: "06/10/2025 15:30"
  - Currency: "R$ 1.500,00"
  - Status: "Pendente" → "Em Produção"
  - Arrays: "3 recortes", "2 serviços"

- **User attribution**
  - "João Silva • há 2 horas"
  - "Sistema • ontem às 14:30"

- **Visual indicators**
  - Icons for different action types
  - Color coding (create=green, update=blue, delete=red)
  - Expandable details for complex changes

---

## Expected Response Format

When you call the API, you'll receive:

```json
{
  "success": true,
  "message": "Registros de mudanças carregados com sucesso",
  "data": [
    {
      "id": "changelog-uuid-1",
      "entityType": "TASK",
      "entityId": "task-uuid-123",
      "action": "UPDATE",
      "field": "status",
      "oldValue": "PENDING",
      "newValue": "IN_PRODUCTION",
      "reason": "Campo status atualizado",
      "userId": "user-uuid-456",
      "triggeredBy": "USER_ACTION",
      "triggeredById": "task-uuid-123",
      "createdAt": "2025-10-06T15:30:00.000Z",
      "user": {
        "id": "user-uuid-456",
        "name": "João Silva",
        "email": "joao@example.com"
      }
    }
  ],
  "meta": {
    "totalRecords": 45,
    "totalPages": 3,
    "currentPage": 1,
    "pageSize": 20,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

## Field Mappings

### Task Entity Fields

The following task fields are automatically tracked and translated:

| Backend Field | Frontend Display | Format Example |
|--------------|------------------|----------------|
| `name` | Nome | "Tarefa 123" |
| `status` | Status | "Pendente" → "Em Produção" |
| `serialNumber` | Número de Série | "ABC-123" |
| `plate` | Placa | "ABC-1234" |
| `details` | Detalhes | Text |
| `entryDate` | Data de Entrada | "06/10/2025" |
| `term` | Prazo | "10/10/2025" |
| `price` | Preço | "R$ 1.500,00" |
| `budgetId` | Orçamento | UUID → "Orçamento #123" |
| `nfeId` | Nota Fiscal | UUID → "NFe #456" |
| `receiptId` | Recibo | UUID → "Recibo #789" |
| `customerId` | Cliente | UUID → "João da Silva" |
| `sectorId` | Setor | UUID → "Pintura" |
| `paintId` | Tinta | UUID → "Vermelho Ferrari" |
| `services` | Serviços | "2 serviços adicionados" |
| `artworks` | Artes | "3 artes adicionadas" |
| `paintIds` | Tintas de Logo | "2 tintas adicionadas" |
| `cuts` | Recortes | "3 recortes" (when implemented) |
| `airbrushings` | Aerografias | "1 aerografia" |

---

## What Changed

### Backend Updates (Complete)

- ✅ Database schema with indexes
- ✅ Changelog service with field tracking
- ✅ API endpoints with pagination
- ✅ User attribution
- ✅ Transaction support
- ✅ Field-level tracking for tasks
- ✅ Complex field tracking (services, artworks, paintIds)

### Frontend Updates (Complete)

- ✅ Changelog display component
- ✅ Field name translations (Portuguese)
- ✅ Value formatting utilities
- ✅ API hooks (`useChangeLogs`)
- ✅ Timeline UI with icons
- ✅ Loading and error states

### Known Limitations

- ⚠️ **Cuts field** - Backend does NOT track cuts changes yet
  - Frontend is ready to display cuts changes
  - Backend needs to implement cuts tracking (see `BACKEND_CUTS_CHANGELOG_FIX.md`)
  - Same issue affects: airbrushings, some service changes

---

## How to Test

### 1. Visual Test in Task Detail Page

The changelog component is already integrated in the task detail page:

**Location**: `/src/pages/production/schedule/task-detail.tsx` (or similar)

**What to check**:
1. Navigate to a task detail page
2. Scroll to "Histórico de Alterações" section
3. Verify:
   - Changes are displayed in chronological order (newest first)
   - Field names are in Portuguese
   - Values are properly formatted
   - User names and timestamps appear correctly
   - Status labels are translated (Pendente, Em Produção, etc.)

---

### 2. Test Changelog Creation

**Step 1**: Edit a task
- Change status from "Pendente" to "Em Produção"
- Change price from R$ 1.000,00 to R$ 1.500,00
- Save

**Step 2**: Check the changelog
- Refresh the task detail page
- Scroll to "Histórico de Alterações"
- Verify 2 new entries appear:
  - "Status" change
  - "Preço" change

**Expected Display**:
```
┌─────────────────────────────────────┐
│ 📝 Status                           │
│ João Silva • há 2 minutos           │
│                                     │
│ De: Pendente                        │
│ Para: Em Produção                   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 💰 Preço                            │
│ João Silva • há 2 minutos           │
│                                     │
│ De: R$ 1.000,00                     │
│ Para: R$ 1.500,00                   │
└─────────────────────────────────────┘
```

---

### 3. Test API Directly

**Using browser console or API client**:

```javascript
// Fetch task history
fetch('/api/changelogs/entity/TASK/your-task-id')
  .then(res => res.json())
  .then(data => console.log(data));

// Expected: Array of changelog entries
```

---

### 4. Test Different Actions

| Action | How to Test | Expected Result |
|--------|-------------|-----------------|
| **Create** | Create new task | 1 CREATE changelog entry |
| **Update** | Edit task fields | 1 UPDATE entry per changed field |
| **Add Service** | Add service to task | 1 UPDATE entry for "services" field |
| **Remove Service** | Remove service from task | 1 UPDATE entry for "services" field |
| **Add Artwork** | Upload artwork | 1 UPDATE entry for "artworks" field |
| **Add Paint** | Add logo paint | 1 UPDATE entry for "paintIds" field |

---

## Integration Guide

### Adding Changelog to a New Page

**Example**: Adding changelog to Order detail page

```tsx
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { CHANGE_LOG_ENTITY_TYPE } from "@/constants";

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const { data: order } = useOrder(orderId);

  return (
    <div>
      {/* Your existing order details */}

      {/* Add changelog section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Histórico de Alterações</h2>
        <ChangelogHistory
          entityType={CHANGE_LOG_ENTITY_TYPE.ORDER}
          entityId={orderId}
          entityName={`Pedido #${order?.id.slice(0, 8)}`}
          maxHeight="600px"
          limit={50}
        />
      </div>
    </div>
  );
}
```

---

### Custom Hooks Available

**`useChangeLogs`**:
```tsx
import { useChangeLogs } from "@/hooks/useChangeLogs";

const { data, isLoading, error, refetch } = useChangeLogs({
  entityType: "TASK",
  entityId: taskId,
  page: 1,
  limit: 20,
});
```

**Returns**:
```typescript
{
  data: {
    data: ChangeLog[],
    meta: {
      totalRecords: number,
      totalPages: number,
      currentPage: number,
      pageSize: number,
      hasNextPage: boolean,
      hasPreviousPage: boolean
    }
  },
  isLoading: boolean,
  error: Error | null,
  refetch: () => void
}
```

---

## Troubleshooting

### Issue: Changelogs not appearing

**Possible causes**:
1. **Backend not creating changelogs**
   - Check if field is in `fieldsToTrack` array (backend)
   - Verify value actually changed
   - Check transaction didn't rollback

2. **Frontend not fetching**
   - Check network tab for API calls
   - Verify `entityType` and `entityId` are correct
   - Check for CORS or authentication issues

3. **Component not rendering**
   - Check if `ChangelogHistory` component is imported
   - Verify props are passed correctly
   - Check for console errors

---

### Issue: Field names not in Portuguese

**Solution**: Field translation is already configured in `/src/utils/changelog-fields.ts`

If a field is missing:
1. Add to `TASK_CHANGELOG_FIELDS` (or appropriate entity)
2. Add to `getFieldLabel()` function
3. Rebuild and test

---

### Issue: Values not formatted correctly

**Solution**: Custom formatters are in `/src/utils/changelog-fields.ts`

Add custom formatter in `formatFieldValue()`:
```typescript
export function formatFieldValue(
  field: string,
  value: any,
  entityType: CHANGE_LOG_ENTITY_TYPE
): string {
  // Add your custom formatter
  if (field === "yourField") {
    return formatYourValue(value);
  }

  // ... existing formatters
}
```

---

### Issue: Performance slow with many changelogs

**Solutions**:
1. **Use pagination**: Default is 20 items per page
2. **Increase `limit` prop**: Up to 100 items
3. **Add date filters**: Backend supports date range queries
4. **Lazy loading**: Component has built-in infinite scroll support

---

## Configuration Files

### Field Mappings
**Location**: `/src/utils/changelog-fields.ts`
**Contains**:
- Field name translations (EN → PT)
- Value formatters
- Entity-specific field lists

### Constants
**Location**: `/src/constants/changelogs.ts`
**Contains**:
- `CHANGE_LOG_ENTITY_TYPE` enum
- `CHANGE_LOG_ACTION` enum
- Status labels

### API Client
**Location**: `/src/api/changelogs.ts`
**Contains**:
- API request functions
- Type definitions
- Error handling

---

## Next Steps

### For Task Detail Page

**Already implemented** ✅
- Changelog section displays automatically
- All simple fields tracked (status, price, name, etc.)
- Services tracking works
- Artworks tracking works
- Paint IDs tracking works

**Not yet implemented** ⚠️
- Cuts field tracking (backend needs update)
- Airbrushing field tracking (backend needs update)

### For Other Pages

**Ready to implement**:
1. Copy the `ChangelogHistory` component usage from task detail page
2. Update `entityType` and `entityId` props
3. Customize field mappings if needed (in `/src/utils/changelog-fields.ts`)

**Example pages to add**:
- Order detail page (`CHANGE_LOG_ENTITY_TYPE.ORDER`)
- Customer detail page (`CHANGE_LOG_ENTITY_TYPE.CUSTOMER`)
- User profile page (`CHANGE_LOG_ENTITY_TYPE.USER`)
- Supplier detail page (`CHANGE_LOG_ENTITY_TYPE.SUPPLIER`)

---

## Support

**Backend Documentation**:
- Full API docs: `/api/CHANGELOG_API_DOCUMENTATION.md`
- Implementation guide: `/api/src/modules/common/changelog/CHANGELOG_IMPLEMENTATION_GUIDE.md`
- Cuts tracking fix: `/web/BACKEND_CUTS_CHANGELOG_FIX.md`

**Frontend Files**:
- Component: `/src/components/ui/changelog-history.tsx`
- Utils: `/src/utils/changelog-fields.ts`
- Hooks: `/src/hooks/useChangeLogs.ts`
- Constants: `/src/constants/changelogs.ts`

**Questions?**
- Check existing task detail page implementation
- Review field mapping configuration
- Test with simple field changes first
- Use browser dev tools to debug API calls

---

**Frontend Status**: ✅ **READY TO USE**
**Backend Status**: ✅ **OPERATIONAL** (with minor gaps in complex fields)

**Last Updated**: October 6, 2025
