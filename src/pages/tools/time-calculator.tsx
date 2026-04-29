import { useCallback, useEffect, useRef, useState } from "react";
import { IconClock, IconArrowBackUp } from "@tabler/icons-react";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants";
import { cn } from "@/lib/utils";

import {
  evaluateTimeExpression,
  formatMinutesAsHHMM,
} from "@/utils/time-math";

interface HistoryEntry {
  id: string;
  expression: string;
  result: string;
}

const ERROR_DISPLAY = "Erro";
const HISTORY_CAP = 50;

/**
 * Determines whether the display should be replaced (rather than appended to)
 * on the next input. True after `=` evaluation or after an error.
 */
type DisplayMode = "input" | "result" | "error";

/**
 * Find the last fully-evaluable token at the end of `expr`.
 * Used for memory operations where we want the "current value" — if the
 * expression is incomplete, we fall back to the most recent number/time
 * literal we can isolate.
 */
function lastValueMinutes(expr: string): number | null {
  const trimmed = expr.trim();
  if (trimmed.length === 0) return null;

  // Try evaluating the whole thing first.
  const whole = evaluateTimeExpression(trimmed);
  if (whole.ok) return whole.minutes;

  // Walk back to the last operator and evaluate the tail token only.
  let i = trimmed.length - 1;
  while (i >= 0) {
    const ch = trimmed[i];
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") break;
    i--;
  }
  const tail = trimmed.slice(i + 1).trim();
  if (tail.length === 0) return null;
  const tailEval = evaluateTimeExpression(tail);
  return tailEval.ok ? tailEval.minutes : null;
}

/**
 * Apply a single input character to the current expression with HH:MM
 * auto-formatting. Digits typed without an explicit colon are treated as
 * a `HH:MM` literal in the current "slot" (the run of characters since the
 * last operator): the third digit triggers an automatic colon insert, and
 * the slot is capped at four digits + colon.
 */
function applyInputChar(prev: string, ch: string): string {
  // Operators always append.
  if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
    return prev + ch;
  }

  let slotStart = prev.length;
  for (let i = prev.length - 1; i >= 0; i--) {
    const c = prev[i];
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      slotStart = i + 1;
      break;
    }
    if (i === 0) slotStart = 0;
  }
  const slot = prev.slice(slotStart);

  if (ch === ":") {
    if (slot.length === 0 || slot.includes(":")) return prev;
    return prev + ":";
  }

  // Digit input.
  const colonIdx = slot.indexOf(":");
  if (colonIdx >= 0) {
    const minutesPart = slot.slice(colonIdx + 1);
    if (minutesPart.length >= 2) return prev; // HH:MM full
    return prev + ch;
  }

  // No colon yet — auto-insert before the third digit so input formats as HH:MM.
  if (slot.length === 2) {
    return prev + ":" + ch;
  }
  return prev + ch;
}

interface KeyDef {
  key: string;
  label: React.ReactNode;
  variant?: "default" | "operator" | "memory" | "equals" | "danger";
  ariaLabel?: string;
  // CSS grid placement (column / row 1-indexed). When omitted the key uses
  // the natural grid flow.
  col?: number;
  row?: number;
  rowSpan?: number;
}

const KEY_LAYOUT: KeyDef[] = [
  // Row 1 — memory + clear
  { key: "MC", label: "MC", variant: "memory", col: 1, row: 1 },
  { key: "MR", label: "MR", variant: "memory", col: 2, row: 1 },
  { key: "MS", label: "MS", variant: "memory", col: 3, row: 1 },
  { key: "M+", label: "M+", variant: "memory", col: 4, row: 1 },
  { key: "C", label: "C", variant: "danger", col: 5, row: 1 },

  // Row 2
  { key: "7", label: "7", col: 1, row: 2 },
  { key: "8", label: "8", col: 2, row: 2 },
  { key: "9", label: "9", col: 3, row: 2 },
  { key: "+", label: "+", variant: "operator", col: 4, row: 2 },
  {
    key: "BACK",
    label: <IconArrowBackUp className="h-5 w-5" stroke={2} />,
    variant: "danger",
    ariaLabel: "Apagar",
    col: 5,
    row: 2,
  },

  // Row 3
  { key: "4", label: "4", col: 1, row: 3 },
  { key: "5", label: "5", col: 2, row: 3 },
  { key: "6", label: "6", col: 3, row: 3 },
  { key: "-", label: "−", variant: "operator", col: 4, row: 3 },

  // = spans rows 3-5 in column 5
  { key: "=", label: "=", variant: "equals", col: 5, row: 3, rowSpan: 3 },

  // Row 4
  { key: "1", label: "1", col: 1, row: 4 },
  { key: "2", label: "2", col: 2, row: 4 },
  { key: "3", label: "3", col: 3, row: 4 },
  { key: "*", label: "×", variant: "operator", col: 4, row: 4 },

  // Row 5
  { key: "0", label: "0", col: 1, row: 5 },
  { key: ":", label: ":", col: 2, row: 5 },
  { key: "/", label: "÷", variant: "operator", col: 3, row: 5 },
  // col 4, row 5 intentionally empty (matches reference image)
];

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TimeCalculatorPage() {
  const [display, setDisplay] = useState<string>("");
  const [mode, setMode] = useState<DisplayMode>("input");
  const [memoryMinutes, setMemoryMinutes] = useState<number>(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Live preview while typing.
  const livePreview = (() => {
    if (mode === "error" || display.length === 0) return null;
    const ev = evaluateTimeExpression(display);
    return ev.ok ? formatMinutesAsHHMM(ev.minutes) : null;
  })();

  const pushHistory = useCallback((expression: string, result: string) => {
    setHistory((prev) => {
      const next: HistoryEntry[] = [
        { id: genId(), expression, result },
        ...prev,
      ];
      if (next.length > HISTORY_CAP) next.length = HISTORY_CAP;
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setDisplay("");
    setMode("input");
  }, []);

  const handleBackspace = useCallback(() => {
    if (mode === "error" || mode === "result") {
      setDisplay("");
      setMode("input");
      return;
    }
    setDisplay((prev) => {
      let next = prev.slice(0, -1);
      // Strip a now-trailing colon so the slot returns to a clean HH state
      // instead of leaving a dangling separator on screen.
      if (next.endsWith(":")) next = next.slice(0, -1);
      return next;
    });
  }, [mode]);

  const handleEquals = useCallback(() => {
    if (display.trim().length === 0) return;
    const ev = evaluateTimeExpression(display);
    if (!ev.ok) {
      setDisplay(ERROR_DISPLAY);
      setMode("error");
      return;
    }
    const formatted = formatMinutesAsHHMM(ev.minutes);
    pushHistory(display, formatted);
    setDisplay(formatted);
    setMode("result");
  }, [display, pushHistory]);

  const appendChar = useCallback(
    (ch: string) => {
      setDisplay((prev) => {
        if (mode === "error") {
          if (/[0-9]/.test(ch)) return applyInputChar("", ch);
          return "";
        }
        if (mode === "result") {
          if (/[+\-*/]/.test(ch)) return applyInputChar(prev, ch);
          // Digit/colon → start fresh.
          return applyInputChar("", ch);
        }
        return applyInputChar(prev, ch);
      });
      setMode("input");
    },
    [mode],
  );

  const handleMemoryStore = useCallback(() => {
    if (display.trim().length === 0) return;
    const v = lastValueMinutes(display);
    if (v === null) return;
    setMemoryMinutes(v);
  }, [display]);

  const handleMemoryAdd = useCallback(() => {
    if (display.trim().length === 0) return;
    const v = lastValueMinutes(display);
    if (v === null) return;
    setMemoryMinutes((prev) => prev + v);
  }, [display]);

  const handleMemoryClear = useCallback(() => {
    setMemoryMinutes(0);
  }, []);

  const handleMemoryRecall = useCallback(() => {
    const literal = formatMinutesAsHHMM(memoryMinutes);
    // Recalled literal must not start with a "-" — that would parse as an
    // operator. Drop the sign for negatives (calculator can't represent
    // signed literals; user can subtract instead).
    const safe = literal.startsWith("-") ? literal.slice(1) : literal;
    setDisplay((prev) => {
      if (mode === "error") return safe;
      if (mode === "result") return safe;
      return prev + safe;
    });
    setMode("input");
  }, [memoryMinutes, mode]);

  const handleKeyPress = useCallback(
    (key: string) => {
      switch (key) {
        case "C":
          handleClear();
          return;
        case "BACK":
          handleBackspace();
          return;
        case "=":
          handleEquals();
          return;
        case "MC":
          handleMemoryClear();
          return;
        case "MR":
          handleMemoryRecall();
          return;
        case "MS":
          handleMemoryStore();
          return;
        case "M+":
          handleMemoryAdd();
          return;
        default:
          // Digit, colon, or operator.
          appendChar(key);
      }
    },
    [
      appendChar,
      handleBackspace,
      handleClear,
      handleEquals,
      handleMemoryAdd,
      handleMemoryClear,
      handleMemoryRecall,
      handleMemoryStore,
    ],
  );

  // Keyboard support
  const handleKeyPressRef = useRef(handleKeyPress);
  useEffect(() => {
    handleKeyPressRef.current = handleKeyPress;
  }, [handleKeyPress]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is on an input/textarea.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      const k = e.key;
      if (/^[0-9]$/.test(k)) {
        handleKeyPressRef.current(k);
        e.preventDefault();
        return;
      }
      if (k === ":" || k === "+" || k === "-" || k === "*" || k === "/") {
        handleKeyPressRef.current(k);
        e.preventDefault();
        return;
      }
      if (k === "Enter" || k === "=") {
        handleKeyPressRef.current("=");
        e.preventDefault();
        return;
      }
      if (k === "Backspace") {
        handleKeyPressRef.current("BACK");
        e.preventDefault();
        return;
      }
      if (k === "Escape") {
        handleKeyPressRef.current("C");
        e.preventDefault();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleHistoryClick = useCallback((entry: HistoryEntry) => {
    // Recalled result must not start with "-" for the same reason as MR.
    const safe = entry.result.startsWith("-") ? entry.result.slice(1) : entry.result;
    setDisplay(safe);
    setMode("result");
  }, []);

  const handleHistoryClearAll = useCallback(() => {
    setHistory([]);
  }, []);

  const isError = mode === "error";
  const memoryActive = memoryMinutes !== 0;
  const memoryLiteral = formatMinutesAsHHMM(memoryMinutes);

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Calculadora de Horas"
          icon={IconClock}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Ferramentas", href: routes.tools.root },
            { label: "Calculadora de Horas" },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Calculator card */}
          <Card className="lg:col-span-3 flex flex-col">
            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Display */}
              <div
                className={cn(
                  "relative rounded-lg border border-border bg-muted/40 px-4 py-6 sm:py-8 flex flex-col items-end justify-end min-h-[120px] overflow-hidden",
                  isError && "border-destructive",
                )}
                aria-live="polite"
              >
                {memoryActive && (
                  <span
                    className="absolute top-2 left-3 inline-flex items-center justify-center rounded bg-primary/15 text-primary text-[10px] font-bold px-1.5 py-0.5 tracking-wide"
                    title={`Memória: ${memoryLiteral}`}
                  >
                    M
                  </span>
                )}
                <div className="w-full text-right">
                  <div
                    className={cn(
                      "text-sm text-muted-foreground tabular-nums truncate min-h-[1.25rem]",
                      isError && "text-destructive/70",
                    )}
                  >
                    {!isError && livePreview && livePreview !== display ? `= ${livePreview}` : " "}
                  </div>
                  <div
                    className={cn(
                      "font-mono font-bold tabular-nums leading-tight break-all",
                      "text-3xl sm:text-4xl md:text-5xl",
                      isError ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {display.length === 0 ? "0" : display}
                  </div>
                </div>
              </div>

              {/* Keypad */}
              <div
                className="grid gap-2 sm:gap-3"
                style={{
                  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                  gridTemplateRows: "repeat(5, minmax(56px, 1fr))",
                }}
                role="group"
                aria-label="Teclado da calculadora"
              >
                {KEY_LAYOUT.map((k) => {
                  const variant = k.variant ?? "default";
                  const className = cn(
                    "h-full w-full text-lg sm:text-xl font-semibold rounded-md transition-colors",
                    "flex items-center justify-center",
                    variant === "default" &&
                      "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                    variant === "operator" &&
                      "bg-primary/10 text-primary hover:bg-primary/20 font-bold",
                    variant === "memory" &&
                      "bg-muted text-muted-foreground hover:bg-muted/70 text-sm sm:text-base",
                    variant === "danger" &&
                      "bg-destructive/10 text-destructive hover:bg-destructive/20",
                    variant === "equals" &&
                      "bg-primary text-primary-foreground hover:bg-primary/90 text-2xl sm:text-3xl font-bold",
                  );
                  const style: React.CSSProperties = {};
                  if (k.col) style.gridColumn = String(k.col);
                  if (k.row) style.gridRow = k.rowSpan ? `${k.row} / span ${k.rowSpan}` : String(k.row);
                  return (
                    <Button
                      key={k.key}
                      type="button"
                      variant="ghost"
                      onClick={() => handleKeyPress(k.key)}
                      className={className}
                      style={style}
                      aria-label={k.ariaLabel ?? (typeof k.label === "string" ? k.label : k.key)}
                    >
                      {k.label}
                    </Button>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                Os dígitos formatam automaticamente como <span className="font-mono">HH:MM</span> (ex.: digite <span className="font-mono">0130</span> → <span className="font-mono">01:30</span>). Multiplicação e divisão tratam o segundo valor como escalar.
              </p>
            </CardContent>
          </Card>

          {/* History */}
          <Card className="lg:col-span-2 flex flex-col">
            <CardContent className="p-4 sm:p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Histórico</h2>
                {history.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleHistoryClearAll}
                    className="text-xs h-7"
                  >
                    Limpar
                  </Button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground py-12">
                  Nenhum cálculo ainda.
                  <br />
                  Os resultados aparecerão aqui.
                </div>
              ) : (
                <ul className="flex-1 overflow-y-auto space-y-2 -mr-2 pr-2">
                  {history.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => handleHistoryClick(entry)}
                        className="w-full text-left rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors px-3 py-2"
                      >
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {entry.expression}
                        </div>
                        <div className="text-base font-semibold font-mono tabular-nums">
                          = {entry.result}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {memoryActive && (
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
                  <span>Memória</span>
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {memoryLiteral}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default TimeCalculatorPage;
