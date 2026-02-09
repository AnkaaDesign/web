import { useState, useCallback } from "react";
import type { GroupByField } from "@/components/common/filters/grouping/GroupBySelector";
import type { Aggregation } from "@/components/common/filters/grouping/AggregationSelector";

export interface GroupByState {
  groups: GroupByField[];
  aggregations: Aggregation[];
}

export interface UseGroupByStateOptions {
  /**
   * Default grouping state
   */
  defaultState?: GroupByState;

  /**
   * Callback when grouping changes
   */
  onChange?: (state: GroupByState) => void;

  /**
   * Maximum number of group levels
   */
  maxGroups?: number;
}

export interface UseGroupByStateReturn {
  /**
   * Current groups
   */
  groups: GroupByField[];

  /**
   * Current aggregations
   */
  aggregations: Aggregation[];

  /**
   * Set groups
   */
  setGroups: (groups: GroupByField[]) => void;

  /**
   * Set aggregations
   */
  setAggregations: (aggregations: Aggregation[]) => void;

  /**
   * Add a group
   */
  addGroup: (field: string, label: string) => void;

  /**
   * Remove a group
   */
  removeGroup: (id: string) => void;

  /**
   * Add an aggregation
   */
  addAggregation: (aggregation: Aggregation) => void;

  /**
   * Remove an aggregation
   */
  removeAggregation: (id: string) => void;

  /**
   * Clear all groupings
   */
  clearGrouping: () => void;

  /**
   * Reset to default grouping
   */
  resetGrouping: () => void;

  /**
   * Check if any grouping is active
   */
  hasActiveGrouping: boolean;

  /**
   * Apply grouping (triggers onChange)
   */
  applyGrouping: () => void;
}

const DEFAULT_STATE: GroupByState = {
  groups: [],
  aggregations: [],
};

export function useGroupByState({
  defaultState = DEFAULT_STATE,
  onChange,
  maxGroups = 3,
}: UseGroupByStateOptions = {}): UseGroupByStateReturn {
  const [groups, setGroupsState] = useState<GroupByField[]>(defaultState.groups);
  const [aggregations, setAggregationsState] = useState<Aggregation[]>(defaultState.aggregations);

  const setGroups = useCallback(
    (newGroups: GroupByField[]) => {
      setGroupsState(newGroups);
      onChange?.({ groups: newGroups, aggregations });
    },
    [aggregations, onChange]
  );

  const setAggregations = useCallback(
    (newAggregations: Aggregation[]) => {
      setAggregationsState(newAggregations);
      onChange?.({ groups, aggregations: newAggregations });
    },
    [groups, onChange]
  );

  const addGroup = useCallback(
    (field: string, label: string) => {
      if (groups.length >= maxGroups) return;

      const newGroup: GroupByField = {
        id: `group-${Date.now()}`,
        field,
        label,
        order: groups.length,
      };

      const newGroups = [...groups, newGroup];
      setGroups(newGroups);
    },
    [groups, maxGroups, setGroups]
  );

  const removeGroup = useCallback(
    (id: string) => {
      const newGroups = groups
        .filter((g) => g.id !== id)
        .map((g, index) => ({ ...g, order: index }));
      setGroups(newGroups);
    },
    [groups, setGroups]
  );

  const addAggregation = useCallback(
    (aggregation: Aggregation) => {
      const newAggregations = [...aggregations, aggregation];
      setAggregations(newAggregations);
    },
    [aggregations, setAggregations]
  );

  const removeAggregation = useCallback(
    (id: string) => {
      const newAggregations = aggregations.filter((a) => a.id !== id);
      setAggregations(newAggregations);
    },
    [aggregations, setAggregations]
  );

  const clearGrouping = useCallback(() => {
    setGroupsState([]);
    setAggregationsState([]);
    onChange?.(DEFAULT_STATE);
  }, [onChange]);

  const resetGrouping = useCallback(() => {
    setGroupsState(defaultState.groups);
    setAggregationsState(defaultState.aggregations);
    onChange?.(defaultState);
  }, [defaultState, onChange]);

  const applyGrouping = useCallback(() => {
    onChange?.({ groups, aggregations });
  }, [groups, aggregations, onChange]);

  const hasActiveGrouping = groups.length > 0 || aggregations.length > 0;

  return {
    groups,
    aggregations,
    setGroups,
    setAggregations,
    addGroup,
    removeGroup,
    addAggregation,
    removeAggregation,
    clearGrouping,
    resetGrouping,
    hasActiveGrouping,
    applyGrouping,
  };
}
