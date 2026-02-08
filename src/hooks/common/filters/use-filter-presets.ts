import { useState, useEffect, useCallback } from "react";
import { FilterDefinition, LocalStorageFilterPresets, FilterPresetStorage } from "@/utils/table-filter-utils";

export interface UseFilterPresetsOptions {
  /**
   * Storage implementation (default: LocalStorageFilterPresets)
   */
  storage?: FilterPresetStorage;

  /**
   * Current user ID for filtering presets
   */
  userId?: string;

  /**
   * Auto-load presets on mount
   */
  autoLoad?: boolean;
}

export interface UseFilterPresetsReturn {
  /**
   * Available presets
   */
  presets: FilterDefinition[];

  /**
   * Currently selected preset ID
   */
  selectedPresetId: string | null;

  /**
   * Loading state
   */
  isLoading: boolean;

  /**
   * Error state
   */
  error: Error | null;

  /**
   * Load all presets
   */
  loadPresets: () => Promise<void>;

  /**
   * Load a specific preset
   */
  loadPreset: (id: string) => Promise<FilterDefinition | null>;

  /**
   * Save a preset
   */
  savePreset: (preset: FilterDefinition) => Promise<void>;

  /**
   * Delete a preset
   */
  deletePreset: (id: string) => Promise<void>;

  /**
   * Update a preset
   */
  updatePreset: (preset: FilterDefinition) => Promise<void>;

  /**
   * Select a preset
   */
  selectPreset: (id: string | null) => void;

  /**
   * Get the currently selected preset
   */
  getSelectedPreset: () => FilterDefinition | null;
}

export function useFilterPresets({
  storage = new LocalStorageFilterPresets(),
  userId,
  autoLoad = true,
}: UseFilterPresetsOptions = {}): UseFilterPresetsReturn {
  const [presets, setPresets] = useState<FilterDefinition[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadPresets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedPresets = await storage.loadPresets(userId);
      setPresets(loadedPresets);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load presets"));
    } finally {
      setIsLoading(false);
    }
  }, [storage, userId]);

  const loadPreset = useCallback(
    async (id: string): Promise<FilterDefinition | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const preset = await storage.loadPreset(id);
        return preset;
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load preset"));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [storage]
  );

  const savePreset = useCallback(
    async (preset: FilterDefinition) => {
      setIsLoading(true);
      setError(null);
      try {
        await storage.savePreset(preset);
        await loadPresets();
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to save preset"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [storage, loadPresets]
  );

  const deletePreset = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await storage.deletePreset(id);
        if (selectedPresetId === id) {
          setSelectedPresetId(null);
        }
        await loadPresets();
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to delete preset"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [storage, loadPresets, selectedPresetId]
  );

  const updatePreset = useCallback(
    async (preset: FilterDefinition) => {
      setIsLoading(true);
      setError(null);
      try {
        await storage.updatePreset(preset);
        await loadPresets();
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to update preset"));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [storage, loadPresets]
  );

  const selectPreset = useCallback((id: string | null) => {
    setSelectedPresetId(id);
  }, []);

  const getSelectedPreset = useCallback((): FilterDefinition | null => {
    if (!selectedPresetId) return null;
    return presets.find((p) => p.id === selectedPresetId) || null;
  }, [selectedPresetId, presets]);

  // Auto-load presets on mount
  useEffect(() => {
    if (autoLoad) {
      loadPresets();
    }
  }, [autoLoad, loadPresets]);

  return {
    presets,
    selectedPresetId,
    isLoading,
    error,
    loadPresets,
    loadPreset,
    savePreset,
    deletePreset,
    updatePreset,
    selectPreset,
    getSelectedPreset,
  };
}
