// FormData Helper Utilities
// Helps create FormData with proper context for file organization

import { FileContext, sanitizeDirectoryName } from './file-organization';

export interface FormDataOptions {
  // Entity context
  entityType: FileContext['entityType'];
  entityId?: string;

  // Related entities (for file organization)
  customer?: {
    id?: string;
    name?: string;
    fantasyName?: string;
  };
  supplier?: {
    id?: string;
    name?: string;
    fantasyName?: string;
  };
  user?: {
    id?: string;
    name?: string;
  };

  // Cut specific
  cutType?: 'vinyl' | 'stencil';
}

/**
 * Creates FormData with proper context for backend file organization
 */
export function createFormDataWithContext(
  data: Record<string, any>,
  files: Record<string, File | File[] | null | undefined>,
  options: FormDataOptions
): FormData {
  const formData = new FormData();

  // Add context metadata
  formData.append('_context', JSON.stringify({
    entityType: options.entityType,
    entityId: options.entityId,
    customerName: sanitizeDirectoryName(options.customer?.fantasyName || options.customer?.name || ''),
    supplierName: sanitizeDirectoryName(options.supplier?.fantasyName || options.supplier?.name || ''),
    userName: sanitizeDirectoryName(options.user?.name || ''),
    cutType: options.cutType,
  }));

  // Add regular form data
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (value instanceof Date) {
        formData.append(key, value.toISOString());
      } else if (Array.isArray(value)) {
        // For arrays, append as JSON string
        formData.append(key, JSON.stringify(value));
      } else if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  });

  // Add files with proper field names and metadata
  Object.entries(files).forEach(([fieldName, fileOrFiles]) => {
    if (!fileOrFiles) return;

    const filesArray = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];

    filesArray.forEach((file) => {
      if (file && file instanceof File) {
        // Add file directly - backend will handle file type detection
        formData.append(fieldName, file);
      }
    });
  });

  return formData;
}

/**
 * Helper for Customer forms
 */
export function createCustomerFormData(
  data: Record<string, any>,
  logoFile?: File | null,
  customer?: FormDataOptions['customer']
): FormData {
  return createFormDataWithContext(
    data,
    { logo: logoFile },
    {
      entityType: 'customer',
      customer,
    }
  );
}

/**
 * Helper for Supplier forms
 */
export function createSupplierFormData(
  data: Record<string, any>,
  logoFile?: File | null,
  supplier?: FormDataOptions['supplier']
): FormData {
  return createFormDataWithContext(
    data,
    { logo: logoFile },
    {
      entityType: 'supplier',
      supplier,
    }
  );
}

/**
 * Helper for Warning forms
 */
export function createWarningFormData(
  data: Record<string, any>,
  attachmentFiles?: File[] | null,
  user?: FormDataOptions['user']
): FormData {
  return createFormDataWithContext(
    data,
    { attachments: attachmentFiles },
    {
      entityType: 'warning',
      user,
    }
  );
}

/**
 * Helper for Task forms
 */
export function createTaskFormData(
  data: Record<string, any>,
  files: {
    budgets?: File[];
    receipts?: File[];
    invoices?: File[];
    artworks?: File[];
  },
  customer?: FormDataOptions['customer']
): FormData {
  return createFormDataWithContext(
    data,
    files,
    {
      entityType: 'task',
      customer,
    }
  );
}

/**
 * Helper for Cut forms
 */
export function createCutFormData(
  data: Record<string, any>,
  cutFile?: File | null,
  customer?: FormDataOptions['customer'],
  cutType?: 'vinyl' | 'stencil'
): FormData {
  return createFormDataWithContext(
    data,
    { file: cutFile },
    {
      entityType: 'cut',
      customer,
      cutType,
    }
  );
}

/**
 * Helper for Airbrushing forms
 */
export function createAirbrushingFormData(
  data: Record<string, any>,
  files: {
    receipts?: File[];
    invoices?: File[];
    artworks?: File[];
  },
  customer?: FormDataOptions['customer']
): FormData {
  return createFormDataWithContext(
    data,
    files,
    {
      entityType: 'airbrushing',
      customer,
    }
  );
}

/**
 * Helper for Order forms
 */
export function createOrderFormData(
  data: Record<string, any>,
  files: {
    budgets?: File[];
    receipts?: File[];
    invoices?: File[];
  },
  customer?: FormDataOptions['customer']
): FormData {
  return createFormDataWithContext(
    data,
    files,
    {
      entityType: 'order',
      customer,
    }
  );
}

/**
 * Helper for External Withdrawal forms
 */
export function createWithdrawalFormData(
  data: Record<string, any>,
  files: {
    receipts?: File[];
    invoices?: File[];
  },
  customer?: FormDataOptions['customer']
): FormData {
  return createFormDataWithContext(
    data,
    files,
    {
      entityType: 'withdrawal',
      customer,
    }
  );
}

/**
 * Helper for Stock Entry forms
 */
export function createEntryFormData(
  data: Record<string, any>,
  files: {
    invoices?: File[];
    documents?: File[];
  },
  supplier?: FormDataOptions['supplier']
): FormData {
  return createFormDataWithContext(
    data,
    files,
    {
      entityType: 'entry',
      supplier,
    }
  );
}

/**
 * Helper for Stock Exit forms
 */
export function createExitFormData(
  data: Record<string, any>,
  files: {
    invoices?: File[];
    documents?: File[];
  },
  customer?: FormDataOptions['customer']
): FormData {
  return createFormDataWithContext(
    data,
    files,
    {
      entityType: 'exit',
      customer,
    }
  );
}