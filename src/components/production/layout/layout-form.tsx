import React, { useState, useEffect, useCallback, useRef } from "react";
import { IconDownload, IconTrash, IconPlus, IconCopy, IconFlipHorizontal, IconCamera } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { LayoutCreateFormData } from "../../../schemas";

interface LayoutFormProps {
  selectedSide?: 'left' | 'right' | 'back';
  layouts?: {
    left: LayoutCreateFormData;
    right: LayoutCreateFormData;
    back: LayoutCreateFormData;
  };
  // Support for single layout prop (current usage)
  layout?: LayoutCreateFormData;
  onChange?: (side: 'left' | 'right' | 'back', data: LayoutCreateFormData) => void;
  // Support for onSave prop (current usage)
  onSave?: (data: LayoutCreateFormData) => void;
  showPhoto?: boolean;
  disabled?: boolean;
  taskName?: string;
  previewMode?: boolean;
  onSideChange?: (side: 'left' | 'right' | 'back') => void;
  validationError?: string | null;
}

interface Door {
  id: string;
  position: number; // Position from left edge in cm
  width: number; // Door width in cm
  doorHeight: number; // Height of the door from bottom of layout in cm
}

// Store state for each side
interface SideState {
  height: number;
  totalWidth: number;
  doors: Door[];
}

// Store photo state separately
interface PhotoState {
  imageUrl?: string;
  photoId?: string | null;
  file?: File;
}

// Completely uncontrolled door height input
const DoorHeightInput = React.forwardRef<
  { getValue: () => number },
  {
    doorId: string;
    defaultValue: number;
    layoutHeight: number;
    disabled?: boolean;
    onBlur?: (value: number) => void;
  }
>(({ doorId, defaultValue, layoutHeight, disabled, onBlur }, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState<string>(() => {
    if (defaultValue === 0) return "";
    const meters = defaultValue / 100;
    return meters.toFixed(2).replace(".", ",");
  });

  // Parse display value to cm
  const parseValue = (val: string): number => {
    if (!val || val === "") return 0;
    const normalized = val.replace(",", ".");
    const parsed = parseFloat(normalized);
    if (isNaN(parsed)) return 0;

    // If value looks like it was typed without decimal (e.g., 190 for 1.90m)
    if (!val.includes(",") && !val.includes(".") && parsed > 10) {
      return parsed;
    }
    return parsed * 100;
  };

  // Expose getValue method via ref
  React.useImperativeHandle(ref, () => ({
    getValue: () => {
      let cmValue = parseValue(localValue);
      // Door height must be between 50cm and the layout height
      cmValue = Math.max(50, Math.min(layoutHeight, cmValue));
      return Math.round(cmValue);
    }
  }), [localValue, layoutHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (!/^[0-9.,]*$/.test(inputValue)) return;

    const commaCount = (inputValue.match(/,/g) || []).length;
    const dotCount = (inputValue.match(/\./g) || []).length;
    if (commaCount + dotCount > 1) return;

    setLocalValue(inputValue.replace(".", ","));
  };

  const handleBlur = () => {
    const value = parseValue(localValue);
    // Door height must be between 50cm and the layout height
    const clampedValue = Math.max(50, Math.min(layoutHeight, value));
    onBlur?.(Math.round(clampedValue));

    // Format for display
    const meters = clampedValue / 100;
    setLocalValue(meters.toFixed(2).replace(".", ","));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBlur();
      e.currentTarget.blur();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="1,90"
      disabled={disabled}
      className="w-14 h-8 text-center text-xs rounded-md border border-border bg-transparent px-2 py-1 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-all"
    />
  );
});

DoorHeightInput.displayName = 'DoorHeightInput';

// Natural typing measurement input component
const MeasurementInput = React.memo(({
  value,
  onChange,
  placeholder = "0,00",
  suffix = "cm",
  className,
  min,
  max,
  disabled = false,
  style = {}
}: {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  suffix?: string;
  className?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
}) => {
  const [localValue, setLocalValue] = React.useState<string>("");
  const [isFocused, setIsFocused] = React.useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Format number for display (cm to m with comma)
  const formatValue = (val: number): string => {
    if (val === 0) return "";
    const meters = val / 100;
    return meters.toFixed(2).replace(".", ",");
  };

  // Parse display value to cm
  const parseValue = (val: string): number => {
    if (!val || val === "") return 0;

    // Replace comma with dot for parsing
    const normalized = val.replace(",", ".");
    const parsed = parseFloat(normalized);

    if (isNaN(parsed)) return 0;

    // If value looks like it was typed without decimal (e.g., 840 for 8.40m)
    // Use threshold > 100 so that "11" is treated as 11m (1100cm), not 11cm
    // Values like 840 (8.40m) or 240 (2.40m) are treated as cm
    if (!val.includes(",") && !val.includes(".") && parsed > 100) {
      return parsed; // Already in cm
    }

    // Otherwise treat as meters and convert to cm
    return parsed * 100;
  };

  // Update local value when external value changes (but not while focused)
  React.useEffect(() => {
    if (!isFocused) {
      setLocalValue(formatValue(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Allow only numbers, comma, and dot
    if (!/^[0-9.,]*$/.test(inputValue)) return;

    // Check for multiple commas or dots
    const commaCount = (inputValue.match(/,/g) || []).length;
    const dotCount = (inputValue.match(/\./g) || []).length;
    if (commaCount + dotCount > 1) return;

    // Replace dot with comma for consistency
    const normalizedInput = inputValue.replace(".", ",");

    setLocalValue(normalizedInput);
    // Don't call onChange here - wait for blur
  };

  const handleBlur = () => {
    setIsFocused(false);

    // Parse the value
    let cmValue = parseValue(localValue);

    // Apply min/max constraints
    if (min !== undefined) cmValue = Math.max(min, cmValue);
    if (max !== undefined) cmValue = Math.min(max, cmValue);

    // Auto-format: if user types whole numbers like 840, treat as cm
    // Use threshold > 100 so that "11" is treated as 11m, not 11cm
    if (!localValue.includes(",") && !localValue.includes(".")) {
      const numValue = parseFloat(localValue);
      if (numValue > 100) {
        cmValue = numValue;
      }
    }

    // Only call onChange if the value actually changed
    const newValue = Math.round(cmValue);
    if (newValue !== value) {
      onChange(newValue);
    }
    setLocalValue(formatValue(cmValue));
  };

  const handleFocus = () => {
    setIsFocused(true);
    setTimeout(() => {
      const input = document.activeElement as HTMLInputElement;
      if (input && typeof input.select === 'function') {
        input.select();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="relative inline-block">
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "h-8 rounded-md border border-border bg-transparent px-2 py-1 text-sm",
          "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          className
        )}
        style={style}
        ref={inputRef}
      />
    </div>
  );
});

MeasurementInput.displayName = 'MeasurementInput';

export const LayoutForm = ({
  selectedSide = 'left',
  layouts,
  layout,
  onChange,
  onSave,
  showPhoto,
  disabled = false,
  taskName,
  previewMode = false,
  onSideChange,
  validationError
}: LayoutFormProps) => {
  // Store photo state for back side only
  const [photoState, setPhotoState] = useState<PhotoState>({});

  // Track if we're currently saving to prevent state reset during save
  const isSavingRef = useRef(false);

  // Track last user interaction timestamp to prevent unwanted resets from backend data
  // Initialize to 0 to ALLOW initial sync from backend, then update when user interacts
  const lastUserInteractionRef = useRef<number>(0);

  // Track if there are pending changes that shouldn't be overwritten
  const hasPendingChangesRef = useRef<boolean>(false);

  // Track which sides have had their initial state emitted
  const initialStateEmittedRef = useRef<Record<'left' | 'right' | 'back', boolean>>({
    left: false,
    right: false,
    back: false,
  });

  // Store state for all three sides
  const [sideStates, setSideStates] = useState<Record<'left' | 'right' | 'back', SideState>>(() => {
    const initialStates: Record<'left' | 'right' | 'back', SideState> = {
      left: { height: 240, totalWidth: 800, doors: [] },
      right: { height: 240, totalWidth: 800, doors: [] },
      back: { height: 242, totalWidth: 242, doors: [] }  // Back side defaults to 2.42m x 2.42m
    };

    // Handle single layout prop (current usage pattern)
    if (layout) {
      const state: SideState = {
        height: (layout.height || 2.4) * 100,
        totalWidth: 800,
        doors: []
      };

      if (layout.layoutSections && layout.layoutSections.length > 0) {
        const layoutSections = layout.layoutSections;
        const total = layoutSections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
        state.totalWidth = total || 800;

        // Extract doors from sections
        const extractedDoors: Door[] = [];
        let currentPos = 0;

        layoutSections.forEach((section: any, idx: number) => {
          if (section.isDoor) {
            extractedDoors.push({
              id: `door-${selectedSide}-${idx}-${Date.now()}-${Math.random()}`,
              position: currentPos,
              width: section.width * 100,
              doorHeight: (section.doorHeight || 1.9) * 100
            });
          }
          currentPos += section.width * 100;
        });

        state.doors = extractedDoors;
      }

      initialStates[selectedSide] = state;
    }
    // Handle layouts prop (plural - original usage)
    else if (layouts) {
      Object.keys(layouts).forEach((side) => {
        const layoutData = layouts[side as 'left' | 'right' | 'back'];
        if (layoutData) {
          const state: SideState = {
            height: (layoutData.height || 2.4) * 100,
            totalWidth: 800,
            doors: []
          };

          if (layoutData.layoutSections && layoutData.layoutSections.length > 0) {
            const layoutSections = layoutData.layoutSections;
            const total = layoutSections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
            state.totalWidth = total || 800;

            // Extract doors from sections
            const extractedDoors: Door[] = [];
            let currentPos = 0;

            layoutSections.forEach((section: any, idx: number) => {
              if (section.isDoor) {
                extractedDoors.push({
                  id: `door-${side}-${idx}-${Date.now()}-${Math.random()}`,
                  position: currentPos,
                  width: section.width * 100,
                  doorHeight: (section.doorHeight || 1.9) * 100
                });
              }
              currentPos += section.width * 100;
            });

            state.doors = extractedDoors;
          }

          initialStates[side as 'left' | 'right' | 'back'] = state;
        }
      });
    }

    return initialStates;
  });

  // Keep track of the last layout data we received for each side to detect actual changes
  const lastLayoutRef = useRef<Record<string, any>>({});

  // CRITICAL: Sync state when layouts prop changes (fixes missing doors bug)
  useEffect(() => {
    if (!layouts) return;

    // Don't sync if user has pending changes
    if (hasPendingChangesRef.current) {
      return;
    }

    // Don't sync if currently saving
    if (isSavingRef.current) {
      return;
    }

    setSideStates(prev => {
      const newStates = { ...prev };
      let hasChanges = false;

      // Sync each side that has data in layouts prop
      Object.keys(layouts).forEach((side) => {
        const layoutData = layouts[side as 'left' | 'right' | 'back'];
        if (layoutData?.layoutSections && Array.isArray(layoutData.layoutSections)) {
          const state: SideState = {
            height: (layoutData.height || 2.4) * 100,
            totalWidth: 800,
            doors: []
          };

          const layoutSections = layoutData.layoutSections;
          const total = layoutSections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
          state.totalWidth = total || (side === 'back' ? 242 : 800);

          // Extract doors from sections
          const extractedDoors: Door[] = [];
          let currentPos = 0;

          layoutSections.forEach((section: any, idx: number) => {
            if (section.isDoor) {
              extractedDoors.push({
                id: `door-${side}-${idx}-${Date.now()}-${Math.random()}`,
                position: currentPos,
                width: section.width * 100,
                doorHeight: (section.doorHeight || 1.9) * 100
              });
            }
            currentPos += section.width * 100;
          });

          state.doors = extractedDoors;
          newStates[side as 'left' | 'right' | 'back'] = state;
          hasChanges = true;
        }
      });

      return hasChanges ? newStates : prev;
    });
  }, [layouts]);

  // Sync layout prop changes with internal state
  // Only sync when layout data actually changes, not when just switching sides
  useEffect(() => {
    // Don't sync if we're in the middle of saving
    if (isSavingRef.current) {
      return;
    }

    // CRITICAL FIX: Don't sync if user has pending changes or made changes recently
    // This prevents backend refetch from overwriting user's door removal/edits
    if (hasPendingChangesRef.current) {
      return;
    }

    const timeSinceLastInteraction = Date.now() - lastUserInteractionRef.current;
    const protectionWindow = 5000; // 5 seconds protection window
    if (timeSinceLastInteraction < protectionWindow) {
      return;
    }

    if (!layout) {
      return;
    }

    // Don't reset state if backend returns incomplete data (layoutSections: null)
    // This happens when the backend doesn't include layoutSections in the response
    if (layout.layoutSections === null || layout.layoutSections === undefined) {
      return;
    }

    // Create a key for this side's layout to detect actual data changes
    const layoutKey = `${selectedSide}-${JSON.stringify(layout)}`;
    const lastKey = lastLayoutRef.current[selectedSide];

    // Only update if the layout data actually changed (not just selectedSide)
    if (layoutKey === lastKey) {
      return;
    }

    // Store this layout as the last seen for this side
    lastLayoutRef.current[selectedSide] = layoutKey;

    const state: SideState = {
      height: (layout.height || 2.4) * 100,
      totalWidth: 800,
      doors: []
    };

    if (layout.layoutSections && layout.layoutSections.length > 0) {
      const layoutSections = layout.layoutSections;
      const total = layoutSections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
      state.totalWidth = total || 800;

      // Extract doors from sections
      const extractedDoors: Door[] = [];
      let currentPos = 0;

      layoutSections.forEach((section: any, idx: number) => {
        if (section.isDoor) {
          extractedDoors.push({
            id: `door-${selectedSide}-${idx}-${Date.now()}-${Math.random()}`,
            position: currentPos,
            width: section.width * 100,
            doorHeight: (section.doorHeight || 1.9) * 100
          });
        }
        currentPos += section.width * 100;
      });

      state.doors = extractedDoors;
    }

    // Clear pending changes flag since we're syncing fresh data from backend
    hasPendingChangesRef.current = false;

    setSideStates(prev => {
      return {
        ...prev,
        [selectedSide]: state
      };
    });
  }, [layout, selectedSide]);

  // Separate effect for syncing photo state from layout
  // This runs independently to avoid circular dependency issues
  useEffect(() => {
    if (!layout) {
      return;
    }

    // For back side only, sync photo from layout
    if (selectedSide !== 'back') {
      return;
    }

    // If user has selected a new file, don't overwrite it
    if (photoState.file) {
      return;
    }

    if (layout.photo) {
      // Only sync if the photo ID changed
      if (photoState.photoId === layout.photo.id) {
        return;
      }

      const apiUrl = (window as any).__ANKAA_API_URL__ || import.meta.env.VITE_API_URL || "http://localhost:3030";
      const imageUrl = `${apiUrl}/files/${layout.photo.id}/download`;

      setPhotoState({
        imageUrl,
        photoId: layout.photo.id,
        file: null,
      });
    } else {
      // Layout has no photo - clear photoState only if it had a photoId (not a new file)
      if (photoState.photoId && !photoState.file) {
        setPhotoState({});
      }
    }
  }, [layout, selectedSide, photoState.photoId, photoState.file]);

  // Emit initial state to parent when selected side changes and has no saved layout
  // This ensures parent knows the default values
  useEffect(() => {
    // Skip if no onChange handler
    if (!onChange) {
      return;
    }

    // Skip if we've already emitted initial state for this side
    if (initialStateEmittedRef.current[selectedSide]) {
      return;
    }

    // Skip if we have a layout prop (already synced above)
    if (layout && layout.layoutSections) {
      initialStateEmittedRef.current[selectedSide] = true;
      return;
    }

    const state = sideStates[selectedSide];

    // Calculate segments
    const segments: Array<{ type: 'segment' | 'door'; start: number; end: number; width: number; door?: Door }> = [];

    if (state.doors.length === 0) {
      segments.push({
        type: 'segment',
        start: 0,
        end: state.totalWidth,
        width: state.totalWidth,
      });
    } else {
      const sortedDoors = [...state.doors].sort((a, b) => a.position - b.position);
      let currentPos = 0;

      sortedDoors.forEach((door) => {
        if (door.position > currentPos) {
          segments.push({
            type: 'segment',
            start: currentPos,
            end: door.position,
            width: door.position - currentPos,
          });
        }
        segments.push({
          type: 'door',
          start: door.position,
          end: door.position + door.width,
          width: door.width,
          door,
        });
        currentPos = door.position + door.width;
      });

      if (currentPos < state.totalWidth) {
        segments.push({
          type: 'segment',
          start: currentPos,
          end: state.totalWidth,
          width: state.totalWidth - currentPos,
        });
      }
    }

    const layoutSections = segments.map((segment, index) => ({
      width: segment.width / 100,
      isDoor: segment.type === 'door',
      doorHeight: segment.type === 'door' && segment.door ? segment.door.doorHeight / 100 : null,
      position: index
    }));

    const layoutData = {
      height: state.height / 100,
      layoutSections,
      photoId: photoState?.photoId || null,
      photoFile: photoState?.file || null, // Include file for upload
    };

    // Mark this side as having emitted state
    initialStateEmittedRef.current[selectedSide] = true;

    // Emit to parent
    onChange(selectedSide, layoutData);
  }, [selectedSide, layout, onChange]); // Run when selected side or layout changes

  // Get current side's state
  const currentState = sideStates[selectedSide];
  const shouldShowPhoto = showPhoto ?? selectedSide === 'back';

  // Update state for current side
  const updateCurrentSide = useCallback((updates: Partial<SideState>) => {
    // CRITICAL FIX: Record timestamp of user interaction and mark as having pending changes
    // This prevents backend refetch from overwriting changes (especially door removals)
    lastUserInteractionRef.current = Date.now();
    hasPendingChangesRef.current = true;

    setSideStates(prev => {
      const newState = {
        ...prev,
        [selectedSide]: {
          ...prev[selectedSide],
          ...updates
        }
      };

      // Sync height between left and right sides (not back)
      if (updates.height !== undefined && selectedSide !== 'back') {
        const oppositeSide = selectedSide === 'left' ? 'right' : 'left';
        newState[oppositeSide] = {
          ...newState[oppositeSide],
          height: updates.height
        };
      }

      const state = newState[selectedSide];

      // Emit changes for current side
      const segments = calculateSegments(state.doors, state.totalWidth);

      const layoutSections = segments.map((segment, index) => ({
        width: segment.width / 100,
        isDoor: segment.type === 'door',
        doorHeight: segment.type === 'door' && segment.door ? segment.door.doorHeight / 100 : null,
        position: index
      }));

      const layoutData = {
        height: state.height / 100,
        layoutSections,
        photoId: photoState?.photoId || null,
        photoFile: photoState?.file || null, // Include file for upload
      };

      // Set saving flag to prevent state reset during save
      isSavingRef.current = true;

      // Support both callback patterns
      if (onChange) {
        onChange(selectedSide, layoutData);

        // Also emit changes for the opposite side if height was synced
        if (updates.height !== undefined && selectedSide !== 'back') {
          const oppositeSide = selectedSide === 'left' ? 'right' : 'left';
          const oppositeState = newState[oppositeSide];
          const oppositeSegments = calculateSegments(oppositeState.doors, oppositeState.totalWidth);

          const oppositeLayoutSections = oppositeSegments.map((segment, index) => ({
            width: segment.width / 100,
            isDoor: segment.type === 'door',
            doorHeight: segment.type === 'door' && segment.door ? segment.door.doorHeight / 100 : null,
            position: index
          }));

          const oppositeLayoutData = {
            height: oppositeState.height / 100,
            layoutSections: oppositeLayoutSections,
            photoId: null,
            photoFile: null,
          };

          onChange(oppositeSide, oppositeLayoutData);
        }
      } else if (onSave) {
        // Call onSave and handle the promise
        const saveResult = onSave(layoutData);

        // If onSave returns a promise, wait for it to complete
        if (saveResult && typeof saveResult.then === 'function') {
          saveResult.finally(() => {
            // Reset the flag after a delay to allow the backend to process
            setTimeout(() => {
              isSavingRef.current = false;
            }, 500);
          });
        } else {
          // If not a promise, reset after a delay
          setTimeout(() => {
            isSavingRef.current = false;
          }, 500);
        }
      } else {
        // No callback, reset immediately
        isSavingRef.current = false;
      }

      return newState;
    });
  }, [selectedSide, onChange, onSave]);

  // Calculate segments
  const calculateSegments = (doors: Door[], totalWidth: number) => {
    if (doors.length === 0) {
      return [{
        type: 'segment',
        start: 0,
        end: totalWidth,
        width: Math.round(totalWidth)
      }];
    }

    // Sort doors by position
    const sortedDoors = [...doors].sort((a, b) => a.position - b.position);
    const segments: any[] = [];
    let currentPos = 0;

    sortedDoors.forEach((door) => {
      // Add segment before door if there's space
      if (door.position > currentPos) {
        segments.push({
          type: 'segment',
          start: currentPos,
          end: door.position,
          width: Math.round(door.position - currentPos)
        });
      }

      // Add door
      segments.push({
        type: 'door',
        start: door.position,
        end: door.position + door.width,
        width: Math.round(door.width),
        door: door
      });

      currentPos = door.position + door.width;
    });

    // Add final segment after last door if there's space
    if (currentPos < totalWidth) {
      segments.push({
        type: 'segment',
        start: currentPos,
        end: totalWidth,
        width: Math.round(totalWidth - currentPos)
      });
    }

    return segments;
  };

  const segments = React.useMemo(() => {
    if (!currentState) return [];
    return calculateSegments(currentState.doors, currentState.totalWidth);
  }, [currentState]);

  // Calculate display scale
  const maxDisplayWidth = 500;
  const maxDisplayHeight = 150;
  const scale = Math.min(
    maxDisplayWidth / Math.max(currentState?.totalWidth || 800, 100),
    maxDisplayHeight / Math.max(currentState?.height || 240, 100),
    0.8
  );

  // Add a new door
  const addDoor = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();

    if (!currentState) return;

    const doorWidth = 100; // Default door width in cm
    const defaultDoorHeight = 190; // Default door height from bottom in cm (1.90m)

    let position: number;
    const doors = currentState.doors;

    if (doors.length === 0) {
      // First door - center it
      position = currentState.totalWidth / 2 - doorWidth / 2;
    } else if (doors.length === 1) {
      // Second door - distribute evenly
      const spacing = Math.round(currentState.totalWidth / 3);
      const firstDoorNewPosition = Math.round(spacing - doorWidth / 2);
      position = Math.round((spacing * 2) - doorWidth / 2);

      // Update both doors at once
      const updatedDoors = [
        {
          ...doors[0],
          position: Math.round(Math.max(0, firstDoorNewPosition))
        },
        {
          id: `door-${selectedSide}-${Date.now()}-${Math.random()}`,
          position: Math.round(Math.max(0, Math.min(position, currentState.totalWidth - doorWidth))),
          width: Math.round(doorWidth),
          doorHeight: Math.round(defaultDoorHeight)
        }
      ];

      updateCurrentSide({ doors: updatedDoors });
      return;
    } else {
      // Third+ door - find best empty space
      const sortedDoors = [...doors].sort((a, b) => a.position - b.position);
      let bestGap = 0;
      let bestPosition = 0;

      // Check gap at the beginning (allow doors at edge - no minimum buffer required)
      if (sortedDoors[0].position >= doorWidth) {
        bestGap = sortedDoors[0].position;
        bestPosition = Math.round((sortedDoors[0].position - doorWidth) / 2);
      }

      // Check gaps between doors
      for (let i = 0; i < sortedDoors.length - 1; i++) {
        const gapStart = sortedDoors[i].position + sortedDoors[i].width;
        const gapEnd = sortedDoors[i + 1].position;
        const gapSize = gapEnd - gapStart;

        if (gapSize > bestGap && gapSize >= doorWidth) {
          bestGap = gapSize;
          bestPosition = Math.round(gapStart + (gapSize - doorWidth) / 2);
        }
      }

      // Check gap at the end (allow doors at edge - no minimum buffer required)
      const lastDoor = sortedDoors[sortedDoors.length - 1];
      const endGap = currentState.totalWidth - (lastDoor.position + lastDoor.width);
      if (endGap > bestGap && endGap >= doorWidth) {
        bestPosition = Math.round(lastDoor.position + lastDoor.width + (endGap - doorWidth) / 2);
      }

      position = bestPosition;
    }

    // Add the door
    const newDoor = {
      id: `door-${selectedSide}-${Date.now()}-${Math.random()}`,
      position: Math.round(Math.max(0, Math.min(position, currentState.totalWidth - doorWidth))),
      width: Math.round(doorWidth),
      doorHeight: Math.round(defaultDoorHeight)
    };

    updateCurrentSide({ doors: [...doors, newDoor] });
  }, [currentState, selectedSide, updateCurrentSide]);

  // Remove a door
  const removeDoor = useCallback((doorId: string) => {
    if (!currentState) return;
    updateCurrentSide({ doors: currentState.doors.filter(d => d.id !== doorId) });
  }, [currentState, updateCurrentSide]);

  // Update door height
  const updateDoorHeight = useCallback((doorId: string, doorHeight: number) => {
    if (!currentState) return;
    const updatedDoors = currentState.doors.map(d =>
      d.id === doorId ? { ...d, doorHeight } : d
    );
    updateCurrentSide({ doors: updatedDoors });
  }, [currentState, updateCurrentSide]);

  // Update segment width
  const updateSegmentWidth = useCallback((segmentIndex: number, newWidth: number) => {
    const segment = segments[segmentIndex];
    if (!segment || segment.type === 'door') return;

    const oldWidth = segment.width;
    const widthDiff = newWidth - oldWidth;

    // Update total width if it's the last segment
    if (segmentIndex === segments.length - 1) {
      updateCurrentSide({ totalWidth: Math.max(100, currentState.totalWidth + widthDiff) });
    } else {
      // Shift doors that come after this segment
      const sortedDoors = [...currentState.doors].sort((a, b) => a.position - b.position);
      const newDoors = sortedDoors.map(door => {
        if (door.position >= segment.end) {
          return { ...door, position: Math.max(0, door.position + widthDiff) };
        }
        return door;
      });

      updateCurrentSide({
        doors: newDoors,
        totalWidth: Math.max(100, currentState.totalWidth + widthDiff)
      });
    }
  }, [segments, currentState, updateCurrentSide]);

  // Update door properties
  const updateDoor = useCallback((doorId: string, updates: Partial<Door>) => {
    const updatedDoors = currentState.doors.map(d => d.id === doorId ? { ...d, ...updates } : d);

    // If width changed, update total width to accommodate
    if (updates.width !== undefined) {
      const oldDoor = currentState.doors.find(d => d.id === doorId);
      if (oldDoor) {
        const widthDiff = updates.width - oldDoor.width;
        updateCurrentSide({
          doors: updatedDoors,
          totalWidth: Math.max(100, currentState.totalWidth + widthDiff)
        });
        return;
      }
    }

    updateCurrentSide({ doors: updatedDoors });
  }, [currentState, updateCurrentSide]);

  // Generate SVG
  const generateSVG = useCallback(() => {
    const margin = 50;
    const svgWidth = currentState.totalWidth + margin * 2 + 100;
    const svgHeight = currentState.height + margin * 2 + 100;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}mm" height="${svgHeight}mm" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <text x="${margin}" y="25" text-anchor="start" font-size="14" font-weight="bold" fill="#000">${getSideLabel(selectedSide)}</text>
  <rect x="${margin}" y="${margin}" width="${currentState.totalWidth}" height="${currentState.height}" fill="none" stroke="#000" stroke-width="1"/>`;

    // Add doors - doorHeight is measured from bottom of layout to top of door opening
    currentState.doors.forEach(door => {
      const doorTopY = margin + (currentState.height - door.doorHeight);
      svg += `
  <line x1="${margin + door.position}" y1="${doorTopY}" x2="${margin + door.position}" y2="${margin + currentState.height}" stroke="#000" stroke-width="1"/>
  <line x1="${margin + door.position + door.width}" y1="${doorTopY}" x2="${margin + door.position + door.width}" y2="${margin + currentState.height}" stroke="#000" stroke-width="1"/>
  <line x1="${margin + door.position}" y1="${doorTopY}" x2="${margin + door.position + door.width}" y2="${doorTopY}" stroke="#000" stroke-width="1"/>`;
    });

    // Add width dimensions with arrows
    segments.forEach(segment => {
      const startX = margin + segment.start;
      const endX = margin + segment.start + segment.width;
      const centerX = startX + segment.width / 2;
      const dimY = margin + currentState.height + 20;

      // Dimension line
      svg += `
  <line x1="${startX}" y1="${dimY}" x2="${endX}" y2="${dimY}" stroke="#0066cc" stroke-width="1"/>`;

      // Left arrow
      svg += `
  <polygon points="${startX},${dimY} ${startX + 5},${dimY - 3} ${startX + 5},${dimY + 3}" fill="#0066cc"/>`;

      // Right arrow
      svg += `
  <polygon points="${endX},${dimY} ${endX - 5},${dimY - 3} ${endX - 5},${dimY + 3}" fill="#0066cc"/>`;

      // Dimension text
      svg += `
  <text x="${centerX}" y="${dimY + 15}" text-anchor="middle" font-size="12" fill="#0066cc">${segment.width}</text>`;
    });

    // Height dimension with arrows
    const dimX = margin - 20;
    const startY = margin;
    const endY = margin + currentState.height;
    const centerY = startY + currentState.height / 2;

    // Dimension line
    svg += `
  <line x1="${dimX}" y1="${startY}" x2="${dimX}" y2="${endY}" stroke="#0066cc" stroke-width="1"/>`;

    // Top arrow
    svg += `
  <polygon points="${dimX},${startY} ${dimX - 3},${startY + 5} ${dimX + 3},${startY + 5}" fill="#0066cc"/>`;

    // Bottom arrow
    svg += `
  <polygon points="${dimX},${endY} ${dimX - 3},${endY - 5} ${dimX + 3},${endY - 5}" fill="#0066cc"/>`;

    // Height text
    svg += `
  <text x="${dimX - 10}" y="${centerY}" text-anchor="middle" font-size="12" fill="#0066cc" transform="rotate(-90, ${dimX - 10}, ${centerY})">${currentState.height}</text>
</svg>`;

    return svg;
  }, [currentState, segments]);

  // Copy from another side
  const copyFromSide = useCallback((fromSide: 'left' | 'right' | 'back') => {
    if (fromSide === selectedSide) return;

    const sourceState = sideStates[fromSide];

    // Deep copy the source state
    const copiedState: SideState = {
      height: sourceState.height,
      totalWidth: sourceState.totalWidth,
      doors: sourceState.doors.map(door => ({
        ...door,
        id: `door-${selectedSide}-${Date.now()}-${Math.random()}` // New IDs for copied doors
      }))
    };

    updateCurrentSide(copiedState);
    // Layout operations don't require success toasts as they're UI feedback
  }, [selectedSide, sideStates, updateCurrentSide]);

  // Mirror from another side
  const mirrorFromSide = useCallback((fromSide: 'left' | 'right' | 'back') => {
    if (fromSide === selectedSide) return;

    const sourceState = sideStates[fromSide];

    // Mirror the layout (flip door positions)
    const mirroredDoors = sourceState.doors.map(door => {
      // Mirror position: new position = total width - (original position + door width)
      const mirroredPosition = sourceState.totalWidth - (door.position + door.width);

      return {
        ...door,
        id: `door-${selectedSide}-${Date.now()}-${Math.random()}`,
        position: Math.max(0, mirroredPosition)
      };
    });

    const mirroredState: SideState = {
      height: sourceState.height,
      totalWidth: sourceState.totalWidth,
      doors: mirroredDoors
    };

    updateCurrentSide(mirroredState);
    // Layout operations don't require success toasts as they're UI feedback
  }, [selectedSide, sideStates, updateCurrentSide]);

  // Get label for side
  const getSideLabel = (side: 'left' | 'right' | 'back') => {
    switch (side) {
      case 'left': return 'Motorista';
      case 'right': return 'Sapo';
      case 'back': return 'Traseira';
    }
  };

  // Handle photo selection (file will be uploaded with task submission)
  const handlePhotoUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Create a URL for the uploaded file to display preview
        const imageUrl = URL.createObjectURL(file);

        // Store photo file first
        const newPhotoState = { imageUrl, file, photoId: null };
        setPhotoState(newPhotoState);

        toast.success('Foto adicionada - será salva ao submeter a tarefa');

        // CRITICAL FIX: Mark as having pending changes before notifying parent
        // This ensures the photo upload is protected from backend resets
        lastUserInteractionRef.current = Date.now();
        hasPendingChangesRef.current = true;

        // Trigger parent notification to include the photo file
        if (!currentState) return;

        // Calculate current segments to send with the photo
        const segments = calculateSegments(currentState.doors, currentState.totalWidth);
        const layoutSections = segments.map((segment, index) => ({
          width: segment.width / 100,
          isDoor: segment.type === 'door',
          doorHeight: segment.type === 'door' && segment.door ? segment.door.doorHeight / 100 : null,
          position: index
        }));

        const layoutData = {
          height: currentState.height / 100,
          layoutSections,
          photoId: newPhotoState.photoId || null,
          photoFile: file, // Include the file
        };

        // Notify parent immediately with photo file
        if (onChange) {
          onChange(selectedSide, layoutData);
        } else if (onSave) {
          onSave(layoutData);
        }
      }
    };
    input.click();
  }, [currentState, selectedSide, onChange, onSave]);

  // Download SVG
  const downloadSVG = useCallback(() => {
    try {
      const svgContent = generateSVG();
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Create filename with task name and side
      const sideLabel = getSideLabel(selectedSide).toLowerCase();
      const taskPrefix = taskName ? `${taskName}-` : '';
      link.download = `${taskPrefix}layout-${sideLabel}-${currentState.totalWidth}mm.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      // Download success is evident through browser download
    } catch (error) {
      toast.error('Erro ao gerar o layout');
    }
  }, [generateSVG, selectedSide, currentState]);

  // Early return if no current state
  if (!currentState) {
    return (
      <div className="space-y-4 p-4 border border-border/40 rounded-lg bg-background/50">
        <p className="text-muted-foreground">Carregando layout...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Preview Container with centered content */}
      <div className="p-4 border border-border/40 rounded-lg bg-background/50">
        {/* Centered Layout Container */}
        <div className="flex flex-col items-center">
          {/* Main Layout with Height Input and Width Inputs */}
          <div className="flex gap-4">
            {/* Height Input - Left Side */}
            <div className="flex flex-col items-center" style={{ height: `${30 + currentState.height * scale + 30}px`, paddingTop: '30px' }}>
              <div className="flex-1 flex items-center">
                <MeasurementInput
                  value={currentState.height}
                  onChange={(value) => updateCurrentSide({ height: value })}
                  placeholder="2,40"
                  suffix="cm"
                  min={100}
                  max={400}
                  disabled={disabled}
                  className="w-14 text-center text-xs"
                />
              </div>
            </div>

            {/* Layout and Width Inputs Container */}
            <div className="flex flex-col">
              {/* Door height inputs above the truck layout */}
              <div className="mb-2 relative" style={{ width: `${currentState.totalWidth * scale}px`, height: '30px' }}>
                {currentState.doors.map(door => (
                  <div
                    key={door.id}
                    className="absolute flex justify-center"
                    style={{
                      left: `${door.position * scale}px`,
                      width: `${door.width * scale}px`,
                    }}
                  >
                    <DoorHeightInput
                      doorId={door.id}
                      defaultValue={door.doorHeight}
                      layoutHeight={currentState.height}
                      disabled={disabled}
                      onBlur={(value) => updateDoorHeight(door.id, value)}
                    />
                  </div>
                ))}
              </div>

              {/* Main Layout Rectangle */}
              <div
                className="border-2 border-foreground/70 bg-muted/30 relative overflow-hidden"
                style={{
                  width: `${currentState.totalWidth * scale}px`,
                  height: `${currentState.height * scale}px`
                }}
              >
                {/* Photo background for back side */}
                {selectedSide === 'back' && photoState.imageUrl && (
                  <img
                    src={photoState.imageUrl}
                    alt="Layout background"
                    className="absolute inset-0 w-full h-full object-cover opacity-50"
                  />
                )}
                {/* Render doors and their controls (only for sides, not back) */}
                {selectedSide !== 'back' && currentState.doors.map(door => {
                  // doorHeight is measured from bottom to top of door opening
                  // So the door top position = layout height - door height
                  const doorTopPosition = currentState.height - door.doorHeight;
                  return (
                    <div key={door.id}>
                      {/* Door vertical lines - only below the door top line */}
                      <div
                        className="absolute border-l-2 border-r-2 border-foreground/70 pointer-events-none"
                        style={{
                          left: `${door.position * scale}px`,
                          top: `${doorTopPosition * scale}px`,
                          width: `${door.width * scale}px`,
                          height: `${door.doorHeight * scale - 2}px`,
                        }}
                      />

                      {/* Door top line */}
                      <div
                        className="absolute border-t-2 border-foreground/70 pointer-events-none"
                        style={{
                          left: `${door.position * scale}px`,
                          top: `${doorTopPosition * scale}px`,
                          width: `${door.width * scale}px`,
                        }}
                      />

                      {/* Remove door button */}
                      <button
                        type="button"
                        onClick={() => removeDoor(door.id)}
                        disabled={disabled}
                        className="absolute w-5 h-5 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full flex items-center justify-center transition-colors opacity-80 hover:opacity-100"
                        style={{
                          left: `${(door.position + door.width / 2) * scale - 10}px`,
                          top: `${(doorTopPosition + door.doorHeight / 2) * scale - 10}px`,
                        }}
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Width inputs below layout */}
              <div
                className="mt-2 flex"
                style={{
                  width: `${currentState.totalWidth * scale}px`,
                }}
              >
                {segments.map((segment, index) => (
                  <div
                    key={`segment-${index}-${segment.start}`}
                    className="flex justify-center"
                    style={{
                      width: `${segment.width * scale}px`,
                    }}
                  >
                    <MeasurementInput
                      value={segment.width}
                      onChange={(newWidth) => {
                        if (segment.type === 'door' && segment.door) {
                          updateDoor(segment.door.id, { width: newWidth });
                        } else {
                          updateSegmentWidth(index, newWidth);
                        }
                      }}
                      placeholder="1,00"
                      suffix="cm"
                      min={0}
                      disabled={disabled}
                      className="w-14 text-center text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Controls at the bottom */}
        <div className="mt-12 pt-4 border-t border-border/30">
          {/* Control Buttons - All in single row */}
          <div className="flex gap-2">
            {/* Editing controls - hidden in preview mode */}
            {!previewMode && (
              <>
                {/* Copy button - only between left and right sides */}
                {selectedSide !== 'back' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={disabled}
                    onClick={() => copyFromSide(selectedSide === 'left' ? 'right' : 'left')}
                    className="flex-1"
                  >
                    <IconCopy className="h-4 w-4 mr-1" />
                    Copiar {selectedSide === 'left' ? 'Sapo' : 'Motorista'}
                  </Button>
                )}

                {/* Mirror button - only between left and right sides */}
                {selectedSide !== 'back' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={disabled}
                    onClick={() => mirrorFromSide(selectedSide === 'left' ? 'right' : 'left')}
                    className="flex-1"
                  >
                    <IconFlipHorizontal className="h-4 w-4 mr-1" />
                    Espelhar {selectedSide === 'left' ? 'Sapo' : 'Motorista'}
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={selectedSide === 'back' ? handlePhotoUpload : addDoor}
                  size="sm"
                  variant="default"
                  disabled={disabled}
                  className="flex-1"
                >
                  {selectedSide === 'back' ? (
                    <>
                      <IconCamera className="h-4 w-4 mr-1" />
                      {photoState.imageUrl ? 'Substituir Foto' : 'Adicionar Foto'}
                    </>
                  ) : (
                    <>
                      <IconPlus className="h-4 w-4 mr-1" />
                      Adicionar Porta
                    </>
                  )}
                </Button>
              </>
            )}

            {/* Download button - always visible */}
            <Button
              type="button"
              onClick={downloadSVG}
              size="sm"
              variant="default"
              disabled={disabled}
              className={previewMode ? "w-full" : "flex-1"}
            >
              <IconDownload className="h-4 w-4 mr-1" />
              Baixar SVG
            </Button>
          </div>
        </div>
      </div>

      {/* Photo Status Indicator - only show for back side */}
      {selectedSide === 'back' && photoState.imageUrl && (
        <Alert className="mt-4">
          <AlertDescription className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <IconCamera className="h-4 w-4" />
              {photoState.file ? (
                <span>Foto selecionada: <strong>{photoState.file.name}</strong> (será salva ao submeter)</span>
              ) : photoState.photoId ? (
                <span>Foto do layout carregada (ID: {photoState.photoId})</span>
              ) : (
                <span>Foto carregada</span>
              )}
            </span>
            <Button
              type="button"
              onClick={() => {
                setPhotoState({});
                hasPendingChangesRef.current = true;
                toast.info('Foto removida');
                // Notify parent about photo removal
                if (!currentState) return;
                const segments = calculateSegments(currentState.doors, currentState.totalWidth);
                const layoutSections = segments.map((segment, index) => ({
                  width: segment.width / 100,
                  isDoor: segment.type === 'door',
                  doorHeight: segment.type === 'door' && segment.door ? segment.door.doorHeight / 100 : null,
                  position: index
                }));
                const layoutData = {
                  height: currentState.height / 100,
                  layoutSections,
                  photoId: null,
                  photoFile: null,
                };
                if (onChange) {
                  onChange(selectedSide, layoutData);
                } else if (onSave) {
                  onSave(layoutData);
                }
              }}
              size="sm"
              variant="ghost"
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Error Display */}
      {validationError && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};