# Supplier Components - File Handling Guide

This guide explains how file handling works across all supplier-related pages and components.

## Component Architecture

### File Display Components

#### 1. AvatarDisplay (Logo Display)
**Purpose:** Display supplier logos and brand images
**Location:** `/home/kennedy/repositories/web/src/components/ui/avatar-display.tsx`

**Usage:**
```tsx
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";

// Basic usage
<SupplierLogoDisplay
  logo={supplier.logo}
  supplierName={supplier.fantasyName}
  size="md"
  shape="rounded"
/>

// Available sizes: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
// Available shapes: "circle" | "square" | "rounded"
```

**Features:**
- Automatic fallback to initials if no logo
- Multiple size options
- Flexible shapes (circle, square, rounded)
- Built-in error handling
- Optimized image loading

**When to Use:**
- Supplier logos in tables
- Profile pictures
- Brand/company logos
- Any avatar-style circular or square images

**When NOT to Use:**
- Document previews (use FileViewer instead)
- Multi-file displays (use FileItem/FilePreviewGrid instead)
- Full-size image viewing (use FilePreview modal instead)

#### 2. FileViewer (Document Display)
**Purpose:** Display and preview documents (contracts, certificates, PDFs, etc.)
**Location:** `/home/kennedy/repositories/web/src/components/file/file-viewer.tsx`

**Usage:**
```tsx
import { FileViewerProvider, useFileViewer } from "@/components/common/file";
import { FileItem } from "@/components/common/file";

// Wrap your component tree with FileViewerProvider
<FileViewerProvider>
  <YourComponent />
</FileViewerProvider>

// Inside your component
function DocumentsList({ documents }) {
  const { actions } = useFileViewer();

  return (
    <div>
      {documents.map((file) => (
        <FileItem
          key={file.id}
          file={file}
          viewMode="list"
          onPreview={() => actions.viewFile(file)}
          onDownload={() => actions.downloadFile(file)}
          showActions
        />
      ))}
    </div>
  );
}
```

**Features:**
- PDF preview support
- Image preview with gallery navigation
- Video playback
- Download functionality
- Security warnings for untrusted files
- Thumbnails and file type icons

**When to Use:**
- Contracts
- Certificates
- Invoices
- Technical documentation
- Any document that needs preview/download

**When NOT to Use:**
- Logo/avatar display (use AvatarDisplay instead)
- Inline embedded content
- Non-file content

## Supplier Page Implementations

### 1. Supplier Details Page
**File:** `/home/kennedy/repositories/web/src/pages/inventory/suppliers/details/[id].tsx`

**File Handling:**
- Wrapped with `FileViewerProvider` for document previews
- Uses `SupplierLogoDisplay` for logo in BasicInfoCard
- Uses `DocumentsCard` with FileViewer integration for documents

**Example:**
```tsx
<FileViewerProvider>
  <BasicInfoCard supplier={supplier} />
  <DocumentsCard
    supplier={supplier}
    contracts={supplier.contracts}
    certificates={supplier.certificates}
    otherDocuments={supplier.otherDocuments}
  />
</FileViewerProvider>
```

### 2. Supplier List/Table
**File:** `/home/kennedy/repositories/web/src/components/inventory/supplier/list/supplier-table-columns.tsx`

**File Handling:**
- Uses `SupplierLogoDisplay` for logo thumbnails in table rows
- Compact size (sm) for table cells
- Automatic fallback to initials

**Example:**
```tsx
{
  key: "fantasyName",
  accessor: (supplier: Supplier) => (
    <div className="flex items-center gap-2">
      <SupplierLogoDisplay
        logo={supplier.logo}
        supplierName={supplier.fantasyName}
        size="sm"
        shape="rounded"
      />
      <span>{supplier.fantasyName}</span>
    </div>
  )
}
```

### 3. Supplier Forms (Create/Edit)
**Files:**
- `/home/kennedy/repositories/web/src/components/inventory/supplier/form/logo-input.tsx`
- `/home/kennedy/repositories/web/src/components/inventory/supplier/form/documents-input.tsx`

**File Handling:**

#### Logo Upload:
```tsx
<LogoInput
  disabled={isSubmitting}
  existingLogoId={supplier?.logoId}
  onFileChange={(file) => {
    // Handle logo change
  }}
/>
```

#### Document Uploads:
```tsx
<DocumentsInput
  disabled={isSubmitting}
  contractFiles={existingContracts}
  certificateFiles={existingCertificates}
  otherDocumentFiles={existingOtherDocs}
  onFilesChange={(category, files) => {
    // Handle document uploads by category
    // category: "contract" | "certificate" | "other"
  }}
/>
```

## Component Breakdown

### Basic Info Card
**File:** `/home/kennedy/repositories/web/src/components/inventory/supplier/detail/basic-info-card.tsx`

**Changes:**
- Replaced manual `<img>` with `SupplierLogoDisplay`
- Removed custom error handling (handled by AvatarDisplay)
- Cleaner, more consistent logo display

### Documents Card
**File:** `/home/kennedy/repositories/web/src/components/inventory/supplier/detail/documents-card.tsx`

**Features:**
- Organized sections for contracts, certificates, and other documents
- FileViewer integration for previews
- Download functionality
- Responsive grid layout
- Empty state messaging

**Document Categories:**
1. **Contracts** - Service agreements, purchase contracts
2. **Certificates** - Quality certificates, compliance documents, ISO certifications
3. **Other Documents** - Invoices, receipts, miscellaneous files

## Type Definitions

### Extended Supplier Types
**File:** `/home/kennedy/repositories/web/src/types/supplier-extended.ts`

```typescript
interface SupplierWithDocuments extends Supplier {
  contracts?: AnkaaFile[];
  contractIds?: string[];
  certificates?: AnkaaFile[];
  certificateIds?: string[];
  otherDocuments?: AnkaaFile[];
  otherDocumentIds?: string[];
}

type SupplierDocumentCategory = "contract" | "certificate" | "other";
```

## Key Distinctions

### Logo vs Documents

| Feature | Logo (AvatarDisplay) | Documents (FileViewer) |
|---------|---------------------|----------------------|
| **Purpose** | Brand identity | Content storage |
| **Component** | AvatarDisplay | FileItem + FileViewer |
| **Display** | Avatar/thumbnail | List/grid with preview |
| **Interaction** | Visual only | Preview, download, delete |
| **File Types** | Images only | PDFs, images, docs, etc. |
| **Quantity** | Single file | Multiple files |
| **Preview** | No modal | Full preview modal |

## Migration Guide

### Before (Old Implementation)
```tsx
// Logo display
{supplier.logo?.id && (
  <img
    src={getFileUrl(supplier.logo)}
    alt="Logo"
    className="h-8 w-8 rounded-md object-cover"
    onError={(e) => {
      (e.target as HTMLImageElement).style.display = "none";
    }}
  />
)}

// Fallback
{!supplier.logo?.id && (
  <div className="h-8 w-8 rounded-md bg-muted">
    <span>{supplier.fantasyName.charAt(0)}</span>
  </div>
)}
```

### After (New Implementation)
```tsx
<SupplierLogoDisplay
  logo={supplier.logo}
  supplierName={supplier.fantasyName}
  size="sm"
  shape="rounded"
/>
```

## Best Practices

### 1. Always Use Appropriate Components
- **Logo display** → Use `SupplierLogoDisplay`
- **Document display** → Use `FileItem` with `FileViewerProvider`
- **Upload forms** → Use `FileUploadField`

### 2. Wrap Document Pages with FileViewerProvider
```tsx
<FileViewerProvider>
  {/* Your page content with FileItems */}
</FileViewerProvider>
```

### 3. Consistent Sizing
- **Table rows**: size="sm"
- **Profile sections**: size="lg" or "xl"
- **Detail pages**: size="2xl"

### 4. Document Organization
Always categorize documents into:
- Contracts
- Certificates
- Other Documents

### 5. Error Handling
- AvatarDisplay handles image errors automatically
- FileViewer provides built-in error states
- Always provide fallback content

## Common Patterns

### Pattern 1: Supplier Table Row
```tsx
<div className="flex items-center gap-2">
  <SupplierLogoDisplay
    logo={supplier.logo}
    supplierName={supplier.fantasyName}
    size="sm"
    shape="rounded"
  />
  <span className="font-medium">{supplier.fantasyName}</span>
</div>
```

### Pattern 2: Document Section with Preview
```tsx
const { actions } = useFileViewer();

<div>
  <h3>Contracts</h3>
  {contracts.map((file) => (
    <FileItem
      key={file.id}
      file={file}
      viewMode="list"
      onPreview={() => actions.viewFile(file)}
      onDownload={() => actions.downloadFile(file)}
    />
  ))}
</div>
```

### Pattern 3: Logo Upload Form
```tsx
<LogoInput
  disabled={isSubmitting}
  existingLogoId={supplier?.logoId}
  onFileChange={(file) => {
    form.setValue("logoFile", file, { shouldDirty: true });
  }}
/>
```

## Future Enhancements

To add document support to the backend:

1. **Update Prisma Schema:**
```prisma
model Supplier {
  // ... existing fields
  contractIds      String[]
  certificateIds   String[]
  otherDocumentIds String[]

  contracts        File[] @relation("SUPPLIER_CONTRACTS")
  certificates     File[] @relation("SUPPLIER_CERTIFICATES")
  otherDocuments   File[] @relation("SUPPLIER_OTHER_DOCS")
}
```

2. **Update Supplier Types:**
Use `SupplierWithDocuments` from `supplier-extended.ts`

3. **Update API Includes:**
```typescript
{
  include: {
    logo: true,
    contracts: true,
    certificates: true,
    otherDocuments: true,
  }
}
```

## Testing Checklist

- [ ] Logo displays correctly in table
- [ ] Logo displays correctly on details page
- [ ] Logo fallback shows correct initials
- [ ] Logo upload works in create/edit forms
- [ ] Documents display in organized sections
- [ ] Document preview modal opens correctly
- [ ] Document download works
- [ ] FileViewerProvider is present on all document pages
- [ ] Empty states show appropriate messages
- [ ] Error states are handled gracefully

## Support

For questions or issues with file handling:
1. Check this documentation
2. Review component source code
3. Check FileViewer and AvatarDisplay component docs
4. Verify FileViewerProvider is properly implemented
