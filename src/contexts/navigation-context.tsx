import { useMemo, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { MENU_ITEMS } from "@/constants";
import type { MenuItem } from "@/constants";
import { getFilteredMenuForUser } from "@/utils";
import { useAuth } from "@/contexts/auth-context";

/**
 * Navigation context — remembers WHICH menu entry the user clicked.
 *
 * Several pages live under more than one menu section (e.g. /departamento-pessoal/colaboradores
 * exists under "Administração" for ADMIN and under "Departamento Pessoal" for the same
 * ADMIN; /departamento-pessoal/bonus is both RH > Bônus and DP > Salários e Cargos >
 * Gratificações). Pure URL matching therefore cannot tell which section should be
 * highlighted/expanded — it used to pick a section the user never clicked, "opening
 * different menus when clicking into other pages".
 *
 * The fix: when a nav entry is clicked we record its id+path (sessionStorage, so it
 * survives reloads but stays per-tab). Winner resolution prefers a match inside the
 * recorded entry's subtree (the entry itself or one of its children, e.g. its
 * /detalhes/:id route); when the recorded entry no longer matches the URL we fall back
 * to the longest-match algorithm over the whole visible tree.
 *
 * Implementation note: this is a module-level store exposed through
 * useSyncExternalStore instead of a <Provider> so the sidebar, flyout and page
 * breadcrumbs can share it without adding wiring to the app provider tree.
 */

const STORAGE_KEY = "ankaa-nav-context";

export interface RecordedNav {
  id: string;
  path: string;
}

let cached: RecordedNav | null | undefined; // undefined = sessionStorage not read yet
const listeners = new Set<() => void>();

function read(): RecordedNav | null {
  if (cached !== undefined) return cached;
  try {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as RecordedNav) : null;
    cached = parsed && typeof parsed.id === "string" && typeof parsed.path === "string" ? parsed : null;
  } catch {
    cached = null;
  }
  return cached;
}

function write(next: RecordedNav | null) {
  cached = next;
  try {
    if (typeof window !== "undefined") {
      if (next) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage unavailable — keep the in-memory value only
  }
  listeners.forEach((l) => l());
}

/** Record a sidebar/flyout menu-entry click (id + path disambiguate duplicate ids). */
export function recordNavClick(id: string | undefined, path: string | undefined): void {
  if (!id || !path) return;
  write({ id, path });
}

/** Forget the recorded entry (favorites jumps are section-less navigation). */
export function clearNavContext(): void {
  write(null);
}

export function getRecordedNav(): RecordedNav | null {
  return read();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRecordedNav(): RecordedNav | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

// ---------------------------------------------------------------------------
// Pure winner resolution (shared by the sidebar, the collapsed flyout and the
// breadcrumbs hook — and imported directly by the simulation tests).
// ---------------------------------------------------------------------------

export interface NavTrailEntry {
  id: string;
  title: string;
  path?: string;
}

export interface ActiveNav {
  /** The single winning nav item (exactly one item gets the full active style). */
  id: string | null;
  title: string | null;
  hasChildren: boolean;
  /** Ancestors of the winner, outermost section first. */
  trail: NavTrailEntry[];
  /** Every id present in the visible tree (lets callers tell nav rows from ad-hoc rows). */
  navIds: Set<string>;
}

const CONTEXTUAL_ACTIONS = ["cadastrar", "criar", "editar", "detalhes"];
const KNOWN_STATIC_SEGMENTS = ["criar", "cadastrar", "editar", "detalhes", "testar", "editar-em-lote", "editar-lote", "list", "novo"];

/**
 * Match score for one item against the URL: exact static/dynamic matches score the
 * full URL length (so they beat any strict prefix), prefix matches score the prefix
 * length, contextual entries (cadastrar/criar/editar/detalhes) never win as prefixes.
 */
function matchScore(item: MenuItem, currentPath: string): number {
  const itemPath = item.path;
  if (!itemPath) return -1;

  if (itemPath.includes(":")) {
    // Don't let /foo/:id swallow known static siblings like /foo/criar.
    const basePathMatch = itemPath.match(/^(.+?)\/:[^/]+/);
    if (basePathMatch) {
      const basePath = basePathMatch[1];
      if (currentPath.startsWith(basePath + "/")) {
        const firstSegment = currentPath.slice(basePath.length + 1).split("/")[0];
        if (KNOWN_STATIC_SEGMENTS.includes(firstSegment)) return -1;
      }
    }
    const pattern = itemPath.replace(/:[^/]+/g, "[^/]+");
    return new RegExp(`^${pattern}$`).test(currentPath) ? currentPath.length : -1;
  }

  if (currentPath === itemPath) return itemPath.length;

  const clean = itemPath.replace(/\/:[^/]+/g, "");
  const isContextual = CONTEXTUAL_ACTIONS.some(
    (action) => item.id?.includes(action) || clean.endsWith(`/${action}`) || clean.includes(`/${action}/`),
  );
  if (!isContextual && currentPath.startsWith(clean + "/")) return clean.length;
  return -1;
}

interface Candidate {
  id: string;
  title: string;
  hasChildren: boolean;
  isLeaf: boolean;
  score: number;
  trail: NavTrailEntry[];
}

/**
 * Longest match across `items`; ties prefer the DEEPER item (a child over a section
 * that shares its path), then a LEAF over a container, then tree order.
 */
function resolveWithin(items: MenuItem[], baseTrail: NavTrailEntry[], currentPath: string): Candidate | null {
  let best: Candidate | null = null;
  const beats = (score: number, depth: number, isLeaf: boolean): boolean => {
    if (!best) return true;
    if (score !== best.score) return score > best.score;
    if (depth !== best.trail.length) return depth > best.trail.length;
    return isLeaf && !best.isLeaf;
  };
  const visit = (list: MenuItem[], trail: NavTrailEntry[]) => {
    for (const it of list || []) {
      const id = it.id || it.path;
      const isLeaf = !it.children || it.children.length === 0;
      const score = matchScore(it, currentPath);
      if (score >= 0 && id && beats(score, trail.length, isLeaf)) {
        best = { id, title: it.title, hasChildren: !isLeaf, isLeaf, score, trail };
      }
      if (it.children) visit(it.children, id ? [...trail, { id, title: it.title, path: it.path }] : trail);
    }
  };
  visit(items, baseTrail);
  return best;
}

function collectNavIds(items: MenuItem[], navIds: Set<string>) {
  for (const it of items || []) {
    const id = it.id || it.path;
    if (id) navIds.add(id);
    if (it.children) collectNavIds(it.children, navIds);
  }
}

/** Locate the recorded entry in the visible tree (id AND path — ids can repeat). */
function findRecordedItem(items: MenuItem[], recorded: RecordedNav, trail: NavTrailEntry[] = []): { item: MenuItem; trail: NavTrailEntry[] } | null {
  for (const it of items || []) {
    if (it.id === recorded.id && it.path === recorded.path) return { item: it, trail };
    if (it.children) {
      const id = it.id || it.path;
      const found = findRecordedItem(it.children, recorded, id ? [...trail, { id, title: it.title, path: it.path }] : trail);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Resolve the single active nav item for a URL.
 * 1. If the user clicked a nav entry and the URL still belongs to it (the entry itself
 *    or any of its descendants, e.g. its /detalhes/:id route), the winner is resolved
 *    INSIDE that entry's subtree — other sections sharing the path never win.
 * 2. Otherwise: longest match over the whole visible tree (exact beats prefix, leaf
 *    beats container, then tree order).
 */
export function resolveActiveNav(menu: MenuItem[], currentPath: string, recorded?: RecordedNav | null): ActiveNav {
  const navIds = new Set<string>();
  collectNavIds(menu, navIds);

  let winner: Candidate | null = null;
  if (recorded) {
    const found = findRecordedItem(menu, recorded);
    if (found) winner = resolveWithin([found.item], found.trail, currentPath);
  }
  if (!winner) winner = resolveWithin(menu, [], currentPath);

  return winner
    ? { id: winner.id, title: winner.title, hasChildren: winner.hasChildren, trail: winner.trail, navIds }
    : { id: null, title: null, hasChildren: false, trail: [], navIds };
}

/**
 * Expansion state derived from the winner: exactly the winner's ancestor chain is
 * expanded (plus the winner itself when it is a container); every other container in
 * the tree — at every level — is collapsed (accordion).
 */
export function computeExpandedFromActive(menu: MenuItem[], active: ActiveNav): { [key: string]: boolean } {
  const expandedIds = new Set(active.trail.map((t) => t.id));
  if (active.id && active.hasChildren) expandedIds.add(active.id);
  const map: { [key: string]: boolean } = {};
  const visit = (items: MenuItem[]) => {
    for (const it of items || []) {
      if (it.id && it.children && it.children.length > 0) map[it.id] = expandedIds.has(it.id);
      if (it.children) visit(it.children);
    }
  };
  visit(menu);
  return map;
}

// ---------------------------------------------------------------------------
// Breadcrumbs derived from the navigation context
// ---------------------------------------------------------------------------

export interface NavBreadcrumb {
  label: string;
  href?: string;
}

/**
 * Pure breadcrumb builder: "Início" + the winner's ancestor titles (+ the winner
 * title, unless the page supplies its own leaf crumbs, e.g. an entity name).
 * Falls back to the page's static array when no nav entry matches the URL.
 */
export function buildNavBreadcrumbs(
  menu: MenuItem[],
  currentPath: string,
  recorded: RecordedNav | null,
  fallback: NavBreadcrumb[],
  leaf?: NavBreadcrumb[],
): NavBreadcrumb[] {
  const active = resolveActiveNav(menu, currentPath, recorded);
  if (!active.id || !active.title) return fallback;
  const crumbs: NavBreadcrumb[] = [{ label: "Início", href: "/" }];
  for (const t of active.trail) {
    crumbs.push({ label: t.title, href: t.path && !t.path.includes(":") ? t.path : undefined });
  }
  crumbs.push(...(leaf && leaf.length > 0 ? leaf : [{ label: active.title }]));
  return crumbs;
}

/**
 * Breadcrumbs for shared pages reachable from multiple menu sections.
 * Derives the trail from the user's visible menu + the recorded nav entry, so an
 * ACCOUNTING user who opened "Departamento Pessoal > Colaboradores" sees
 * "Início / Departamento Pessoal / Colaboradores" instead of a hardcoded
 * "Administração" trail. `opts.leaf` replaces the final crumb (entity names etc.).
 */
export function useNavBreadcrumbs(fallback: NavBreadcrumb[], opts?: { leaf?: NavBreadcrumb[] }): NavBreadcrumb[] {
  const { user } = useAuth();
  const location = useLocation();
  const recorded = useRecordedNav();
  const leaf = opts?.leaf;

  const menu = useMemo(() => getFilteredMenuForUser(MENU_ITEMS, (user as any) || undefined, "web"), [user]);

  return useMemo(
    () => buildNavBreadcrumbs(menu, location.pathname, recorded, fallback, leaf),
    // fallback/leaf are typically inline literals; recomputing per render is cheap.
    [menu, location.pathname, recorded, fallback, leaf],
  );
}
