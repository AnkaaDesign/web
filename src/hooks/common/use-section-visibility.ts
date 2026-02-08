import { useState, useCallback } from "react";

export type FieldConfig = {
  id: string;
  label: string;
  sectionId: string;
  defaultVisible?: boolean;
  required?: boolean;
}

export type SectionConfig = {
  id: string;
  label: string;
  defaultVisible?: boolean;
  fields: FieldConfig[];
}

export type VisibilityState = {
  sections: Set<string>;
  fields: Set<string>;
}

/**
 * Hook to manage section and field visibility with localStorage persistence
 *
 * @param storageKey - Unique key for localStorage (e.g., "task-detail-visibility")
 * @param sections - Array of section configurations with their fields
 * @returns Object with visibility state and update functions
 *
 * @example
 * ```tsx
 * const { visibilityState, toggleSection, toggleField, resetToDefaults } = useSectionVisibility(
 *   "task-detail-visibility",
 *   [
 *     {
 *       id: "overview",
 *       label: "Overview",
 *       defaultVisible: true,
 *       fields: [
 *         { id: "customer", label: "Customer", sectionId: "overview", required: true },
 *         { id: "sector", label: "Sector", sectionId: "overview" }
 *       ]
 *     }
 *   ]
 * );
 * ```
 */
export function useSectionVisibility(
  storageKey: string,
  sections: SectionConfig[]
) {
  // Build default visibility sets
  const getDefaultVisibility = useCallback((): VisibilityState => {
    const defaultSections = new Set<string>();
    const defaultFields = new Set<string>();

    sections.forEach((section) => {
      if (section.defaultVisible !== false) {
        defaultSections.add(section.id);
      }

      section.fields.forEach((field) => {
        if (field.defaultVisible !== false) {
          defaultFields.add(field.id);
        }
      });
    });

    return { sections: defaultSections, fields: defaultFields };
  }, [sections]);

  // Initialize state from localStorage or use defaults
  const [visibilityState, setVisibilityState] = useState<VisibilityState>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          const storedState: VisibilityState = {
            sections: new Set(parsed.sections || []),
            fields: new Set(parsed.fields || []),
          };

          // Ensure required fields are always visible
          sections.forEach((section) => {
            section.fields.forEach((field) => {
              if (field.required) {
                storedState.fields.add(field.id);
              }
            });
          });

          return storedState;
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`Failed to parse stored section visibility for key "${storageKey}":`, error);
      }
    }

    return getDefaultVisibility();
  });

  // Save to localStorage
  const saveToLocalStorage = useCallback(
    (state: VisibilityState) => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            sections: Array.from(state.sections),
            fields: Array.from(state.fields),
          })
        );
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error(`Failed to save section visibility to localStorage for key "${storageKey}":`, error);
        }
      }
    },
    [storageKey]
  );

  // Toggle entire section visibility
  const toggleSection = useCallback(
    (sectionId: string) => {
      setVisibilityState((prev) => {
        const newSections = new Set(prev.sections);
        const newFields = new Set(prev.fields);

        if (newSections.has(sectionId)) {
          // Hide section and all its fields
          newSections.delete(sectionId);
          const section = sections.find((s) => s.id === sectionId);
          section?.fields.forEach((field) => {
            if (!field.required) {
              newFields.delete(field.id);
            }
          });
        } else {
          // Show section and all its non-hidden fields
          newSections.add(sectionId);
          const section = sections.find((s) => s.id === sectionId);
          section?.fields.forEach((field) => {
            if (field.defaultVisible !== false) {
              newFields.add(field.id);
            }
          });
        }

        const newState = { sections: newSections, fields: newFields };
        saveToLocalStorage(newState);
        return newState;
      });
    },
    [sections, saveToLocalStorage]
  );

  // Toggle individual field visibility
  const toggleField = useCallback(
    (fieldId: string) => {
      setVisibilityState((prev) => {
        // Find the field config
        let fieldConfig: FieldConfig | undefined;
        for (const section of sections) {
          fieldConfig = section.fields.find((f) => f.id === fieldId);
          if (fieldConfig) break;
        }

        // Don't allow toggling required fields
        if (fieldConfig?.required) {
          return prev;
        }

        const newFields = new Set(prev.fields);

        if (newFields.has(fieldId)) {
          newFields.delete(fieldId);
        } else {
          newFields.add(fieldId);
        }

        const newState = { sections: prev.sections, fields: newFields };
        saveToLocalStorage(newState);
        return newState;
      });
    },
    [sections, saveToLocalStorage]
  );

  // Reset to default visibility
  const resetToDefaults = useCallback(() => {
    const defaultState = getDefaultVisibility();
    setVisibilityState(defaultState);
    saveToLocalStorage(defaultState);
  }, [getDefaultVisibility, saveToLocalStorage]);

  // Check if a section is visible
  const isSectionVisible = useCallback(
    (sectionId: string): boolean => {
      return visibilityState.sections.has(sectionId);
    },
    [visibilityState.sections]
  );

  // Check if a field is visible
  const isFieldVisible = useCallback(
    (fieldId: string): boolean => {
      return visibilityState.fields.has(fieldId);
    },
    [visibilityState.fields]
  );

  return {
    visibilityState,
    toggleSection,
    toggleField,
    resetToDefaults,
    isSectionVisible,
    isFieldVisible,
  };
}
