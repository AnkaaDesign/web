# File Upload Workflow Documentation

## Overview
This document describes the new unified file upload workflow that ensures files are properly organized in the remote storage directory structure based on their entity type and relationships.

## Architecture Changes

### Old Workflow (Removed)
1. Files uploaded to temporary location first
2. File IDs returned to frontend
3. Form submission with file IDs
4. Backend moves files to final location

### New Workflow (Implemented)
1. Files selected and stored in form state
2. Form submission creates FormData with files and context
3. Backend receives files with full entity context
4. Files saved directly to correct remote storage directories

## Directory Structure

### Storage Root: `/srv/remote-storage/`

```
/srv/remote-storage/
├── Advertencias/           # Warnings - organized by employee name
│   └── {UserName}/
├── Comprovantes/          # Receipts
│   ├── Aerografia/{CustomerFantasyName}/
│   ├── Pedidos/{CustomerFantasyName}/
│   ├── Retiradas/{CustomerFantasyName}/
│   └── Tarefas/{CustomerFantasyName}/
├── Logos/                 # Company logos
│   ├── Clientes/{CustomerFantasyName}/
│   └── Fornecedores/{SupplierFantasyName}/
├── NFs/                   # Invoices (Notas Fiscais)
│   ├── Aerografia/{CustomerFantasyName}/
│   ├── Entradas/{SupplierFantasyName}/
│   ├── Pedidos/{CustomerFantasyName}/
│   ├── Retiradas/{CustomerFantasyName}/
│   ├── Saidas/{CustomerFantasyName}/
│   └── Tarefas/{CustomerFantasyName}/
├── Orcamentos/            # Budgets/Quotes
│   ├── Aerografia/{CustomerFantasyName}/
│   ├── Pedidos/{CustomerFantasyName}/
│   └── Tarefas/{CustomerFantasyName}/
├── Plotter/               # Cut files
│   └── {CustomerFantasyName}/
│       ├── Adesivos/      # Vinyl cuts
│       ├── Estencis/      # Stencil cuts
│       └── Outros/        # Other cuts
├── Projetos/              # Project artworks
│   └── {CustomerFantasyName}/
│       ├── Images/        # Image files
│       ├── Pdfs/          # PDF files
│       └── Outros/        # Other files
├── Auxiliares/            # Auxiliary files
│   └── Aerografia/{CustomerFantasyName}/
└── Thumbnails/            # Auto-generated thumbnails
```

## Implementation Details

### Frontend Components

#### 1. File Organization Service (`src/utils/file-organization.ts`)
- Defines directory structure mappings
- Provides path resolution functions
- Handles file type detection
- Sanitizes directory names

#### 2. FormData Helper (`src/utils/form-data-helper.ts`)
- Creates FormData with proper context metadata
- Entity-specific helper functions
- Includes file metadata for backend processing
- Ensures proper field naming

#### 3. Updated Form Components
All form components now:
- Store files in form state (not uploaded immediately)
- Use FormData helpers to include context
- Submit files with entity data in single request

### Backend Requirements

#### 1. Context Processing
Backend should extract context from FormData:
```json
{
  "_context": {
    "entityType": "customer",
    "customerName": "ACME Corp",
    "supplierName": null,
    "userName": null
  }
}
```

#### 2. File Metadata
Each file field has accompanying metadata:
```json
{
  "logo_metadata": {
    "fieldName": "logo",
    "originalName": "company-logo.png",
    "fileType": "logo",
    "isImage": true,
    "isPdf": false,
    "extension": "png"
  }
}
```

#### 3. Path Resolution
Backend should:
1. Read entity context from `_context` field
2. Determine file type from metadata
3. Build path using configuration
4. Create directories if needed
5. Save file to resolved path

## Entity-Specific Configurations

### Customer
- **Logo**: `Logos/Clientes/{CustomerFantasyName}/`

### Supplier
- **Logo**: `Logos/Fornecedores/{SupplierFantasyName}/`

### Warning (Advertência)
- **Attachments**: `Advertencias/{UserName}/`

### Task (Tarefa)
- **Budgets**: `Orcamentos/Tarefas/{CustomerFantasyName}/`
- **Receipts**: `Comprovantes/Tarefas/{CustomerFantasyName}/`
- **Invoices**: `NFs/Tarefas/{CustomerFantasyName}/`
- **Artworks (Images)**: `Projetos/{CustomerFantasyName}/Images/`
- **Artworks (PDFs)**: `Projetos/{CustomerFantasyName}/Pdfs/`

### Cut (Corte)
- **Vinyl**: `Plotter/{CustomerFantasyName}/Adesivos/`
- **Stencil**: `Plotter/{CustomerFantasyName}/Estencis/`
- **Other**: `Plotter/{CustomerFantasyName}/Outros/`

### Airbrushing (Aerografia)
- **Budgets**: `Orcamentos/Aerografia/{CustomerFantasyName}/`
- **Receipts**: `Comprovantes/Aerografia/{CustomerFantasyName}/`
- **Invoices**: `NFs/Aerografia/{CustomerFantasyName}/`
- **Artworks**: `Auxiliares/Aerografia/{CustomerFantasyName}/`

### Order (Pedido)
- **Budgets**: `Orcamentos/Pedidos/{CustomerFantasyName}/`
- **Receipts**: `Comprovantes/Pedidos/{CustomerFantasyName}/`
- **Invoices**: `NFs/Pedidos/{CustomerFantasyName}/`

### External Withdrawal (Retirada Externa)
- **Receipts**: `Comprovantes/Retiradas/{CustomerFantasyName}/`
- **Invoices**: `NFs/Retiradas/{CustomerFantasyName}/`

### Stock Entry (Entrada de Estoque)
- **Invoices**: `NFs/Entradas/{SupplierFantasyName}/`
- **Documents**: `NFs/Entradas/{SupplierFantasyName}/`

### Stock Exit (Saída de Estoque)
- **Invoices**: `NFs/Saidas/{CustomerFantasyName}/`
- **Documents**: `NFs/Saidas/{CustomerFantasyName}/`

## API Changes

### API Clients
All API clients now accept both regular data objects and FormData:

```typescript
async createEntity(data: EntityData | FormData) {
  const headers = data instanceof FormData
    ? { 'Content-Type': 'multipart/form-data' }
    : {};
  return apiClient.post(path, data, { headers });
}
```

### Form Submission
Forms check for files and create FormData when needed:

```typescript
if (hasFiles) {
  const formData = createEntityFormData(
    data,
    files,
    context
  );
  await submitFormData(formData);
} else {
  await submitJSON(data);
}
```

## Benefits

1. **Single Transaction**: Files and data submitted together
2. **Proper Organization**: Files go directly to correct directories
3. **Context Awareness**: Backend has full entity context when processing files
4. **No Orphaned Files**: No temporary files left from failed submissions
5. **Simplified Code**: Removed complex file ID tracking
6. **Better Performance**: Single request instead of multiple
7. **Improved UX**: No waiting for file uploads before form submission

## Migration Notes

### Removed Features
- `uploadSingleFile()` - No longer needed
- `uploadMultipleFiles()` - No longer needed
- File upload endpoints - Should be removed from backend
- Temporary upload directory - No longer used

### Backend Changes Required
1. Update controllers to handle multipart/form-data
2. Extract and process `_context` field
3. Implement path resolution logic
4. Create directories as needed
5. Save files directly to final location

## Testing

To verify the implementation:

1. Create a customer with logo → Check `Logos/Clientes/{Name}/`
2. Create a supplier with logo → Check `Logos/Fornecedores/{Name}/`
3. Create a warning with attachments → Check `Advertencias/{UserName}/`
4. Create a task with various files → Check respective directories
5. Create cuts with different types → Check `Plotter/{Customer}/Adesivos/` or `/Estencis/`

## Troubleshooting

### Common Issues

1. **Files not in correct directory**
   - Check if context is being sent properly
   - Verify backend is reading `_context` field
   - Ensure path variables are being replaced

2. **FormData not being sent**
   - Verify Content-Type header is set correctly
   - Check if files are instanceof File
   - Ensure FormData is created properly

3. **Missing context data**
   - Verify customer/supplier/user data is fetched
   - Check if context helper is being used
   - Ensure all required fields are included

## Future Improvements

1. Add file deduplication logic
2. Implement file versioning
3. Add automatic cleanup for old files
4. Create thumbnail generation service
5. Add file compression for large images
6. Implement file access permissions