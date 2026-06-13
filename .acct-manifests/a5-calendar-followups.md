# a5-calendar — follow-ups / manifest (2026-06-11)

Agent a5-calendar (Calendário unificado + Agenda com avisos + Aniversários + Post-its).

## Already wired by me directly (NO action needed)
- `web/src/constants/routes.ts` → `tools.postIts.root = "/ferramentas/post-its"`.
- `web/src/App.tsx` → lazy `PostItsPage` + `<Route path={routes.tools.postIts.root}>` inside the tools route group.
- `web/src/constants/enums.ts` → `FAVORITE_PAGES.FERRAMENTAS_POST_ITS = "/ferramentas/post-its"`; `enum-labels.ts` → label "Post-its".
- `web/src/api-client/index.ts`, `query-keys.ts`, `schemas/index.ts`, `types/index.ts`, hooks barrels → agenda-event + postit registrations.
- API: `human-resources.module.ts` → `AgendaEventModule` + `PostitModule`; `api/src/schemas/index.ts` + `api/src/types/index.ts` re-exports.

## Confirmed already handled by other agents (verified, no action)
- `web/src/utils/route-privileges.ts` line ~279 already contains `"/ferramentas/post-its"` with broad privileges + TEAM_LEADER (nav agent). Do not duplicate.
- Navigation "Post-its" entry at `/ferramentas/post-its` — nav agent owns it.

## Nav follow-ups (for nav agent, if not already planned)
- None mandatory. Optional: HR calendar nav entry (`/recursos-humanos/calendario`, navigation.ts:1885/1985) could be retitled "Calendário" under a more general section since it now shows feriados + férias + faltas + afastamentos + aniversários + eventos da agenda. Privileges stay [HUMAN_RESOURCES, ADMIN, ACCOUNTING] (page-level PrivilegeRoute matches).

## Deferred / open risks
1. **Year view overlays**: the "Ano" view of the calendar still shows only absences/holidays icons; afastamentos/aniversários/eventos are month-view only (kept the 12×42-cell grid light). Data is already fetched for the full year range if someone wants to add them.
2. **Mobile parity**: no mobile screens for agenda events / post-its / unified calendar (consistent with the build's mobile-deferred decision).
3. **window.confirm**: event delete (calendar day panel) and post-it delete use `window.confirm`; could be upgraded to the app's AlertDialog pattern.
4. **Notification configs**: agenda-event reminders and `user.birthday` have NO rows in `seed-notification-configs.ts` — they dispatch directly via `notificationService.createNotification` (in-code `user.birthday` template + inline pt-BR copy for agenda reminders). If the config-driven enable/disable switchboard should govern them, add `agenda_event.reminder` and `user.birthday` ConfigDefs to the seed registry and pass `metadata.configKey`.
5. **Férias source**: calendar férias remain Secullum-driven (JustificativaId=2 via aggregated absences), NOT the `vacations` web module — same source the page always used. Afastamentos use the new `Leave` entity.
6. **Leave fetch cap**: calendar fetches up to 100 leaves with `startDate <= periodEnd` (no lower bound, to catch open-ended leaves). If the Leave table grows past that, add a smarter overlap filter server-side.
7. **Cron timing**: agenda reminders daily 08:00, birthdays 07:30 (America/Sao_Paulo). Idempotency: `lastNotifiedAt` atomic claim (agenda) / same-day USER_BIRTHDAY notification existence (birthday). Restarting the API after 08:00 does not re-send.
8. **DB**: no migrations needed (AgendaEvent/Postit models + prisma client already existed).
