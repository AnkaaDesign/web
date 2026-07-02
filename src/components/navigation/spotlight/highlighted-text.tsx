import { useMemo } from "react";

/**
 * Highlights the parts of a text that match the search tokens, accent- and
 * case-insensitively (mirrors the API's normalized matching). Matched
 * fragments get a pulsing red outline so the user sees exactly WHY a result
 * appeared — e.g. searching "31" marks the "31" inside a CPF.
 */

function normalizeWithMap(text: string): { normalized: string; map: number[] } {
  let normalized = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const folded = text[i].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    for (const ch of folded) {
      normalized += ch;
      map.push(i);
    }
  }
  return { normalized, map };
}

function findRanges(text: string, tokens: string[]): Array<[number, number]> {
  const { normalized, map } = normalizeWithMap(text);
  const ranges: Array<[number, number]> = [];

  for (const token of tokens) {
    if (!token) continue;
    let from = 0;
    while (from <= normalized.length - token.length) {
      const index = normalized.indexOf(token, from);
      if (index === -1) break;
      ranges.push([map[index], map[index + token.length - 1] + 1]);
      from = index + token.length;
    }
  }

  // Merge overlapping/adjacent ranges
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push([...range] as [number, number]);
    }
  }
  return merged;
}

/** Original-string index of the first token match (accent/case-insensitive), or -1. */
export function firstMatchIndex(text: string, tokens: string[]): number {
  const ranges = findRanges(text, tokens);
  return ranges.length > 0 ? ranges[0][0] : -1;
}

/**
 * Shortens a long value while keeping the matched fragment visible — CSS
 * truncation cuts the tail, which would hide matches living at the end of
 * long values (e.g. "538" at the end of a chassis number).
 */
export function windowAroundMatch(text: string, tokens: string[], keepBefore = 8, maxLength = 28): string {
  if (text.length <= maxLength) return text;
  const index = firstMatchIndex(text, tokens);
  if (index <= keepBefore) return text;
  return `…${text.slice(index - keepBefore)}`;
}

export function HighlightedText({ text, tokens }: { text: string; tokens: string[] }) {
  const segments = useMemo(() => {
    const ranges = findRanges(text, tokens);
    if (ranges.length === 0) return null;

    const parts: Array<{ value: string; matched: boolean }> = [];
    let cursor = 0;
    for (const [start, end] of ranges) {
      if (start > cursor) parts.push({ value: text.slice(cursor, start), matched: false });
      parts.push({ value: text.slice(start, end), matched: true });
      cursor = end;
    }
    if (cursor < text.length) parts.push({ value: text.slice(cursor), matched: false });
    return parts;
  }, [text, tokens]);

  if (!segments) return <>{text}</>;

  return (
    <>
      {segments.map((segment, index) =>
        segment.matched ? (
          <span key={index} className="relative rounded-[3px] bg-red-500/15 px-0.5 text-inherit">
            {segment.value}
            <span aria-hidden className="pointer-events-none absolute inset-0 animate-pulse rounded-[3px] ring-1 ring-red-500/70" />
          </span>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </>
  );
}
