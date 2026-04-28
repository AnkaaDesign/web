import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, routes } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPrinter,
  IconTrash,
  IconEye,
  IconArrowLeft,
  IconSearch,
  IconLink,
} from "@tabler/icons-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { cmykToRgb, rgbToHex, buildRange, cellId, parseCellId, parseColorToRgb, findClosestCell } from "./cmyk-utils";
import { useColorGridCanvas, cellsInRect } from "./use-color-grid-canvas";
import { ColorDetailDialog } from "./color-detail-dialog";

// K (Black): 5% → 55%, Y (Yellow): 0% → 100%
const K_LEVELS = Array.from({ length: 11 }, (_, i) => (i + 1) * 5);
const Y_LEVELS = Array.from({ length: 21 }, (_, i) => i * 5);

const STEP_OPTIONS = [
  { value: "5", label: "5%" },
  { value: "10", label: "10%" },
  { value: "15", label: "15%" },
  { value: "20", label: "20%" },
];

export default function TrueColorSystemPage() {
  usePageTracker({ title: "Paleta", icon: "color" });

  // --- State ---
  const [kIndex, setKIndex] = useState(0);
  const [yIndex, setYIndex] = useState(Y_LEVELS.indexOf(40));
  const [step, setStep] = useState(5);
  const [cMin, setCMin] = useState(0);
  const [cMax, setCMax] = useState(100);
  const [mMin, setMMin] = useState(0);
  const [mMax, setMMax] = useState(100);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showSelected, setShowSelected] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [linked, setLinked] = useState(false);

  // Marquee drag state
  const [dragging, setDragging] = useState(false);
  const [marquee, setMarquee] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Hover tooltip
  const [hoverInfo, setHoverInfo] = useState<{
    c: number;
    m: number;
    hex: string;
    x: number;
    y: number;
  } | null>(null);

  // Color detail dialog (right-click)
  const [detailCell, setDetailCell] = useState<{
    y: number;
    k: number;
    c: number;
    m: number;
  } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [printColsDialogOpen, setPrintColsDialogOpen] = useState(false);
  const [confirmDeselectOpen, setConfirmDeselectOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const gridAreaRef = useRef<HTMLDivElement>(null);
  const selectedCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectedHostRef = useRef<HTMLDivElement>(null);
  const { drawGrid, hitTest } = useColorGridCanvas();

  const currentK = K_LEVELS[kIndex];
  const currentY = Y_LEVELS[yIndex];

  // When linked, K and Y move in opposite directions by the same step (atomic).
  const moveK = useCallback(
    (delta: 1 | -1) => {
      const newK = kIndex + delta;
      if (newK < 0 || newK >= K_LEVELS.length) return;
      if (linked) {
        const newY = yIndex - delta;
        if (newY < 0 || newY >= Y_LEVELS.length) return;
        setKIndex(newK);
        setYIndex(newY);
      } else {
        setKIndex(newK);
      }
    },
    [kIndex, yIndex, linked],
  );

  const moveY = useCallback(
    (delta: 1 | -1) => {
      const newY = yIndex + delta;
      if (newY < 0 || newY >= Y_LEVELS.length) return;
      if (linked) {
        const newK = kIndex - delta;
        if (newK < 0 || newK >= K_LEVELS.length) return;
        setYIndex(newY);
        setKIndex(newK);
      } else {
        setYIndex(newY);
      }
    },
    [kIndex, yIndex, linked],
  );

  const kPrevDisabled = kIndex <= 0 || (linked && yIndex >= Y_LEVELS.length - 1);
  const kNextDisabled = kIndex >= K_LEVELS.length - 1 || (linked && yIndex <= 0);
  const yPrevDisabled = yIndex <= 0 || (linked && kIndex >= K_LEVELS.length - 1);
  const yNextDisabled = yIndex >= Y_LEVELS.length - 1 || (linked && kIndex <= 0);

  const mVals = useMemo(() => buildRange(step, mMin, mMax), [step, mMin, mMax]);
  const cVals = useMemo(() => buildRange(step, cMin, cMax), [step, cMin, cMax]);
  const isEmpty = mVals.length === 0 || cVals.length === 0;

  // Track the actual grid-area dimensions so the canvas can fill all available space
  const [gridAreaSize, setGridAreaSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    const node = gridAreaRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setGridAreaSize({ w: r.width, h: r.height });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const hostStyle = useMemo(() => {
    const Nm = mVals.length;
    const Nc = cVals.length;
    if (!Nm || !Nc || gridAreaSize.w === 0 || gridAreaSize.h === 0) return undefined;
    // Reserve room for tick numbers (left ~28px) and axis labels (top ~32px, bottom ~20px)
    const reservedW = 32;
    const reservedH = 56;
    const availW = Math.max(40, gridAreaSize.w - reservedW);
    const availH = Math.max(40, gridAreaSize.h - reservedH);
    const ratio = Nm / Nc;
    const w = Math.min(availW, availH * ratio);
    const h = w / ratio;
    return { width: `${w}px`, height: `${h}px` };
  }, [gridAreaSize, mVals.length, cVals.length]);

  // --- Drawing ---
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawGrid({
      canvas,
      y: currentY,
      k: currentK,
      step,
      cMin,
      cMax,
      mMin,
      mMax,
      selected,
      selectionMode: true,
    });
  }, [drawGrid, currentY, currentK, step, cMin, cMax, mMin, mMax, selected]);

  useEffect(() => {
    if (!showSelected) {
      // Canvas may have just remounted — wait for layout
      requestAnimationFrame(() => redraw());
    }
  }, [redraw, showSelected]);

  useEffect(() => {
    const ro = new ResizeObserver(() => { if (!showSelected) redraw(); });
    if (hostRef.current) ro.observe(hostRef.current);
    return () => ro.disconnect();
  }, [redraw, showSelected]);

  // --- Selected-view drawing ---
  const selectedCells = useMemo(() => {
    if (selected.size === 0) return [];
    return Array.from(selected)
      .map(parseCellId)
      .filter(Boolean) as { y: number; k: number; c: number; m: number }[];
  }, [selected]);

  const drawSelectedGrid = useCallback(() => {
    const canvas = selectedCanvasRef.current;
    const host = selectedHostRef.current;
    if (!canvas || !host || selectedCells.length === 0) return;

    const rect = host.getBoundingClientRect();
    const availW = rect.width;
    const availH = rect.height;
    const N = selectedCells.length;

    // Fill the full available area without scrolling — choose cols based on the
    // host aspect ratio so cells stay roughly square, then size them to fit both axes.
    const aspect = availH > 0 ? availW / availH : 1;
    const cols = Math.max(1, Math.min(N, Math.round(Math.sqrt(N * aspect)) || 1));
    const rows = Math.ceil(N / cols);
    const cellPx = Math.max(4, Math.floor(Math.min(availW / cols, availH / rows)));
    const chartW = cols * cellPx;
    const chartH = rows * cellPx;
    const gap = Math.max(1.5, Math.min(3.5, cellPx * 0.07));

    const dpr = window.devicePixelRatio || 1;
    canvas.width = chartW * dpr;
    canvas.height = chartH * dpr;
    canvas.style.width = chartW + "px";
    canvas.style.height = chartH + "px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, chartW, chartH);

    selectedCells.forEach((cell, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const [r, g, b] = cmykToRgb(cell.c, cell.m, cell.y, cell.k);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(
        col * cellPx + gap / 2,
        row * cellPx + gap / 2,
        cellPx - gap,
        cellPx - gap,
      );
    });
  }, [selectedCells]);

  useEffect(() => {
    if (showSelected) drawSelectedGrid();
  }, [showSelected, drawSelectedGrid]);

  useEffect(() => {
    if (!showSelected) return;
    const ro = new ResizeObserver(() => drawSelectedGrid());
    if (selectedHostRef.current) ro.observe(selectedHostRef.current);
    return () => ro.disconnect();
  }, [showSelected, drawSelectedGrid]);

  // --- Keyboard navigation ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key) {
        case "ArrowLeft":
          moveY(-1);
          break;
        case "ArrowRight":
          moveY(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveK(-1);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveK(1);
          break;
        case "Escape":
          setDetailOpen(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveK, moveY]);

  // --- Helpers to convert between grid-area coords and canvas coords ---
  const toGridAreaCoords = useCallback((clientX: number, clientY: number) => {
    const area = gridAreaRef.current;
    if (!area) return { x: 0, y: 0 };
    const rect = area.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  // Resolve marquee selection against the canvas
  const resolveMarqueeSelection = useCallback(
    (finalMarquee: { x1: number; y1: number; x2: number; y2: number }, shiftKey: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Convert grid-area marquee corners to canvas-relative coords for cell hit-testing
      const area = gridAreaRef.current;
      if (!area) return;
      const areaRect = area.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const toCanvas = (gx: number, gy: number) => ({
        x: Math.max(0, Math.min(gx + areaRect.left - canvasRect.left, canvasRect.width)),
        y: Math.max(0, Math.min(gy + areaRect.top - canvasRect.top, canvasRect.height)),
      });
      const c1 = toCanvas(finalMarquee.x1, finalMarquee.y1);
      const c2 = toCanvas(finalMarquee.x2, finalMarquee.y2);
      const canvasMarquee = { x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y };

      const ids = cellsInRect(canvasMarquee, canvas, currentY, currentK, step, cMin, cMax, mMin, mMax);
      if (ids.length === 0) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (!shiftKey) {
          for (const id of prev) {
            if (id.startsWith(`y${currentY}|k${currentK}|`)) {
              next.delete(id);
            }
          }
        }
        ids.forEach((id) => next.add(id));
        return next;
      });
    },
    [currentY, currentK, step, cMin, cMax, mMin, mMax],
  );

  // --- Grid area mouse handlers (drag can start anywhere in the grid area) ---
  const handleGridAreaMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const pos = toGridAreaCoords(e.clientX, e.clientY);
      dragStartRef.current = pos;
      setDragging(true);
      setMarquee({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    },
    [toGridAreaCoords],
  );

  const handleGridAreaMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Marquee dragging
      if (dragging && dragStartRef.current) {
        const pos = toGridAreaCoords(e.clientX, e.clientY);
        setMarquee({
          x1: dragStartRef.current.x,
          y1: dragStartRef.current.y,
          x2: pos.x,
          y2: pos.y,
        });
        return;
      }

      // Hover tooltip (only when mouse is over the canvas)
      const canvas = canvasRef.current;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      if (
        e.clientX >= canvasRect.left &&
        e.clientX <= canvasRect.right &&
        e.clientY >= canvasRect.top &&
        e.clientY <= canvasRect.bottom
      ) {
        const hit = hitTest(canvas, e.clientX, e.clientY, step, cMin, cMax, mMin, mMax);
        if (hit) {
          const [r, g, b] = cmykToRgb(hit.c, hit.m, currentY, currentK);
          setHoverInfo({
            c: hit.c,
            m: hit.m,
            hex: rgbToHex(r, g, b),
            x: e.clientX,
            y: e.clientY,
          });
        }
      } else {
        setHoverInfo(null);
      }
    },
    [dragging, toGridAreaCoords, hitTest, step, cMin, cMax, mMin, mMax, currentY, currentK],
  );

  const handleGridAreaMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragging || !marquee) {
        setDragging(false);
        dragStartRef.current = null;
        setMarquee(null);
        return;
      }

      const dx = Math.abs(marquee.x2 - marquee.x1);
      const dy = Math.abs(marquee.y2 - marquee.y1);
      if (dx > 3 || dy > 3) {
        resolveMarqueeSelection(marquee, e.shiftKey);
      } else {
        // Small click — toggle cell if on canvas, otherwise clear selection
        const canvas = canvasRef.current;
        const canvasRect = canvas?.getBoundingClientRect();
        const isOnCanvas =
          canvas &&
          canvasRect &&
          e.clientX >= canvasRect.left &&
          e.clientX <= canvasRect.right &&
          e.clientY >= canvasRect.top &&
          e.clientY <= canvasRect.bottom;

        if (isOnCanvas) {
          const hit = hitTest(canvas, e.clientX, e.clientY, step, cMin, cMax, mMin, mMax);
          if (hit) {
            const id = cellId(currentY, currentK, hit.c, hit.m);
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }
        } else {
          // Clicked outside canvas → select all of current page if empty,
          // or confirm before deselecting if any selection exists on current page
          const prefix = `y${currentY}|k${currentK}|`;
          let hasCurrentPageSelection = false;
          for (const id of selected) {
            if (id.startsWith(prefix)) {
              hasCurrentPageSelection = true;
              break;
            }
          }
          if (!hasCurrentPageSelection) {
            // Select every cell of the current page (within active filter)
            setSelected((prev) => {
              const next = new Set(prev);
              for (const cv of cVals) {
                for (const mv of mVals) {
                  next.add(cellId(currentY, currentK, cv, mv));
                }
              }
              return next;
            });
          } else {
            setConfirmDeselectOpen(true);
          }
        }
      }

      setDragging(false);
      dragStartRef.current = null;
      setMarquee(null);
    },
    [dragging, marquee, resolveMarqueeSelection, hitTest, step, cMin, cMax, mMin, mMax, currentY, currentK, selected, cVals, mVals],
  );

  const handleGridAreaMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setHoverInfo(null);
      if (dragging && marquee) {
        const pos = toGridAreaCoords(e.clientX, e.clientY);
        resolveMarqueeSelection({ ...marquee, x2: pos.x, y2: pos.y }, e.shiftKey);
        setDragging(false);
        dragStartRef.current = null;
        setMarquee(null);
      }
    },
    [dragging, marquee, toGridAreaCoords, resolveMarqueeSelection],
  );

  // Right-click on canvas → color detail
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      if (
        e.clientX < canvasRect.left ||
        e.clientX > canvasRect.right ||
        e.clientY < canvasRect.top ||
        e.clientY > canvasRect.bottom
      ) return;
      e.preventDefault();
      const hit = hitTest(canvas, e.clientX, e.clientY, step, cMin, cMax, mMin, mMax);
      if (hit) {
        setDetailCell({ y: currentY, k: currentK, c: hit.c, m: hit.m });
        setDetailOpen(true);
      }
    },
    [hitTest, step, cMin, cMax, mMin, mMax, currentY, currentK],
  );

  // --- Color search ---
  const handleSearch = useCallback(() => {
    const rgb = parseColorToRgb(searchValue);
    if (!rgb) return;

    const result = findClosestCell(rgb[0], rgb[1], rgb[2], step, K_LEVELS, Y_LEVELS);

    // Navigate to the matching K/Y page
    const kIdx = K_LEVELS.indexOf(result.k);
    const yIdx = Y_LEVELS.indexOf(result.y);
    if (kIdx >= 0) setKIndex(kIdx);
    if (yIdx >= 0) setYIndex(yIdx);

    // Select the cell
    const id = cellId(result.y, result.k, result.c, result.m);
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    setShowSelected(false);
    setSearchValue("");
  }, [searchValue, step]);

  const printSelectedWithCols = useCallback((printCols: number) => {
    const container = document.createElement("div");
    container.id = "tcs-print-root";
    container.style.cssText = "position:fixed;inset:0;z-index:99999;background:#fff;display:none;flex-direction:column;align-items:center;justify-content:start;padding:4px;";

    const N = selectedCells.length;
    if (N === 0) return;
    const cols = printCols;
    const totalRows = Math.ceil(N / cols);
    const pageW = 760;
    const cellPx = Math.max(4, Math.floor(pageW / cols));
    const gap = Math.max(1, Math.floor(cellPx * 0.06));
    const rowW = cols * cellPx;

    // Render each row as a separate canvas so page breaks never cut a row
    for (let r = 0; r < totalRows; r++) {
      const canvas = document.createElement("canvas");
      canvas.width = rowW * 2;
      canvas.height = cellPx * 2;
      canvas.style.cssText = `width:${rowW}px;height:${cellPx}px;display:block;break-inside:avoid;page-break-inside:avoid;`;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);

      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= N) break;
        const cell = selectedCells[idx];
        const [rv, gv, bv] = cmykToRgb(cell.c, cell.m, cell.y, cell.k);
        ctx.fillStyle = `rgb(${rv},${gv},${bv})`;
        ctx.fillRect(c * cellPx + gap / 2, gap / 2, cellPx - gap, cellPx - gap);
      }
      container.appendChild(canvas);
    }

    const style = document.createElement("style");
    style.textContent = `
      @media print {
        html, body { background: white !important; }
        body > *:not(#tcs-print-root) { display: none !important; }
        #tcs-print-root {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          position: static !important;
          width: 100% !important;
          height: auto !important;
          background: white !important;
        }
        #tcs-print-root canvas {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        *, *::before, *::after {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
      @page { margin: 0.2in; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);

    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => {
        document.body.removeChild(container);
        document.head.removeChild(style);
      }, 500);
    });
  }, [selectedCells]);

  const handlePrint = useCallback(() => {
    if (selectedCells.length > 0) {
      setPrintColsDialogOpen(true);
      return;
    }

    // === Print normal view ===
    const container = document.createElement("div");
    container.id = "tcs-print-root";
    container.style.cssText = "position:fixed;inset:0;z-index:99999;background:#fff;display:none;flex-direction:column;align-items:center;justify-content:start;padding:20px 4px 4px;";

    {
      // === Print normal view: K/Y badges + axis labels + ticks + grid ===
      const vC = buildRange(step, cMin, cMax);
      const vM = buildRange(step, mMin, mMax);
      const Nc = vC.length;
      const Nm = vM.length;
      if (Nc === 0 || Nm === 0) return;

      const tickSpace = 24;
      // Maximize: full A4 at 96dpi ≈ 794 x 1122px
      const maxW = 760 - tickSpace;
      const maxH = 1060;
      const cellPx = Math.max(4, Math.min(Math.floor(maxW / Nm), Math.floor(maxH / Nc)));
      const chartW = cellPx * Nm;
      const chartH = cellPx * Nc;
      const gap = Math.max(1.5, Math.min(3.5, cellPx * 0.07));

      // Outer wrapper
      const outer = document.createElement("div");
      outer.style.cssText = `display:flex;flex-direction:column;align-items:flex-start;`;

      // Top row: K/Y badges on the left, "MAGENTA →" on the right — same baseline
      const topRow = document.createElement("div");
      topRow.style.cssText = `display:flex;align-items:flex-end;justify-content:space-between;width:${chartW + tickSpace}px;padding-left:${tickSpace}px;margin-bottom:2px;`;
      topRow.innerHTML =
        `<div style="display:flex;gap:6px;">` +
          `<span style="background:#1d1d1f;color:#fff;font-size:11px;font-weight:500;padding:2px 10px;border-radius:5px;">K ${currentK}%</span>` +
          `<span style="background:#fbbf24;color:#1d1d1f;font-size:11px;font-weight:500;padding:2px 10px;border-radius:5px;">Y ${currentY}%</span>` +
        `</div>` +
        `<div style="font-size:9px;font-weight:700;letter-spacing:0.16em;color:#666;">MAGENTA →</div>`;
      outer.appendChild(topRow);

      // Grid wrapper — margin-top provides space for tick numbers only
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `position:relative;width:${chartW}px;height:${chartH}px;margin-left:${tickSpace}px;margin-top:14px;`;

      // "↓ CIANO" label
      const cLabel = document.createElement("div");
      cLabel.textContent = "↓ CIANO";
      cLabel.style.cssText = `position:absolute;bottom:-18px;left:0;font-size:9px;font-weight:700;letter-spacing:0.16em;color:#666;`;
      wrapper.appendChild(cLabel);

      // Top ticks (Magenta)
      vM.forEach((v, i) => {
        const tick = document.createElement("span");
        tick.textContent = String(v);
        tick.style.cssText = `position:absolute;top:-13px;left:${((i + 0.5) / Nm) * chartW}px;transform:translateX(-50%);font-size:8px;font-weight:600;color:#666;font-family:monospace;`;
        wrapper.appendChild(tick);
      });

      // Left ticks (Cyan)
      vC.forEach((v, i) => {
        const tick = document.createElement("span");
        tick.textContent = String(v);
        tick.style.cssText = `position:absolute;left:-${tickSpace}px;top:${((i + 0.5) / Nc) * chartH}px;transform:translateY(-50%);font-size:8px;font-weight:600;color:#666;font-family:monospace;text-align:right;width:${tickSpace - 4}px;`;
        wrapper.appendChild(tick);
      });

      // Canvas
      const canvas = document.createElement("canvas");
      canvas.width = chartW * 2;
      canvas.height = chartH * 2;
      canvas.style.cssText = `width:${chartW}px;height:${chartH}px;display:block;`;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);

      for (let row = 0; row < Nc; row++) {
        for (let col = 0; col < Nm; col++) {
          const [r, g, b] = cmykToRgb(vC[row], vM[col], currentY, currentK);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(col * cellPx + gap / 2, row * cellPx + gap / 2, cellPx - gap, cellPx - gap);
        }
      }
      wrapper.appendChild(canvas);
      outer.appendChild(wrapper);
      container.appendChild(outer);
    }

    // Inject print stylesheet + container, print, then clean up
    const style = document.createElement("style");
    style.textContent = `
      @media print {
        html, body { background: white !important; }
        body > *:not(#tcs-print-root) { display: none !important; }
        #tcs-print-root {
          display: flex !important;
          position: static !important;
          width: 100% !important;
          height: auto !important;
          background: white !important;
        }
        *, *::before, *::after {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
      @page { margin: 0.2in; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);

    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => {
        document.body.removeChild(container);
        document.head.removeChild(style);
      }, 500);
    });
  }, [selectedCells.length, currentY, currentK, step, cMin, cMax, mMin, mMax]);
  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setShowSelected(false);
  }, []);
  const selectionCount = selected.size;

  const handleConfirmDeselect = useCallback(() => {
    setSelected((prev) => {
      const prefix = `y${currentY}|k${currentK}|`;
      const next = new Set<string>();
      for (const id of prev) {
        if (!id.startsWith(prefix)) next.add(id);
      }
      return next;
    });
    setConfirmDeselectOpen(false);
  }, [currentY, currentK]);

  const clamp = (v: string, lo: number, hi: number, def: number) => {
    const n = parseInt(v, 10);
    if (isNaN(n)) return def;
    return Math.max(lo, Math.min(hi, n));
  };

  const marqueeStyle = useMemo(() => {
    if (!marquee || !dragging) return undefined;
    const left = Math.min(marquee.x1, marquee.x2);
    const top = Math.min(marquee.y1, marquee.y2);
    const width = Math.abs(marquee.x2 - marquee.x1);
    const height = Math.abs(marquee.y2 - marquee.y1);
    return { left, top, width, height } as const;
  }, [marquee, dragging]);

  return (
    <PrivilegeRoute
      requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        {/* Page Header */}
        <PageHeader
          title="Paleta"
          breadcrumbs={[
            { label: "Inicio", href: routes.home },
            { label: "Pintura", href: routes.painting.root },
            { label: "Paleta" },
          ]}
          className="flex-shrink-0"
        />

        {/* Main grid card */}
        <div className="flex-1 min-h-0 pb-4 flex flex-col">
          <Card className="h-full flex flex-col overflow-hidden">
            {/* Toolbar inside the card */}
            <div className="flex items-center gap-3 flex-wrap px-4 py-3">
              {/* K navigation */}
              <NavPill
                label="K"
                value={currentK}
                onPrev={() => moveK(-1)}
                onNext={() => moveK(1)}
                prevDisabled={kPrevDisabled}
                nextDisabled={kNextDisabled}
                variant="dark"
              />

              {/* Link K↔Y: when checked, increasing K decreases Y and vice-versa */}
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="link-ky"
                  checked={linked}
                  onCheckedChange={(v) => setLinked(v === true)}
                />
                <label
                  htmlFor="link-ky"
                  className={cn(
                    "flex items-center gap-1 text-xs cursor-pointer select-none",
                    linked ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                  title="Quando ativado, aumentar K diminui Y e vice-versa"
                >
                  <IconLink className="h-3.5 w-3.5" />
                  Vincular
                </label>
              </div>

              {/* Y navigation */}
              <NavPill
                label="Y"
                value={currentY}
                onPrev={() => moveY(-1)}
                onNext={() => moveY(1)}
                prevDisabled={yPrevDisabled}
                nextDisabled={yNextDisabled}
                variant="yellow"
              />

              {/* Color search */}
              <div className="flex items-center gap-1">
                <div className="relative">
                  <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                    placeholder="#HEX, RGB, CMYK..."
                    className="h-8 w-[160px] rounded-md border border-border bg-transparent pl-7 pr-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSearch} disabled={!searchValue.trim()}>
                  <IconSearch className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Step — using Combobox */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Passo:</span>
                <Combobox
                  value={String(step)}
                  onValueChange={(v) => { if (v) setStep(Number(v)); }}
                  options={STEP_OPTIONS}
                  placeholder="Passo"
                  searchable={false}
                  clearable={false}
                  className="w-[100px]"
                  triggerClassName="h-8 text-xs"
                />
              </div>

              {/* Cyan range */}
              <RangeFilter
                label="Ciano"
                min={cMin}
                max={cMax}
                onMinChange={(v) => {
                  const val = clamp(v, 0, 100, 0);
                  setCMin(Math.min(val, cMax));
                }}
                onMaxChange={(v) => {
                  const val = clamp(v, 0, 100, 100);
                  setCMax(Math.max(val, cMin));
                }}
              />

              {/* Magenta range */}
              <RangeFilter
                label="Magenta"
                min={mMin}
                max={mMax}
                onMinChange={(v) => {
                  const val = clamp(v, 0, 100, 0);
                  setMMin(Math.min(val, mMax));
                }}
                onMaxChange={(v) => {
                  const val = clamp(v, 0, 100, 100);
                  setMMax(Math.max(val, mMin));
                }}
              />

              <div className="flex-1" />

              {selectionCount > 0 && (
                showSelected ? (
                  <Button variant="outline" size="sm" onClick={() => setShowSelected(false)}>
                    <IconArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowSelected(true)}>
                    <IconEye className="h-4 w-4" />
                    Ver Selecionados ({selectionCount})
                  </Button>
                )
              )}

              {selectionCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  <IconTrash className="h-4 w-4" />
                  Limpar ({selectionCount})
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={handlePrint}>
                <IconPrinter className="h-4 w-4" />
                Imprimir
              </Button>
            </div>

            {/* Selected view — compact grid of all selected colors, fills full area */}
            {showSelected ? (
              <div className="flex-1 min-h-0 overflow-hidden p-2 flex items-center justify-center">
                {selectedCells.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">Nenhuma cor selecionada.</p>
                ) : (
                  <div ref={selectedHostRef} className="w-full h-full flex items-center justify-center">
                    <canvas ref={selectedCanvasRef} className="block" />
                  </div>
                )}
              </div>
            ) : (
              /* Normal grid area — drag can start anywhere here */
              <div
                ref={gridAreaRef}
                className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-4 cursor-crosshair select-none"
                               onMouseDown={handleGridAreaMouseDown}
                onMouseMove={handleGridAreaMouseMove}
                onMouseUp={handleGridAreaMouseUp}
                onMouseLeave={handleGridAreaMouseLeave}
                onContextMenu={handleContextMenu}
              >
                {isEmpty ? (
                  <p className="text-muted-foreground text-sm cursor-default">
                    O intervalo de C/M atual filtra todas as celulas.
                  </p>
                ) : (
                  <>
                    {/* Wrapper that holds ticks, labels, and canvas */}
                    <div className="relative" style={{ maxWidth: "100%", maxHeight: "100%" }}>
                      {/* Axis label: MAGENTA → */}
                      <div className="absolute -top-8 right-0 text-[10px] font-bold tracking-[0.16em] text-muted-foreground select-none print:text-[8px]">
                        MAGENTA &rarr;
                      </div>

                      {/* Axis label: ↓ CIANO */}
                      <div className="absolute left-0 -bottom-5 text-[10px] font-bold tracking-[0.16em] text-muted-foreground select-none">
                        &darr; CIANO
                      </div>

                      {/* Top ticks (Magenta values) */}
                      <div className="absolute -top-4 left-0 right-0 h-4 pointer-events-none">
                        {mVals.map((v, i) => (
                          <span
                            key={v}
                            className="absolute bottom-0 -translate-x-1/2 text-[9px] font-semibold text-muted-foreground font-mono"
                            style={{ left: `${((i + 0.5) / mVals.length) * 100}%` }}
                          >
                            {v}
                          </span>
                        ))}
                      </div>

                      {/* Left ticks (Cyan values) */}
                      <div className="absolute -left-7 top-0 bottom-0 w-6 pointer-events-none">
                        {cVals.map((v, i) => (
                          <span
                            key={v}
                            className="absolute right-0 -translate-y-1/2 text-[9px] font-semibold text-muted-foreground font-mono"
                            style={{ top: `${((i + 0.5) / cVals.length) * 100}%` }}
                          >
                            {v}
                          </span>
                        ))}
                      </div>

                      {/* Canvas host */}
                      <div
                        ref={hostRef}
                        className="relative"
                        style={hostStyle}
                      >
                        <canvas
                          ref={canvasRef}
                          className="block w-full h-full"
                        />
                      </div>
                    </div>

                    {/* Marquee selection overlay */}
                    {dragging && marqueeStyle && (
                      <div
                        className="absolute pointer-events-none border-2 border-primary/70 bg-primary/10 rounded-sm z-10"
                        style={{
                          left: marqueeStyle.left,
                          top: marqueeStyle.top,
                          width: marqueeStyle.width,
                          height: marqueeStyle.height,
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Hover tooltip */}
        {hoverInfo && !dragging && (
          <div
            className="fixed z-50 pointer-events-none bg-popover text-popover-foreground border border-border rounded-md px-2.5 py-1.5 shadow-md font-mono text-xs"
            style={{ left: hoverInfo.x + 14, top: hoverInfo.y + 14 }}
          >
            <span
              className="inline-block w-3 h-3 rounded-sm mr-1.5 align-middle border border-border"
              style={{ backgroundColor: hoverInfo.hex }}
            />
            {hoverInfo.hex}
            <br />
            <span className="text-muted-foreground">
              CMYK {hoverInfo.c}/{hoverInfo.m}/{currentY}/{currentK}
            </span>
          </div>
        )}

        {/* Color detail dialog (right-click) */}
        <ColorDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          cell={detailCell}
        />

        {/* Print columns dialog */}
        <PrintColumnsDialog
          open={printColsDialogOpen}
          onOpenChange={setPrintColsDialogOpen}
          totalCells={selectedCells.length}
          onConfirm={(cols) => {
            setPrintColsDialogOpen(false);
            printSelectedWithCols(cols);
          }}
        />

        {/* Confirm deselect dialog */}
        <Dialog open={confirmDeselectOpen} onOpenChange={setConfirmDeselectOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Desmarcar seleção?</DialogTitle>
              <DialogDescription>
                Existem cores selecionadas nesta página. Deseja desmarcá-las?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDeselectOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleConfirmDeselect}>
                Desmarcar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PrivilegeRoute>
  );
}

// --- Sub-components ---

function NavPill({
  label,
  value,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  variant,
}: {
  label: string;
  value: number;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  variant: "dark" | "yellow";
}) {
  return (
    <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onPrev}
        disabled={prevDisabled}
      >
        <IconChevronLeft className="h-4 w-4" />
      </Button>
      <div
        className={cn(
          "px-3 h-7 flex items-center gap-1 rounded-md text-xs font-medium shadow-sm min-w-[60px] justify-center",
          variant === "dark"
            ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
            : "bg-amber-400 text-neutral-900",
        )}
      >
        <span className="text-[10px] opacity-80">{label}</span>
        <span>{value}%</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onNext}
        disabled={nextDisabled}
      >
        <IconChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function RangeFilter({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  label: string;
  min: number;
  max: number;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <Input
        type="number"
        value={min}
        min={0}
        max={100}
        step={5}
        onChange={(v) => onMinChange(String(v ?? 0))}
        className="h-8 w-14 text-xs text-center"
      />
      <span className="text-xs text-muted-foreground">&ndash;</span>
      <Input
        type="number"
        value={max}
        min={0}
        max={100}
        step={5}
        onChange={(v) => onMaxChange(String(v ?? 100))}
        className="h-8 w-14 text-xs text-center"
      />
      <span className="text-xs text-muted-foreground">%</span>
    </div>
  );
}

const COLUMN_OPTIONS = [
  { value: "5", label: "5 colunas" },
  { value: "10", label: "10 colunas" },
  { value: "15", label: "15 colunas" },
  { value: "20", label: "20 colunas" },
  { value: "25", label: "25 colunas" },
  { value: "30", label: "30 colunas" },
  { value: "40", label: "40 colunas" },
  { value: "50", label: "50 colunas" },
];

function PrintColumnsDialog({
  open,
  onOpenChange,
  totalCells,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalCells: number;
  onConfirm: (cols: number) => void;
}) {
  const [cols, setCols] = useState("20");
  const numCols = Number(cols) || 20;
  const rows = Math.ceil(totalCells / numCols);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Imprimir Selecionados</DialogTitle>
          <DialogDescription>
            {totalCells} cores selecionadas. Escolha o numero de colunas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Colunas:</span>
            <Combobox
              value={cols}
              onValueChange={(v) => { if (v) setCols(String(v)); }}
              options={COLUMN_OPTIONS}
              placeholder="Colunas"
              searchable={false}
              clearable={false}
              className="flex-1"
              triggerClassName="h-9 text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {numCols} colunas &times; {rows} linhas
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => onConfirm(numCols)}>
              <IconPrinter className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
