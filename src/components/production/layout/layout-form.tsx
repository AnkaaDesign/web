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
}

interface Door {
  id: string;
  position: number; // Position from left edge in cm
  width: number; // Door width in cm
  offsetTop: number; // Space from top in cm
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
  file?: File;
}

// Completely uncontrolled door offset input
const DoorOffsetInput = React.forwardRef<
  { getValue: () => number },
  {
    doorId: string;
    defaultValue: number;
    height: number;
    disabled?: boolean;
    onBlur?: (value: number) => void;
  }
>(({ doorId, defaultValue, height, disabled, onBlur }, ref) => {
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

    // If value looks like it was typed without decimal (e.g., 50 for 0.50m)
    if (!val.includes(",") && !val.includes(".") && parsed > 10) {
      return parsed;
    }
    return parsed * 100;
  };

  // Expose getValue method via ref
  React.useImperativeHandle(ref, () => ({
    getValue: () => {
      let cmValue = parseValue(localValue);
      cmValue = Math.max(0, Math.min(height - 50, cmValue));
      return Math.round(cmValue);
    }
  }), [localValue, height]);

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
    const clampedValue = Math.max(0, Math.min(height - 50, value));
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
      placeholder="0,50"
      disabled={disabled}
      className="w-14 h-8 text-center text-xs rounded-md border border-border bg-transparent px-2 py-1 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-all"
    />
  );
});

DoorOffsetInput.displayName = 'DoorOffsetInput';

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
    if (!val.includes(",") && !val.includes(".") && parsed > 10) {
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
    if (!localValue.includes(",") && !localValue.includes(".")) {
      const numValue = parseFloat(localValue);
      if (numValue > 10) {
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
      if (input) {
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
  onSideChange
}: LayoutFormProps) => {
  // Store photo state for back side only
  const [photoState, setPhotoState] = useState<PhotoState>({});

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

      if (layout.sections && layout.sections.length > 0) {
        const total = layout.sections.reduce((sum, s) => sum + s.width * 100, 0);
        state.totalWidth = total || 800;

        // Extract doors from sections
        const extractedDoors: Door[] = [];
        let currentPos = 0;

        layout.sections.forEach((section, idx) => {
          if (section.isDoor) {
            extractedDoors.push({
              id: `door-${selectedSide}-${idx}-${Date.now()}-${Math.random()}`,
              position: currentPos,
              width: section.width * 100,
              offsetTop: (section.doorOffset || 0.5) * 100
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

          if (layoutData.sections && layoutData.sections.length > 0) {
            const total = layoutData.sections.reduce((sum, s) => sum + s.width * 100, 0);
            state.totalWidth = total || 800;

            // Extract doors from sections
            const extractedDoors: Door[] = [];
            let currentPos = 0;

            layoutData.sections.forEach((section, idx) => {
              if (section.isDoor) {
                extractedDoors.push({
                  id: `door-${side}-${idx}-${Date.now()}-${Math.random()}`,
                  position: currentPos,
                  width: section.width * 100,
                  offsetTop: (section.doorOffset || 0.5) * 100
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

  // Sync layout prop changes with internal state
  useEffect(() => {
    if (layout) {
      const state: SideState = {
        height: (layout.height || 2.4) * 100,
        totalWidth: 800,
        doors: []
      };

      if (layout.sections && layout.sections.length > 0) {
        const total = layout.sections.reduce((sum, s) => sum + s.width * 100, 0);
        state.totalWidth = total || 800;

        // Extract doors from sections
        const extractedDoors: Door[] = [];
        let currentPos = 0;

        layout.sections.forEach((section, idx) => {
          if (section.isDoor) {
            extractedDoors.push({
              id: `door-${selectedSide}-${idx}-${Date.now()}-${Math.random()}`,
              position: currentPos,
              width: section.width * 100,
              offsetTop: (section.doorOffset || 0.5) * 100
            });
          }
          currentPos += section.width * 100;
        });

        state.doors = extractedDoors;
      }

      setSideStates(prev => ({
        ...prev,
        [selectedSide]: state
      }));
    }
  }, [layout, selectedSide]);

  // Get current side's state
  const currentState = sideStates[selectedSide];
  const shouldShowPhoto = showPhoto ?? selectedSide === 'back';

  // Update state for current side
  const updateCurrentSide = useCallback((updates: Partial<SideState>) => {
    setSideStates(prev => {
      const newState = {
        ...prev,
        [selectedSide]: {
          ...prev[selectedSide],
          ...updates
        }
      };

      // Emit changes for current side
      const state = newState[selectedSide];
      const segments = calculateSegments(state.doors, state.totalWidth);

      const sections = segments.map((segment, index) => ({
        width: segment.width / 100,
        isDoor: segment.type === 'door',
        doorOffset: segment.type === 'door' && segment.door ? segment.door.offsetTop / 100 : null,
        position: index
      }));

      const layoutData = {
        height: state.height / 100,
        sections,
        photoId: null,
      };

      // Support both callback patterns
      if (onChange) {
        onChange(selectedSide, layoutData);
      } else if (onSave) {
        onSave(layoutData);
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
    const doorOffset = 50; // Default offset from top

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
          offsetTop: Math.round(doorOffset)
        }
      ];

      updateCurrentSide({ doors: updatedDoors });
      return;
    } else {
      // Third+ door - find best empty space
      const sortedDoors = [...doors].sort((a, b) => a.position - b.position);
      let bestGap = 0;
      let bestPosition = 0;

      // Check gap at the beginning
      if (sortedDoors[0].position > doorWidth + 50) {
        bestGap = sortedDoors[0].position;
        bestPosition = Math.round((sortedDoors[0].position - doorWidth) / 2);
      }

      // Check gaps between doors
      for (let i = 0; i < sortedDoors.length - 1; i++) {
        const gapStart = sortedDoors[i].position + sortedDoors[i].width;
        const gapEnd = sortedDoors[i + 1].position;
        const gapSize = gapEnd - gapStart;

        if (gapSize > bestGap && gapSize >= doorWidth + 50) {
          bestGap = gapSize;
          bestPosition = Math.round(gapStart + (gapSize - doorWidth) / 2);
        }
      }

      // Check gap at the end
      const lastDoor = sortedDoors[sortedDoors.length - 1];
      const endGap = currentState.totalWidth - (lastDoor.position + lastDoor.width);
      if (endGap > bestGap && endGap >= doorWidth + 50) {
        bestPosition = Math.round(lastDoor.position + lastDoor.width + (endGap - doorWidth) / 2);
      }

      position = bestPosition;
    }

    // Add the door
    const newDoor = {
      id: `door-${selectedSide}-${Date.now()}-${Math.random()}`,
      position: Math.round(Math.max(0, Math.min(position, currentState.totalWidth - doorWidth))),
      width: Math.round(doorWidth),
      offsetTop: Math.round(doorOffset)
    };

    updateCurrentSide({ doors: [...doors, newDoor] });
  }, [currentState, selectedSide, updateCurrentSide]);

  // Remove a door
  const removeDoor = useCallback((doorId: string) => {
    if (!currentState) return;
    updateCurrentSide({ doors: currentState.doors.filter(d => d.id !== doorId) });
  }, [currentState, updateCurrentSide]);

  // Update door offset
  const updateDoorOffset = useCallback((doorId: string, offsetTop: number) => {
    if (!currentState) return;
    const updatedDoors = currentState.doors.map(d =>
      d.id === doorId ? { ...d, offsetTop } : d
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
  <!-- Title text - left aligned with layout -->
  ${taskName ? `<text x="${margin}" y="25" text-anchor="start" font-size="16" font-weight="bold" fill="#000">${taskName}</text>` : ''}
  <text x="${margin}" y="${taskName ? 45 : 25}" text-anchor="start" font-size="14" fill="#666">${getSideLabel(selectedSide)}</text>

  <!-- Main container -->
  <rect x="${margin}" y="${margin}" width="${currentState.totalWidth}" height="${currentState.height}" fill="none" stroke="#000" stroke-width="1"/>`;

    // Add doors
    currentState.doors.forEach(door => {
      svg += `
  <line x1="${margin + door.position}" y1="${margin + door.offsetTop}" x2="${margin + door.position}" y2="${margin + currentState.height}" stroke="#000" stroke-width="1"/>
  <line x1="${margin + door.position + door.width}" y1="${margin + door.offsetTop}" x2="${margin + door.position + door.width}" y2="${margin + currentState.height}" stroke="#000" stroke-width="1"/>
  <line x1="${margin + door.position}" y1="${margin + door.offsetTop}" x2="${margin + door.position + door.width}" y2="${margin + door.offsetTop}" stroke="#000" stroke-width="1"/>`;
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

  // Handle photo upload
  const handlePhotoUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          // Create a URL for the uploaded file to display preview
          const imageUrl = URL.createObjectURL(file);

          // Store photo state separately (not in layout data)
          setPhotoState({ imageUrl, file });

          // Photo upload success feedback through UI is sufficient
        } catch (error) {
          console.error('Error uploading photo:', error);
          toast.error('Erro ao adicionar foto');
        }
      }
    };
    input.click();
  }, []);

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
      <div className="space-y-4 p-6 border rounded-lg bg-background/50">
        <p className="text-muted-foreground">Carregando layout...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Preview Container with centered content */}
      <div className="p-6 border rounded-lg bg-background/50">
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
              {/* Door offset inputs above the truck layout */}
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
                    <DoorOffsetInput
                      doorId={door.id}
                      defaultValue={door.offsetTop}
                      height={currentState.height}
                      disabled={disabled}
                      onBlur={(value) => updateDoorOffset(door.id, value)}
                    />
                  </div>
                ))}
              </div>

              {/* Main Layout Rectangle */}
              <div
                className="border-2 border-foreground/50 bg-muted/10 relative overflow-hidden"
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
                {selectedSide !== 'back' && currentState.doors.map(door => (
                  <div key={door.id}>
                    {/* Door vertical lines - only below the door top line */}
                    <div
                      className="absolute border-l-2 border-r-2 border-foreground/50 pointer-events-none"
                      style={{
                        left: `${door.position * scale}px`,
                        top: `${door.offsetTop * scale}px`,
                        width: `${door.width * scale}px`,
                        height: `${(currentState.height - door.offsetTop) * scale - 2}px`,
                      }}
                    />

                    {/* Door top line */}
                    <div
                      className="absolute border-t-2 border-foreground/50 pointer-events-none"
                      style={{
                        left: `${door.position * scale}px`,
                        top: `${door.offsetTop * scale}px`,
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
                        top: `${(door.offsetTop + (currentState.height - door.offsetTop) / 2) * scale - 10}px`,
                      }}
                    >
                      <IconTrash size={12} />
                    </button>
                  </div>
                ))}
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
                      min={50}
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
        <div className="mt-12 pt-4 border-t">
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
                      Adicionar Foto
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
    </div>
  );
};