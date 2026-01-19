import React, { useState } from "react";
import type { User, Position } from "../../../types";
import { formatCurrency } from "../../../utils";
import { calculateBonusForPosition } from "../../../utils/bonus";
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

// =====================
// SINGLE SOURCE OF TRUTH: All bonus calculations are done by the API
// For simulation purposes, we use the centralized calculateBonusForPosition from utils/bonus.ts
// This ensures consistency across web, mobile, and API calculations
// =====================

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
        onChange={(value: string) => setPerformanceLevel(value)}
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
    header: "PERFORMANCE",
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

      // Calculate using the centralized polynomial-based algorithm
      // This ensures consistency with API calculations
      const bonusAmount = calculateBonusForPosition(
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

