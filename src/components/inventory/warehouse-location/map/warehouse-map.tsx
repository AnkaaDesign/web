import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconPlus, IconMinus, IconMaximize, IconPencil, IconTrash } from "@tabler/icons-react";
import { useWarehouseLocations, useCreateWarehouseLocation, useDeleteWarehouseLocation } from "../../../../hooks";
import { warehouseLocationKeys } from "@/hooks/common/query-keys";
import { getItems, updateWarehouseLocation } from "../../../../api-client";
import type { Item, WarehouseLocation } from "../../../../types";
import { WAREHOUSE_LOCATION_TYPE, WAREHOUSE_LOCATION_TYPE_LABELS } from "../../../../constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { TableSearchInput } from "@/components/ui/table-search-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { WAREHOUSE_TYPE_STYLE, HIGHLIGHT_COLOR } from "./warehouse-type-style";
import { StructureShape } from "./warehouse-structure-shape";
import { WarehouseLocationFrontView } from "./warehouse-location-front-view";
import { WarehouseStructureFields, type StructureDraft } from "./warehouse-structure-panel";

export interface WarehouseMapHandle {
  /** Persist all pending edits (called by the page's "Concluir"). */
  commit: () => void;
  /** Drop all pending edits and revert (called by "Descartar"). */
  discard: () => void;
}

interface WarehouseMapProps {
  className?: string;
  canEdit?: boolean;
  mode: "view" | "edit";
  onModeChange: (mode: "view" | "edit") => void;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ZOOM_STEP = 1.2;
const PADDING = 120;
const GRID_CM = 10; // grid + placement snap = 10 cm
const SNAP_CM = 10;
const GRID_OPTIONS: { label: string; value: number }[] = [
  { label: "Não mostrar", value: 0 },
  { label: "10", value: 10 },
  { label: "30", value: 30 },
  { label: "60", value: 60 },
]; // 0 = grid hidden
const GRID_STORAGE_KEY = "warehouse-map-grid-step"; // persist the grid selector across reload/navigation
const snapPos = (v: number) => Math.round(v / GRID_CM) * GRID_CM;
const snapSize = (v: number) => Math.round(v / SNAP_CM) * SNAP_CM;
const MIN_VIEW_W = 200;
const HANDLE_PX = 11;

// Warehouse floor outline (cm), all measures rounded to the 10 cm grid so the walls,
// sector lines and structures all snap to the same grid. L-shape: a 520-wide body with a
// narrower 280-wide extension below-left.
const FLOOR_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [520, 0],
  [520, 1350],
  [280, 1350],
  [280, 1970],
  [0, 1970],
];
// 4 sectors by Y band (3 in the main body + the extension), grid-rounded — drives auto S1..S4 codes
const SECTOR_BANDS: ReadonlyArray<{ id: string; yMin: number; yMax: number }> = [
  { id: "S1", yMin: 0, yMax: 670 },
  { id: "S2", yMin: 670, yMax: 1180 },
  { id: "S3", yMin: 1180, yMax: 1350 },
  { id: "S4", yMin: 1350, yMax: 1970 },
];
const sectorAt = (y: number, h: number) => (SECTOR_BANDS.find((b) => y + h / 2 >= b.yMin && y + h / 2 < b.yMax) || SECTOR_BANDS[0]).id;
const TYPE_PREFIX: Record<WAREHOUSE_LOCATION_TYPE, string> = {
  [WAREHOUSE_LOCATION_TYPE.ESTANTE]: "E",
  [WAREHOUSE_LOCATION_TYPE.ESTANTE_DUPLA]: "D",
  [WAREHOUSE_LOCATION_TYPE.ESTANTE_KANBAN]: "K",
  [WAREHOUSE_LOCATION_TYPE.PAINEL]: "PN",
  [WAREHOUSE_LOCATION_TYPE.PALETE]: "PL",
};
const FLOOR_BOX: ViewBox = { x: 0, y: 0, w: 520, h: 1970 };
const FLOOR_PATH = FLOOR_POINTS.map((p, i) => `${i ? "L" : "M"} ${p[0]} ${p[1]}`).join(" ") + " Z";
// Y of the "funil" — the step where the L-shape narrows inward. The sector divider that
// lands on this boundary is pinned here so the split sits exactly in the funnel, not at the
// cluster midpoint.
const FUNNEL_Y: number | null = (() => {
  for (let i = 1; i < FLOOR_POINTS.length; i++) {
    if (FLOOR_POINTS[i][1] === FLOOR_POINTS[i - 1][1] && FLOOR_POINTS[i][0] < FLOOR_POINTS[i - 1][0]) return FLOOR_POINTS[i][1];
  }
  return null;
})();
// Right wall of the narrow extension below the funnel (x where the L-shape steps inward).
const FUNNEL_X: number | null = (() => {
  for (let i = 1; i < FLOOR_POINTS.length; i++) {
    if (FLOOR_POINTS[i][1] === FLOOR_POINTS[i - 1][1] && FLOOR_POINTS[i][0] < FLOOR_POINTS[i - 1][0]) return FLOOR_POINTS[i][0];
  }
  return null;
})();
// Clamp a structure rectangle so it stays fully INSIDE the L-shaped floor — structures may
// never be placed/dragged/resized past the warehouse walls.
const clampToFloor = (x: number, y: number, w: number, h: number) => {
  const maxX = FLOOR_BOX.x + FLOOR_BOX.w - w;
  const maxY = FLOOR_BOX.y + FLOOR_BOX.h - h;
  let nx = Math.min(Math.max(x, FLOOR_BOX.x), Math.max(FLOOR_BOX.x, maxX));
  let ny = Math.min(Math.max(y, FLOOR_BOX.y), Math.max(FLOOR_BOX.y, maxY));
  // any part reaching into the narrow extension is bounded by its inner right wall
  if (FUNNEL_Y != null && FUNNEL_X != null && ny + h > FUNNEL_Y) nx = Math.max(FLOOR_BOX.x, Math.min(nx, FUNNEL_X - w));
  return { x: nx, y: ny };
};
const FALLBACK_VIEWBOX: ViewBox = { x: -PADDING, y: -PADDING, w: FLOOR_BOX.w + PADDING * 2, h: FLOOR_BOX.h + PADDING * 2 };

const DEFAULT_SIZE: Record<WAREHOUSE_LOCATION_TYPE, { w: number; h: number }> = {
  [WAREHOUSE_LOCATION_TYPE.ESTANTE]: { w: 90, h: 30 },
  [WAREHOUSE_LOCATION_TYPE.ESTANTE_DUPLA]: { w: 90, h: 60 },
  [WAREHOUSE_LOCATION_TYPE.ESTANTE_KANBAN]: { w: 90, h: 30 },
  [WAREHOUSE_LOCATION_TYPE.PAINEL]: { w: 100, h: 20 },
  [WAREHOUSE_LOCATION_TYPE.PALETE]: { w: 120, h: 120 },
};

/** Pending local edits (geometry + fields), keyed by id, until Concluir. */
type Pending = Partial<Omit<StructureDraft, "id">>;
interface Geom {
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
}

type Interaction =
  | { kind: "pan"; startX: number; startY: number; origin: ViewBox }
  | { kind: "move"; id: string; startX: number; startY: number; origin: Geom; moved: boolean }
  | { kind: "resize"; id: string; startX: number; startY: number; origin: Geom; corner: "nw" | "ne" | "sw" | "se" }
  | null;

export const WarehouseMap = forwardRef<WarehouseMapHandle, WarehouseMapProps>(function WarehouseMap({ className, canEdit, mode, onModeChange }, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: locationsResponse, isLoading } = useWarehouseLocations({
    isActive: true,
    orderBy: { name: "asc" },
    limit: 100,
    include: { _count: { select: { items: true } } },
  });
  const locations = useMemo<WarehouseLocation[]>(() => locationsResponse?.data ?? [], [locationsResponse]);

  const createMutation = useCreateWarehouseLocation();
  const deleteMutation = useDeleteWarehouseLocation();
  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateWarehouseLocation(id, data, undefined, { suppressToast: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: warehouseLocationKeys.all }),
  });

  // ---- selection / editor / pending edits ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [confirmDelete, setConfirmDelete] = useState<WarehouseLocation | null>(null);
  const [gridStep, setGridStep] = useState<number>(() => {
    // restore the last grid selection (persists reload + navigation)
    try {
      const raw = localStorage.getItem(GRID_STORAGE_KEY);
      if (raw != null) {
        const n = Number(raw);
        if (GRID_OPTIONS.some((o) => o.value === n)) return n;
      }
    } catch {
      /* localStorage unavailable */
    }
    return GRID_CM;
  }); // visible minor-grid step (cm)

  useEffect(() => {
    try {
      localStorage.setItem(GRID_STORAGE_KEY, String(gridStep));
    } catch {
      /* localStorage unavailable */
    }
  }, [gridStep]);

  const effective = useCallback((loc: WarehouseLocation): WarehouseLocation => ({ ...loc, ...(pending[loc.id] ?? {}) }), [pending]);
  const geomOf = useCallback((loc: WarehouseLocation): Geom => { const e = effective(loc); return { positionX: e.positionX, positionY: e.positionY, width: e.width, height: e.height, rotation: e.rotation }; }, [effective]);

  const makeDraft = useCallback((loc: WarehouseLocation): StructureDraft => { const e = effective(loc); return { id: e.id, name: e.name, type: e.type, section: e.section, code: e.code, levels: e.levels, columns: e.columns, width: e.width, height: e.height, rotation: e.rotation, positionX: e.positionX, positionY: e.positionY }; }, [effective]);
  const [draft, setDraft] = useState<StructureDraft | null>(null);
  const draftRef = useRef<StructureDraft | null>(null);
  draftRef.current = draft;
  const selectStructure = useCallback((loc: WarehouseLocation) => { setSelectedId(loc.id); setDraft(makeDraft(loc)); }, [makeDraft]);
  const deselect = useCallback(() => { setSelectedId(null); setDraft(null); }, []);
  // The map identifies a structure as "setor-código"; keep the stored name in sync with that
  // so lists/labels elsewhere stay correct (the form no longer has a separate Nome field).
  const deriveName = (section: string | null, code: string | null, fallback: string) => [section, code].filter(Boolean).join("-") || fallback;

  // ---- Floor boundary ----
  const floor = FLOOR_BOX;

  // ---- Canvas size ----
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => { const r = entries[0].contentRect; setCanvasSize({ w: r.width, h: r.height }); });
    ro.observe(el);
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ---- ViewBox ----
  const [viewBox, setViewBox] = useState<ViewBox>(FALLBACK_VIEWBOX);
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;
  const [hasInitialized, setHasInitialized] = useState(false);

  const clampView = useCallback(
    (vb: ViewBox): ViewBox => {
      const aspect = canvasSize.w > 0 ? canvasSize.h / canvasSize.w : 0.66;
      // Zoom-out limit must let the WHOLE floor fit — for a tall/narrow warehouse
      // that means the viewBox width needed to contain the floor height.
      const fitW = Math.max(floor.w, floor.h / aspect);
      const maxW = fitW + PADDING * 4;
      let { x, y, w } = vb;
      w = Math.min(Math.max(w, MIN_VIEW_W), maxW);
      const h = w * aspect;
      const mX = PADDING * 2, mY = PADDING * 2;
      if (w >= floor.w + mX * 2) x = floor.x + floor.w / 2 - w / 2;
      else x = Math.min(Math.max(x, floor.x - mX), floor.x + floor.w + mX - w);
      if (h >= floor.h + mY * 2) y = floor.y + floor.h / 2 - h / 2;
      else y = Math.min(Math.max(y, floor.y - mY), floor.y + floor.h + mY - h);
      return { x, y, w, h };
    },
    [floor, canvasSize],
  );
  const fitView = useCallback((): ViewBox => {
    const aspect = canvasSize.w > 0 ? canvasSize.h / canvasSize.w : 0.66;
    const w = Math.max(floor.w + PADDING * 2, (floor.h + PADDING * 2) / aspect);
    return clampView({ x: floor.x + floor.w / 2 - w / 2, y: floor.y + floor.h / 2 - (w * aspect) / 2, w, h: w * aspect });
  }, [clampView, floor, canvasSize]);

  useEffect(() => { if (!hasInitialized && locations.length > 0) { setViewBox(fitView()); setHasInitialized(true); } }, [fitView, hasInitialized, locations.length]);
  useLayoutEffect(() => { if (hasInitialized && canvasSize.w > 0) setViewBox((v) => clampView(v)); }, [canvasSize, clampView, hasInitialized]);

  const resetView = useCallback(() => setViewBox(fitView()), [fitView]);
  const zoomBy = useCallback(
    (factor: number, centerX?: number, centerY?: number) => {
      setViewBox((prev) => { const cx = centerX ?? prev.x + prev.w / 2; const cy = centerY ?? prev.y + prev.h / 2; const nw = prev.w / factor, nh = prev.h / factor; return clampView({ x: cx - (cx - prev.x) * (nw / prev.w), y: cy - (cy - prev.y) * (nh / prev.h), w: nw, h: nh }); });
    },
    [clampView],
  );

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const vb = viewBoxRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: vb.x + ((clientX - rect.left) / rect.width) * vb.w, y: vb.y + ((clientY - rect.top) / rect.height) * vb.h };
  }, []);
  // Native non-passive wheel listener — React's onWheel is passive, so its
  // preventDefault() is ignored and the page scrolls instead of the map zooming.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = clientToSvg(e.clientX, e.clientY);
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, x, y);
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, [clientToSvg, zoomBy]);

  const openEditor = useCallback((loc: WarehouseLocation, fresh = false) => { selectStructure(loc); setIsNew(fresh); setEditOpen(true); }, [selectStructure]);

  // ---- Pointer interaction ----
  const interactionRef = useRef<Interaction>(null);
  const lastClickRef = useRef<{ id: string; t: number } | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return; // only the primary (left) button grabs/pans — right-click is ignored
      const el = e.target as Element;
      const role = el.getAttribute?.("data-role");
      const id = el.getAttribute?.("data-id") ?? undefined;
      const start = clientToSvg(e.clientX, e.clientY);
      if (mode === "edit" && role === "resize" && id) {
        const loc = locations.find((l) => l.id === id);
        const corner = ((el.getAttribute?.("data-corner") as "nw" | "ne" | "sw" | "se") || "se");
        if (loc) { selectStructure(loc); interactionRef.current = { kind: "resize", id, startX: start.x, startY: start.y, origin: geomOf(loc), corner }; }
      } else if (mode === "edit" && role === "structure" && id) {
        const loc = locations.find((l) => l.id === id);
        if (loc) { selectStructure(loc); interactionRef.current = { kind: "move", id, startX: start.x, startY: start.y, origin: geomOf(loc), moved: false }; }
      } else if (role === "bg") {
        if (mode === "edit") deselect();
        interactionRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, origin: viewBoxRef.current };
      } else return;
      setIsInteracting(true);
      svgRef.current?.setPointerCapture(e.pointerId);
    },
    [mode, locations, clientToSvg, geomOf, selectStructure, deselect],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const it = interactionRef.current;
      if (!it) return;
      if (it.kind === "pan") {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const dx = ((e.clientX - it.startX) / rect.width) * it.origin.w;
        const dy = ((e.clientY - it.startY) / rect.height) * it.origin.h;
        setViewBox(clampView({ ...it.origin, x: it.origin.x - dx, y: it.origin.y - dy }));
        return;
      }
      const cur = clientToSvg(e.clientX, e.clientY);
      if (it.kind === "move") {
        const clamped = clampToFloor(snapPos(it.origin.positionX + (cur.x - it.startX)), snapPos(it.origin.positionY + (cur.y - it.startY)), it.origin.width, it.origin.height);
        const nx = clamped.x;
        const ny = clamped.y;
        if (nx !== it.origin.positionX || ny !== it.origin.positionY) it.moved = true;
        const section = sectorAt(ny, it.origin.height); // sector is derived from where the structure sits on the map
        const name = deriveName(section, draftRef.current?.code ?? null, draftRef.current?.name ?? `${section}`);
        setPending((p) => ({ ...p, [it.id]: { ...p[it.id], positionX: nx, positionY: ny, section, name } }));
        setDraft((d) => (d && d.id === it.id ? { ...d, positionX: nx, positionY: ny, section, name } : d));
      } else if (it.kind === "resize") {
        const ox = it.origin.positionX, oy = it.origin.positionY, ow = it.origin.width, oh = it.origin.height;
        const right = ox + ow, bottom = oy + oh;
        const dx = cur.x - it.startX, dy = cur.y - it.startY;
        let nx = ox, ny = oy, nw = ow, nh = oh;
        if (it.corner === "se") {
          nw = Math.max(SNAP_CM, snapSize(ow + dx)); nh = Math.max(SNAP_CM, snapSize(oh + dy));
        } else if (it.corner === "nw") {
          nx = Math.min(snapPos(ox + dx), right - SNAP_CM); ny = Math.min(snapPos(oy + dy), bottom - SNAP_CM); nw = right - nx; nh = bottom - ny;
        } else if (it.corner === "ne") {
          const nr = Math.max(ox + SNAP_CM, snapSize(right + dx)); ny = Math.min(snapPos(oy + dy), bottom - SNAP_CM); nw = nr - ox; nh = bottom - ny;
        } else {
          nx = Math.min(snapPos(ox + dx), right - SNAP_CM); const nb = Math.max(oy + SNAP_CM, snapSize(bottom + dy)); nw = right - nx; nh = nb - oy;
        }
        // keep the resized box inside the floor walls (clamp edges, never poke outside)
        if (nx < FLOOR_BOX.x) { nw -= FLOOR_BOX.x - nx; nx = FLOOR_BOX.x; }
        if (ny < FLOOR_BOX.y) { nh -= FLOOR_BOX.y - ny; ny = FLOOR_BOX.y; }
        const rLimit = FUNNEL_Y != null && FUNNEL_X != null && ny + nh > FUNNEL_Y ? FUNNEL_X : FLOOR_BOX.x + FLOOR_BOX.w;
        if (nx + nw > rLimit) nw = rLimit - nx;
        if (ny + nh > FLOOR_BOX.y + FLOOR_BOX.h) nh = FLOOR_BOX.y + FLOOR_BOX.h - ny;
        nw = Math.max(SNAP_CM, nw); nh = Math.max(SNAP_CM, nh);
        setPending((p) => ({ ...p, [it.id]: { ...p[it.id], positionX: nx, positionY: ny, width: nw, height: nh } }));
        setDraft((d) => (d && d.id === it.id ? { ...d, positionX: nx, positionY: ny, width: nw, height: nh } : d));
      }
    },
    [clientToSvg, clampView],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const it = interactionRef.current;
      interactionRef.current = null;
      setIsInteracting(false);
      try { svgRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      // A click (no drag) just selects (done on pointerdown). Pointer capture
      // swallows DOM dblclick, so detect the double-click here to open the editor.
      if (mode === "edit" && it && it.kind === "move" && !it.moved) {
        const now = Date.now();
        const last = lastClickRef.current;
        if (last && last.id === it.id && now - last.t < 350) {
          const loc = locations.find((l) => l.id === it.id);
          if (loc) openEditor(loc);
          lastClickRef.current = null;
        } else {
          lastClickRef.current = { id: it.id, t: now };
        }
      }
      // geometry stays in `pending` — committed on Concluir, not now.
    },
    [mode, locations, openEditor],
  );

  // ---- Front-view modal ----
  const [frontView, setFrontView] = useState<WarehouseLocation | null>(null);
  const openFrontView = useCallback((loc: WarehouseLocation) => setFrontView(loc), []);

  // ---- Item search → blink on map ----
  const [itemQuery, setItemQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matchedItems, setMatchedItems] = useState<Item[]>([]);
  useEffect(() => {
    const term = itemQuery.trim();
    if (term.length < 2) { setMatchedItems([]); return; }
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try { const response = await getItems({ page: 1, limit: 100, orderBy: { name: "asc" }, searchingFor: term } as any); if (active) setMatchedItems(response.data ?? []); }
      catch { if (active) setMatchedItems([]); }
      finally { if (active) setSearching(false); }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [itemQuery]);

  const searchActive = itemQuery.trim().length >= 2;
  const matchedLocationIds = useMemo(() => { const s = new Set<string>(); for (const it of matchedItems) if (it.warehouseLocationId) s.add(it.warehouseLocationId); return s; }, [matchedItems]);
  const matchedItemIds = useMemo(() => new Set(matchedItems.map((i) => i.id)), [matchedItems]);

  // ---- Add / save / delete ----
  const addStructure = useCallback(
    async (type: WAREHOUSE_LOCATION_TYPE) => {
      const size = DEFAULT_SIZE[type];
      const vb = viewBoxRef.current;
      // start near the viewport centre but always clamped inside the floor walls
      const start = clampToFloor(snapPos(vb.x + vb.w / 2 - size.w / 2), snapPos(vb.y + vb.h / 2 - size.h / 2), size.w, size.h);
      let px = start.x;
      let py = start.y;
      const occupied = (x: number, y: number) => locations.some((l) => { const g = geomOf(l); return g.positionX === x && g.positionY === y; });
      let guard = 0;
      while (occupied(px, py) && guard < 30) { const c = clampToFloor(px + GRID_CM, py + GRID_CM, size.w, size.h); px = c.x; py = c.y; guard++; }
      // auto sector (from position) + next free code in that sector (E1, K2, PL3…)
      const section = sectorAt(py, size.h);
      const prefix = TYPE_PREFIX[type];
      const re = new RegExp(`^${prefix}(\\d+)$`);
      const used = locations.filter((l) => l.section === section && l.code).map((l) => { const m = re.exec(String(l.code)); return m ? parseInt(m[1], 10) : 0; });
      const code = `${prefix}${(used.length ? Math.max(...used) : 0) + 1}`;
      const isKanban = type === WAREHOUSE_LOCATION_TYPE.ESTANTE_KANBAN;
      const res = await createMutation.mutateAsync({ name: `${section}-${code}`, section, code, type, levels: isKanban ? 5 : 4, columns: isKanban ? 4 : 1, width: size.w, height: size.h, rotation: 0, positionX: px, positionY: py, isActive: true } as any);
      const created = (res as any)?.data as WarehouseLocation | undefined;
      if (created) openEditor(created, true);
    },
    [createMutation, openEditor, locations, geomOf],
  );

  const panelChange = useCallback(
    (patch: Partial<StructureDraft>) => {
      const cur = draftRef.current;
      if (!selectedId || !cur || cur.id !== selectedId) return;
      const next = { ...cur, ...patch };
      // código (or setor) changed → re-derive the stored name from "setor-código"
      if ("code" in patch || "section" in patch) next.name = deriveName(next.section, next.code, cur.name);
      setDraft(next);
      const { id: _omit, ...rest } = next;
      setPending((p) => ({ ...p, [selectedId]: { ...p[selectedId], ...rest } }));
    },
    [selectedId],
  );

  // Apply edits from the modal to pending and close (committed on Concluir).
  const applyEditor = useCallback(() => setEditOpen(false), []);

  const doDelete = useCallback(
    (loc: WarehouseLocation) => {
      deleteMutation.mutate(loc.id, {
        onSuccess: () => {
          setPending((p) => { const n = { ...p }; delete n[loc.id]; return n; });
          setConfirmDelete(null);
          setEditOpen(false);
          if (selectedId === loc.id) deselect();
        },
      });
    },
    [deleteMutation, selectedId, deselect],
  );

  // ---- commit / discard (exposed to the page header) ----
  const commit = useCallback(() => {
    const entries = Object.entries(pending);
    entries.forEach(([id, patch]) => { if (patch && Object.keys(patch).length) saveMutation.mutate({ id, data: patch }); });
    setPending({});
    setEditOpen(false);
    deselect();
  }, [pending, saveMutation, deselect]);
  const discard = useCallback(() => {
    setPending({});
    setEditOpen(false);
    deselect();
    queryClient.invalidateQueries({ queryKey: warehouseLocationKeys.all });
  }, [deselect, queryClient]);
  useImperativeHandle(ref, () => ({ commit, discard }), [commit, discard]);

  // código must be unique within its setor — flagged in the editor and blocks "Aplicar"
  const codeDuplicate = useMemo(() => {
    const code = draft?.code?.trim().toLowerCase();
    if (!draft || !code) return false;
    return locations.some((l) => {
      if (l.id === draft.id) return false;
      const e = effective(l);
      return e.section === draft.section && String(e.code ?? "").trim().toLowerCase() === code;
    });
  }, [draft, locations, effective]);

  const isEdit = mode === "edit";

  // ---- projection ----
  // preserveAspectRatio="none" stretches the viewBox to exactly fill the canvas, so a
  // coordinate maps independently on each axis. Labels/clicks use this SAME mapping, so
  // labels, clicks, structures and the grid always share one transform → never misalign.
  const pxPerCmX = canvasSize.w / viewBox.w;
  const pxPerCmY = canvasSize.h / viewBox.h;
  const project = (cx: number, cy: number) => ({ x: (cx - viewBox.x) * pxPerCmX, y: (cy - viewBox.y) * pxPerCmY });
  const showMinorGrid = gridStep > 0 && gridStep * pxPerCmX >= 4; // hidden when "Não mostrar" or zoomed far out

  return (
    <>
      <Card className={cn("relative flex flex-col overflow-hidden border border-border shadow-sm", className)}>
        {/* top bar: search / add-toolbar on the left, grid selector on the right (same row) */}
        <div className="flex-shrink-0 p-3">
          <div className="flex items-center gap-2">
            {isEdit ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Adicionar:</span>
                {Object.values(WAREHOUSE_LOCATION_TYPE).map((type) => {
                  const Icon = WAREHOUSE_TYPE_STYLE[type].icon;
                  return (
                    <Button key={type} variant="outline" size="sm" className="gap-1.5" onClick={() => addStructure(type)} disabled={createMutation.isPending}>
                      <Icon className="h-4 w-4" style={{ color: WAREHOUSE_TYPE_STYLE[type].color }} />
                      {WAREHOUSE_LOCATION_TYPE_LABELS[type]}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1">
                <TableSearchInput value={itemQuery} onChange={setItemQuery} placeholder="Buscar item no mapa..." isPending={searching} />
              </div>
            )}
            {/* grid-step selector — same height as the search input */}
            <div className="flex h-10 shrink-0 items-center gap-1 rounded-md border border-border bg-transparent px-2 text-xs text-muted-foreground">
              <span className="mr-0.5 hidden font-medium sm:inline">Grade</span>
              {GRID_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGridStep(opt.value)}
                  className={cn("rounded px-2 py-1.5 font-medium transition-colors", gridStep === opt.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* map area — recessed panel framed by the card surface. Top inset matches the
            toolbar gap (pt-3); left/right/bottom are wider for more breathing room */}
        <div className="min-h-0 flex-1 px-5 pb-5 pt-3">
          <div ref={canvasRef} className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-background dark:bg-[hsl(0_0%_13%)]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Carregando mapa...</div>
          ) : locations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <p>Nenhuma estrutura cadastrada.</p>
              {canEdit && !isEdit && <Button variant="outline" size="sm" className="gap-1" onClick={() => onModeChange("edit")}><IconPencil className="h-4 w-4" /> Editar mapa</Button>}
            </div>
          ) : (
            <>
              <svg
                ref={svgRef}
                data-search={searchActive ? "true" : undefined}
                className={cn("absolute inset-0 h-full w-full touch-none", isInteracting ? "cursor-grabbing" : isEdit ? "cursor-default" : "cursor-grab")}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                preserveAspectRatio="none"
                onContextMenu={(e) => { if (mode === "edit") e.preventDefault(); }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <defs>
                  <pattern id="wh-grid-minor" width={gridStep || GRID_CM} height={gridStep || GRID_CM} patternUnits="userSpaceOnUse">
                    <path d={`M ${gridStep || GRID_CM} 0 L 0 0 0 ${gridStep || GRID_CM}`} fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.1} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                  </pattern>
                  <clipPath id="wh-floor-clip"><path d={FLOOR_PATH} /></clipPath>
                </defs>
                <rect data-role="bg" x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="transparent" />
                <path data-role="bg" d={FLOOR_PATH} fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeOpacity={0.28} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                <g clipPath="url(#wh-floor-clip)" style={{ pointerEvents: "none" }} shapeRendering="crispEdges">
                  {showMinorGrid && <rect x={floor.x} y={floor.y} width={floor.w} height={floor.h} fill="url(#wh-grid-minor)" />}
                  {/* interior walls separating the sectors — each placed in the AISLE GAP
                      between sector clusters so a divider never cuts through a structure */}
                  {(() => {
                    const bottoms: Record<string, number> = {};
                    const tops: Record<string, number> = {};
                    for (const loc of locations) {
                      const yc = loc.positionY + loc.height / 2;
                      const band = SECTOR_BANDS.find((b) => yc >= b.yMin && yc < b.yMax) ?? SECTOR_BANDS[0];
                      bottoms[band.id] = Math.max(bottoms[band.id] ?? -Infinity, loc.positionY + loc.height);
                      tops[band.id] = Math.min(tops[band.id] ?? Infinity, loc.positionY);
                    }
                    const ys: number[] = [];
                    for (let i = 0; i < SECTOR_BANDS.length - 1; i++) {
                      // the divider that coincides with the funnel step is pinned to it
                      if (FUNNEL_Y != null && SECTOR_BANDS[i].yMax === FUNNEL_Y) { ys.push(FUNNEL_Y); continue; }
                      const b = bottoms[SECTOR_BANDS[i].id];
                      const t = tops[SECTOR_BANDS[i + 1].id];
                      ys.push(snapPos(b != null && t != null && isFinite(b) && isFinite(t) && t >= b ? (b + t) / 2 : SECTOR_BANDS[i].yMax));
                    }
                    return ys.map((yy) => <line key={yy} x1={floor.x} y1={yy} x2={floor.x + floor.w} y2={yy} stroke="hsl(var(--foreground))" strokeOpacity={0.25} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />);
                  })()}
                </g>

                {/* structures clipped to the floor in view mode so nothing renders past the wall */}
                <g clipPath={mode === "view" ? "url(#wh-floor-clip)" : undefined}>
                {locations.map((loc) => {
                  const isSel = selectedId === loc.id;
                  const eff = isSel && draft ? draft : effective(loc);
                  const g = { positionX: eff.positionX, positionY: eff.positionY, width: eff.width, height: eff.height, rotation: eff.rotation };
                  const type = eff.type;
                  const cx = g.positionX + g.width / 2;
                  const cy = g.positionY + g.height / 2;
                  const isMatch = matchedLocationIds.has(loc.id);
                  const isDimmed = searchActive && !isMatch;
                  const handleCmX = HANDLE_PX / (pxPerCmX || 1);
                  const handleCmY = HANDLE_PX / (pxPerCmY || 1);
                  return (
                    <g key={loc.id} transform={`rotate(${g.rotation} ${cx} ${cy})`} opacity={isDimmed ? 0.4 : 1} style={{ transition: "opacity 150ms" }}>
                      <StructureShape
                        id={loc.id}
                        type={type}
                        x={g.positionX}
                        y={g.positionY}
                        w={g.width}
                        h={g.height}
                        selected={isSel}
                        columns={eff.columns}
                        sx={pxPerCmX || 1}
                        sy={pxPerCmY || 1}
                        className={cn(isEdit ? "cursor-move" : "cursor-pointer", "transition-[filter] hover:brightness-110")}
                        onClick={() => { if (mode === "view") openFrontView(loc); }}
                        onDoubleClick={() => { if (mode === "edit") openEditor(loc); }}
                      />
                      {/* subtle search blink — a gentle red halo */}
                      {isMatch && <rect x={g.positionX} y={g.positionY} width={g.width} height={g.height} fill="none" stroke={HIGHLIGHT_COLOR} strokeWidth={2} strokeOpacity={0.9} vectorEffect="non-scaling-stroke" className="animate-pulse" style={{ pointerEvents: "none" }} />}
                      {isEdit && isSel && (
                        <>
                          <rect x={g.positionX} y={g.positionY} width={g.width} height={g.height} rx={0} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ pointerEvents: "none" }} />
                          {/* handles sit INSIDE the corners so nothing extends past the structure */}
                          {([
                            ["nw", g.positionX, g.positionY, "cursor-nwse-resize"],
                            ["ne", g.positionX + g.width - handleCmX, g.positionY, "cursor-nesw-resize"],
                            ["sw", g.positionX, g.positionY + g.height - handleCmY, "cursor-nesw-resize"],
                            ["se", g.positionX + g.width - handleCmX, g.positionY + g.height - handleCmY, "cursor-nwse-resize"],
                          ] as const).map(([corner, hx, hy, cur]) => (
                            <rect key={corner} data-role="resize" data-id={loc.id} data-corner={corner} x={hx} y={hy} width={handleCmX} height={handleCmY} rx={1} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={1} vectorEffect="non-scaling-stroke" className={cur} />
                          ))}
                        </>
                      )}
                    </g>
                  );
                })}
                </g>
              </svg>

              {/* constant-size label overlay */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {locations.map((loc) => {
                  const isSel = selectedId === loc.id;
                  const eff = isSel && draft ? draft : effective(loc);
                  const tl = project(eff.positionX, eff.positionY); // top-left corner
                  const wPx = eff.width * pxPerCmX;
                  const hPx = eff.height * pxPerCmY;
                  // gate on the LONGER on-screen dimension — the pill sits above the box and runs
                  // horizontally, so a wide-but-shallow shelf has plenty of room to be labelled.
                  // a tiny min floor only weeds out invisible slivers; using 16 here wrongly hid
                  // long thin estantes whose depth renders a few px under that of their neighbours.
                  if (Math.min(wPx, hPx) < 6 || Math.max(wPx, hPx) < 34) return null;
                  const isDimmed = searchActive && !matchedLocationIds.has(loc.id);
                  const segs = [eff.section, eff.code || eff.name].filter(Boolean) as string[];
                  if (segs.length === 0) return null;
                  // anchored just ABOVE the structure's top-left corner so the pill never
                  // covers the box body, kanban bins, or L-posts — but flip INSIDE the top edge
                  // for racks flush against the canvas top so the label isn't clipped away
                  const nearTop = tl.y < 22;
                  return (
                    <div key={loc.id} className={cn("absolute", !nearTop && "-translate-y-full")} style={{ left: tl.x + (nearTop ? 3 : 0), top: tl.y + (nearTop ? 3 : -2), opacity: isDimmed ? 0.4 : 1, transition: "opacity 150ms" }}>
                      <div className="rounded bg-black/60 px-1.5 py-0.5 leading-tight shadow-sm backdrop-blur-[1px]">
                        <span className="block whitespace-nowrap text-[11px] font-semibold text-white">{segs.join("-")}</span>
                      </div>
                    </div>
                  );
                })}

                {isInteracting && draft && selectedId && (() => {
                  const top = project(draft.positionX + draft.width / 2, draft.positionY);
                  return (
                    <div className="absolute -translate-x-1/2 -translate-y-full rounded bg-foreground px-1.5 py-0.5 text-[11px] font-medium text-background" style={{ left: top.x, top: top.y - 6 }}>
                      {Math.round(draft.width)}×{Math.round(draft.height)} cm · {Math.round(draft.positionX)},{Math.round(draft.positionY)}
                    </div>
                  );
                })()}
              </div>

              <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1 rounded-lg border border-border bg-card/90 p-1 shadow-sm backdrop-blur">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomBy(ZOOM_STEP)} title="Aproximar"><IconPlus className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomBy(1 / ZOOM_STEP)} title="Afastar"><IconMinus className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView} title="Ajustar à tela"><IconMaximize className="h-4 w-4" /></Button>
              </div>
            </>
          )}
          </div>
        </div>
      </Card>

      {/* structure editor modal */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) setEditOpen(false); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {(isNew ? "Nova estrutura" : "Editar estrutura") + (draft ? ` · ${WAREHOUSE_LOCATION_TYPE_LABELS[draft.type]}` : "")}
            </DialogTitle>
          </DialogHeader>
          {draft && <WarehouseStructureFields draft={draft} onChange={panelChange} duplicateCode={codeDuplicate} />}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="destructive" className="gap-1" onClick={() => { const loc = locations.find((l) => l.id === draft?.id); if (loc) setConfirmDelete(loc); }} disabled={deleteMutation.isPending}>
              <IconTrash className="h-4 w-4" /> Excluir
            </Button>
            <Button onClick={applyEditor} disabled={codeDuplicate}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* front view */}
      <Dialog open={!!frontView} onOpenChange={(open) => !open && setFrontView(null)}>
        <DialogContent className={cn("max-h-[90vh] w-[95vw] overflow-y-auto", frontView?.type === WAREHOUSE_LOCATION_TYPE.ESTANTE_KANBAN ? "max-w-6xl" : "max-w-2xl")}>
          {/* visible header (code + type + shelf count, single row) lives inside the front view */}
          <DialogHeader className="sr-only"><DialogTitle>{frontView ? [frontView.section, frontView.code].filter(Boolean).join("-") || frontView.name : "Estrutura"}</DialogTitle></DialogHeader>
          {frontView && <WarehouseLocationFrontView location={frontView} highlightItemIds={matchedItemIds} />}
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir estrutura</AlertDialogTitle>
            <AlertDialogDescription>{confirmDelete && (<>Tem certeza que deseja excluir <strong>{confirmDelete.name}</strong>? Os itens vinculados ficarão sem localização. Esta ação não pode ser desfeita.</>)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelete) doDelete(confirmDelete); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
