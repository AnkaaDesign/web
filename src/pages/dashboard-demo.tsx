// Auto-running screen-recordable tutorial for the configurable home dashboard.
// Self-contained: no API calls, no layout persistence, no providers required.
// Reachable at /dashboard-demo (public route). Delete this file after recording.
//
// Layout mirrors web/src/layouts/main-layout.tsx — header on top of main column,
// sidebar fixed on the RIGHT (w-72, bg-card, border-l). All overlays are
// position: fixed + viewport coords so they line up regardless of scroll.
//
// Visual reference: matches the real home page (see screenshots) — colored
// accent borders per widget, count badges, "Ver todos" footer, edit chrome
// with size chip "1/2 × 2" / cog / trash, Largura × Altura popover.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconPencil,
  IconPlus,
  IconDeviceFloppy,
  IconArrowBackUp,
  IconGripVertical,
  IconSettings,
  IconTrash,
  IconCheck,
  IconClipboardList,
  IconStar,
  IconChartBar,
  IconNote,
  IconSearch,
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconRotateClockwise,
  IconArrowRight,
  IconHome,
  IconShieldCheck,
  IconX,
  IconMenu2,
  IconBell,
  IconSun,
  IconMoon,
  IconChevronRight,
  IconBuildingWarehouse,
  IconBrush,
  IconUsers,
  IconCurrencyDollar,
  IconFileInvoice,
  IconArchive,
  IconBriefcase,
  IconLayoutGrid,
  IconArrowsExchange,
  IconCalendar,
  IconBuilding,
  IconCalendarStats,
  IconClock,
  IconAlertTriangle,
  IconMessage,
  IconColumns,
  IconPalette,
} from "@tabler/icons-react";

// ---------------------------------------------------------------------------
// Pacing — bump to slow the whole script for cleaner narration over recording.
// ---------------------------------------------------------------------------

const SPEED = 1.6;

// ---------------------------------------------------------------------------
// Sizing
// ---------------------------------------------------------------------------

type Cols = 1 | 2 | 3 | 4;
type Rows = 1 | 2 | 3 | 4;
interface WidgetSize {
  cols: Cols;
  rows: Rows;
}

const WIDTH_LABELS: Record<Cols, string> = { 1: "1/4", 2: "1/2", 3: "3/4", 4: "Total" };
const HEIGHT_LABELS: Record<Rows, string> = { 1: "1x", 2: "2x", 3: "3x", 4: "4x" };

// ---------------------------------------------------------------------------
// Border accent palette (matches the real "Aparência" picker)
// ---------------------------------------------------------------------------

type AccentKey = "rose" | "emerald" | "sky" | "violet" | "amber" | "fuchsia" | "none";

const ACCENT: Record<AccentKey, { ring: string; text: string; bg: string; dot: string; titleText: string }> = {
  rose: { ring: "border-rose-500/70 shadow-[0_0_0_1px_rgba(244,63,94,0.25)]", text: "text-rose-500", bg: "bg-rose-500", dot: "bg-rose-500", titleText: "text-rose-500" },
  emerald: { ring: "border-emerald-500/70 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]", text: "text-emerald-500", bg: "bg-emerald-500", dot: "bg-emerald-500", titleText: "text-emerald-500" },
  sky: { ring: "border-sky-500/70 shadow-[0_0_0_1px_rgba(14,165,233,0.25)]", text: "text-sky-500", bg: "bg-sky-500", dot: "bg-sky-500", titleText: "text-sky-500" },
  violet: { ring: "border-violet-500/70 shadow-[0_0_0_1px_rgba(139,92,246,0.25)]", text: "text-violet-500", bg: "bg-violet-500", dot: "bg-violet-500", titleText: "text-violet-500" },
  amber: { ring: "border-amber-500/70 shadow-[0_0_0_1px_rgba(245,158,11,0.25)]", text: "text-amber-500", bg: "bg-amber-500", dot: "bg-amber-500", titleText: "text-amber-500" },
  fuchsia: { ring: "border-fuchsia-500/70 shadow-[0_0_0_1px_rgba(217,70,239,0.25)]", text: "text-fuchsia-500", bg: "bg-fuchsia-500", dot: "bg-fuchsia-500", titleText: "text-fuchsia-500" },
  none: { ring: "border-border", text: "text-foreground", bg: "bg-muted", dot: "bg-muted-foreground", titleText: "text-foreground" },
};

// ---------------------------------------------------------------------------
// Widget catalog
// ---------------------------------------------------------------------------

type WidgetKind =
  | "favorites"
  | "messages"
  | "tasks-overdue"
  | "production"
  | "low-stock"
  | "ppe-deliveries"
  | "ponto"
  | "quick-note";

interface FavPill {
  label: string;
  icon: typeof IconClipboardList;
  bg: string;
  fg: string;
}
interface TaskRow { name: string; client: string; sector: string; sectorTone: 1 | 2; date: string; status: "Em preparação" | "Em produção"; }
interface StockRow { name: string; brand: string; qty: number; reorder: number; consumption: string; }
interface ProductionRow { name: string; client: string; count: number; forecast: string; tone: "ok" | "warn" | "danger" | "muted"; }
interface PpeRow { user: string; item: string; status: "Pendente" | "Assinado"; }
interface PontoRow { name: string; e1?: string; s1?: string; e2?: string; s2?: string; tag?: "ATES" | "FALTA" | "FERIAS"; }
interface MessageRow { from: string; preview: string; ago: string; }

interface MockWidget {
  kind: WidgetKind;
  id: string;
  name: string;
  category: "Geral" | "Produção" | "Estoque" | "RH" | "Financeiro" | "Outros";
  description: string;
  icon: typeof IconClipboardList;
  defaultBorder: AccentKey;
  count?: number;
  pills?: FavPill[];
  tasks?: TaskRow[];
  production?: ProductionRow[];
  stock?: StockRow[];
  ppe?: PpeRow[];
  ponto?: PontoRow[];
  messages?: MessageRow[];
}

const FAVORITES_PILLS: FavPill[] = [
  { label: "Colaboradores", icon: IconUsers, bg: "bg-sky-500/15", fg: "text-sky-500" },
  { label: "Empréstimos", icon: IconArrowsExchange, bg: "bg-orange-500/15", fg: "text-orange-500" },
  { label: "Agenda", icon: IconCalendar, bg: "bg-emerald-500/15", fg: "text-emerald-500" },
  { label: "Barracões", icon: IconBuilding, bg: "bg-violet-500/15", fg: "text-violet-500" },
  { label: "Cronograma", icon: IconCalendarStats, bg: "bg-amber-500/15", fg: "text-amber-500" },
  { label: "Controle de Ponto", icon: IconClock, bg: "bg-fuchsia-500/15", fg: "text-fuchsia-500" },
];

// "Tarefas Atrasadas" — overdue tasks, mix of preparação and produção states.
const TASK_ROWS: TaskRow[] = [
  { name: "Roanna", client: "Roanna", sector: "Produção 2", sectorTone: 2, date: "08/08/23 13:00", status: "Em produção" },
  { name: "Marquespan", client: "Marquespan", sector: "Produção 1", sectorTone: 1, date: "09/08/23 06:00", status: "Em preparação" },
  { name: "Aan", client: "AAN Transportes LTDA", sector: "Produção 1", sectorTone: 1, date: "11/08/23 11:00", status: "Em produção" },
  { name: "Provasi", client: "Provasi", sector: "Produção 1", sectorTone: 1, date: "03/08/23 11:00", status: "Em preparação" },
  { name: "Serra Carioca 14,70", client: "Serra Carioca", sector: "Produção 2", sectorTone: 2, date: "07/08/23 10:00", status: "Em produção" },
  { name: "Frutap", client: "Frutap", sector: "Produção 1", sectorTone: 1, date: "03/08/23 11:00", status: "Em preparação" },
  { name: "Mata Grande", client: "Mata Grande", sector: "Produção 2", sectorTone: 2, date: "01/08/23 11:02", status: "Em produção" },
];

// Forecast tones reflect deadline color logic from the real app:
//   ok     → on track (≥ 5 days out)
//   warn   → near (1–4 days)
//   danger → overdue / today
//   muted  → no/unknown date
const PRODUCTION_ROWS: ProductionRow[] = [
  { name: "Luxafit 7,00", client: "Luxafit", count: 3, forecast: "12/05/26 15:18", tone: "ok" },
  { name: "Luxafit 8,50", client: "Luxafit", count: 3, forecast: "13/05/26 15:19", tone: "ok" },
  { name: "Masterboi LTDA.", client: "masterboi", count: 2, forecast: "10/05/26 10:06", tone: "warn" },
  { name: "Masterboi LTDA.", client: "masterboi", count: 1, forecast: "08/05/26 12:17", tone: "danger" },
  { name: "Madeireira Santa Clara 9,50", client: "Dornellas Material de Construcao", count: 7, forecast: "15/05/26 17:00", tone: "ok" },
  { name: "Madeireira Santa Clara 9,50", client: "Dornellas Material de Construcao", count: 6, forecast: "04/05/26 17:00", tone: "danger" },
];

const STOCK_ROWS: StockRow[] = [
  { name: "Primer Pu Fast Dry", brand: "Farben", qty: 0, reorder: 2, consumption: "3,72" },
  { name: "Disco de Corte", brand: "Norton", qty: 0, reorder: 13, consumption: "17,75" },
  { name: "Mangueira de Água", brand: "Ibirá", qty: 0, reorder: 182, consumption: "121" },
  { name: "Lanterna Led Âmbar", brand: "Genérico", qty: 0, reorder: 0, consumption: "0" },
  { name: "Botina Reposição - 37", brand: "Kadesh", qty: 0, reorder: 0, consumption: "0" },
  { name: "Desengripante", brand: "Tekbond", qty: 0, reorder: 2, consumption: "3,22" },
  { name: "Combinada Articulada 8", brand: "Belzer", qty: 0, reorder: 3, consumption: "0" },
];

const PPE_ROWS: PpeRow[] = [
  { user: "João Silva", item: "Bota — 42", status: "Pendente" },
  { user: "Maria Souza", item: "Luva — M", status: "Assinado" },
  { user: "Pedro Costa", item: "Óculos", status: "Pendente" },
];

const PONTO_ROWS: PontoRow[] = [
  { name: "Alessandro Junior S…", e1: "07:16" },
  { name: "Alex Junior Pereira d…", e1: "07:14" },
  { name: "Alisson Nantes da Si…", e1: "07:14" },
  { name: "Andressa Rodrigues" },
  { name: "Breno Willian dos Sa…", e1: "07:16" },
  { name: "Célio Lourenço", e1: "07:16" },
  { name: "Davyd Jefferson So…", e1: "07:19" },
  { name: "Fábio Aparecido Rod…", e1: "07:16" },
  { name: "Gabriel Aparecido" },
  { name: "Gleverton Armangni…", e1: "07:14" },
  { name: "Igor Santos Faria", e1: "07:17" },
  { name: "José Antônio de Alm…", tag: "ATES", e1: "ATES…", s1: "ATES…", e2: "ATES…", s2: "ATES…" },
  { name: "José Moreira Lopes…" },
  { name: "João Paulo Santos", e1: "07:16" },
];

const MESSAGE_ROWS: MessageRow[] = [
  { from: "Equipe Pintura", preview: "Lote 8421 finalizado, conferindo acabamento agora.", ago: "há 21 minutos" },
  { from: "Almoxarifado", preview: "Estoque baixo de catalisador 2K — abri o pedido com o fornecedor.", ago: "há 1 hora" },
  { from: "Carlos (Comercial)", preview: "Cliente Luxafit confirmou retirada da OS 35404 amanhã às 14h.", ago: "há 3 horas" },
];

const CATALOG: MockWidget[] = [
  {
    kind: "favorites",
    id: "favorites",
    name: "Favoritos",
    category: "Geral",
    description: "Acesso rápido às páginas favoritas. Configurável: título, aparência (cor / ícone)…",
    icon: IconStar,
    defaultBorder: "sky",
    count: 7,
    pills: FAVORITES_PILLS,
  },
  {
    kind: "messages",
    id: "messages",
    name: "Mensagens Recentes",
    category: "Outros",
    description: "Últimas mensagens recebidas. Configurável: título, aparência…",
    icon: IconMessage,
    defaultBorder: "violet",
    count: 3,
    messages: MESSAGE_ROWS,
  },
  {
    kind: "tasks-overdue",
    id: "tasks-overdue",
    name: "Tarefas Atrasadas",
    category: "Produção",
    description: "Tabela de tarefas com paridade visual à página de preparação: OSs ricas,…",
    icon: IconClipboardList,
    defaultBorder: "rose",
    count: 25,
    tasks: TASK_ROWS,
  },
  {
    kind: "production",
    id: "production-general",
    name: "Em Produção (Geral)",
    category: "Produção",
    description: "Tabela das tarefas atualmente em produção em todos os setores.",
    icon: IconBriefcase,
    defaultBorder: "emerald",
    count: 6,
    production: PRODUCTION_ROWS,
  },
  {
    kind: "low-stock",
    id: "items-low-stock",
    name: "Estoque Baixo",
    category: "Estoque",
    description: "Tabela de itens / estoque totalmente configurável: 16 colunas, filtros por estoque,…",
    icon: IconArchive,
    defaultBorder: "rose",
    count: 30,
    stock: STOCK_ROWS,
  },
  {
    kind: "ppe-deliveries",
    id: "ppe-deliveries",
    name: "Entregas de EPI",
    category: "RH",
    description: "Aprove, reprove ou registre a entrega de EPIs direto do dashboard. RH e Admin…",
    icon: IconShieldCheck,
    defaultBorder: "emerald",
    count: 3,
    ppe: PPE_ROWS,
  },
  {
    kind: "ponto",
    id: "ponto-dia",
    name: "Ponto do Dia",
    category: "RH",
    description: "Resumo diário do ponto: colunas configuráveis (incluindo setor, cargo, atestados, faltas…)",
    icon: IconClock,
    defaultBorder: "sky",
    count: 23,
    ponto: PONTO_ROWS,
  },
  {
    kind: "quick-note",
    id: "quick-note",
    name: "Anotações",
    category: "Outros",
    description: "Bloco de notas pessoal, salvo automaticamente neste navegador.",
    icon: IconNote,
    defaultBorder: "violet",
  },
];

const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((w) => [w.id, w]));

// Per-instance overrides (config the user can change at runtime).
interface InstanceOverrides {
  border?: AccentKey;
  hiddenColumns?: string[];
  density?: "comfortable" | "compact";
  rows?: number;
}

interface Instance {
  instanceId: string;
  widgetId: string;
  size: WidgetSize;
  overrides?: InstanceOverrides;
}

// Initial layout matches the screenshot pattern:
//   Row 1:  Favoritos (cols=2, rows=1)  |  Mensagens Recentes (cols=2, rows=1)
//   Row 2-3: Tarefas (cols=2, rows=2)   |  Em Produção (cols=2, rows=2)
//   Row 4-5: Estoque (cols=2, rows=2)   |  ⟶ EMPTY SLOT (where the new widget lands)
const INITIAL_LAYOUT: Instance[] = [
  { instanceId: "i-favs", widgetId: "favorites", size: { cols: 2, rows: 1 } },
  { instanceId: "i-msgs", widgetId: "messages", size: { cols: 2, rows: 1 } },
  { instanceId: "i-tasks", widgetId: "tasks-overdue", size: { cols: 2, rows: 2 } },
  { instanceId: "i-prod", widgetId: "production-general", size: { cols: 2, rows: 2 } },
  { instanceId: "i-stock", widgetId: "items-low-stock", size: { cols: 2, rows: 2 } },
];

// Columns the user can toggle via the column picker (per widget kind).
const COLUMNS_FOR_KIND: Partial<Record<WidgetKind, string[]>> = {
  "tasks-overdue": ["Logomarca", "Cliente", "Setor", "Prazo", "Status"],
  production: ["Logomarca", "Cliente", "OS", "Previsão"],
  "low-stock": ["Nome", "Marca", "Quant.", "Reposição", "Consumo"],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardDemoPage() {
  const [layout, setLayout] = useState<Instance[]>(INITIAL_LAYOUT);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | MockWidget["category"]>("all");
  const [configureId, setConfigureId] = useState<string | null>(null);
  const [configureTab, setConfigureTab] = useState<"aparencia" | "colunas" | "filtros" | "cores" | "comportamento">("aparencia");
  const [draftBorder, setDraftBorder] = useState<AccentKey>("rose");
  const [draftHiddenCols, setDraftHiddenCols] = useState<string[]>([]);
  const [draftDensity, setDraftDensity] = useState<"compact" | "comfortable">("comfortable");
  const [swapHighlight, setSwapHighlight] = useState<string[]>([]);
  const [sizePopoverFor, setSizePopoverFor] = useState<string | null>(null);
  const [highlightTarget, setHighlightTarget] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<
    | { x: number; y: number; title: string; body: string; anchor: "top" | "bottom" }
    | null
  >(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; clicking: boolean }>({
    x: -50,
    y: -50,
    clicking: false,
  });
  const [paused, setPaused] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const stepCount = 16;
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragGhostXY, setDragGhostXY] = useState<{ x: number; y: number } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [now, setNow] = useState(() => new Date());
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    return () => document.documentElement.classList.remove("dark");
  }, [theme]);

  // ------- Animation primitives -------------------------------------------

  const wait = useCallback((ms: number) => {
    const target = ms * SPEED;
    return new Promise<void>((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (pausedRef.current) {
          setTimeout(tick, 80);
          return;
        }
        const elapsed = Date.now() - start;
        if (elapsed >= target) resolve();
        else setTimeout(tick, Math.min(80, target - elapsed));
      };
      tick();
    });
  }, []);

  const findTarget = useCallback((selector: string): { x: number; y: number; rect: DOMRect } | null => {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
  }, []);

  const moveCursorTo = useCallback(
    async (selector: string, opts?: { caption?: { title: string; body: string } }) => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const target = findTarget(selector);
      if (!target) return;
      setHighlightTarget(selector);
      setCursor((c) => ({ ...c, x: target.x, y: target.y, clicking: false }));
      if (opts?.caption) {
        const anchor: "top" | "bottom" = target.rect.top > 240 ? "top" : "bottom";
        setTooltip({
          x: target.x,
          y: anchor === "top" ? target.rect.top - 14 : target.rect.bottom + 14,
          title: opts.caption.title,
          body: opts.caption.body,
          anchor,
        });
      }
      await wait(900);
    },
    [findTarget, wait],
  );

  const clickPulse = useCallback(async () => {
    setCursor((c) => ({ ...c, clicking: true }));
    await wait(260);
    setCursor((c) => ({ ...c, clicking: false }));
    await wait(180);
  }, [wait]);

  const clearOverlays = useCallback(() => {
    setHighlightTarget(null);
    setTooltip(null);
  }, []);

  // ------- Demo script ----------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    let resetCount = 0;

    const runOnce = async () => {
      // -- 1: intro
      setStepIndex(1);
      await moveCursorTo("[data-demo='greeting']", {
        caption: {
          title: "Página inicial sob medida",
          body: "Cada colaborador monta seu painel com os widgets do próprio setor — direto, sem TI no caminho.",
        },
      });
      await wait(2800);
      if (cancelled) return;

      // -- 2: enter edit
      setStepIndex(2);
      await moveCursorTo("[data-demo='edit-btn']", {
        caption: {
          title: "Modo edição",
          body: "Clique em Editar para liberar arrastar, redimensionar, adicionar e configurar widgets.",
        },
      });
      await clickPulse();
      setIsEditing(true);
      await wait(1500);
      if (cancelled) return;

      // -- 3: open add modal
      setStepIndex(3);
      await moveCursorTo("[data-demo='add-btn']", {
        caption: {
          title: "Catálogo completo",
          body: "Apenas os widgets liberados para o seu setor aparecem aqui — sem ruído.",
        },
      });
      await clickPulse();
      setAddOpen(true);
      await wait(1300);
      if (cancelled) return;

      // -- 4: tab filter
      setStepIndex(4);
      await moveCursorTo("[data-demo='tab-RH']", {
        caption: {
          title: "Filtro por área",
          body: "Estoque, RH, Produção, Financeiro… cada categoria mostra só o que faz sentido pra você.",
        },
      });
      await clickPulse();
      setActiveTab("RH");
      await wait(1500);
      if (cancelled) return;

      // -- 5: pick widget — slots into the empty bottom-right spot
      setStepIndex(5);
      await moveCursorTo("[data-demo='catalog-ponto-dia']", {
        caption: {
          title: "Encaixe automático",
          body: "Clique e o widget cai exatamente no espaço vazio da grade — sem reorganizar nada.",
        },
      });
      await clickPulse();
      clearOverlays();
      setLayout((cur) => [
        ...cur,
        { instanceId: "i-ponto", widgetId: "ponto-dia", size: { cols: 2, rows: 2 } },
      ]);
      setNewlyAddedId("i-ponto");
      setAddOpen(false);
      setSearch("");
      setActiveTab("all");
      await wait(700);
      // Highlight the freshly-added tile so it's obvious where it landed.
      await moveCursorTo("[data-demo='tile-i-ponto']", {
        caption: {
          title: "Ponto do Dia no painel",
          body: "Pronto pra usar — entradas e saídas dos colaboradores do dia já aparecem aqui.",
        },
      });
      await wait(1700);
      setNewlyAddedId(null);
      if (cancelled) return;

      // -- 6: open size popover
      setStepIndex(6);
      await moveCursorTo("[data-demo='resize-trigger-i-stock']", {
        caption: {
          title: "Tamanho flexível",
          body: "Largura em frações — 1/4, 1/2, 3/4 ou total — e altura de 1x a 4x. Combine como precisar.",
        },
      });
      await clickPulse();
      setSizePopoverFor("i-stock");
      await wait(1100);
      if (cancelled) return;

      // -- 7: pick Total width
      setStepIndex(7);
      await moveCursorTo("[data-demo='size-width-Total']", {
        caption: {
          title: "Espaço pros itens críticos",
          body: "Estoque agora ocupa a linha inteira — todas as colunas legíveis sem rolagem horizontal.",
        },
      });
      await clickPulse();
      clearOverlays();
      setLayout((cur) =>
        cur.map((it) => (it.instanceId === "i-stock" ? { ...it, size: { cols: 4, rows: it.size.rows } } : it)),
      );
      setSizePopoverFor(null);
      await wait(1500);
      if (cancelled) return;

      // -- 8: click settings cog → open configure modal (Aparência tab)
      setStepIndex(8);
      setDraftBorder("rose");
      setDraftHiddenCols([]);
      setDraftDensity("comfortable");
      setConfigureTab("aparencia");
      // Land on the settings cog FIRST so the user sees what triggered the modal.
      await moveCursorTo("[data-demo='settings-i-tasks']", {
        caption: {
          title: "Configurar widget",
          body: "Clique na engrenagem de qualquer widget pra abrir as opções desta instância.",
        },
      });
      await clickPulse();
      clearOverlays();
      setConfigureId("i-tasks");
      await wait(700);
      await moveCursorTo("[data-demo='acento-cor']", {
        caption: {
          title: "5 áreas de configuração",
          body: "Aparência, Colunas e ordenação, Filtros, Cores de prazo e Comportamento — tudo por instância.",
        },
      });
      await wait(1800);
      if (cancelled) return;

      // -- 9: change color (live preview on the underlying tile)
      setStepIndex(9);
      await moveCursorTo("[data-demo='color-violet']", {
        caption: {
          title: "Aparência",
          body: "A cor define contorno, ícone e título — útil pra destacar widgets críticos pelo olhar.",
        },
      });
      await clickPulse();
      setDraftBorder("violet");
      setLayout((cur) =>
        cur.map((it) =>
          it.instanceId === "i-tasks"
            ? { ...it, overrides: { ...it.overrides, border: "violet" } }
            : it,
        ),
      );
      await wait(1700);
      if (cancelled) return;

      // -- 10: switch to Colunas e ordenação tab
      setStepIndex(10);
      await moveCursorTo("[data-demo='tab-config-colunas']", {
        caption: {
          title: "Colunas e ordenação",
          body: "Toda tabela escolhe quais colunas exibir e em que ordem — arraste pela alça pra reordenar.",
        },
      });
      await clickPulse();
      setConfigureTab("colunas");
      await wait(1700);
      if (cancelled) return;

      // -- 11: uncheck Setor column
      setStepIndex(11);
      await moveCursorTo("[data-demo='col-check-Setor']", {
        caption: {
          title: "Colunas visíveis",
          body: "Desmarque o que você não usa — esconde a coluna do widget e libera espaço pras outras.",
        },
      });
      await clickPulse();
      setDraftHiddenCols(["Setor"]);
      setLayout((cur) =>
        cur.map((it) =>
          it.instanceId === "i-tasks"
            ? { ...it, overrides: { ...it.overrides, hiddenColumns: ["Setor"] } }
            : it,
        ),
      );
      await wait(1700);
      if (cancelled) return;

      // -- 12: apply
      setStepIndex(12);
      await moveCursorTo("[data-demo='configure-apply']", {
        caption: {
          title: "Atualização imediata",
          body: "Aplicar fecha o modal e os widgets já mostram a nova configuração — sem recarregar.",
        },
      });
      await clickPulse();
      clearOverlays();
      setConfigureId(null);
      await wait(1700);
      if (cancelled) return;

      // -- 13: drag reorder — cursor lands on actual drag handle, then animates
      setStepIndex(13);
      // Tooltip BEFORE the drag (anchored to the drag handle area).
      await moveCursorTo("[data-demo='drag-i-prod']", {
        caption: {
          title: "Arrastar e soltar",
          body: "Pegue pelo punho de arrastar e solte em qualquer posição — os outros widgets se realinham sozinhos.",
        },
      });
      await wait(1600);
      if (cancelled) return;
      // Hide tooltip during the drag motion so it doesn't follow visually.
      clearOverlays();
      const fromHandle = findTarget("[data-demo='drag-i-prod']");
      const toHandle = findTarget("[data-demo='drag-i-tasks']");
      if (fromHandle && toHandle) {
        setCursor({ x: fromHandle.x, y: fromHandle.y, clicking: true });
        await wait(220);
        setDraggingId("i-prod");
        const stepCnt = 28;
        for (let i = 1; i <= stepCnt; i++) {
          const t = i / stepCnt;
          const x = fromHandle.x + (toHandle.x - fromHandle.x) * t;
          const y = fromHandle.y + (toHandle.y - fromHandle.y) * t;
          setCursor({ x, y, clicking: true });
          setDragGhostXY({ x, y });
          await wait(45);
          if (cancelled) return;
        }
        // Commit the swap and flash both tiles so the change is unmistakable.
        setLayout((cur) => {
          const arr = [...cur];
          const fromIdx = arr.findIndex((it) => it.instanceId === "i-prod");
          const toIdx = arr.findIndex((it) => it.instanceId === "i-tasks");
          if (fromIdx >= 0 && toIdx >= 0) {
            const [moved] = arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, moved);
          }
          return arr;
        });
        setDraggingId(null);
        setDragGhostXY(null);
        setCursor((c) => ({ ...c, clicking: false }));
        setSwapHighlight(["i-prod", "i-tasks"]);
        await wait(700);
        setSwapHighlight([]);
      }
      await wait(900);
      if (cancelled) return;

      // -- 14: remove widget
      setStepIndex(14);
      await moveCursorTo("[data-demo='remove-i-msgs']", {
        caption: {
          title: "Sem medo de remover",
          body: "Tirou um widget sem querer? Ele continua no catálogo — adicione de volta a qualquer momento.",
        },
      });
      await clickPulse();
      clearOverlays();
      setRemovingId("i-msgs");
      await wait(550);
      setLayout((cur) => cur.filter((it) => it.instanceId !== "i-msgs"));
      setRemovingId(null);
      await wait(1300);
      if (cancelled) return;

      // -- 15: save
      setStepIndex(15);
      await moveCursorTo("[data-demo='save-btn']", {
        caption: {
          title: "Salva e sincroniza",
          body: "O painel é salvo por usuário e te segue no celular, no tablet e em qualquer outro PC.",
        },
      });
      await clickPulse();
      setIsSaving(true);
      await wait(1100);
      setIsSaving(false);
      setIsEditing(false);
      setSavedFlash(true);
      await wait(2000);
      setSavedFlash(false);
      if (cancelled) return;

      // -- 16: outro
      setStepIndex(16);
      clearOverlays();
      setCursor((c) => ({ ...c, x: window.innerWidth / 2, y: 80 }));
      await wait(2400);
      if (cancelled) return;

      // reset for loop
      setLayout(INITIAL_LAYOUT);
      setDraftBorder("rose");
      setDraftHiddenCols([]);
      setDraftDensity("comfortable");
      setConfigureTab("aparencia");
      setSwapHighlight([]);
      await wait(900);
    };

    const loop = async () => {
      while (!cancelled && resetCount < 100) {
        await runOnce();
        resetCount += 1;
        await wait(900);
      }
    };

    loop();
    return () => {
      cancelled = true;
    };
  }, [restartKey, moveCursorTo, clickPulse, wait, findTarget, clearOverlays]);

  // ------- Filters --------------------------------------------------------

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATALOG.filter((w) => {
      if (activeTab !== "all" && w.category !== activeTab) return false;
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q)
      );
    });
  }, [search, activeTab]);

  const tabCounts = useMemo(() => {
    const map: Record<string, number> = { all: CATALOG.length };
    for (const w of CATALOG) {
      map[w.category] = (map[w.category] || 0) + 1;
    }
    return map;
  }, []);

  // ------- Render ---------------------------------------------------------

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground relative">
      {/* Main column (LEFT, fills remaining width) */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <FauxHeader />
        <main className="bg-background flex-1 overflow-y-auto transition-colors">
          <div className="w-full px-6 py-6">
            <DashboardHeader
              isEditing={isEditing}
              isSaving={isSaving}
              savedFlash={savedFlash}
              now={now}
            />

            <div
              className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
              style={{ gridAutoRows: "180px" }}
            >
              {layout.map((inst) => {
                const def = CATALOG_BY_ID[inst.widgetId];
                if (!def) return null;
                const isRemoving = removingId === inst.instanceId;
                const isDragging = draggingId === inst.instanceId;
                const isNewlyAdded = newlyAddedId === inst.instanceId;
                const border = inst.overrides?.border ?? def.defaultBorder;
                return (
                  <div
                    key={inst.instanceId}
                    data-demo={`tile-${inst.instanceId}`}
                    className={`relative h-full min-h-0 transition-all duration-500 ${colSpanClass(inst.size.cols)} ${rowSpanClass(inst.size.rows)} ${
                      isRemoving ? "opacity-0 scale-95" : "opacity-100 scale-100"
                    } ${isDragging ? "opacity-30" : ""} ${
                      isNewlyAdded ? "animate-in fade-in zoom-in-95 duration-500" : ""
                    } ${swapHighlight.includes(inst.instanceId) ? "ring-4 ring-primary/60 ring-offset-2 ring-offset-background rounded-lg" : ""}`}
                  >
                    <WidgetCard
                      def={def}
                      instance={inst}
                      border={border}
                      isEditing={isEditing}
                    />

                    {isEditing && (
                      <>
                        <div className="absolute top-2 left-2 z-20">
                          <button
                            data-demo={`drag-${inst.instanceId}`}
                            type="button"
                            className="cursor-grab rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label={`Arrastar ${def.name}`}
                          >
                            <IconGripVertical className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="absolute top-1.5 right-2 z-20 flex items-center gap-1">
                          <SizeChip instanceId={inst.instanceId} size={inst.size} />
                          <button
                            type="button"
                            data-demo={`settings-${inst.instanceId}`}
                            className="h-7 w-7 rounded p-0 inline-flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
                            title="Configurar widget"
                          >
                            <IconSettings className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            data-demo={`remove-${inst.instanceId}`}
                            className="h-7 w-7 rounded p-0 inline-flex items-center justify-center text-destructive hover:bg-destructive/10"
                            title="Remover widget"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <Footnote />
          </div>
        </main>
      </div>

      <FauxSidebar
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      />

      {/* Overlays */}
      <Spotlight target={highlightTarget} />
      {tooltip && <Caption tooltip={tooltip} />}
      <FauxCursor x={cursor.x} y={cursor.y} clicking={cursor.clicking} />

      {dragGhostXY && draggingId && (
        <div
          className="pointer-events-none fixed z-[90] w-64 rounded-lg border border-primary/40 bg-card/95 backdrop-blur-sm shadow-2xl p-3"
          style={{ left: dragGhostXY.x - 128, top: dragGhostXY.y - 40 }}
        >
          <div className="text-xs font-semibold text-foreground">
            {CATALOG_BY_ID[layout.find((l) => l.instanceId === draggingId)?.widgetId ?? ""]?.name}
          </div>
          <div className="text-[11px] text-muted-foreground">arrastando…</div>
        </div>
      )}

      <SizePopover
        instance={sizePopoverFor ? layout.find((l) => l.instanceId === sizePopoverFor) ?? null : null}
      />

      <AddModal
        open={addOpen}
        search={search}
        widgets={filteredCatalog}
        activeTab={activeTab}
        tabCounts={tabCounts}
      />

      <ConfigureModal
        open={!!configureId}
        target={configureId ? layout.find((l) => l.instanceId === configureId) ?? null : null}
        tab={configureTab}
        border={draftBorder}
        hiddenCols={draftHiddenCols}
        density={draftDensity}
      />

      {/* "Sucesso — Preferência atualizada com sucesso" toast (matches the real one) */}
      {savedFlash && (
        <div className="fixed bottom-6 right-6 z-[110] w-[300px] rounded-lg border border-emerald-500/50 bg-card shadow-2xl p-4 animate-in fade-in slide-in-from-right-2 duration-300">
          <div className="flex items-start gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 mt-1.5 shrink-0 shadow-[0_0_0_4px_rgba(16,185,129,0.2)]" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">Sucesso</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Preferência atualizada com sucesso.
              </div>
            </div>
            <IconX className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          </div>
        </div>
      )}

      {/* "Layout salvo" indicator (shown briefly after save) */}
      {savedFlash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1.5 text-emerald-500 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-300">
          <IconCheck className="h-3.5 w-3.5" />
          Layout salvo
        </div>
      )}

      <DemoControls
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        onRestart={() => {
          setLayout(INITIAL_LAYOUT);
          setIsEditing(false);
          setIsSaving(false);
          setSavedFlash(false);
          setAddOpen(false);
          setConfigureId(null);
          setConfigureTab("aparencia");
          setSizePopoverFor(null);
          setActiveTab("all");
          setSearch("");
          setDraftBorder("rose");
          setDraftHiddenCols([]);
          setDraftDensity("comfortable");
          setNewlyAddedId(null);
          setSwapHighlight([]);
          clearOverlays();
          setCursor({ x: -50, y: -50, clicking: false });
          setRestartKey((k) => k + 1);
        }}
        stepIndex={stepIndex}
        stepCount={stepCount}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function colSpanClass(cols: Cols): string {
  switch (cols) {
    case 1: return "lg:col-span-1 sm:col-span-1";
    case 2: return "lg:col-span-2 sm:col-span-2";
    case 3: return "lg:col-span-3 sm:col-span-2";
    case 4: return "lg:col-span-4 sm:col-span-2 col-span-1";
  }
}
function rowSpanClass(rows: Rows): string {
  switch (rows) {
    case 1: return "row-span-1";
    case 2: return "row-span-2";
    case 3: return "row-span-3";
    case 4: return "row-span-4";
  }
}

// ---------------------------------------------------------------------------
// Header (mirrors web/src/components/navigation/header.tsx)
// ---------------------------------------------------------------------------

function FauxHeader() {
  return (
    <header className="border-b border-border px-4 py-3 w-full h-16 flex items-center justify-between transition-colors bg-card shrink-0">
      <div className="flex items-center gap-4">
        <img
          src="/logo.png"
          alt="Ankaa Logo"
          className="h-12"
          onError={(e) => {
            const span = document.createElement("span");
            span.textContent = "ankaa";
            span.className = "text-2xl font-extrabold tracking-tight text-primary";
            (e.currentTarget as HTMLImageElement).replaceWith(span);
          }}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          className="w-12 h-12 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-foreground"
          title="Menu"
        >
          <IconMenu2 width={20} height={20} />
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Sidebar (RIGHT) — user card + bell + theme in top row, menu below
// ---------------------------------------------------------------------------

function FauxSidebar({
  theme,
  onToggleTheme,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const items: { icon: typeof IconHome; label: string; active?: boolean; hasChildren?: boolean }[] = [
    { icon: IconStar, label: "Favoritos" },
    { icon: IconHome, label: "Início", active: true },
    { icon: IconBriefcase, label: "Administração", hasChildren: true },
    { icon: IconChartBar, label: "Estatísticas", hasChildren: true },
    { icon: IconBuildingWarehouse, label: "Estoque", hasChildren: true },
    { icon: IconLayoutGrid, label: "Ferramentas" },
    { icon: IconCurrencyDollar, label: "Financeiro", hasChildren: true },
    { icon: IconBrush, label: "Pintura", hasChildren: true },
    { icon: IconClipboardList, label: "Produção", hasChildren: true },
    { icon: IconUsers, label: "Recursos Humanos", hasChildren: true },
    { icon: IconFileInvoice, label: "Servidor", hasChildren: true },
  ];
  return (
    <aside className="hidden md:flex flex-col bg-card border-l border-border w-72 shrink-0">
      <div className="border-b border-border h-16 flex items-center px-2 gap-1.5">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg flex-1 min-w-0 hover:bg-muted/50 cursor-pointer transition-colors">
          <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-base">K</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate text-foreground">Kennedy Ca…</div>
            <div className="text-xs opacity-70 truncate text-muted-foreground">kennedy.ankaa…</div>
          </div>
        </div>
        <button
          className="relative h-9 w-9 rounded-lg inline-flex items-center justify-center hover:bg-muted text-foreground"
          title="Avisos"
        >
          <IconBell size={18} />
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold inline-flex items-center justify-center">
            20
          </span>
        </button>
        <button
          onClick={onToggleTheme}
          className="h-9 w-9 rounded-lg inline-flex items-center justify-center hover:bg-muted text-foreground"
          title={theme === "dark" ? "Tema claro" : "Tema escuro"}
        >
          {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div
              key={it.label}
              className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 min-h-[40px] ${
                it.active
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted/50 text-foreground"
              }`}
            >
              <div className="w-5 shrink-0 flex items-center justify-center">
                <Icon size={20} stroke={1.5} />
              </div>
              <span className="flex-1 text-sm font-medium truncate">{it.label}</span>
              {it.hasChildren && (
                <IconChevronRight size={16} className={it.active ? "opacity-90" : "opacity-50"} />
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Page header (greeting + actions + clock)
// ---------------------------------------------------------------------------

function DashboardHeader({
  isEditing,
  isSaving,
  savedFlash,
  now,
}: {
  isEditing: boolean;
  isSaving: boolean;
  savedFlash: boolean;
  now: Date;
}) {
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <header
      data-demo="greeting"
      className="mb-6 flex items-end justify-between gap-4 flex-wrap"
    >
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Bom dia, Kennedy Campos!
        </h1>
        <p className="text-sm text-muted-foreground mt-1 lowercase first-letter:uppercase">
          {dateLabel}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {!isEditing ? (
          <>
            <button
              data-demo="edit-btn"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-accent text-sm font-medium transition-colors"
            >
              <IconPencil className="h-4 w-4" />
              Editar
            </button>
            <span className="text-base font-mono tabular-nums text-foreground/80 px-1">
              {hours}:{minutes}:{seconds}
            </span>
          </>
        ) : (
          <>
            <button
              data-demo="add-btn"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-accent text-sm font-medium transition-colors"
            >
              <IconPlus className="h-4 w-4" />
              Adicionar widget
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-destructive text-destructive-foreground hover:opacity-90 text-sm font-medium transition-opacity">
              <IconArrowBackUp className="h-4 w-4" />
              Descartar
            </button>
            <button
              data-demo="save-btn"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-sm font-semibold transition-opacity"
            >
              <IconDeviceFloppy className="h-4 w-4" />
              {isSaving ? "Salvando..." : savedFlash ? "Salvo" : "Salvar"}
            </button>
            <span className="text-base font-mono tabular-nums text-foreground/80 px-1">
              {hours}:{minutes}:{seconds}
            </span>
          </>
        )}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// WidgetCard — colored accent border + icon-tinted title + count + body + footer
// ---------------------------------------------------------------------------

function WidgetCard({
  def,
  instance,
  border,
  isEditing,
}: {
  def: MockWidget;
  instance: Instance;
  border: AccentKey;
  isEditing: boolean;
}) {
  const Icon = def.icon;
  const accent = ACCENT[border];
  const hiddenCols = instance.overrides?.hiddenColumns ?? [];
  const density = instance.overrides?.density ?? "comfortable";
  return (
    <div className={`h-full w-full rounded-lg border-2 bg-card flex flex-col overflow-hidden transition-colors duration-300 ${accent.ring}`}>
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-border shrink-0 ${
          isEditing ? "pl-9 pr-[160px]" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 ${accent.text} shrink-0`} />
          <span className={`text-sm font-semibold truncate ${accent.titleText}`}>{def.name}</span>
          {def.count !== undefined && (
            <span className={`text-[11px] font-bold rounded px-1.5 py-0.5 tabular-nums ${accent.text} bg-current/15`}
                  style={{ backgroundColor: "rgb(255 255 255 / 0.06)" }}>
              {def.count}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {def.kind === "favorites" && <FavoritesBody pills={def.pills ?? []} />}
        {def.kind === "messages" && <MessagesBody rows={def.messages ?? []} />}
        {def.kind === "tasks-overdue" && (
          <TaskTableBody rows={def.tasks ?? []} hiddenCols={hiddenCols} density={density} />
        )}
        {def.kind === "production" && <ProductionTableBody rows={def.production ?? []} />}
        {def.kind === "low-stock" && <StockTableBody rows={def.stock ?? []} />}
        {def.kind === "ppe-deliveries" && <PpeBody rows={def.ppe ?? []} />}
        {def.kind === "ponto" && <PontoBody rows={def.ponto ?? []} />}
        {def.kind === "quick-note" && <QuickNoteBody />}
      </div>

      <div className="border-t border-border h-8 flex items-center justify-center text-[12px] text-muted-foreground shrink-0 hover:bg-muted/30 transition-colors cursor-pointer">
        <span className="flex items-center gap-1">
          Ver todos
          <IconChevronRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

function FavoritesBody({ pills }: { pills: FavPill[] }) {
  // Vertical card layout: icon centered on top, label centered below.
  // Matches the real home Favoritos widget exactly.
  return (
    <div className="h-full p-2 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
      {pills.map((p) => {
        const Icon = p.icon;
        return (
          <div
            key={p.label}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border/70 bg-card-nested/50 px-2 py-3 hover:bg-muted/40 cursor-pointer transition-colors text-center min-w-0"
          >
            <div className={`shrink-0 h-10 w-10 rounded-xl ${p.bg} ${p.fg} inline-flex items-center justify-center`}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-foreground line-clamp-2 leading-tight max-w-full px-1">
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MessagesBody({ rows }: { rows: MessageRow[] }) {
  // Horizontal row of fixed-width message cards (not a stacked list).
  // Each card has a defined width so the layout reads as a row of chips,
  // matching the real Mensagens Recentes widget.
  return (
    <div className="h-full overflow-x-auto overflow-y-hidden p-2 flex gap-2">
      {rows.map((m, i) => (
        <div
          key={i}
          className="shrink-0 w-[200px] rounded-lg bg-muted/40 border border-border p-2.5 flex flex-col hover:bg-muted/60 cursor-pointer transition-colors"
        >
          <div className="text-sm font-bold text-foreground truncate">{m.from}</div>
          <div className="text-[11px] text-muted-foreground line-clamp-2 leading-snug mt-0.5 flex-1">
            {m.preview}
          </div>
          <div className="text-[10px] text-muted-foreground/70 mt-1">{m.ago}</div>
        </div>
      ))}
    </div>
  );
}

function TableHeader({ cols, hidden = [] }: { cols: string[]; hidden?: string[] }) {
  const visible = cols.filter((c) => !hidden.includes(c));
  return (
    <div
      className="grid gap-2 px-3 py-1.5 border-b border-border bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground font-bold"
      style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
    >
      {visible.map((c) => (
        <span key={c} className="truncate">{c}</span>
      ))}
    </div>
  );
}

function TaskTableBody({
  rows,
  hiddenCols,
  density,
}: {
  rows: TaskRow[];
  hiddenCols: string[];
  density: "compact" | "comfortable";
}) {
  const allCols = ["Logomarca", "Cliente", "Setor", "Prazo", "Status"];
  const visibleCols = allCols.filter((c) => !hiddenCols.includes(c));
  const padY = density === "compact" ? "py-1" : "py-1.5";
  return (
    <div className="h-full flex flex-col">
      <TableHeader cols={allCols} hidden={hiddenCols} />
      <div className="flex-1 overflow-hidden divide-y divide-border/60">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`grid gap-2 px-3 ${padY} text-xs items-center transition-all`}
            style={{ gridTemplateColumns: `repeat(${visibleCols.length}, minmax(0, 1fr))` }}
          >
            {visibleCols.includes("Logomarca") && (
              <span className="truncate text-foreground">{r.name}</span>
            )}
            {visibleCols.includes("Cliente") && (
              <span className="truncate text-foreground/90">{r.client}</span>
            )}
            {visibleCols.includes("Setor") && (
              <span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    r.sectorTone === 2
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-sky-500/20 text-sky-400"
                  }`}
                >
                  {r.sector}
                </span>
              </span>
            )}
            {visibleCols.includes("Prazo") && (
              <span className="text-rose-400 tabular-nums truncate">{r.date}</span>
            )}
            {visibleCols.includes("Status") && (
              <span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    r.status === "Em produção"
                      ? "bg-sky-500/20 text-sky-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {r.status}
                </span>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const TONE_COLOR: Record<ProductionRow["tone"], string> = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  danger: "text-rose-400",
  muted: "text-muted-foreground",
};

function ProductionTableBody({ rows }: { rows: ProductionRow[] }) {
  return (
    <div className="h-full flex flex-col">
      <TableHeader cols={["Logomarca", "Cliente", "OS", "Previsão"]} />
      <div className="flex-1 overflow-hidden divide-y divide-border/60">
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid gap-2 px-3 py-1.5 text-xs items-center"
            style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
          >
            <span className="truncate text-foreground">{r.name}</span>
            <span className="truncate text-foreground/90">{r.client}</span>
            <span className="text-amber-500 font-semibold tabular-nums">{r.count}</span>
            <span className={`tabular-nums truncate ${TONE_COLOR[r.tone]}`}>{r.forecast}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockTableBody({ rows }: { rows: StockRow[] }) {
  return (
    <div className="h-full flex flex-col">
      <TableHeader cols={["Nome", "Marca", "Quant.", "Reposição", "Consumo"]} />
      <div className="flex-1 overflow-hidden divide-y divide-border/60">
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid gap-2 px-3 py-1.5 text-xs items-center"
            style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
          >
            <span className="truncate text-foreground">{r.name}</span>
            <span className="truncate text-foreground/90">{r.brand}</span>
            <span className="flex items-center gap-1 tabular-nums">
              <IconAlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
              <span className="text-rose-400 font-semibold">{r.qty}</span>
            </span>
            <span className="text-foreground/90 tabular-nums">{r.reorder}</span>
            <span className="text-foreground/90 tabular-nums">{r.consumption}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PpeBody({ rows }: { rows: PpeRow[] }) {
  return (
    <div className="h-full flex flex-col">
      <TableHeader cols={["Colaborador", "Item", "Status"]} />
      <div className="flex-1 overflow-hidden divide-y divide-border/60">
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid gap-2 px-3 py-1.5 text-xs items-center"
            style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
          >
            <span className="truncate text-foreground">{r.user}</span>
            <span className="truncate text-foreground/90">{r.item}</span>
            <span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  r.status === "Assinado"
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-500/20 text-amber-500"
                }`}
              >
                {r.status}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PontoBody({ rows }: { rows: PontoRow[] }) {
  return (
    <div className="h-full flex flex-col">
      {/* Date navigation bar — < / Hoje / > matching the real Ponto do Dia widget */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/15">
        <div className="flex items-center gap-1">
          <span className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground cursor-pointer">
            <IconChevronRight className="h-3.5 w-3.5 rotate-180" />
          </span>
          <span className="h-6 px-2 inline-flex items-center rounded bg-muted/40 text-[11px] font-medium gap-1 text-foreground">
            <IconCalendar className="h-3 w-3" />
            Hoje
          </span>
          <span className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground cursor-pointer">
            <IconChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
      <TableHeader cols={["Colaborador", "Entrada 1", "Saída 1", "Entrada 2", "Saída 2"]} />
      <div className="flex-1 overflow-hidden divide-y divide-border/60">
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid gap-2 px-3 py-1 text-xs items-center"
            style={{ gridTemplateColumns: "1.7fr 1fr 1fr 1fr 1fr" }}
          >
            <span className="truncate text-foreground">{r.name}</span>
            <PontoCell v={r.e1} />
            <PontoCell v={r.s1} />
            <PontoCell v={r.e2} />
            <PontoCell v={r.s2} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PontoCell({ v }: { v?: string }) {
  if (!v) return <span className="text-muted-foreground/60">—</span>;
  if (v.startsWith("ATES") || v === "FALTA" || v === "FERIAS") {
    return (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-400 inline-block max-w-full truncate">
        {v}
      </span>
    );
  }
  return <span className="tabular-nums text-foreground/90">{v}</span>;
}

function QuickNoteBody() {
  return (
    <div className="h-full p-3 text-sm text-foreground/90 leading-relaxed space-y-2">
      <div>• Verificar lote 8421 amanhã cedo</div>
      <div>• Ligar fornecedor de tinta PU</div>
      <div>• Confirmar EPI com a equipe</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SizeChip + SizePopover
// ---------------------------------------------------------------------------

function SizeChip({ instanceId, size }: { instanceId: string; size: WidgetSize }) {
  return (
    <button
      data-demo={`resize-trigger-${instanceId}`}
      type="button"
      className="h-7 px-2 gap-1 inline-flex items-center text-xs text-foreground rounded hover:bg-accent border border-border bg-background/50"
      title={`Tamanho: ${WIDTH_LABELS[size.cols]} × ${size.rows} ${size.rows === 1 ? "linha" : "linhas"}`}
    >
      <IconLayoutGrid className="h-3.5 w-3.5" />
      <span className="tabular-nums">
        {WIDTH_LABELS[size.cols]} × {size.rows}
      </span>
    </button>
  );
}

function SizePopover({ instance }: { instance: Instance | null }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!instance) {
      setPos(null);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      const el = document.querySelector(
        `[data-demo='resize-trigger-${instance.instanceId}']`,
      ) as HTMLElement | null;
      if (!el) {
        if (!cancelled) raf = requestAnimationFrame(tick);
        return;
      }
      const r = el.getBoundingClientRect();
      setPos({ left: r.right - 288, top: r.bottom + 6 });
      if (!cancelled) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [instance]);

  if (!instance || !pos) return null;
  const widths: Cols[] = [1, 2, 3, 4];
  const heights: Rows[] = [1, 2, 3, 4];
  return (
    <div
      className="pointer-events-none fixed z-[140] w-72 rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Largura
        </div>
        <div className="grid grid-cols-4 gap-1">
          {widths.map((c) => {
            const active = c === instance.size.cols;
            return (
              <span
                key={c}
                data-demo={`size-width-${WIDTH_LABELS[c]}`}
                className={`relative h-9 rounded-md border text-xs font-medium inline-flex items-center justify-center ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border text-foreground"
                }`}
              >
                {WIDTH_LABELS[c]}
                {active && <IconCheck className="absolute top-0.5 right-0.5 h-3 w-3" />}
              </span>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Altura
        </div>
        <div className="grid grid-cols-4 gap-1">
          {heights.map((r) => {
            const active = r === instance.size.rows;
            return (
              <span
                key={r}
                className={`relative h-9 rounded-md border text-xs font-medium inline-flex items-center justify-center ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border text-foreground"
                }`}
              >
                {HEIGHT_LABELS[r]}
                {active && <IconCheck className="absolute top-0.5 right-0.5 h-3 w-3" />}
              </span>
            );
          })}
        </div>
      </div>

      <div className="pt-1.5 border-t border-border text-[11px] text-muted-foreground tabular-nums text-center">
        {WIDTH_LABELS[instance.size.cols]} largura • {instance.size.rows}{" "}
        {instance.size.rows === 1 ? "linha" : "linhas"} de altura
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add modal
// ---------------------------------------------------------------------------

function AddModal({
  open,
  search,
  widgets,
  activeTab,
  tabCounts,
}: {
  open: boolean;
  search: string;
  widgets: MockWidget[];
  activeTab: "all" | MockWidget["category"];
  tabCounts: Record<string, number>;
}) {
  const tabs: { key: "all" | MockWidget["category"]; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "Estoque", label: "Estoque" },
    { key: "RH", label: "Recursos Humanos" },
    { key: "Produção", label: "Produção" },
    { key: "Financeiro", label: "Financeiro" },
    { key: "Outros", label: "Outros" },
  ];
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[160] flex items-center justify-center transition-opacity duration-300 ${
        open ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`relative w-[760px] max-w-[92%] h-[600px] max-h-[85vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col p-5 transition-all duration-300 ${
          open ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95"
        }`}
      >
        <div className="shrink-0 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Adicionar widget</h2>
            <p className="text-sm text-muted-foreground">
              Escolha um widget para adicionar ao seu painel. Apenas widgets disponíveis para o seu setor são exibidos.
            </p>
          </div>
          <span className="h-7 w-7 rounded inline-flex items-center justify-center text-muted-foreground hover:bg-muted">
            <IconX className="h-4 w-4" />
          </span>
        </div>

        <div className="relative shrink-0 mt-3">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <div
            data-demo="add-search"
            className="w-full h-9 rounded-md border border-input bg-background px-9 inline-flex items-center text-sm text-foreground"
          >
            {search ? <span>{search}</span> : <span className="text-muted-foreground">Buscar widgets...</span>}
            <span className="ml-1 inline-block h-4 w-px bg-foreground animate-pulse" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-3 shrink-0 border-b border-border pb-2">
          {tabs.map((t) => {
            const count = t.key === "all" ? tabCounts.all : tabCounts[t.key as string] ?? 0;
            const active = activeTab === t.key;
            return (
              <span
                key={t.key}
                data-demo={`tab-${t.key}`}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded inline-flex items-center gap-1.5 transition-colors ${
                  active
                    ? "border-b-2 border-primary text-primary -mb-2 pb-3 bg-transparent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                <span
                  className={`text-[10px] tabular-nums px-1 rounded ${
                    active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </span>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden mt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-2">
            {widgets.map((w) => {
              const Icon = w.icon;
              return (
                <div
                  key={w.id}
                  data-demo={`catalog-${w.id}`}
                  className="group relative rounded-lg border border-border bg-card hover:bg-muted/40 hover:border-primary/40 hover:shadow-md transition-all p-3 flex flex-col items-start text-left overflow-hidden h-[150px]"
                >
                  <div className="rounded-md bg-primary/10 p-2 mb-2">
                    <Icon className={`h-5 w-5 ${ACCENT[w.defaultBorder].text}`} />
                  </div>
                  <div className="flex-1 min-h-0 w-full">
                    <div className="text-sm font-semibold leading-tight text-foreground line-clamp-2">
                      {w.name}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3 leading-tight">
                      {w.description}
                    </p>
                  </div>
                  <div className="absolute top-2 right-2 text-[9px] uppercase tracking-wider text-muted-foreground/70 font-bold">
                    {w.category}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configure modal — color, columns, density, rows
// ---------------------------------------------------------------------------

function ConfigureModal({
  open,
  target,
  tab,
  border,
  hiddenCols,
  density,
}: {
  open: boolean;
  target: Instance | null;
  tab: "aparencia" | "colunas" | "filtros" | "cores" | "comportamento";
  border: AccentKey;
  hiddenCols: string[];
  density: "compact" | "comfortable";
}) {
  const def = target ? CATALOG_BY_ID[target.widgetId] : null;
  const columns = def ? COLUMNS_FOR_KIND[def.kind] ?? [] : [];
  const colorName: Record<AccentKey, string> = {
    rose: "Vermelho",
    amber: "Âmbar",
    emerald: "Verde",
    sky: "Azul",
    violet: "Violeta",
    fuchsia: "Magenta",
    none: "—",
  };
  const tabs: { key: typeof tab; label: string; icon: typeof IconPalette }[] = [
    { key: "aparencia", label: "Aparência", icon: IconPalette },
    { key: "colunas", label: "Colunas e ordenação", icon: IconColumns },
    { key: "filtros", label: "Filtros", icon: IconLayoutGrid },
    { key: "cores", label: "Cores de prazo", icon: IconAlertTriangle },
    { key: "comportamento", label: "Comportamento", icon: IconSettings },
  ];

  return (
    <div
      data-demo="configure-modal"
      className={`pointer-events-none fixed inset-0 z-[160] flex items-center justify-center transition-opacity duration-300 ${
        open ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`relative w-[720px] max-w-[94%] max-h-[88vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col transition-all duration-300 ${
          open ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              Configurar: {def?.name ?? "Widget"}
            </h2>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {def?.description ?? "Ajuste a aparência, as colunas, os filtros e o comportamento desta instância."}
            </p>
          </div>
          <span className="h-7 w-7 rounded inline-flex items-center justify-center text-muted-foreground hover:bg-muted">
            <IconX className="h-4 w-4" />
          </span>
        </div>

        {/* Title input */}
        <div className="px-5 pt-4 shrink-0">
          <label className="text-xs font-semibold text-foreground">Título</label>
          <div className="mt-1.5 flex items-center gap-1">
            <div className="flex-1 h-9 rounded-md border border-input bg-background px-3 inline-flex items-center text-sm text-foreground">
              {def?.name ?? "Tarefas Atrasadas"}
            </div>
            <button className="h-9 w-9 rounded-md border border-border inline-flex items-center justify-center text-muted-foreground hover:bg-muted" title="Salvar preset">
              <IconDeviceFloppy className="h-3.5 w-3.5" />
            </button>
            <button className="h-9 w-9 rounded-md border border-border inline-flex items-center justify-center text-muted-foreground hover:bg-muted" title="Carregar preset">
              <IconRotateClockwise className="h-3.5 w-3.5 rotate-180" />
            </button>
            <button className="h-9 w-9 rounded-md border border-border inline-flex items-center justify-center text-muted-foreground hover:bg-muted" title="Restaurar padrão">
              <IconRotateClockwise className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4 shrink-0 border-b border-border flex flex-wrap gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <span
                key={t.key}
                data-demo={`tab-config-${t.key}`}
                className={`text-[13px] font-medium px-3 py-2 inline-flex items-center gap-1.5 transition-colors -mb-px border-b-2 cursor-pointer ${
                  active
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </span>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 pt-4">
          {tab === "aparencia" && (
            <ApariencaTab border={border} colorName={colorName} density={density} />
          )}
          {tab === "colunas" && <ColunasTab columns={columns} hiddenCols={hiddenCols} />}
          {tab === "filtros" && <PlaceholderTab label="Filtros" />}
          {tab === "cores" && <PlaceholderTab label="Cores de prazo" />}
          {tab === "comportamento" && <PlaceholderTab label="Comportamento" />}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 pt-3 border-t border-border shrink-0">
          <span className="px-3 py-1.5 text-sm text-muted-foreground">Cancelar</span>
          <span
            data-demo="configure-apply"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold"
          >
            <IconCheck className="h-3.5 w-3.5" />
            Aplicar
          </span>
        </div>
      </div>
    </div>
  );
}

// Aparência tab — Acento (cor/ícone/borda) + Densidade e linhas
function ApariencaTab({
  border,
  colorName,
  density,
}: {
  border: AccentKey;
  colorName: Record<AccentKey, string>;
  density: "comfortable" | "compact";
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="text-[11px] text-primary hover:underline">Restaurar aparência</button>
      </div>

      {/* Acento section */}
      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <IconPalette className="h-4 w-4" />
            Acento (cor, ícone, borda)
          </div>
          <IconChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
        </div>
        <div className="px-4 pb-4 grid grid-cols-3 gap-2">
          {/* COR */}
          <div
            data-demo="acento-cor"
            className="rounded-md border border-border bg-card-nested/30 p-3 cursor-pointer hover:border-primary/40 transition-colors"
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">COR</div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="h-5 w-5 rounded-md inline-block shrink-0"
                style={{ backgroundColor: COLOR_HEX[border] }}
              />
              <span className="text-sm font-medium text-foreground truncate">{colorName[border]}</span>
            </div>
          </div>
          {/* ÍCONE */}
          <div className="rounded-md border border-border bg-card-nested/30 p-3 cursor-pointer hover:border-primary/40 transition-colors">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">ÍCONE</div>
            <div className="mt-2 flex items-center gap-2">
              <IconClipboardList className={`h-5 w-5 shrink-0 ${ACCENT[border].text}`} />
              <span className="text-sm font-medium text-foreground truncate">Prancheta com texto</span>
            </div>
          </div>
          {/* BORDA */}
          <div
            data-demo="acento-borda"
            className="rounded-md border border-border bg-card-nested/30 p-3 cursor-pointer hover:border-primary/40 transition-colors"
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">BORDA</div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="h-5 w-5 rounded-md inline-block shrink-0 border-2"
                style={{ borderColor: COLOR_HEX[border] }}
              />
              <span className="text-sm font-medium text-foreground truncate">{colorName[border]}</span>
            </div>
          </div>
        </div>
        {/* Inline color picker — visible during demo */}
        <div className="px-4 pb-4 -mt-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mr-2">
              Cor:
            </span>
            {(["rose", "amber", "emerald", "sky", "violet", "fuchsia"] as AccentKey[]).map((c) => (
              <span
                key={c}
                data-demo={`color-${c}`}
                className={`h-7 w-7 rounded-full inline-flex items-center justify-center cursor-pointer transition-all ${
                  border === c
                    ? "ring-2 ring-offset-2 ring-offset-card ring-foreground/40"
                    : "ring-0 hover:scale-110"
                }`}
                style={{ backgroundColor: COLOR_HEX[c] }}
              >
                {border === c && <IconCheck className="h-3.5 w-3.5 text-white" />}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Densidade e linhas */}
      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <IconColumns className="h-4 w-4" />
            Densidade e linhas
          </div>
          <IconChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
        </div>
        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
          <DropdownRow label="Densidade" value={density === "compact" ? "Compacta" : "Confortável"} dataDemo="configure-density" />
          <DropdownRow label="Listras alternadas" value="Sim" />
          <DropdownRow label="Linhas divisórias" value="Sim" />
          <DropdownRow label="Destaque ao passar mouse" value="Sim" />
          <DropdownRow label="Cabeçalho fixo" value="Sim" />
          <DropdownRow label="Bolinha colorida na 1ª coluna" value="Sim" />
          <DropdownRow label="Mostrar caixa de busca" value="Não" />
        </div>
      </div>

      {/* Renderização das células — collapsed */}
      <div className="rounded-lg border border-border flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30">
        <span className="text-sm font-semibold text-foreground">Renderização das células</span>
        <IconChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="rounded-lg border border-border flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30">
        <span className="text-sm font-semibold text-foreground">Cabeçalho e link</span>
        <IconChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

// Colunas e ordenação tab
function ColunasTab({ columns, hiddenCols }: { columns: string[]; hiddenCols: string[] }) {
  const visibleCols = columns.filter((c) => !hiddenCols.includes(c));
  const availableCols = [
    "Acabamento", "Artes", "Categoria", "Chassi", "Comissão", "Concluída em",
    "Criado em", "Detalhes", "Entrada", "Identificador", "Implemento", "Iniciada em",
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="text-[11px] text-primary hover:underline">Restaurar colunas</button>
      </div>

      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-foreground">
            Selecionar e reordenar ({visibleCols.length})
          </span>
          <IconChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
        </div>

        {/* VISÍVEIS */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
            <span>Visíveis ({visibleCols.length})</span>
            <button className="text-primary normal-case font-medium hover:underline">Limpar</button>
          </div>
          <div className="space-y-1">
            {columns.map((col) => {
              const visible = !hiddenCols.includes(col);
              return (
                <div
                  key={col}
                  data-demo={`col-row-${col}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer"
                >
                  <IconGripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <span
                    data-demo={`col-check-${col}`}
                    className={`h-4 w-4 rounded border inline-flex items-center justify-center shrink-0 ${
                      visible
                        ? "bg-primary border-primary"
                        : "bg-card border-border"
                    }`}
                  >
                    {visible && <IconCheck className="h-3 w-3 text-primary-foreground" />}
                  </span>
                  <span className={`text-sm flex-1 ${visible ? "text-foreground" : "text-muted-foreground line-through"}`}>
                    {col}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* DISPONÍVEIS */}
        <div className="px-4 pb-4 border-t border-border pt-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
            Disponíveis (32)
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {availableCols.map((col) => (
              <div key={col} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/40 cursor-pointer">
                <span className="h-4 w-4 rounded border border-border bg-card shrink-0" />
                <span className="text-xs text-foreground/90 truncate">{col}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 leading-snug">
            Marque as colunas que deseja exibir. Arraste pela alça para reordenar — a ordem aqui define a ordem na tabela.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30">
        <span className="text-sm font-semibold text-foreground">Navegação ao clicar na linha</span>
        <IconChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="rounded-lg border border-primary/40 bg-primary/5 flex items-center justify-between px-4 py-3 cursor-pointer">
        <span className="text-sm font-semibold text-primary">Ordenação multi-coluna</span>
        <IconChevronRight className="h-4 w-4 text-primary rotate-90" />
      </div>
    </div>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="h-[300px] flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
      <IconSettings className="h-8 w-8 opacity-30" />
      <p className="text-sm">Conteúdo de "{label}" — disponível no painel real.</p>
    </div>
  );
}

function DropdownRow({
  label,
  value,
  dataDemo,
}: {
  label: string;
  value: string;
  dataDemo?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-foreground">{label}</label>
      <div
        data-demo={dataDemo}
        className="mt-1 h-9 rounded-md border border-input bg-background px-3 flex items-center justify-between text-xs text-foreground cursor-pointer hover:border-primary/40 transition-colors"
      >
        <span>{value}</span>
        <IconChevronRight className="h-3.5 w-3.5 text-muted-foreground rotate-90" />
      </div>
    </div>
  );
}

const COLOR_HEX: Record<AccentKey, string> = {
  rose: "rgb(244 63 94)",
  amber: "rgb(245 158 11)",
  emerald: "rgb(16 185 129)",
  sky: "rgb(14 165 233)",
  violet: "rgb(139 92 246)",
  fuchsia: "rgb(217 70 239)",
  none: "rgb(120 120 120)",
};

// ---------------------------------------------------------------------------
// Cursor / Spotlight / Caption
// ---------------------------------------------------------------------------

function FauxCursor({ x, y, clicking }: { x: number; y: number; clicking: boolean }) {
  return (
    <div
      className="pointer-events-none fixed z-[200] transition-all duration-700 ease-out"
      style={{ left: x - 2, top: y - 2 }}
    >
      <div className="relative">
        {clicking && (
          <span className="absolute -inset-3 rounded-full bg-primary/35 animate-ping" />
        )}
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]"
        >
          <path
            d="M2 2 L2 18 L7 13 L10 20 L13 19 L10 12 L17 12 Z"
            fill="white"
            stroke="black"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

function Spotlight({ target }: { target: string | null }) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(
    null,
  );
  useEffect(() => {
    if (!target) {
      setBox(null);
      return;
    }
    let raf = 0;
    let cancelled = false;
    let missCount = 0;
    const tick = () => {
      const el = document.querySelector(target) as HTMLElement | null;
      if (!el) {
        missCount += 1;
        if (missCount > 3) setBox(null);
        if (!cancelled) raf = requestAnimationFrame(tick);
        return;
      }
      missCount = 0;
      const rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        if (!cancelled) raf = requestAnimationFrame(tick);
        return;
      }
      setBox({
        left: rect.left - 6,
        top: rect.top - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      });
      if (!cancelled) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [target]);
  if (!box) return null;
  return (
    <div
      className="pointer-events-none fixed z-[150] rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background shadow-[0_0_0_4000px_rgba(0,0,0,0.20)] transition-[left,top,width,height] duration-500"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    />
  );
}

function Caption({
  tooltip,
}: {
  tooltip: { x: number; y: number; title: string; body: string; anchor: "top" | "bottom" };
}) {
  return (
    <div
      className="pointer-events-none fixed z-[180] w-[300px] transition-all duration-500"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: `translate(-50%, ${tooltip.anchor === "top" ? "-100%" : "0"})`,
      }}
    >
      <div className="rounded-lg bg-foreground text-background shadow-2xl px-3.5 py-2.5">
        <div className="text-[11px] uppercase tracking-wider opacity-70 font-semibold flex items-center gap-1">
          <IconArrowRight className="h-3 w-3" />
          {tooltip.title}
        </div>
        <div className="text-[13px] leading-snug font-medium mt-0.5">{tooltip.body}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer + controls
// ---------------------------------------------------------------------------

function Footnote() {
  return (
    <p className="text-[11px] text-muted-foreground/70 mt-6">
      Apresentação automática do painel customizável — as ações são simuladas para gravação. Nenhuma alteração é enviada ao servidor.
    </p>
  );
}

function DemoControls({
  paused,
  onTogglePause,
  onRestart,
  stepIndex,
  stepCount,
}: {
  paused: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
  stepIndex: number;
  stepCount: number;
}) {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("clean") === "1") {
    return null;
  }
  return (
    <div className="fixed bottom-3 left-3 z-[210] flex items-center gap-2 rounded-full bg-card/95 backdrop-blur border border-border shadow-lg px-2 py-1.5">
      <button
        onClick={onTogglePause}
        className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-foreground"
        title={paused ? "Retomar" : "Pausar"}
      >
        {paused ? <IconPlayerPlayFilled className="h-3.5 w-3.5" /> : <IconPlayerPauseFilled className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={onRestart}
        className="h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-muted text-foreground"
        title="Reiniciar"
      >
        <IconRotateClockwise className="h-3.5 w-3.5" />
      </button>
      <span className="text-[11px] text-muted-foreground tabular-nums px-1.5">
        {stepIndex}/{stepCount}
      </span>
      <button
        onClick={() => {
          const url = new URL(window.location.href);
          url.searchParams.set("clean", "1");
          window.location.href = url.toString();
        }}
        className="h-7 px-2 inline-flex items-center justify-center rounded-full text-[11px] font-semibold hover:bg-muted text-foreground"
        title="Modo gravação (esconde estes controles)"
      >
        <IconX className="h-3 w-3 mr-1" />
        modo limpo
      </button>
    </div>
  );
}

export { DashboardDemoPage };
