import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconAlertTriangle, IconCircleCheck, IconLoader2, IconMinus, IconPlus, IconPrinter } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { BRAND_ASSETS } from "@/config/assets";
import { taskLabelService, type LabelSheet } from "@/api-client/task-label";
import type { Task } from "../../../../types";
import { LABEL_HEIGHT, LABEL_WIDTH, taskLabelCardMarkup } from "./task-label-card";
import { CAPTION_BASELINE, CAPTION_SIZE, LABEL_SLOTS, SHEET_HEIGHT, SHEET_WIDTH, orientationMarkSvg, taskLabelCaption, type PlacedLabel } from "./task-label-sheet";

// Right-click → "Imprimir Etiquetas": picks the A4 slots for this print and has the SERVER print the
// sheet on the office Epson (photo paper, high quality, 100% — fixed there, nobody touches a dialog).
// A sheet is reused across prints (one truck at a time). Which slots were already printed lives on the
// SERVER — the sheet in the printer is the same for every user — and the next print pre-selects the
// free ones; clicking a printed slot frees it, "Folha nova" frees them all.

const DEFAULT_COPIES = 2; // one label per side of the truck body
const MAX_COPIES = 4;
const JOB_POLL_MS = 2000;
const JOB_GIVE_UP_MS = 5 * 60_000;
const SHEET_KEY = ["task-labels", "sheet"] as const;

/** Serial number, else plate — what tells two trucks of the same customer apart. */
const taskIdentifier = (t: Task) => t.serialNumber || t.truck?.plate || null;
const taskShortLabel = (t: Task) => taskIdentifier(t) || t.name;

// The preview is a sheet of paper: it stays white in dark mode, so its marks use fixed paper
// colours instead of theme tokens (which would turn light-on-white). Outlines stay faint — the
// empty slots and the picked cards' edges — so the cards themselves carry the sheet.
const PAPER = {
  slotStroke: "#D1D5DB",
  slotNumber: "#9CA3AF",
  usedFill: "#E5E7EB",
  usedStroke: "#D1D5DB",
  usedText: "#6B7280",
  extraFill: "#FEF3C7",
  extraStroke: "#F59E0B",
  pickedStroke: "#E5E7EB",
  caption: "#6B7280",
};

type Step = { kind: "pick" } | { kind: "sending" } | { kind: "printing"; jobId: number; messages: string[] };

const errorMessage = (e: unknown) => {
  const data = (e as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message || (e instanceof Error ? e.message : "Não foi possível imprimir as etiquetas.");
};

interface TaskLabelPrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
}

export function TaskLabelPrintModal({ open, onOpenChange, tasks }: TaskLabelPrintModalProps) {
  const queryClient = useQueryClient();
  const [copies, setCopies] = useState<Record<string, number>>({});
  // null = automatic (first free slots); an array = the slots the user picked by hand
  const [manualSlots, setManualSlots] = useState<number[] | null>(null);
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [printError, setPrintError] = useState<string | null>(null);
  const [confirmNewSheet, setConfirmNewSheet] = useState(false);
  const pollRef = useRef<number | null>(null);

  // keyed on the ids, not the array: the page hands a freshly filtered array on every render
  // (live updates), which must not wipe the copies and slots picked so far
  const taskKey = tasks.map((t) => t.id).join(",");
  useEffect(() => {
    if (!open) return;
    setCopies(Object.fromEntries(taskKey.split(",").filter(Boolean).map((id) => [id, DEFAULT_COPIES])));
    setManualSlots(null);
    setStep({ kind: "pick" });
    setPrintError(null);
    setConfirmNewSheet(false);
  }, [open, taskKey]);

  // stop polling a job when the dialog closes or unmounts
  useEffect(() => {
    if (!open && pollRef.current) window.clearTimeout(pollRef.current);
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [open]);

  const printer = useQuery({
    queryKey: ["task-labels", "printer"],
    queryFn: () => taskLabelService.getPrinterStatus(),
    enabled: open,
    refetchInterval: open ? 5000 : false,
    staleTime: 0,
  });

  // shared with every user: refreshed while the dialog is open so a print from elsewhere shows up
  const sheet = useQuery({
    queryKey: SHEET_KEY,
    queryFn: () => taskLabelService.getSheet(),
    enabled: open,
    refetchInterval: open ? 5000 : false,
    staleTime: 0,
  });
  const usedSlots = useMemo(() => new Set(sheet.data?.usedSlots ?? []), [sheet.data]);
  const setSheet = useCallback((next: LabelSheet) => queryClient.setQueryData(SHEET_KEY, next), [queryClient]);

  const totalLabels = useMemo(() => tasks.reduce((sum, t) => sum + (copies[t.id] ?? DEFAULT_COPIES), 0), [tasks, copies]);
  const freeSlots = useMemo(() => LABEL_SLOTS.map((s) => s.index).filter((i) => !usedSlots.has(i)), [usedSlots]);

  const chosenSlots = useMemo(
    // a hand-picked slot someone else printed in the meantime drops out of the pick
    () => (manualSlots ? manualSlots.filter((s) => !usedSlots.has(s)).sort((a, b) => a - b) : freeSlots.slice(0, totalLabels)),
    [manualSlots, usedSlots, freeSlots, totalLabels],
  );

  // labels fill the chosen slots in reading order, each task's copies side by side
  const placed = useMemo<PlacedLabel[]>(() => {
    const sequence = tasks.flatMap((t) => Array.from({ length: copies[t.id] ?? DEFAULT_COPIES }, () => t));
    return chosenSlots
      .slice(0, sequence.length)
      .map((slot, i) => ({ slot, taskId: sequence[i].id, caption: taskLabelCaption(sequence[i].name, taskIdentifier(sequence[i])) }));
  }, [tasks, copies, chosenSlots]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const placedBySlot = useMemo(() => new Map(placed.map((p) => [p.slot, p])), [placed]);

  // card SVG per (task, slot): the QR is rebuilt only when that pair changes
  const cardCache = useMemo(() => new Map<string, string>(), []);
  const cardMarkup = useCallback(
    (taskId: string, slot: number) => {
      const key = `${taskId}:${slot}`;
      let markup = cardCache.get(key);
      if (!markup) {
        markup = taskLabelCardMarkup(taskId, BRAND_ASSETS.logo, `preview-${slot}`);
        cardCache.set(key, markup);
      }
      return markup;
    },
    [cardCache],
  );

  const busy = step.kind !== "pick";
  const mismatch = chosenSlots.length !== totalLabels;
  const notEnoughRoom = !manualSlots && freeSlots.length < totalLabels;
  const printerReady = printer.data?.ready === true;
  // nothing printed yet on this sheet: the print carries the "TOPO" mark (server decides the same way)
  const freshSheet = sheet.isSuccess && usedSlots.size === 0;

  const toggleSlot = useCallback(
    (index: number) => {
      if (busy) return;
      if (usedSlots.has(index)) {
        // clicking a printed slot frees it for everybody (the cut went wrong, or it was marked by mistake)
        taskLabelService
          .releaseSlots([index])
          .then(setSheet)
          .catch((e) => toast.error(errorMessage(e)));
        return;
      }
      const current = manualSlots ?? chosenSlots;
      setManualSlots(current.includes(index) ? current.filter((s) => s !== index) : [...current, index]);
    },
    [busy, usedSlots, manualSlots, chosenSlots, setSheet],
  );

  const changeCopies = (taskId: string, delta: number) => {
    setCopies((prev) => ({ ...prev, [taskId]: Math.min(MAX_COPIES, Math.max(1, (prev[taskId] ?? DEFAULT_COPIES) + delta)) }));
    setManualSlots(null);
  };

  const startNewSheet = async () => {
    try {
      setSheet(await taskLabelService.startNewSheet());
      setManualSlots(null);
      setConfirmNewSheet(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const followJob = useCallback(
    (jobId: number, startedAt: number) => {
      pollRef.current = window.setTimeout(async () => {
        try {
          const job = await taskLabelService.getJob(jobId);
          if (job.done) {
            // the server already marked the slots (and gives them back if the job failed)
            void queryClient.invalidateQueries({ queryKey: SHEET_KEY });
            if (job.success) {
              toast.success("Etiquetas impressas.");
              onOpenChange(false);
            } else {
              setPrintError(job.messages.join(" ") || "A impressora não concluiu a folha.");
              setStep({ kind: "pick" });
            }
            return;
          }
          setStep({ kind: "printing", jobId, messages: job.messages });
          if (Date.now() - startedAt > JOB_GIVE_UP_MS) {
            setPrintError("A impressora está demorando demais. Confira o painel dela antes de imprimir de novo.");
            setStep({ kind: "pick" });
            return;
          }
          followJob(jobId, startedAt);
        } catch (e) {
          // the printer forgets finished jobs quickly: losing track after it was accepted is not a failure
          setPrintError(`Não deu para acompanhar a impressão (${errorMessage(e)}). Confira a folha antes de imprimir de novo.`);
          setStep({ kind: "pick" });
        }
      }, JOB_POLL_MS);
    },
    [queryClient, onOpenChange],
  );

  const handlePrint = async () => {
    setPrintError(null);
    setStep({ kind: "sending" });
    try {
      const { jobId } = await taskLabelService.print(placed.map(({ slot, taskId }) => ({ slot, taskId })));
      setStep({ kind: "printing", jobId, messages: [] });
      void queryClient.invalidateQueries({ queryKey: SHEET_KEY });
      followJob(jobId, Date.now());
    } catch (e) {
      setPrintError(errorMessage(e));
      setStep({ kind: "pick" });
      void printer.refetch();
      void sheet.refetch(); // e.g. a slot was taken by someone else meanwhile
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle>Imprimir etiquetas</DialogTitle>
          <DialogDescription>
            Escolha os espaços da folha A4. Os espaços já impressos valem para todos; clique num deles para liberá-lo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex justify-center rounded-md bg-muted/30 p-3">
            <svg
              viewBox={`0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}`}
              className="h-[520px] max-h-[60vh] w-auto rounded-sm bg-white ring-1 ring-black/5"
              role="group"
              aria-label="Folha A4 com os espaços das etiquetas"
            >
              {freshSheet && placed.length > 0 && <g dangerouslySetInnerHTML={{ __html: orientationMarkSvg() }} />}
              {LABEL_SLOTS.map((slot) => {
                const used = usedSlots.has(slot.index);
                const label = placedBySlot.get(slot.index);
                const chosen = chosenSlots.includes(slot.index);
                const task = label ? taskById.get(label.taskId) : undefined;
                const cx = slot.x + LABEL_WIDTH / 2;
                const cy = slot.y + LABEL_HEIGHT / 2;
                return (
                  <g
                    key={slot.index}
                    role="button"
                    tabIndex={0}
                    aria-label={`Espaço ${slot.index + 1}${used ? ", já impresso" : task ? `, ${taskShortLabel(task)}` : ""}`}
                    onClick={() => toggleSlot(slot.index)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleSlot(slot.index)}
                    className={cn("group cursor-pointer outline-none", busy && "cursor-default")}
                  >
                    {label && !used ? (
                      // what will print: the card, a faint outline where the cut goes, and the caption
                      <>
                        <g transform={`translate(${slot.x} ${slot.y})`} dangerouslySetInnerHTML={{ __html: cardMarkup(label.taskId, slot.index) }} />
                        <rect x={slot.x} y={slot.y} width={LABEL_WIDTH} height={LABEL_HEIGHT} rx={3} fill="none" stroke={PAPER.pickedStroke} strokeWidth={0.35} />
                        <text x={slot.x} y={slot.y - CAPTION_BASELINE} fontSize={CAPTION_SIZE} fontWeight={600} fill={PAPER.caption} className="pointer-events-none select-none">
                          {label.caption}
                        </text>
                      </>
                    ) : (
                      <>
                        <rect
                          x={slot.x}
                          y={slot.y}
                          width={LABEL_WIDTH}
                          height={LABEL_HEIGHT}
                          rx={3}
                          fill={used ? PAPER.usedFill : chosen ? PAPER.extraFill : "#FFFFFF"}
                          stroke={used ? PAPER.usedStroke : chosen ? PAPER.extraStroke : PAPER.slotStroke}
                          strokeWidth={0.4}
                          strokeDasharray={!used && !chosen ? "2 1.5" : undefined}
                          className={cn(!used && !chosen && !busy && "group-hover:fill-[#F3F4F6]")}
                        />
                        <text
                          x={cx}
                          y={cy}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={5}
                          fontWeight={600}
                          fill={used ? PAPER.usedText : PAPER.slotNumber}
                          className="pointer-events-none select-none"
                        >
                          {used ? "impresso" : slot.index + 1}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <PrinterStatusLine loading={printer.isLoading} status={printer.data} step={step} />

            <div>
              <div className="mb-2 text-sm font-medium">Etiquetas por tarefa</div>
              <ul className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
                {tasks.map((t) => {
                  const n = copies[t.id] ?? DEFAULT_COPIES;
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{t.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{taskShortLabel(t)}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Menos uma etiqueta"
                          disabled={busy || n <= 1}
                          onClick={() => changeCopies(t.id, -1)}
                        >
                          <IconMinus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-5 text-center text-sm tabular-nums">{n}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Mais uma etiqueta"
                          disabled={busy || n >= MAX_COPIES}
                          onClick={() => changeCopies(t.id, 1)}
                        >
                          <IconPlus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium tabular-nums">{totalLabels}</span> etiqueta{totalLabels === 1 ? "" : "s"} ·{" "}
                <span className="font-medium tabular-nums">{chosenSlots.length}</span> espaço{chosenSlots.length === 1 ? "" : "s"} escolhido
                {chosenSlots.length === 1 ? "" : "s"} · {freeSlots.length} livre{freeSlots.length === 1 ? "" : "s"} na folha
              </div>
              {notEnoughRoom && <p className="text-destructive">Não há espaços livres suficientes nesta folha. Libere espaços ou reduza as etiquetas.</p>}
              {!notEnoughRoom && mismatch && (
                <p className="text-destructive">
                  Escolha {totalLabels} espaço{totalLabels === 1 ? "" : "s"} — {chosenSlots.length > totalLabels ? "sobram" : "faltam"}{" "}
                  {Math.abs(totalLabels - chosenSlots.length)}.
                </p>
              )}
              {printError && <p className="text-destructive">{printError}</p>}
            </div>

            <p className="mt-auto text-xs text-muted-foreground">
              Papel fotográfico A4 na bandeja de trás, lado de imprimir para a frente. A folha nova sai com "▲ TOPO" nos cantos: recoloque-a
              sempre com o TOPO entrando primeiro.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:items-center sm:space-x-0">
          {/* a fresh sheet frees every slot FOR EVERYBODY: ask once more, in place */}
          <div className="flex flex-wrap items-center gap-2 sm:mr-auto">
            {confirmNewSheet ? (
              <>
                <span className="text-sm">Liberar todos os espaços da folha?</span>
                <Button type="button" size="sm" variant="destructive" onClick={startNewSheet} disabled={busy}>
                  Sim, folha nova
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmNewSheet(false)}>
                  Não
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setConfirmNewSheet(true)} disabled={busy || usedSlots.size === 0}>
                Folha nova
              </Button>
            )}
          </div>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={handlePrint} disabled={busy || !sheet.isSuccess || totalLabels === 0 || mismatch || notEnoughRoom || !printerReady}>
            {busy ? <IconLoader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <IconPrinter className="mr-1.5 h-4 w-4" />}
            {step.kind === "sending" ? "Enviando…" : step.kind === "printing" ? "Imprimindo…" : "Imprimir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrinterStatusLine({
  loading,
  status,
  step,
}: {
  loading: boolean;
  status: Awaited<ReturnType<typeof taskLabelService.getPrinterStatus>> | undefined;
  step: Step;
}) {
  if (step.kind === "sending") return <StatusRow tone="busy" text="Montando a folha e enviando para a impressora…" />;
  if (step.kind === "printing") {
    return <StatusRow tone={step.messages.length ? "warn" : "busy"} text={step.messages.length ? step.messages.join(" ") : "Imprimindo…"} />;
  }
  if (loading || !status) return <StatusRow tone="busy" text="Consultando a impressora…" />;
  if (status.ready) {
    const extra = status.messages.length ? ` (${status.messages.join(" ")})` : "";
    return <StatusRow tone="ok" text={`${status.state === "processing" ? "Impressora ocupada, a folha entra na fila" : "Impressora pronta"}${extra}`} />;
  }
  return <StatusRow tone="warn" text={status.messages.join(" ") || "Impressora indisponível."} />;
}

function StatusRow({ tone, text }: { tone: "ok" | "warn" | "busy"; text: string }) {
  const Icon = tone === "ok" ? IconCircleCheck : tone === "warn" ? IconAlertTriangle : IconLoader2;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm",
        tone === "ok" && "border-green-600/30 text-green-700 dark:text-green-400",
        tone === "warn" && "border-destructive/40 text-destructive",
        tone === "busy" && "text-muted-foreground",
      )}
      role="status"
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "busy" && "animate-spin")} />
      <span>{text}</span>
    </div>
  );
}
