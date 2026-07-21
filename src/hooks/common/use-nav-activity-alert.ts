// =====================================================
// Navigation activity ALERT state machine (blink + annoying bip)
// =====================================================
//
// Layers a nag loop on top of the raw "new activity" signal (see `use-nav-activity`).
// The raw signal only says "there is a pending cut → this path wants attention". This
// module decides WHEN that turns into an active alert (blinking guide + audible bips)
// versus staying quiet, and drives the sound.
//
// Behaviour (cuts):
//   • A pending cut exists and the user is NOT on the Recorte page and is NOT snoozed
//     → ALERTING: the nav entry blinks AND we play bursts of 3–5 bips, each burst
//     spaced 0.8s bip-to-bip, then a 60s gap, then another burst — forever, until the
//     user acts or the alert is otherwise suppressed.
//   • The user opens the Recorte page → the blink and bips stop immediately and a 30
//     minute snooze starts (refreshed for as long as they stay on the page).
//   • They leave without clearing the cuts → stays quiet for the rest of the 30 min,
//     then, if a cut is still pending, the whole nag loop starts over.
//   • A NEW cut is created during the snooze (the pending count rises) → the snooze is
//     cancelled immediately and the nag resumes mid-window; creating a cut overrides
//     the 30 min mute.
//   • No pending cut → idle, silent.
//
// Implementation: a single module-level engine (one set of timers, one audio loop) fed
// by one driver hook mounted once in the always-present sidebar. Modeled after the
// module-level store in `navigation-context` and exposed via useSyncExternalStore, so
// consumers just read the snooze/route-gated set of paths that should blink right now.

import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";

import { routes } from "@/constants";
import { useNavActivity } from "@/hooks/common/use-nav-activity";
import { playAnnoyingBeep } from "@/utils/nav-alert-sound";

const CUT_ROOT = routes.production.cutting.root; // "/producao/recorte"

const SNOOZE_MS = 30 * 60 * 1000; // quiet window after the user visits the cut page
const CYCLE_GAP_MS = 60 * 1000; // wait after a burst finishes before the next burst
const BEEP_SPACING_MS = 800; // bip-to-bip spacing inside a burst
const MIN_BEEPS = 3;
const MAX_BEEPS = 5;

const EMPTY_PATHS: ReadonlySet<string> = new Set<string>();

/** "Entered the cut page" = the list root or any of its sub-routes (detalhes/editar/…). */
function isCutPage(pathname: string): boolean {
  return pathname === CUT_ROOT || pathname.startsWith(CUT_ROOT + "/");
}

// ---------------------------------------------------------------------------
// Persistence — the snooze and the last-seen cut count are mirrored to localStorage
// so a full page reload doesn't wipe the mute (which would restart the blink + bip)
// nor make the first post-reload poll mistake the existing pending cuts for brand-new
// ones (which would also clear the snooze). Both survive a reload; a fresh login
// clears them via reset().
// ---------------------------------------------------------------------------
const SNOOZE_STORAGE_KEY = "ankaa-cut-alert-snooze-until"; // epoch ms
const COUNT_STORAGE_KEY = "ankaa-cut-alert-last-count"; // last pending-cut count

function readStoredNumber(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0; // storage unavailable (SSR / private mode) — fall back to in-memory only
  }
}

function persistState(): void {
  try {
    localStorage.setItem(SNOOZE_STORAGE_KEY, String(snoozeUntil));
    localStorage.setItem(COUNT_STORAGE_KEY, String(lastCutCount));
  } catch {
    // storage unavailable / quota — snooze silently degrades to in-memory for this tab.
  }
}

// ---------------------------------------------------------------------------
// Module-level engine (single instance for the whole app)
// ---------------------------------------------------------------------------

// Latest inputs pushed in by the driver hook.
let inputPaths: ReadonlySet<string> = EMPTY_PATHS; // every activity path (cuts + any future source)
let inputCutPending = false; // is the cut path currently signalling activity?
let inputOnCutPage = false; // is the user on the Recorte page right now?

let snoozeUntil = readStoredNumber(SNOOZE_STORAGE_KEY); // epoch ms; alerting suppressed until this moment
let cutQueueMountCount = 0; // dashboard "Fila de Corte" widgets currently on screen
let lastCutCount = readStoredNumber(COUNT_STORAGE_KEY); // last observed count of pending cuts (to detect newly-created ones)

// Beep loop state.
let alerting = false;
let beepTimers: ReturnType<typeof setTimeout>[] = [];
let cycleTimer: ReturnType<typeof setTimeout> | null = null;
let snoozeWakeTimer: ReturnType<typeof setTimeout> | null = null;

// Snapshot exposed to React (the paths that should blink NOW, after gating).
let blinkPaths: ReadonlySet<string> = EMPTY_PATHS;
let blinkSignature = "";
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function pathsSignature(paths: ReadonlySet<string>): string {
  return [...paths].sort().join("|");
}

function randomBeepCount(): number {
  // 3, 4 or 5 — re-rolled every burst so the pattern never settles into something
  // the ear can tune out.
  return MIN_BEEPS + Math.floor(Math.random() * (MAX_BEEPS - MIN_BEEPS + 1));
}

function runBurst(): void {
  if (!alerting) return;
  const n = randomBeepCount();
  for (let i = 0; i < n; i++) {
    beepTimers.push(setTimeout(() => playAnnoyingBeep(), i * BEEP_SPACING_MS));
  }
  // Next burst starts 60s AFTER the last bip of this burst.
  const untilNextBurst = (n - 1) * BEEP_SPACING_MS + CYCLE_GAP_MS;
  cycleTimer = setTimeout(() => {
    beepTimers = [];
    runBurst();
  }, untilNextBurst);
}

function startAlerting(): void {
  if (alerting) return;
  alerting = true;
  runBurst();
}

function stopAlerting(): void {
  if (!alerting && beepTimers.length === 0 && !cycleTimer) return;
  alerting = false;
  beepTimers.forEach(clearTimeout);
  beepTimers = [];
  if (cycleTimer) {
    clearTimeout(cycleTimer);
    cycleTimer = null;
  }
}

/**
 * Reconcile the engine to the latest inputs. Idempotent: safe to call repeatedly
 * (React effects, StrictMode double-invokes, the snooze-expiry timer) — it always
 * derives desired state from current inputs and only starts/stops what needs it.
 */
function reconcile(): void {
  const now = Date.now();

  // Two surfaces show the cut queue: the Recorte page AND the dashboard "Fila de
  // Corte" widget. Being on EITHER suppresses the alert and (re)arms the shared 30 min
  // snooze, so entering one silences the blink + bip for both — and the nag can't come
  // back until the user has been away from both for the full window.
  const onCutSurface = inputOnCutPage || cutQueueMountCount > 0;
  if (onCutSurface) snoozeUntil = now + SNOOZE_MS;

  const shouldAlert = inputCutPending && !onCutSurface && now >= snoozeUntil;

  // Gate the blink: strip only the cut path when the cut alert is suppressed; any other
  // (future) activity source keeps blinking as normal.
  let nextBlink: ReadonlySet<string>;
  if (shouldAlert || !inputPaths.has(CUT_ROOT)) {
    nextBlink = inputPaths;
  } else {
    const stripped = new Set(inputPaths);
    stripped.delete(CUT_ROOT);
    nextBlink = stripped.size === 0 ? EMPTY_PATHS : stripped;
  }
  const nextSignature = pathsSignature(nextBlink);
  if (nextSignature !== blinkSignature) {
    blinkSignature = nextSignature;
    blinkPaths = nextBlink;
    emit();
  }

  if (shouldAlert) startAlerting();
  else stopAlerting();

  // Wake exactly when the snooze expires so the nag resumes on time, without waiting
  // for the next React Query poll or a route change to nudge us.
  if (snoozeWakeTimer) {
    clearTimeout(snoozeWakeTimer);
    snoozeWakeTimer = null;
  }
  if (!shouldAlert && inputCutPending && !onCutSurface && now < snoozeUntil) {
    snoozeWakeTimer = setTimeout(reconcile, snoozeUntil - now + 50);
  }

  // Mirror the mute state to storage so it survives a page reload.
  persistState();
}

function updateInputs(
  paths: ReadonlySet<string>,
  cutPending: boolean,
  onCutPage: boolean,
  cutCount: number,
): void {
  // A newly-created cut (the pending count went UP) cancels any active snooze, so the
  // nag resumes immediately — creating a cut overrides the 30 min mute. While the user
  // is on a cut surface reconcile() re-arms the snooze anyway, so this only re-alerts
  // once they're actually away.
  //
  // Only act on a REAL, loaded count. On (re)load the cuts query hasn't resolved yet and
  // reports 0; if we let that 0 overwrite the (persisted) baseline, the next real count
  // would look like a burst of "new" cuts and wrongly clear the snooze — which is exactly
  // what made the mute vanish on every reload. A genuine "0 pending" needs no handling
  // here: there's nothing to alert about, so leaving the baseline untouched is harmless.
  if (cutCount > 0) {
    if (cutCount > lastCutCount) snoozeUntil = 0;
    lastCutCount = cutCount;
  }

  inputPaths = paths;
  inputCutPending = cutPending;
  inputOnCutPage = onCutPage;
  reconcile();
}

/** Full teardown — used when the sidebar unmounts (e.g. logout) so nothing keeps beeping. */
function reset(): void {
  inputPaths = EMPTY_PATHS;
  inputCutPending = false;
  inputOnCutPage = false;
  snoozeUntil = 0;
  lastCutCount = 0;
  persistState(); // clear the persisted mute too, so a fresh login starts clean
  stopAlerting();
  if (snoozeWakeTimer) {
    clearTimeout(snoozeWakeTimer);
    snoozeWakeTimer = null;
  }
  if (blinkSignature !== "") {
    blinkSignature = "";
    blinkPaths = EMPTY_PATHS;
    emit();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ReadonlySet<string> {
  return blinkPaths;
}

// ---------------------------------------------------------------------------
// Driver hook — mount ONCE (the always-present sidebar). Returns the set of paths
// that should blink right now (snooze/route-gated), and drives the bip loop.
// ---------------------------------------------------------------------------

export function useNavActivityAlert(): ReadonlySet<string> {
  const navActivity = useNavActivity();
  const location = useLocation();

  const onCutPage = isCutPage(location.pathname);
  const cutPending = navActivity.paths.has(CUT_ROOT);
  const cutCount = navActivity.counts.get(CUT_ROOT) ?? 0;

  useEffect(() => {
    updateInputs(navActivity.paths, cutPending, onCutPage, cutCount);
  }, [navActivity.paths, cutPending, onCutPage, cutCount]);

  // Only true unmount (not every input change) tears the engine down.
  useEffect(() => reset, []);

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_PATHS);
}

// ---------------------------------------------------------------------------
// Cut-queue widget presence — lets the dashboard "Fila de Corte" widget count as a
// cut surface. While ANY instance is mounted the nag is suppressed; unmounting arms
// the same 30 min snooze the cut page uses (shared `snoozeUntil`), so viewing the
// widget silences the blink + bip exactly like opening the Recorte page, and vice
// versa. Call once per widget instance; the counter tolerates several on one board.
// ---------------------------------------------------------------------------
export function useCutQueueAlertPresence(): void {
  useEffect(() => {
    cutQueueMountCount += 1;
    snoozeUntil = Date.now() + SNOOZE_MS;
    reconcile();
    return () => {
      cutQueueMountCount = Math.max(0, cutQueueMountCount - 1);
      snoozeUntil = Date.now() + SNOOZE_MS; // leaving → keep both quiet for the full window
      reconcile();
    };
  }, []);
}
