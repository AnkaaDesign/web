// =====================================================
// Navigation "new activity" alert sound (the annoying bip)
// =====================================================
//
// A deliberately grating alarm-style beep, synthesized on the fly with the Web
// Audio API (no asset to ship, full control over how obnoxious it is). Paired with
// the nav-activity blink: while a cut is waiting to be started and the operator has
// not gone to the Recorte page, the state machine in `use-nav-activity-alert` fires
// this beep in short bursts to nag them there.
//
// Harshness recipe: three detuned square-wave partials (dissonant + slightly beating),
// a fast internal pitch trill, and a fast square-wave amplitude tremolo — i.e. a
// buzzer, not a chime. All of it is capped by a master gain so it stays loud-but-safe.
//
// Autoplay: browsers keep an AudioContext "suspended" until the first user gesture, so
// we lazily create it and resume it on the first pointer/key/touch event. In this app
// the user has always logged in (i.e. interacted) long before a cut alert can fire, so
// by the time we beep the context is unlocked.

const MUTE_STORAGE_KEY = "ankaa-nav-alert-muted";

type AudioCtx = AudioContext;

let ctx: AudioCtx | null = null;
let unlockBound = false;

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
}

function getContext(): AudioCtx | null {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

/** Attach one-time listeners that resume a suspended context on the first user gesture. */
function bindUnlock(): void {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const resume = () => {
    const c = getContext();
    if (c && c.state === "suspended") c.resume().catch(() => {});
  };
  (["pointerdown", "keydown", "touchstart"] as const).forEach((ev) => window.addEventListener(ev, resume, { capture: true, passive: true }));
}

if (typeof window !== "undefined") bindUnlock();

/** Read the (optional) escape-hatch mute flag. Off by default — the alert is meant to nag. */
function isMuted(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Programmatic mute toggle (no UI wired up; a safety valve for devs/power users). */
export function setNavAlertMuted(muted: boolean): void {
  try {
    if (typeof window === "undefined") return;
    if (muted) window.localStorage.setItem(MUTE_STORAGE_KEY, "1");
    else window.localStorage.removeItem(MUTE_STORAGE_KEY);
  } catch {
    // localStorage unavailable — ignore
  }
}

/** Build and fire one harsh beep on the given context. */
function synthesize(c: AudioCtx): void {
  const now = c.currentTime;
  const dur = 0.22; // long enough to register as a distinct, irritating "bip"

  // Master gain carries the amplitude envelope: near-instant attack, flat hold, quick
  // release. Kept at 0.35 so three stacked partials don't clip.
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.35, now + 0.004);
  master.gain.setValueAtTime(0.35, now + dur - 0.05);
  master.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  master.connect(c.destination);

  // Tremolo: a fast square LFO chops the amplitude ~42x/sec → buzzer-like roughness.
  const trem = c.createGain();
  trem.gain.value = 0.5; // baseline; LFO swings it around this
  trem.connect(master);
  const lfo = c.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = 42;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.5;
  lfo.connect(lfoDepth);
  lfoDepth.connect(trem.gain);
  lfo.start(now);
  lfo.stop(now + dur);

  // Three dissonant, slightly-beating partials. Each also trills between two grating
  // pitches four times across the beep for a smoke-alarm "warble".
  const step = dur / 4;
  const partials = [2794, 2809, 3958]; // near-unison beating pair + a jarring interval above
  for (const base of partials) {
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.setValueAtTime(base * 1.19, now + step);
    osc.frequency.setValueAtTime(base, now + step * 2);
    osc.frequency.setValueAtTime(base * 1.19, now + step * 3);
    const g = c.createGain();
    g.gain.value = 1 / partials.length;
    osc.connect(g);
    g.connect(trem);
    osc.start(now);
    osc.stop(now + dur);
  }
}

/** Play one annoying beep, unless muted or the browser has no Web Audio support. */
export function playAnnoyingBeep(): void {
  if (isMuted()) return;
  const c = getContext();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  try {
    synthesize(c);
  } catch {
    // A transient Web Audio failure must never break navigation — swallow it.
  }
}
