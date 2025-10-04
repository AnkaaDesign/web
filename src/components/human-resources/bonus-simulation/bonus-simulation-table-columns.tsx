import React, { useState } from "react";
import type { User, Position } from "../../../types";
import { formatCurrency } from "../../../utils";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Button } from "../../ui/button";
import { IconCheck, IconX, IconEdit } from "@tabler/icons-react";

// === CORRECT BONUS CALCULATION FROM DB SEED ===
// Performance multipliers (exactly as in seed database)
const performanceMultipliers: Record<number, number> = {
  1: 1.0,       // Base value
  2: 2.0,       // Exactly 2x base
  3: 3.0,       // Exactly 3x base
  4: 3.5,       // Exactly 3.5x base
  5: 4.0,       // Exactly 4x base (corrected from Excel)
};

/**
 * Get detailed position level (1-12) from position name (exactly as in seed database)
 */
function getDetailedPositionLevel(positionName: string): number {
  const normalized = positionName.toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/iv/g, 'iv')  // Normalize IV variations
    .replace(/iii/g, 'iii')  // Normalize III variations
    .replace(/ii/g, 'ii')  // Normalize II variations
    .replace(/i(?!i|v)/g, 'i');  // Normalize I (not followed by i or v)

  // Junior positions (1-4)
  if (normalized.includes('junior iv') || normalized.includes('júnior iv') ||
      normalized.includes('junior4') || normalized.includes('júnior4')) return 4;
  if (normalized.includes('junior iii') || normalized.includes('júnior iii') ||
      normalized.includes('junior3') || normalized.includes('júnior3')) return 3;
  if (normalized.includes('junior ii') || normalized.includes('júnior ii') ||
      normalized.includes('junior2') || normalized.includes('júnior2')) return 2;
  if (normalized.includes('junior i') || normalized.includes('júnior i') ||
      normalized.includes('junior1') || normalized.includes('júnior1') ||
      normalized.includes('junior') || normalized.includes('júnior')) return 1;

  // Pleno positions (5-8)
  if (normalized.includes('pleno iv') || normalized.includes('pleno4')) return 8;
  if (normalized.includes('pleno iii') || normalized.includes('pleno3')) return 7;
  if (normalized.includes('pleno ii') || normalized.includes('pleno2')) return 6;
  if (normalized.includes('pleno i') || normalized.includes('pleno1') ||
      normalized.includes('pleno')) return 5;

  // Senior positions (9-12)
  if (normalized.includes('senior iv') || normalized.includes('sênior iv') ||
      normalized.includes('senior4') || normalized.includes('sênior4')) return 12;
  if (normalized.includes('senior iii') || normalized.includes('sênior iii') ||
      normalized.includes('senior3') || normalized.includes('sênior3')) return 11;
  if (normalized.includes('senior ii') || normalized.includes('sênior ii') ||
      normalized.includes('senior2') || normalized.includes('sênior2')) return 10;
  if (normalized.includes('senior i') || normalized.includes('sênior i') ||
      normalized.includes('senior1') || normalized.includes('sênior1') ||
      normalized.includes('senior') || normalized.includes('sênior')) return 9;

  // Default mappings
  if (normalized.includes('auxiliar') || normalized.includes('estagiário')) return 1;

  return 5; // Default to Pleno I
}

/**
 * Calculate position 11 base using polynomial (exactly as in seed database)
 */
function calculatePosition11Base(averageTasksPerUser: number): number {
  const b1 = averageTasksPerUser;
  const polynomial = (
    3.31 * Math.pow(b1, 5) -
    61.07 * Math.pow(b1, 4) +
    364.82 * Math.pow(b1, 3) -
    719.54 * Math.pow(b1, 2) +
    465.16 * b1 -
    3.24
  );
  return polynomial * 0.4; // 40% as per Excel formula
}

/**
 * Calculate cascade values for all positions (exactly as in seed database)
 */
function calculateCascadeValues(position11Base: number): Map<number, number> {
  const values = new Map<number, number>();

  values.set(11, position11Base); // Position 11: Base
  values.set(12, position11Base * 1.05); // Position 12: +5%
  values.set(10, position11Base * (1 - 0.0413)); // Position 10: -4.13%

  const position10 = values.get(10)!;
  const position9 = position10 * (1 - 0.055); // Position 9: Position 10 - 5.5%
  values.set(9, position9);

  // Continue cascade from position 9 down
  const position9Value = values.get(9)!;
  values.set(8, position9Value * (1 - 0.036)); // Position 8: Position 9 - 3.6%
  values.set(7, values.get(8)! * (1 - 0.101)); // Position 7: Position 8 - 10.1%
  values.set(6, values.get(7)! * (1 - 0.1307)); // Position 6: Position 7 - 13.07%
  values.set(5, values.get(6)! * (1 - 0.1702)); // Position 5: Position 6 - 17.02%
  values.set(4, values.get(5)! * (1 - 0.2296)); // Position 4: Position 5 - 22.96%
  values.set(3, values.get(4)! * (1 - 0.3006)); // Position 3: Position 4 - 30.06%
  values.set(2, values.get(3)! * (1 - 0.4003)); // Position 2: Position 3 - 40.03%
  values.set(1, values.get(2)! * (1 - 0.5)); // Position 1: Position 2 - 50%

  return values;
}

/**
 * Calculate bonus value using the correct polynomial-based algorithm from seed database
 */
function calculateCorrectBonusValue(positionName: string, performanceLevel: number, averageTasksPerUser: number): number {
  const positionLevel = getDetailedPositionLevel(positionName);

  // Clamp performance level to valid range (1-5)
  const clampedPerformanceLevel = Math.max(1, Math.min(5, performanceLevel));

  // Step 1: Calculate position 11 base value using polynomial
  const position11Base = calculatePosition11Base(averageTasksPerUser);

  // Step 2: Get cascade values for all positions
  const cascadeValues = calculateCascadeValues(position11Base);

  // Step 3: Get base value for position (direct mapping)
  const positionBase = cascadeValues.get(positionLevel) || 0;

  // Step 4: Apply performance multiplier
  const performanceMultiplier = performanceMultipliers[clampedPerformanceLevel] || 1.0;
  const finalValue = positionBase * performanceMultiplier;

  return Math.round(finalValue * 100) / 100;
}

// Extended User interface for bonus simulation with editable fields
export interface BonusSimulationRow extends User {
  // Editable fields for simulation
  simulatedPositionId?: string;
  simulatedPerformanceLevel?: number;
  // Calculated values
  simulatedBonusAmount?: number;
  // UI state
  isEditingPosition?: boolean;
  isEditingPerformance?: boolean;
}

export interface BonusSimulationColumn {
  key: string;
  header: string;
  accessor: (
    user: BonusSimulationRow,
    averageTasksPerUser: number,
    positions: Position[],
    onUpdate: (userId: string, field: string, value: any) => void
  ) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

// Inline Edit Component for Position
const InlinePositionEditor = ({
  user,
  positions,
  onSave,
  onCancel,
}: {
  user: BonusSimulationRow;
  positions: Position[];
  onSave: (value: string) => void;
  onCancel: () => void;
}) => {
  const [selectedPositionId, setSelectedPositionId] = useState(
    user.simulatedPositionId || user.positionId || ""
  );

  const handleSave = () => {
    onSave(selectedPositionId);
  };

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <Select value={selectedPositionId} onValueChange={setSelectedPositionId}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {positions.filter(p => p.bonifiable === true).map((position) => (
            <SelectItem key={position.id} value={position.id}>
              {position.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="ghost" onClick={handleSave} className="h-8 px-2">
        <IconCheck className="h-3 w-3 text-green-600" />
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 px-2">
        <IconX className="h-3 w-3 text-red-600" />
      </Button>
    </div>
  );
};

// Inline Edit Component for Performance Level
const InlinePerformanceEditor = ({
  user,
  onSave,
  onCancel,
}: {
  user: BonusSimulationRow;
  onSave: (value: number) => void;
  onCancel: () => void;
}) => {
  const [performanceLevel, setPerformanceLevel] = useState(
    String(user.simulatedPerformanceLevel || user.performanceLevel || 1)
  );

  const handleSave = () => {
    const level = parseInt(performanceLevel);
    if (level >= 1 && level <= 5) {
      onSave(level);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Input
        type="number"
        min="1"
        max="5"
        value={performanceLevel}
        onChange={(e) => setPerformanceLevel(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-8 w-16 text-center text-sm"
        autoFocus
      />
      <Button size="sm" variant="ghost" onClick={handleSave} className="h-8 px-2">
        <IconCheck className="h-3 w-3 text-green-600" />
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 px-2">
        <IconX className="h-3 w-3 text-red-600" />
      </Button>
    </div>
  );
};

export const createBonusSimulationColumns = (): BonusSimulationColumn[] => [
  // Name column (non-editable)
  {
    key: "name",
    header: "NOME",
    accessor: (user: BonusSimulationRow) => (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 border border-border/50">
          <span className="text-xs font-semibold text-muted-foreground">
            {user.name?.charAt(0)?.toUpperCase() || "?"}
          </span>
        </div>
        <span className="font-medium truncate max-w-[200px]">{user.name}</span>
      </div>
    ),
    sortable: true,
    className: "min-w-[250px]",
    align: "left",
  },

  // Sector column (non-editable)
  {
    key: "sector",
    header: "SETOR",
    accessor: (user: BonusSimulationRow) => (
      <div className="text-sm">{user.sector?.name || <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Position column (editable dropdown)
  {
    key: "position",
    header: "CARGO",
    accessor: (
      user: BonusSimulationRow,
      averageTasksPerUser: number,
      positions: Position[],
      onUpdate: (userId: string, field: string, value: any) => void
    ) => {
      const currentPosition = positions.find(
        p => p.id === (user.simulatedPositionId || user.positionId)
      ) || user.position;

      if (user.isEditingPosition) {
        return (
          <InlinePositionEditor
            user={user}
            positions={positions}
            onSave={(value) => {
              onUpdate(user.id, "simulatedPositionId", value);
              onUpdate(user.id, "isEditingPosition", false);
            }}
            onCancel={() => onUpdate(user.id, "isEditingPosition", false)}
          />
        );
      }

      return (
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 group"
          onClick={() => onUpdate(user.id, "isEditingPosition", true)}
        >
          <span className="text-sm truncate">
            {currentPosition?.name || <span className="text-muted-foreground">-</span>}
          </span>
          <IconEdit className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      );
    },
    sortable: true,
    className: "min-w-[200px]",
    align: "left",
  },

  // Performance Level column (editable input with validation 1-12)
  {
    key: "performanceLevel",
    header: "NÍVEL PERFORMANCE",
    accessor: (
      user: BonusSimulationRow,
      averageTasksPerUser: number,
      positions: Position[],
      onUpdate: (userId: string, field: string, value: any) => void
    ) => {
      const currentLevel = user.simulatedPerformanceLevel || user.performanceLevel || 1;

      if (user.isEditingPerformance) {
        return (
          <InlinePerformanceEditor
            user={user}
            onSave={(value) => {
              onUpdate(user.id, "simulatedPerformanceLevel", value);
              onUpdate(user.id, "isEditingPerformance", false);
            }}
            onCancel={() => onUpdate(user.id, "isEditingPerformance", false)}
          />
        );
      }

      // Color mapping for performance levels (1-5 range)
      const getVariant = (level: number) => {
        if (level >= 5) return "success"; // 5: excellent (green)
        if (level >= 4) return "info"; // 4: good (blue)
        if (level >= 3) return "warning"; // 3: average (yellow)
        if (level >= 2) return "secondary"; // 2: below average (gray)
        if (level >= 1) return "destructive"; // 1: poor (red)
        return "outline"; // 0: No performance
      };

      return (
        <div
          className="flex items-center justify-center cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 group"
          onClick={() => onUpdate(user.id, "isEditingPerformance", true)}
        >
          <div className="flex items-center gap-2">
            <div className={`
              inline-flex items-center justify-center min-w-[3rem] h-6 px-2 rounded-full text-xs font-medium
              ${getVariant(currentLevel) === "success" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : ""}
              ${getVariant(currentLevel) === "info" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : ""}
              ${getVariant(currentLevel) === "warning" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" : ""}
              ${getVariant(currentLevel) === "secondary" ? "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300" : ""}
              ${getVariant(currentLevel) === "destructive" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : ""}
              ${getVariant(currentLevel) === "outline" ? "bg-muted text-muted-foreground" : ""}
            `}>
              {currentLevel}
            </div>
            <IconEdit className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      );
    },
    sortable: true,
    className: "w-40",
    align: "center",
  },

  // Bonus Amount column (calculated using proper bonus matrix)
  {
    key: "bonusAmount",
    header: "VALOR SIMULADO",
    accessor: (
      user: BonusSimulationRow,
      averageTasksPerUser: number,
      positions: Position[]
    ) => {
      const currentPosition = positions.find(
        p => p.id === (user.simulatedPositionId || user.positionId)
      ) || user.position;

      const performanceLevel = user.simulatedPerformanceLevel || user.performanceLevel || 0;

      if (performanceLevel === 0) {
        return (
          <div className="text-sm font-medium text-right text-muted-foreground">
            Sem bônus
          </div>
        );
      }

      // Calculate using the correct polynomial-based algorithm from db seed
      const bonusAmount = calculateCorrectBonusValue(
        currentPosition?.name || "",
        performanceLevel,
        averageTasksPerUser
      );

      return (
        <div className="text-sm font-medium tabular-nums text-right">
          {formatCurrency(bonusAmount)}
        </div>
      );
    },
    sortable: true,
    className: "w-40",
    align: "right",
  },
];

export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set([
    "name",
    "sector",
    "position",
    "performanceLevel",
    "bonusAmount"
  ]);
};

