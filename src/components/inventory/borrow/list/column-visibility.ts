interface BorrowColumn {
  id: string;
  label: string;
  group?: string;
  defaultVisible?: boolean;
  description?: string;
  required?: boolean;
}

interface BorrowColumnGroup {
  id: string;
  label: string;
  columns: BorrowColumn[];
}

export const BORROW_COLUMNS: BorrowColumn[] = [
  // Basic Information
  { id: "id", label: "ID", group: "basic", defaultVisible: false, description: "Identificador único do empréstimo" },
  { id: "item.name", label: "Item", group: "basic", defaultVisible: true, description: "Nome do item emprestado", required: true },
  { id: "user.name", label: "Usuário", group: "basic", defaultVisible: true, description: "Nome do usuário que pegou emprestado", required: true },
  { id: "quantity", label: "Quantidade", group: "basic", defaultVisible: true, description: "Quantidade emprestada", required: true },

  // Status
  { id: "status", label: "Status", group: "status", defaultVisible: true, description: "Status do empréstimo", required: true },
  { id: "returnedAt", label: "Devolvido em", group: "status", defaultVisible: true, description: "Data de devolução" },

  // Item Details
  { id: "item.uniCode", label: "Código do Item", group: "itemDetails", defaultVisible: false, description: "Código único do item" },
  { id: "item.brand.name", label: "Marca", group: "itemDetails", defaultVisible: false, description: "Marca do item" },
  { id: "item.category.name", label: "Categoria", group: "itemDetails", defaultVisible: false, description: "Categoria do item" },
  { id: "item.quantity", label: "Estoque Atual", group: "itemDetails", defaultVisible: false, description: "Quantidade atual em estoque do item" },

  // User Details
  { id: "user.email", label: "Email do Usuário", group: "userDetails", defaultVisible: false, description: "Email do usuário" },
  { id: "user.cpf", label: "CPF do Usuário", group: "userDetails", defaultVisible: false, description: "CPF do usuário" },
  { id: "user.position.name", label: "Cargo", group: "userDetails", defaultVisible: false, description: "Cargo do usuário" },
  { id: "user.sector.name", label: "Setor", group: "userDetails", defaultVisible: false, description: "Setor do usuário" },

  // Metadata
  { id: "createdAt", label: "Criado em", group: "metadata", defaultVisible: true, description: "Data de criação do empréstimo" },
  { id: "updatedAt", label: "Atualizado em", group: "metadata", defaultVisible: false, description: "Data da última atualização" },
];

export const BORROW_COLUMN_GROUPS: BorrowColumnGroup[] = [
  { id: "basic", label: "Informações Básicas", columns: BORROW_COLUMNS.filter((col) => col.group === "basic") },
  { id: "status", label: "Status", columns: BORROW_COLUMNS.filter((col) => col.group === "status") },
  { id: "itemDetails", label: "Detalhes do Item", columns: BORROW_COLUMNS.filter((col) => col.group === "itemDetails") },
  { id: "userDetails", label: "Detalhes do Usuário", columns: BORROW_COLUMNS.filter((col) => col.group === "userDetails") },
  { id: "metadata", label: "Metadados", columns: BORROW_COLUMNS.filter((col) => col.group === "metadata") },
];

// Storage key for persisting column visibility preferences
export const BORROW_COLUMNS_STORAGE_KEY = "borrow-list-visible-columns";

// Maximum number of visible columns allowed
export const MAX_VISIBLE_BORROW_COLUMNS = 10;

// Get default visible columns
export const getDefaultVisibleBorrowColumns = (): Set<string> => {
  return new Set(BORROW_COLUMNS.filter((col) => col.defaultVisible).map((col) => col.id));
};

// Get required columns that cannot be hidden
export const getRequiredBorrowColumns = (): Set<string> => {
  return new Set(BORROW_COLUMNS.filter((col) => col.required).map((col) => col.id));
};

// Validate if a column configuration is valid
export const isValidBorrowColumnConfiguration = (columns: Set<string>): boolean => {
  const requiredColumns = getRequiredBorrowColumns();
  // Check if all required columns are included
  for (const required of requiredColumns) {
    if (!columns.has(required)) {
      return false;
    }
  }
  // Check if column count is within limits
  return columns.size <= MAX_VISIBLE_BORROW_COLUMNS;
};

// Load column visibility from localStorage
export const loadBorrowColumnVisibility = (): Set<string> => {
  try {
    const stored = localStorage.getItem(BORROW_COLUMNS_STORAGE_KEY);
    if (stored) {
      const columns = new Set<string>(JSON.parse(stored));
      // Validate the stored configuration
      if (isValidBorrowColumnConfiguration(columns)) {
        return columns;
      }
    }
  } catch (e) {
    console.error("Failed to load borrow column visibility:", e);
  }
  // Return defaults if loading fails or configuration is invalid
  return getDefaultVisibleBorrowColumns();
};

// Save column visibility to localStorage
export const saveBorrowColumnVisibility = (columns: Set<string>): void => {
  try {
    if (isValidBorrowColumnConfiguration(columns)) {
      localStorage.setItem(BORROW_COLUMNS_STORAGE_KEY, JSON.stringify(Array.from(columns)));
    }
  } catch (e) {
    console.error("Failed to save borrow column visibility:", e);
  }
};
