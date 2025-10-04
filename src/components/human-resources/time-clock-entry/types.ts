export interface FieldModification {
  entryId: string;
  field: string;
  originalValue: any;
  currentValue: any;
  isModified: boolean;
}

export interface StateManagerState {
  modifications: Map<string, FieldModification>;
  changedEntries: Set<string>;
  isInitialized: boolean;
}

export interface StateManagerActions {
  updateField: (entryId: string, field: string, value: any, originalValue: any) => void;
  restoreAll: () => void;
  restoreEntry: (entryId: string) => void;
  restoreField: (entryId: string, field: string) => void;
  getModification: (entryId: string, field: string) => FieldModification | undefined;
  isFieldModified: (entryId: string, field: string) => boolean;
  isEntryModified: (entryId: string) => boolean;
  getAllModifications: () => FieldModification[];
  getChangedEntryCount: () => number;
}

export interface StateManager {
  state: StateManagerState;
  actions: StateManagerActions;
}

export interface LocationData {
  FonteDadosId: number;
  DataHora: string;
  Latitude: number;
  Longitude: number;
  Precisao: number;
  Endereco: string;
  PossuiFoto?: boolean;
}

export interface PendingJustification {
  entryId: string;
  field: string;
  originalTime: string;
  newTime: string | null;
  fieldLabel: string;
}
