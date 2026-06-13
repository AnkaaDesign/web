# a6-docs-medicina — follow-ups (navigation.ts / route-privileges.ts / shared files)

## navigation.ts / route-privileges.ts

**No changes required.** This pass added no new web routes/pages:

- The "Documentação" feature is a card (`UserDocumentationCard`) inside the
  existing collaborator detail page (`/administracao/colaboradores/detalhes/:id`)
  — see `a6-docs-user-detail.md` for the exact import/JSX snippet to apply.
- All medicina-do-trabalho / departamento-pessoal routes used here already exist
  and were registered by W4 in the previous wave.

## New API endpoints (already gated ACCOUNTING/HUMAN_RESOURCES/ADMIN by the
controller-level @Roles — no api-side registration pending)

- `GET  /admissions/by-user/:userId` — admission (1:1) by collaborator, default
  include `documents.file + user`; returns `data: null` (success) when the user
  has no admission yet.
- `POST /admissions/by-user/:userId/documents` — multipart (`file` + `type`,
  `note?`); lazily creates the Admission (DOCS_PENDING + default checklist,
  changelogged) when absent, then upserts the document row by type
  (OTHER allows multiples), status → RECEIVED.

## Deferred / notes

- Mobile parity for the Documentação card and medicina-do-trabalho screens
  remains pending (consistent with the rest of the ACCOUNTING area).
- `AdmissionDocument.expiresAt` exists (api) and is editable via
  `PUT /admissions/documents/:documentId`, but no expiry dashboard exists for
  ADMISSION documents (only medical exams have /expiring). Possible future
  follow-up for CNH renewals.
