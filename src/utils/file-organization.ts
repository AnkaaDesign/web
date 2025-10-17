// File Organization Configuration for WebDAV
// This module defines the directory structure for different file types and entities

export interface FileOrganizationConfig {
  entity: string;
  fileType: string;
  getPath: (context: FileContext) => string;
}

export interface FileContext {
  // Entity identifiers
  entityType: 'task' | 'customer' | 'supplier' | 'warning' | 'cut' | 'airbrushing' | 'order' | 'withdrawal';
  entityId?: string;

  // Related entities
  customerName?: string;
  customerFantasyName?: string;
  supplierName?: string;
  supplierFantasyName?: string;
  withdrawerName?: string;
  userName?: string;
  userId?: string;

  // File metadata
  fileType?: 'logo' | 'budget' | 'receipt' | 'invoice' | 'invoiceReimbursement' | 'reimbursement' | 'artwork' | 'cut' | 'attachment' | 'document';
  fileExtension?: string;
  isImage?: boolean;
  isPdf?: boolean;

  // Cut specific
  cutType?: 'vinyl' | 'stencil';
}

// Directory structure mapping based on WebDAV organization
export const FILE_ORGANIZATION: FileOrganizationConfig[] = [
  // ==================
  // CUSTOMER FILES
  // ==================
  {
    entity: 'customer',
    fileType: 'logo',
    getPath: (ctx) => `Logos/Clientes/${ctx.customerFantasyName || ctx.customerName || 'Sem-Nome'}/`
  },

  // ==================
  // SUPPLIER FILES
  // ==================
  {
    entity: 'supplier',
    fileType: 'logo',
    getPath: (ctx) => `Logos/Fornecedores/${ctx.supplierFantasyName || ctx.supplierName || 'Sem-Nome'}/`
  },

  // ==================
  // WARNING FILES
  // ==================
  {
    entity: 'warning',
    fileType: 'attachment',
    getPath: (ctx) => `Advertencias/${ctx.userName || ctx.userId || 'Usuario-Desconhecido'}/`
  },

  // ==================
  // CUT FILES
  // ==================
  {
    entity: 'cut',
    fileType: 'cut',
    getPath: (ctx) => {
      const customerDir = ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente';
      if (ctx.cutType === 'vinyl') {
        return `Plotter/${customerDir}/Adesivos/`;
      } else if (ctx.cutType === 'stencil') {
        return `Plotter/${customerDir}/Espovo/`;
      }
      return `Plotter/${customerDir}/Outros/`;
    }
  },

  // ==================
  // TASK FILES
  // ==================
  {
    entity: 'task',
    fileType: 'budget',
    getPath: (ctx) => `Orcamentos/Tarefas/${ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente'}/`
  },
  {
    entity: 'task',
    fileType: 'receipt',
    getPath: (ctx) => `Comprovantes/Tarefas/${ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente'}/`
  },
  {
    entity: 'task',
    fileType: 'reimbursement',
    getPath: (ctx) => `Reembolsos/Tarefas/${ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente'}/`
  },
  {
    entity: 'task',
    fileType: 'invoice',
    getPath: (ctx) => `Notas Fiscais/Tarefas/${ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente'}/`
  },
  {
    entity: 'task',
    fileType: 'invoiceReimbursement',
    getPath: (ctx) => `Notas Fiscais Reembolso/Tarefas/${ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente'}/`
  },
  {
    entity: 'task',
    fileType: 'artwork',
    getPath: (ctx) => {
      const customerDir = ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente';
      if (ctx.isImage) {
        return `Projetos/${customerDir}/Imagens/`;
      } else if (ctx.isPdf) {
        return `Projetos/${customerDir}/Pdfs/`;
      }
      return `Projetos/${customerDir}/Outros/`;
    }
  },

  // ==================
  // AIRBRUSHING FILES
  // ==================
  {
    entity: 'airbrushing',
    fileType: 'budget',
    getPath: (ctx) => `Orcamentos/Aerografias/${ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente'}/`
  },
  {
    entity: 'airbrushing',
    fileType: 'receipt',
    getPath: (ctx) => `Comprovantes/Aerografias/${ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente'}/`
  },
  {
    entity: 'airbrushing',
    fileType: 'reimbursement',
    getPath: (ctx) => `Reembolsos/Aerografias/${ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente'}/`
  },
  {
    entity: 'airbrushing',
    fileType: 'invoice',
    getPath: (ctx) => `Notas Fiscais/Aerografias/${ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente'}/`
  },
  {
    entity: 'airbrushing',
    fileType: 'invoiceReimbursement',
    getPath: (ctx) => `Notas Fiscais Reembolso/Aerografias/${ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente'}/`
  },
  {
    entity: 'airbrushing',
    fileType: 'artwork',
    getPath: (ctx) => {
      const customerDir = ctx.customerFantasyName || ctx.customerName || 'Sem-Cliente';
      if (ctx.isImage) {
        return `Aerografias/${customerDir}/Imagens/`;
      } else if (ctx.isPdf) {
        return `Aerografias/${customerDir}/Pdfs/`;
      }
      return `Aerografias/${customerDir}/Outros/`;
    }
  },

  // ==================
  // ORDER FILES
  // ==================
  {
    entity: 'order',
    fileType: 'budget',
    getPath: (ctx) => `Orcamentos/Pedidos/${ctx.supplierFantasyName || ctx.supplierName || 'Sem-Fornecedor'}/`
  },
  {
    entity: 'order',
    fileType: 'receipt',
    getPath: (ctx) => `Comprovantes/Pedidos/${ctx.supplierFantasyName || ctx.supplierName || 'Sem-Fornecedor'}/`
  },
  {
    entity: 'order',
    fileType: 'reimbursement',
    getPath: (ctx) => `Reembolsos/Pedidos/${ctx.supplierFantasyName || ctx.supplierName || 'Sem-Fornecedor'}/`
  },
  {
    entity: 'order',
    fileType: 'invoice',
    getPath: (ctx) => `Notas Fiscais/Pedidos/${ctx.supplierFantasyName || ctx.supplierName || 'Sem-Fornecedor'}/`
  },
  {
    entity: 'order',
    fileType: 'invoiceReimbursement',
    getPath: (ctx) => `Notas Fiscais Reembolso/Pedidos/${ctx.supplierFantasyName || ctx.supplierName || 'Sem-Fornecedor'}/`
  },

  // ==================
  // EXTERNAL WITHDRAWAL FILES
  // ==================
  {
    entity: 'withdrawal',
    fileType: 'budget',
    getPath: (ctx) => `Orcamentos/RetiradasExternas/${ctx.withdrawerName || 'Sem-Retirador'}/`
  },
  {
    entity: 'withdrawal',
    fileType: 'receipt',
    getPath: (ctx) => `Comprovantes/RetiradasExternas/${ctx.withdrawerName || 'Sem-Retirador'}/`
  },
  {
    entity: 'withdrawal',
    fileType: 'reimbursement',
    getPath: (ctx) => `Reembolsos/RetiradasExternas/${ctx.withdrawerName || 'Sem-Retirador'}/`
  },
  {
    entity: 'withdrawal',
    fileType: 'invoice',
    getPath: (ctx) => `Notas Fiscais/RetiradasExternas/${ctx.withdrawerName || 'Sem-Retirador'}/`
  },
  {
    entity: 'withdrawal',
    fileType: 'invoiceReimbursement',
    getPath: (ctx) => `Notas Fiscais Reembolso/RetiradasExternas/${ctx.withdrawerName || 'Sem-Retirador'}/`
  }
];

// Helper function to get the correct path for a file
export function getFileOrganizationPath(context: FileContext): string {
  const config = FILE_ORGANIZATION.find(
    (cfg) => cfg.entity === context.entityType && cfg.fileType === context.fileType
  );

  if (!config) {
    console.warn(`No file organization config found for entity: ${context.entityType}, fileType: ${context.fileType}`);
    return 'Uploads/'; // Default fallback directory
  }

  return config.getPath(context);
}

// Helper function to get file metadata from mimetype or extension
export function getFileMetadata(file: File | { mimetype?: string; filename?: string }): {
  isImage: boolean;
  isPdf: boolean;
  fileExtension: string;
} {
  let mimetype: string = '';
  let filename: string = '';

  if (file instanceof File) {
    mimetype = file.type;
    filename = file.name;
  } else {
    mimetype = file.mimetype || '';
    filename = file.filename || '';
  }

  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const isImage = mimetype.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension);
  const isPdf = mimetype === 'application/pdf' || extension === 'pdf';

  return {
    isImage,
    isPdf,
    fileExtension: extension
  };
}

// Special directories that should not be used for file storage
export const SPECIAL_DIRECTORIES = [
  'Thumbnails',     // Auto-generated thumbnails
  'Lixeira',        // Trash
  '.recycle',       // Recycle bin
  'Auxiliares',     // Auxiliary files (direct WebDAV access only)
  'Rascunhos',      // Drafts (for another project)
  'Fotos',          // Photos (for another project)
  'Artes',          // Arts (for another project)
  'Backup',         // Backup files
  'Observacoes',    // Notes/Observations
];

// Helper function to sanitize directory names
export function sanitizeDirectoryName(name: string): string {
  // Remove or replace invalid characters
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-') // Replace invalid chars with hyphen
    .replace(/\.+/g, '.')                    // Replace multiple dots with single dot
    .replace(/^\.+|\.+$/g, '')               // Remove leading/trailing dots
    .replace(/\s+/g, '-')                    // Replace spaces with hyphens
    .replace(/-+/g, '-')                     // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '')                 // Remove leading/trailing hyphens
    .trim() || 'Sem-Nome';                   // Fallback if empty
}

// Helper to build complete file path
export function buildFilePath(context: FileContext, filename: string): string {
  const directory = getFileOrganizationPath(context);
  const sanitizedFilename = sanitizeDirectoryName(filename);
  return `${directory}${sanitizedFilename}`;
}

// Export configuration for backend to use
export const FILE_ORGANIZATION_CONFIG = {
  paths: FILE_ORGANIZATION,
  specialDirectories: SPECIAL_DIRECTORIES,
  helpers: {
    getPath: getFileOrganizationPath,
    getMetadata: getFileMetadata,
    sanitizeName: sanitizeDirectoryName,
    buildPath: buildFilePath,
  }
};