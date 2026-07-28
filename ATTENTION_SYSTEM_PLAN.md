# Attention System — Blink / Bip + Presence ("is-editing") Plan

A generalized, event-driven **Attention** system that can blink+bip a **table row**, a
**detail page**, or a **single field**, driven by (1) configurable **business rules** and
(2) real-time **presence** ("someone is editing this"). Replaces the hardcoded cut/Recorte
nav alert with a data-driven engine. First target: the Task workflow.

---

## 0. Terminology — "webhook" → WebSocket (you already have it)

For **intra-app** real-time, a webhook (outbound HTTP callback) is the wrong tool — it's for
third-party integrations. What you actually want is a **push channel**, and you already have a
production one: **Socket.io**, NestJS `@WebSocketGateway`, namespace `notifications`, with
`user:{id}` / `sector:{sectorId}` / `admin` rooms (`api/src/modules/common/notification/
notification.gateway.ts`), a web singleton `socketService` (`web/src/lib/socket.ts`), and
`use-notification-socket.tsx` that already maps socket events onto the react-query cache.

Your "2 webhooks per entity" map to **two event topics per entity**, carried over this socket:

| Topic | Direction | Purpose |
|---|---|---|
| **`presence`** | client ⇄ server | "User X is editing entity Y" (edit form open, or a mutating right-click action). Bidirectional → needs a socket, not a webhook. |
| **`attention`** | server → client | "Entity Y changed" + "these entities need attention" (rule/state signals + cache-invalidation triggers). |

No polling. The current cut source polls every 60s (`use-nav-activity.ts`); we delete that and
drive everything from these two topics + a coarse server-side time-trigger cron.

---

## 1. Three-layer architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 3 — RENDER PRIMITIVES (web)                                     │
│  AttentionProvider (owns blink+bip lifecycle, keyed by ruleId:entityId)│
│  useAttention(type,id) · useAttentionField(type,id,field) · <AttentionRow>│
│  reuses nav-alert-sound.ts (bip) + index.css keyframes (blink)        │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 2 — RULE ENGINE (shared descriptors, hybrid eval)              │
│  Rules are DATA: predicate + target + roles + cadence + ack-policy   │
│  Client evaluates loaded rows → which row/field blinks (zero server) │
│  Server evaluates for nav badge + time-triggers → pushes attention   │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 1 — TRANSPORT (reuse existing Socket.io)                       │
│  new `attention` namespace/gateway + per-entity presence rooms       │
│  reuse socketService, sector/user/admin room targeting               │
└─────────────────────────────────────────────────────────────────────┘
```

**The single most important design decision:** the blink+bip lifecycle is owned by a
**top-level `AttentionProvider`, keyed by `(ruleId, entityId)`** — NOT by the row/field/detail
component. Row/field/detail components only *subscribe* to the shared phase. This is the only
structure that satisfies "don't stop the moment I open the detail page; play the full 5× cycle,
then re-trigger after cooldown." Navigation just re-renders a subscriber; it never restarts or
kills the running cycle. This generalizes the existing `use-nav-activity-alert.ts` state machine
(which today lives once in the sidebar) into a provider that can key many concurrent cycles.

---

## 2. The Attention primitive — addressing scheme

Everything keys off one address: **`entityType:entityId[:field]`**.

- **Row** → subscribe `task:123` → whole-row blink + "edited-by" ring.
- **Detail page** → subscribe `task:123` (page-level) + `task:123:forecastDate` (field-level).
- **Field** → subscribe `task:123:forecastDate`.

This is what makes it reusable across every entity and both migrated components.

---

## 3. Rule model — rules are DATA (like your notification config)

Model the blink rules on the existing `NotificationConfiguration` system
(`api/prisma/schema.prisma:2506`, admin UI `web/src/pages/administration/notifications/
configurations/create.tsx`). A rule descriptor (shared shape, evaluable on client AND server):

```ts
interface AttentionRule {
  id: string;
  name: string;                 // "Liberado sem data de entrada"
  entityType: "TASK" | ...;     // start with TASK
  enabled: boolean;
  priority: number;             // higher wins when multiple rules hit same target

  // WHO sees it — reuses SectorPrivileges (already how roles are modeled)
  targetSectors: SectorPrivileges[];   // e.g. [LOGISTIC, PRODUCTION_MANAGER]

  // WHEN it fires — a small serializable predicate DSL (see §3.1)
  predicate: PredicateNode;

  // WHERE it blinks
  target: { level: "row" } | { level: "detail" } | { level: "field"; field: string };

  // HOW it blinks/bips — replaces today's hardcoded constants
  cadence: {
    blinkCount: number;         // was MIN_BEEPS..MAX_BEEPS (3–5)
    intervalMs: number;         // BEEP_SPACING_MS (800)
    soundEnabled: boolean;      // per-rule; can be user-muted
    cooldownMs: number;         // was SNOOZE_MS (30 * 60 * 1000)
  };

  // stop condition — the crux of your forecast example
  acknowledgement: "onView" | "onResolve" | "cycleThenCooldown";
}
```

**Acknowledgement policies** (this is why your cut rule and forecast rule behave differently):
- `onView` — silences when the user opens the entity's detail page (old cut behavior, but per-entity now).
- `onResolve` — silences only when `predicate` becomes false (forecast updated / marked entry).
- `cycleThenCooldown` — always plays the full N-blink cycle, goes quiet, waits `cooldownMs`,
  re-evaluates; re-fires if still true. **Composes** with `onResolve` → your forecast rule =
  `cycleThenCooldown` + auto-stop when predicate false. Entering the detail page does NOT stop it.

### 3.1 Predicate DSL (serializable, so a config UI can author it)

```ts
type PredicateNode =
  | { op: "and" | "or"; nodes: PredicateNode[] }
  | { op: "not"; node: PredicateNode }
  | { op: "eq" | "ne" | "gt" | "lt"; field: string; value: Primitive | "$now" }
  | { op: "isNull" | "notNull"; field: string };
```

A single evaluator (`evaluatePredicate(node, entity, now)`) is duplicated into web + api (same
as your existing schema-duplication convention). Field paths use dotted access
(`truck.chassisNumber`) so truck-level fields work.

### 3.2 The three Task rules, encoded

Confirmed field names: `Task.cleared: boolean`, `Task.entryDate`, `Task.term`,
`Task.forecastDate`, `Task.serialNumber`; chassis/plate live on `truck.chassisNumber` /
`truck.plate`.

> **Superseded 2026-07-27 — read `src/lib/attention/rules.ts`, not the snippets below.**
> R3 was split into R3a (chassis), R3b (plate) and R3c (plaqueta). The plate rule only fires
> when the task has **no serial number** — the two identify the same vehicle, so a task
> carrying a serial is already identified. R3c tests `truck.vinPlateId`: a Plaqueta deixou de
> ser texto e virou FOTO, então o alerta pede uma ação concreta (fotografar a plaqueta) em vez
> de um número que ninguém digitava.

```ts
// R1 — cleared but no entry date yet → blink the forecast field for logistics + prod manager
{ name: "Liberado sem entrada", entityType: "TASK",
  predicate: { op:"and", nodes:[ {op:"eq",field:"cleared",value:true},
                                 {op:"isNull",field:"entryDate"} ] },
  target: { level:"field", field:"forecastDate" },
  targetSectors: [LOGISTIC, PRODUCTION_MANAGER],
  acknowledgement: "cycleThenCooldown" }

// R2 — forecast date arrived and it's NOT cleared anymore → blink forecast
{ name: "Previsão vencida sem liberação", entityType: "TASK",
  predicate: { op:"and", nodes:[ {op:"lt",field:"forecastDate",value:"$now"},
                                 {op:"eq",field:"cleared",value:false} ] },
  target: { level:"field", field:"forecastDate" },
  targetSectors: [LOGISTIC, PRODUCTION_MANAGER],
  acknowledgement: "cycleThenCooldown" }   // time-triggered (see §7)

// R3 — truck is here (entryDate set) but chassis/vinplate missing → logistics must capture
{ name: "Entrada sem chassi/placa", entityType: "TASK",
  predicate: { op:"and", nodes:[ {op:"notNull",field:"entryDate"},
                                 {op:"or",nodes:[ {op:"isNull",field:"truck.chassisNumber"},
                                                  {op:"isNull",field:"truck.vinPlate"} ]} ] },
  target: { level:"field", field:"chassisNumber" },   // detail field id, task-detail-page.tsx:605
  targetSectors: [LOGISTIC],
  acknowledgement: "cycleThenCooldown" }
```

---

## 4. Hybrid evaluation — who decides what blinks

| Question | Decided by | Why |
|---|---|---|
| Which **row/field** on screen blinks | **Client** engine over loaded rows | Client already has the data; zero server cost; O(rows×rules), rules are few |
| Whether a task **not on screen** needs attention (nav badge) | **Server** attention summary, pushed via socket | Client can't see unloaded data |
| **Time-based** firing ("forecast date arrived") | **Server** cron → emits `attention` event | Time passing isn't a client event |
| **Presence** ("being edited") | **Server** in-memory registry, pushed | Cross-user state |

Client engine lives in the `AttentionProvider`: on every relevant react-query cache change it
re-runs `evaluateRules(loadedEntities, currentUser)` and diffs the active-attention set, starting
/ stopping cycles accordingly. No polling — cache changes are themselves driven by socket events.

---

## 5. Reuse & generalize the existing state machine + sound

Existing, already-good building blocks to lift out of the sidebar into the provider:

- **State machine** `web/src/hooks/common/use-nav-activity-alert.ts` — `runBurst()`, snooze
  (`SNOOZE_MS`), `randomBeepCount()`, `reconcile()`, localStorage persistence. Generalize:
  make it operate on a **map of active cycles keyed by `ruleId:entityId`** instead of one global
  cut alert; read cadence/cooldown from the rule instead of module constants.
- **Sound** `web/src/utils/nav-alert-sound.ts` — `playAnnoyingBeep()`, `isMuted()`, lazy
  `AudioContext`. Reuse as-is; add a per-rule `soundEnabled` gate and an autoplay-unlock on first
  user gesture (queue until unlocked).
- **Blink CSS** `web/src/index.css:423` `@keyframes nav-activity-pulse` / `.nav-activity-blink`
  + `prefers-reduced-motion` block (`:442`). Reuse the keyframes; add a lighter
  `.attention-blink-field` variant for inline fields.
- **Nav trail resolution** `web/src/contexts/navigation-context.ts`
  (`resolveNavActivityBlinkIds`) — keep; feed it from the rule engine's server summary instead of
  the hardcoded cut path in `use-nav-activity.ts`.

Net: the nav-menu alert becomes *one consumer* of the same engine, and its "cut" source becomes
*one rule* (R0: `CUT_STATUS.PENDING exists`, `targetSectors:[WAREHOUSE]`, `acknowledgement:onView`).

---

## 6. Presence subsystem ("is-editing")

### Server (new, small)
- New gateway `api/src/modules/common/attention/attention.gateway.ts` (clone
  `backup.gateway.ts` pattern), namespace `attention`, JWT auth like the notifications gateway.
- In-memory `Map<entityKey, Map<socketId, {userId, name, since}>>`. No DB writes (ephemeral).
- `@SubscribeMessage('presence:enter')` `{entityType, entityId}` → add editor, join room
  `entity:{type}:{id}`, broadcast `presence:update {entityType, entityId, editors[]}`.
- `presence:leave` + `handleDisconnect` + heartbeat timeout → auto-release (prevents stuck locks).
- Optional soft-lock: on concurrent submit, server can warn; NOT a hard lock (keep it advisory).

### Web
- `useEntityPresence(entityType, entityId)` → `{ editors, isEditedByOthers }`.
- **Announce entry points** (fire `presence:enter` / `leave`):
  - Every edit form mount/unmount (`useEditForm` is the natural single hook to instrument).
  - Task preparation right-click mutating actions in `task-prep-page.tsx` — "Editar" (`:517`),
    "Liberar" (`:536`), "Dar Entrada" (`:552`), "Definir Setor/Prazo" (`:621`/`:628`), etc.
    Fire a short-lived presence pulse around the optimistic action.
- **Render**: row ring via `getRowClassName`; detail header presence chip; form banner
  "Ana está editando esta tarefa". On `beforeunload`, emit `leave`.

### Change broadcast + cache invalidation (the "reload the data" requirement)
- On any Task mutation, API emits an internal `EventEmitter2` event `entity.changed`
  `{entityType, entityId, changedFields}`, forwarded by the gateway as socket `entity:changed`.
- Web listener (clone `use-notification-socket.tsx`) invalidates the matching react-query keys.
  Task keys are centralized: `taskKeys` in `web/src/hooks/common/query-keys.ts:731`
  (`taskKeys.all`, `taskKeys.detail(id)`). Debounce invalidations (coalesce bursts).
- This closes the loop: someone edits → others' tables/detail refetch → client engine
  re-evaluates → blink state updates. Zero polling.

---

## 7. Time-triggers (server cron)

The only unavoidable periodic work (time passing is not an event). NestJS `@Cron` every ~5–15 min:
- Query tasks crossing a time boundary this window (e.g. `forecastDate` just passed and still
  `cleared=false` → R2). Coarse, indexed DB query — not per-client polling.
- Emit `attention` events (and refresh per-sector nav summaries) so connected clients re-evaluate.
- Reuse `NotificationCooldown` (`schema.prisma:2496`) for dedup so it doesn't re-fire each tick.

---

## 8. Data model (Prisma) — new + reused

**Reuse:** `NotificationCooldown` (30m cooldown / dedup), `SeenNotification.remindAt`
(acknowledge / remind-me-later), `SectorPrivileges` (role targeting), `NotificationConfiguration`
+ `NotificationRule.ruleConfig Json` (rule authoring pattern).

**New models:**
- `AttentionRule` — the persisted rule (§3 shape); `predicate`/`target`/`cadence` as `Json`,
  `targetSectors SectorPrivileges[]`, `priority`, `enabled`.
- `AttentionRulePreference` — per-user opt-out / mute-sound per rule (mirrors
  `UserNotificationPreference`, `schema.prisma:2461`).
- `AttentionAck` — per-user, per-`(ruleId, entityId)` acknowledgement + `snoozeUntil` (server-side
  so cooldown survives reloads and follows the user across devices; replaces today's localStorage
  cut snooze). Unique `[userId, ruleId, entityId]`.

**Enum gap:** `LOGISTIC_MANAGER` does **not** exist (only `LOGISTIC`; `PRODUCTION_MANAGER` does).
Decision needed — add the enum value, or target `LOGISTIC` (see Open Decisions).

---

## 9. Integration into the migrated components (minimal, additive)

### New DataTable (`components/ui/datatable/`)
- **Row blink + edited-by ring**: use the existing first-class hook
  `getRowClassName(row)` (`data-table.tsx:104`, merged last via `cn`, memo-comparator already keys
  on it at `:1518`). Return attention/presence classes:
  ```ts
  getRowClassName={(t) => cn(
    attn.rowClass("TASK", t.id),        // "" | "attention-blink ring-1 ring-red-500"
    presence.rowClass("TASK", t.id),    // "" | "ring-1 ring-amber-400 animate-[pulse...]"
  )}
  ```
  No table-core changes.
- **Field blink**: inside the column's `cell` renderer, wrap the value in a subscriber:
  ```ts
  cell: ({ row }) => <AttentionField type="TASK" id={row.original.id} field="forecastDate">
                       {formatForecast(row.original)}</AttentionField>
  ```

### New DetailPage (`components/ui/detailpage/`)
- Add optional `blink?: boolean | string` (rule/highlight id) to `DetailFieldDef`
  (`detail-page-types.ts:107`); OR its `field` value into the `DetailRow className` in
  `inline-edit-field.tsx` (~`:461`). Field-level blink with zero structural change.
- Section blink: conditional class on the `Card` in `detail-section.tsx:113` keyed off `def.id`.
- Detail header: presence chip ("editando: Ana") + page-level attention.
- Because paging state (`location.state.ids`) and the provider live above the route, the running
  blink cycle persists when you land on `task-detail-page.tsx` — it plays out its 5×, per spec.

---

## 10. Config & preferences UI (clone the notification pattern)

- **Admin rules editor**: clone `pages/administration/notifications/configurations/{list,create,
  edit,details}.tsx`. Sections: Basic (name, entityType, enabled, priority) · Predicate builder
  (field/op/value rows → `PredicateNode`) · Target (level + field + `targetSectors`) · Cadence
  (blinkCount, intervalMs, cooldownMs, soundEnabled) · Acknowledgement policy.
- **Per-user prefs**: extend the profile preferences hub
  (`pages/profile/notification-preferences.tsx`) with an "Alertas / Blink" tab — mute sound,
  opt out of specific rules, global reduced-motion respect.

---

## 11. Performance & robustness checklist

- **No polling** anywhere; delete the cut `refetchInterval` source.
- **Autoplay policy**: unlock `AudioContext` on first user gesture; queue bips until unlocked.
- **prefers-reduced-motion**: already handled for nav; apply the same to new blink variants.
- **Provider cost**: O(loadedRows × rules); rules are few; evaluation memoized on cache version.
- **Room scoping**: presence rooms per open entity; attention summaries per sector room — bounded fan-out.
- **Debounced invalidation**: coalesce `entity:changed` bursts before touching react-query.
- **Cooldown/ack persistence**: server-side `AttentionAck` (cross-device) instead of localStorage.
- **Multiple rules on one target**: resolve by `priority`; highest-priority visual wins (or stack).
- **Presence cleanup**: heartbeat timeout + disconnect + `beforeunload` → no stuck "being edited".
- **Graceful socket loss**: `socketService` already has infinite reconnect + `sync:request`;
  on reconnect, re-announce presence and refetch attention summary.

---

## 12. Phased rollout

- **Phase 1 — Render engine + Task rules (client-only, rules as code).**
  `AttentionProvider` (generalized state machine + sound), `useAttention`/`useAttentionField`/
  `<AttentionField>`, blink CSS. Encode R0(cut)+R1+R2+R3 as code constants. Wire into new
  DataTable (`getRowClassName`, field cells) + DetailPage. Retire the hardcoded cut nav source →
  nav becomes an engine consumer. **Delivers visible value with no schema/gateway work.**
- **Phase 2 — Presence + change broadcast.** `attention` gateway, `presence:*`, `entity:changed`
  → query invalidation. Instrument `useEditForm` + task-prep right-click actions. Row/detail/form
  "edited-by" UI.
- **Phase 3 — Persistence & config.** `AttentionRule` + `AttentionAck` + `AttentionRulePreference`
  models; admin rules editor + per-user prefs; server-side cooldown/ack; server attention summary
  for the global nav badge; time-trigger cron for R2.
- **Phase 4 — Expand.** More Task rules; extend engine to other entities (orders, cuts already
  covered, inventory, etc.) — each new entity = new rules, no new plumbing.

---

## 12b. IMPLEMENTATION STATUS (built & typecheck-verified)

**DONE (web tsc + api tsc clean; only pre-existing unrelated errors remain):**

Web — `web/src/lib/attention/` (self-contained):
- `types.ts` · `predicate.ts` (DSL evaluator) · `rules.ts` (R1/R2/R3 + R0 cut) ·
  `engine.ts` (multi-key burst→cooldown→re-fire state machine, sound serialization,
  pushed-attention support, global version) · `ack-store.ts` (localStorage) ·
  `attention-context.tsx` (provider) · `use-attention.ts` (hooks + class resolvers) ·
  `attention-field.tsx` (`<AttentionField>` + manual-warning icon/double-click) ·
  `presence.ts` (is-editing store) · `attention-socket.ts` + `use-attention-socket.tsx`
  (dedicated `attention` socket) · `send-warning.tsx` (recipient-picker modal) · `index.ts`.
- Sound: `utils/nav-alert-sound.ts` extended with `playAttentionBeep(tone)` (soft/harsh) — additive.
- CSS: `index.css` attention/presence keyframes + reduced-motion.
- `App.tsx`: `<AttentionProvider>` mounted app-wide.
- Task detail (`task-detail-page.tsx`): forecast + chassis fields wrapped in `<AttentionField>`
  (+ send-warning icon), task registered, `onView` acknowledged on open.
- Cronograma (`task-schedule-table-page.tsx`): row blink (attention + presence) via
  `getRowClassName`, "Enviar aviso" row action, live re-render.
- Edit page (`schedule/edit/[id].tsx`): `useAnnouncePresence` ("is editing").
- `use-task.ts`: broadcasts `entity:changed` on mutation so other clients reload.

API — `api/src/modules/common/attention/` (isolated, cannot affect notifications):
- `attention.gateway.ts` (namespace `attention`, JWT+rooms, presence registry,
  `presence:enter/leave`, `entity:changed` rebroadcast, `attention:push/dismiss`) ·
  `attention.service.ts` (manual warning dispatch) · `attention.controller.ts`
  (`POST /attention/warnings`) · `attention.module.ts`. Registered in `app.module.ts`.

**Not runtime-tested** (no dev server run) — verification is TypeScript + careful additive wiring.

## 12c. REMAINING — Task #4 (deferred; needs a DB migration in your env)

The engine runs fully on the localStorage ack fallback, so this is pure enhancement.
Apply in your environment (I did not run migrations against your DB):

1. **Prisma** (`api/prisma/schema.prisma`) — add, then `prisma migrate dev` + `prisma generate`:
   - `AttentionAck { id, userId, ruleId, entityType, entityId, snoozeUntil DateTime?, acknowledged Boolean, lastFiredAt DateTime, @@unique([userId,ruleId,entityId]) }`
   - `AttentionRule { …the §3 shape as columns/Json… }` · `AttentionRulePreference { userId, ruleId, muted, soundMuted, @@unique([userId,ruleId]) }`
2. **API** — `AttentionAckService` + `GET/PUT /attention/ack` (mirror the notification-preference repo pattern); optional `@Cron` sweep for R2 emitting `attention`/`entity:changed`; server attention summary endpoint for the nav badge.
3. **Web** — implement a server-backed `AttentionAckStore` and `configureAckStore(serverStore)` in the provider (localStorage stays as offline cache); admin rules editor cloned from `pages/administration/notifications/configurations/*`; per-user prefs tab in `pages/profile/notification-preferences.tsx`.
4. **Nav unification** — once the server summary exists, feed `use-nav-activity` from it and retire the polling cut source.

## 13. Resolved decisions (locked)

1. **Role target → use existing `LOGISTIC`.** No new enum. Forecast/chassis rules target
   `[LOGISTIC, PRODUCTION_MANAGER]`. (Revisit only if managers must be distinguished later.)
2. **Rules-as-code first.** Phase 1 encodes R0–R3 as code constants; DB config UI lands in Phase 3.
3. **Server-side `AttentionAck`.** Cooldown/snooze/"already saw it" persist per-user in the DB
   (cross-device). **Consequence:** the `AttentionAck` model + a minimal read/write endpoint move
   **into Phase 1** (the only backend needed early); rules themselves stay in code. localStorage is
   used only as an offline fallback cache.
4. **Per-rule sound, harsh tone for high-priority.** `cadence.soundEnabled` per rule; the
   smoke-alarm bip is reserved for high-priority rules, softer/none for routine ones; user-mutable
   per rule.

### Adjusted phasing (reflecting #3)
- **Phase 1** now also includes: `AttentionAck` Prisma model + `GET/PUT /attention/ack` (or reuse
  the notification service's persistence pattern). Everything else in Phase 1 unchanged.
- **Phase 3** drops `AttentionAck` (already built) and keeps: `AttentionRule` +
  `AttentionRulePreference` models, admin rules editor, per-user prefs, server attention summary,
  time-trigger cron.
