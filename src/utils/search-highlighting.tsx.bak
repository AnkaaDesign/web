import React from "react";
import { cn } from "@/lib/utils";

// Types for highlighting configuration
export interface HighlightConfig {
  /** CSS classes for highlighted text */
  highlightClassName?: string;
  /** Case sensitive matching */
  caseSensitive?: boolean;
  /** Match whole words only */
  wholeWordsOnly?: boolean;
  /** Custom highlight renderer */
  renderHighlight?: (text: string, index: number) => React.ReactNode;
  /** Maximum number of highlights per text */
  maxHighlights?: number;
}

export interface SearchMatch {
  /** Start index of match */
  start: number;
  /** End index of match */
  end: number;
  /** Matched text */
  text: string;
  /** Match score/relevance */
  score?: number;
}

// Default highlight configuration
const DEFAULT_HIGHLIGHT_CONFIG: Required<HighlightConfig> = {
  highlightClassName: "bg-yellow-200 dark:bg-yellow-800 font-medium px-0.5 rounded",
  caseSensitive: false,
  wholeWordsOnly: false,
  renderHighlight: (text: string, index: number) => (
    <mark key={index} className={DEFAULT_HIGHLIGHT_CONFIG.highlightClassName}>
      {text}
    </mark>
  ),
  maxHighlights: 50,
};

/**
 * Find all matches of a query in text
 */
export function findMatches(text: string, query: string, config: Partial<HighlightConfig> = {}): SearchMatch[] {
  const { caseSensitive, wholeWordsOnly, maxHighlights } = {
    ...DEFAULT_HIGHLIGHT_CONFIG,
    ...config,
  };

  if (!text || !query) return [];

  const searchText = caseSensitive ? text : text.toLowerCase();
  const searchQuery = caseSensitive ? query : query.toLowerCase();

  const matches: SearchMatch[] = [];
  let lastIndex = 0;

  // Create regex pattern
  let pattern: RegExp;
  if (wholeWordsOnly) {
    pattern = new RegExp(`\\b${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, caseSensitive ? "g" : "gi");
  } else {
    pattern = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), caseSensitive ? "g" : "gi");
  }

  let match;
  while ((match = pattern.exec(text)) !== null && matches.length < maxHighlights) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      score: calculateMatchScore(match[0], searchQuery, match.index, text.length),
    });

    // Prevent infinite loop on zero-length matches
    if (match.index === pattern.lastIndex) {
      pattern.lastIndex++;
    }
  }

  return matches;
}

/**
 * Calculate relevance score for a match
 */
function calculateMatchScore(matchText: string, query: string, position: number, totalLength: number): number {
  let score = 0;

  // Exact match bonus
  if (matchText.toLowerCase() === query.toLowerCase()) {
    score += 100;
  }

  // Position bonus (matches at the beginning are more relevant)
  const positionRatio = 1 - position / totalLength;
  score += positionRatio * 20;

  // Length bonus (shorter matches in context are often more relevant)
  const lengthRatio = query.length / matchText.length;
  score += lengthRatio * 10;

  return score;
}

/**
 * Basic text highlighting function
 */
export function highlightText(text: string, query: string, config: Partial<HighlightConfig> = {}): React.ReactNode {
  const finalConfig = { ...DEFAULT_HIGHLIGHT_CONFIG, ...config };

  if (!text || !query) return text;

  const matches = findMatches(text, query, finalConfig);
  if (matches.length === 0) return text;

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  matches.forEach((match, index) => {
    // Add text before the match
    if (match.start > lastEnd) {
      parts.push(text.substring(lastEnd, match.start));
    }

    // Add highlighted match
    parts.push(finalConfig.renderHighlight(match.text, index));

    lastEnd = match.end;
  });

  // Add remaining text after last match
  if (lastEnd < text.length) {
    parts.push(text.substring(lastEnd));
  }

  return <>{parts}</>;
}

/**
 * Advanced highlighting with multiple queries
 */
export function highlightMultipleQueries(
  text: string,
  queries: string[],
  config: Partial<HighlightConfig> & {
    /** Different colors for different queries */
    queryColors?: string[];
  } = {},
): React.ReactNode {
  const { queryColors = [], ...baseConfig } = config;

  if (!text || queries.length === 0) return text;

  const allMatches: (SearchMatch & { queryIndex: number })[] = [];

  // Find matches for each query
  queries.forEach((query, queryIndex) => {
    if (query) {
      const matches = findMatches(text, query, baseConfig);
      matches.forEach((match) => {
        allMatches.push({ ...match, queryIndex });
      });
    }
  });

  if (allMatches.length === 0) return text;

  // Sort by position and remove overlaps
  allMatches.sort((a, b) => a.start - b.start);
  const nonOverlappingMatches = removeOverlaps(allMatches);

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  nonOverlappingMatches.forEach((match, index) => {
    // Add text before the match
    if (match.start > lastEnd) {
      parts.push(text.substring(lastEnd, match.start));
    }

    // Add highlighted match with query-specific styling
    const colorClass = queryColors[match.queryIndex] || DEFAULT_HIGHLIGHT_CONFIG.highlightClassName;
    parts.push(
      <mark key={index} className={colorClass}>
        {match.text}
      </mark>,
    );

    lastEnd = match.end;
  });

  // Add remaining text after last match
  if (lastEnd < text.length) {
    parts.push(text.substring(lastEnd));
  }

  return <>{parts}</>;
}

/**
 * Remove overlapping matches, keeping the highest scoring ones
 */
function removeOverlaps<T extends SearchMatch>(matches: T[]): T[] {
  if (matches.length <= 1) return matches;

  const result: T[] = [];
  let current = matches[0];

  for (let i = 1; i < matches.length; i++) {
    const next = matches[i];

    // Check if they overlap
    if (next.start < current.end) {
      // Keep the match with higher score
      if ((next.score || 0) > (current.score || 0)) {
        current = next;
      }
    } else {
      // No overlap, add current and move to next
      result.push(current);
      current = next;
    }
  }

  // Add the last match
  result.push(current);

  return result;
}

/**
 * Context-aware highlighting that shows surrounding text
 */
export function highlightWithContext(
  text: string,
  query: string,
  config: Partial<HighlightConfig> & {
    /** Characters to show before and after match */
    contextLength?: number;
    /** Separator between contexts */
    separator?: string;
    /** Maximum number of context snippets */
    maxSnippets?: number;
  } = {},
): React.ReactNode {
  const { contextLength = 50, separator = " ... ", maxSnippets = 3, ...highlightConfig } = config;

  if (!text || !query) return text;

  const matches = findMatches(text, query, highlightConfig);
  if (matches.length === 0) return text;

  // Sort matches by score (highest first)
  const sortedMatches = matches.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, maxSnippets);

  const snippets = sortedMatches.map((match, index) => {
    const start = Math.max(0, match.start - contextLength);
    const end = Math.min(text.length, match.end + contextLength);
    const snippet = text.substring(start, end);

    // Adjust match positions relative to snippet
    const adjustedQuery = query;
    const adjustedMatch = {
      ...match,
      start: match.start - start,
      end: match.end - start,
    };

    return (
      <React.Fragment key={index}>
        {start > 0 && "..."}
        {highlightText(snippet, adjustedQuery, highlightConfig)}
        {end < text.length && "..."}
      </React.Fragment>
    );
  });

  return (
    <>
      {snippets.reduce((acc, snippet, index) => {
        if (index === 0) return [snippet];
        return [...acc, separator, snippet];
      }, [] as React.ReactNode[])}
    </>
  );
}

/**
 * Table cell highlighting component
 */
export interface HighlightedCellProps {
  /** Cell content */
  children: React.ReactNode;
  /** Search query to highlight */
  query?: string;
  /** Multiple queries to highlight */
  queries?: string[];
  /** Highlight configuration */
  config?: Partial<HighlightConfig>;
  /** Cell className */
  className?: string;
}

export function HighlightedCell({ children, query, queries, config, className }: HighlightedCellProps) {
  const text = React.Children.toArray(children).join("");

  let highlightedContent: React.ReactNode;

  if (queries && queries.length > 0) {
    highlightedContent = highlightMultipleQueries(text, queries, config);
  } else if (query) {
    highlightedContent = highlightText(text, query, config);
  } else {
    highlightedContent = children;
  }

  return <span className={cn("search-highlighted-cell", className)}>{highlightedContent}</span>;
}

/**
 * Hook for managing highlighting state
 */
export function useSearchHighlighting(initialQuery: string = "") {
  const [highlightQuery, setHighlightQuery] = React.useState(initialQuery);
  const [highlightQueries, setHighlightQueries] = React.useState<string[]>([]);

  const highlight = React.useCallback(
    (text: string, config?: Partial<HighlightConfig>) => {
      if (highlightQueries.length > 0) {
        return highlightMultipleQueries(text, highlightQueries, config);
      } else if (highlightQuery) {
        return highlightText(text, highlightQuery, config);
      }
      return text;
    },
    [highlightQuery, highlightQueries],
  );

  const addQuery = React.useCallback(
    (query: string) => {
      if (query && !highlightQueries.includes(query)) {
        setHighlightQueries((prev) => [...prev, query]);
      }
    },
    [highlightQueries],
  );

  const removeQuery = React.useCallback((query: string) => {
    setHighlightQueries((prev) => prev.filter((q) => q !== query));
  }, []);

  const clearQueries = React.useCallback(() => {
    setHighlightQuery("");
    setHighlightQueries([]);
  }, []);

  return {
    highlightQuery,
    highlightQueries,
    setHighlightQuery,
    setHighlightQueries,
    addQuery,
    removeQuery,
    clearQueries,
    highlight,
  };
}

/**
 * Search result highlighting presets
 */
export const HIGHLIGHT_PRESETS = {
  primary: {
    highlightClassName: "bg-primary/20 text-primary font-medium px-0.5 rounded",
  },
  secondary: {
    highlightClassName: "bg-secondary/20 text-secondary-foreground font-medium px-0.5 rounded",
  },
  warning: {
    highlightClassName: "bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 font-medium px-0.5 rounded",
  },
  error: {
    highlightClassName: "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 font-medium px-0.5 rounded",
  },
  success: {
    highlightClassName: "bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 font-medium px-0.5 rounded",
  },
  subtle: {
    highlightClassName: "bg-muted text-muted-foreground font-medium px-0.5 rounded",
  },
} as const;

// Export utility functions for common use cases
export const SearchHighlighting = {
  highlight: highlightText,
  highlightMultiple: highlightMultipleQueries,
  highlightWithContext,
  findMatches,
  PRESETS: HIGHLIGHT_PRESETS,
};
