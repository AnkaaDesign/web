// calculator.tsx
// Calculadora com histórico (/ferramentas/calculadora).
// Operações básicas, porcentagem e parênteses via avaliador de expressão
// próprio (tokenizer + parser recursivo — sem eval(); ver
// utils/calculator-math.ts). Cada "=" registra "expressão = resultado" numa
// fita de histórico clicável (expressão ou resultado voltam ao visor).
//
// Persistência do histórico: reaproveita o armazenamento server-side de
// preferências por página (StatisticsPreferences — pageKey livre + config
// JSON opaco, mesmo mecanismo das páginas de estatísticas), com auto-save
// debounced e sem toasts. Assim o histórico segue o usuário entre
// dispositivos, em vez de ficar preso ao localStorage do navegador.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconArrowBackUp, IconCalculator } from "@tabler/icons-react";
import { z } from "zod";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { routes, FAVORITE_PAGES } from "@/constants";
import { cn } from "@/lib/utils";
import { useStatisticsPagePersistence } from "@/hooks/common/use-statistics-page-persistence";

import { evaluateExpression, formatCalcResult } from "@/utils/calculator-math";

const ERROR_DISPLAY = "Erro";
const HISTORY_CAP = 100;

interface HistoryEntry {
  id: string;
  expression: string;
  result: string;
}

// Config persistida (JSON puro) — validada antes de aplicar.
const calculatorConfigSchema = z.object({
  history: z
    .array(
      z.object({
        id: z.string(),
        expression: z.string(),
        result: z.string(),
      }),
    )
    .max(HISTORY_CAP),
});

type CalculatorConfig = z.infer<typeof calculatorConfigSchema>;

type DisplayMode = "input" | "result" | "error";

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface KeyDef {
  key: string;
  label: React.ReactNode;
  variant?: "default" | "operator" | "equals" | "danger";
  ariaLabel?: string;
  col?: number;
  row?: number;
  colSpan?: number;
}

const KEY_LAYOUT: KeyDef[] = [
  // Row 1 — clear, parênteses, backspace
  { key: "C", label: "C", variant: "danger", col: 1, row: 1 },
  { key: "(", label: "(", variant: "operator", col: 2, row: 1 },
  { key: ")", label: ")", variant: "operator", col: 3, row: 1 },
  {
    key: "BACK",
    label: <IconArrowBackUp className="h-5 w-5" stroke={2} />,
    variant: "danger",
    ariaLabel: "Apagar",
    col: 4,
    row: 1,
  },

  // Row 2
  { key: "7", label: "7", col: 1, row: 2 },
  { key: "8", label: "8", col: 2, row: 2 },
  { key: "9", label: "9", col: 3, row: 2 },
  { key: "/", label: "÷", variant: "operator", col: 4, row: 2 },

  // Row 3
  { key: "4", label: "4", col: 1, row: 3 },
  { key: "5", label: "5", col: 2, row: 3 },
  { key: "6", label: "6", col: 3, row: 3 },
  { key: "*", label: "×", variant: "operator", col: 4, row: 3 },

  // Row 4
  { key: "1", label: "1", col: 1, row: 4 },
  { key: "2", label: "2", col: 2, row: 4 },
  { key: "3", label: "3", col: 3, row: 4 },
  { key: "-", label: "−", variant: "operator", col: 4, row: 4 },

  // Row 5
  { key: "0", label: "0", col: 1, row: 5 },
  { key: ",", label: ",", col: 2, row: 5 },
  { key: "%", label: "%", variant: "operator", col: 3, row: 5 },
  { key: "+", label: "+", variant: "operator", col: 4, row: 5 },

  // Row 6 — equals em toda a largura
  { key: "=", label: "=", variant: "equals", col: 1, row: 6, colSpan: 4 },
];

export function CalculatorPage() {
  const [display, setDisplay] = useState<string>("");
  const [mode, setMode] = useState<DisplayMode>("input");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // ---- Persistência server-side do histórico --------------------------
  const persistedConfig = useMemo<CalculatorConfig>(() => ({ history }), [history]);
  const applyConfig = useCallback((config: CalculatorConfig) => {
    setHistory(config.history);
  }, []);
  const { isRestoring } = useStatisticsPagePersistence<CalculatorConfig>({
    pageKey: routes.tools.calculator.root,
    schema: calculatorConfigSchema,
    current: persistedConfig,
    apply: applyConfig,
  });

  // Live preview enquanto digita.
  const livePreview = (() => {
    if (mode !== "input" || display.trim().length === 0) return null;
    const ev = evaluateExpression(display);
    return ev.ok ? formatCalcResult(ev.value) : null;
  })();

  const pushHistory = useCallback((expression: string, result: string) => {
    setHistory((prev) => {
      const next: HistoryEntry[] = [{ id: genId(), expression, result }, ...prev];
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
    setDisplay((prev) => prev.slice(0, -1));
  }, [mode]);

  const handleEquals = useCallback(() => {
    if (mode !== "input" || display.trim().length === 0) return;
    const ev = evaluateExpression(display);
    if (!ev.ok) {
      setDisplay(ERROR_DISPLAY);
      setMode("error");
      return;
    }
    const formatted = formatCalcResult(ev.value);
    pushHistory(display, formatted);
    setDisplay(formatted);
    setMode("result");
  }, [display, mode, pushHistory]);

  const appendChar = useCallback(
    (ch: string) => {
      setDisplay((prev) => {
        if (mode === "error") {
          // Após erro, qualquer tecla recomeça do zero.
          return /[0-9,(]/.test(ch) ? ch : "";
        }
        if (mode === "result") {
          // Operador continua a conta a partir do resultado; dígito recomeça.
          if (/[+\-*/%]/.test(ch)) return prev + ch;
          return /[0-9,(]/.test(ch) ? ch : prev;
        }
        return prev + ch;
      });
      setMode("input");
    },
    [mode],
  );

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
        default:
          appendChar(key);
      }
    },
    [appendChar, handleBackspace, handleClear, handleEquals],
  );

  // Teclado físico.
  const handleKeyPressRef = useRef(handleKeyPress);
  useEffect(() => {
    handleKeyPressRef.current = handleKeyPress;
  }, [handleKeyPress]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      const k = e.key;
      if (/^[0-9]$/.test(k) || "+-*/()%".includes(k)) {
        handleKeyPressRef.current(k);
        e.preventDefault();
        return;
      }
      if (k === "," || k === ".") {
        handleKeyPressRef.current(",");
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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Reuso do histórico: expressão volta editável; resultado volta como base.
  const reuseExpression = useCallback((entry: HistoryEntry) => {
    setDisplay(entry.expression);
    setMode("input");
  }, []);

  const reuseResult = useCallback((entry: HistoryEntry) => {
    setDisplay(entry.result);
    setMode("result");
  }, []);

  const handleHistoryClearAll = useCallback(() => {
    setHistory([]);
  }, []);

  const isError = mode === "error";

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Calculadora"
          icon={IconCalculator}
          favoritePage={FAVORITE_PAGES.FERRAMENTAS_CALCULADORA}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Ferramentas", href: routes.tools.root },
            { label: "Calculadora" },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Calculadora */}
          <Card className="lg:col-span-3 flex flex-col">
            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Visor */}
              <div
                className={cn(
                  "relative rounded-lg border border-border bg-muted/40 px-4 py-6 sm:py-8 flex flex-col items-end justify-end min-h-[120px] overflow-hidden",
                  isError && "border-destructive",
                )}
                aria-live="polite"
              >
                <div className="w-full text-right">
                  <div
                    className={cn(
                      "text-sm text-muted-foreground tabular-nums truncate min-h-[1.25rem]",
                      isError && "text-destructive/70",
                    )}
                  >
                    {livePreview && livePreview !== display ? `= ${livePreview}` : " "}
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

              {/* Teclado */}
              <div
                className="grid gap-2 sm:gap-3"
                style={{
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gridTemplateRows: "repeat(6, minmax(52px, 1fr))",
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
                    variant === "danger" &&
                      "bg-destructive/10 text-destructive hover:bg-destructive/20",
                    variant === "equals" &&
                      "bg-primary text-primary-foreground hover:bg-primary/90 text-2xl sm:text-3xl font-bold",
                  );
                  const style: React.CSSProperties = {};
                  if (k.col) style.gridColumn = k.colSpan ? `${k.col} / span ${k.colSpan}` : String(k.col);
                  if (k.row) style.gridRow = String(k.row);
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
                Aceita parênteses e porcentagem: <span className="font-mono">100 + 10%</span> ={" "}
                <span className="font-mono">110</span>; <span className="font-mono">200 × 10%</span> ={" "}
                <span className="font-mono">20</span>. Decimais com vírgula.
              </p>
            </CardContent>
          </Card>

          {/* Histórico */}
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
                  {isRestoring ? (
                    "Carregando histórico..."
                  ) : (
                    <span>
                      Nenhum cálculo ainda.
                      <br />
                      Os resultados aparecerão aqui.
                    </span>
                  )}
                </div>
              ) : (
                <ul className="flex-1 overflow-y-auto space-y-2 -mr-2 pr-2">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => reuseExpression(entry)}
                        title="Reutilizar a expressão"
                        className="w-full text-left px-3 pt-2 text-xs text-muted-foreground font-mono truncate hover:text-foreground"
                      >
                        {entry.expression}
                      </button>
                      <button
                        type="button"
                        onClick={() => reuseResult(entry)}
                        title="Reutilizar o resultado"
                        className="w-full text-left px-3 pb-2 text-base font-semibold font-mono tabular-nums"
                      >
                        = {entry.result}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CalculatorPage;
