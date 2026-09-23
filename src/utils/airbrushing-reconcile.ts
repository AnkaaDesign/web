import { airbrushingService } from "@/api-client/airbrushing";
import { AIRBRUSHING_STATUS, AIRBRUSHING_PAYMENT_STATUS, AIRBRUSHING_DUE_DATE_RULE } from "@/constants";
import type { FileWithPreview } from "@/components/common/file";
import { buildAirbrushingPayload, hasNonDefaultAirbrushingConfig } from "@/utils/airbrushing-submit";
import { createAirbrushingFormData } from "@/utils/form-data-helper";

// A RECONCILIAÇÃO DAS AEROGRAFIAS DE UMA TAREFA — planejar e executar.
//
// Morava dentro de `task-edit-form.tsx`, que era o único lugar que gravava aerografia
// editada. O orçamento passou a editar a aerografia de CADA veículo, e duas cópias do
// mesmo diff (com os mesmos cuidados de arquivo, status de layout e envelope em lote)
// divergiriam no primeiro conserto. Uma definição só, usada pelos dois.

/**
 * Reconciliation plan for a task's airbrushings — the airbrushing analog of the cut
 * reconciliation. Airbrushings are individual DB rows carrying their own status /
 * payment workflow + file attachments, so on save we diff the form's rows against the
 * loaded DB snapshot and touch ONLY what changed: create genuinely-new rows, update the
 * ones whose fields/files changed (preserving the rest), and delete the ones the user
 * removed. Driving deletes/updates off this diff (instead of shipping the array inside
 * the task payload) is what fixes the "remove all airbrushings never persists" bug —
 * a removed row is now an explicit delete rather than a swallowed empty array.
 *
 * `uploaded` mock Files (existing attachments re-hydrated by the selector) are kept as
 * ID references; only genuinely-new `File` objects (uploaded === falsy) are sent as
 * multipart. Rows with new files must use the single multipart create/update endpoint
 * (the JSON batch endpoints can't carry uploads) — matching how cuts fan brand-new
 * uploads out to `createCut` while batching everything else.
 */
export type AirbrushingFiles = { receipts: File[]; invoices: File[]; layouts: File[] };
export type AirbrushingCreateOp = { data: Record<string, any>; files: AirbrushingFiles };
export type AirbrushingUpdateOp = {
  id: string;
  data: Record<string, any>;
  files: AirbrushingFiles;
  /** The row's attachment set changed, so it must go through the single multipart endpoint. */
  touchesFiles: boolean;
};

export function planAirbrushingReconciliation(
  originalList: any[],
  formList: any[],
): { toCreate: AirbrushingCreateOp[]; toUpdate: AirbrushingUpdateOp[]; toDelete: string[]; hasChanges: boolean } {
  const originalById = new Map<string, any>((originalList || []).map((a) => [a.id, a]));

  // Ids of the files this row ALREADY has on the server. The rows reaching this planner
  // come from two different places with two different shapes, and the predicate must
  // accept both or it silently reports "this row has no files":
  //   • rows the user touched  → `MultiAirbrushingSelector` hydrated them into
  //     FileWithPreview (a real `File` carrying `uploaded: true` + `uploadedFileId`);
  //   • rows the user did NOT touch → still the raw API objects `mapDataToForm` seeded,
  //     which are plain objects with `id` and NO `uploaded` flag (the selector skips its
  //     first sync-to-form on purpose, so the form value keeps them as-is).
  // Testing `f.uploaded` alone therefore returned [] for every untouched airbrushing,
  // which both marked the row as changed and sent `layoutIds: []` — the batch update then
  // detached every layout the airbrushing had. Anything that is not a pending browser
  // upload is already persisted, so key off that instead.
  // Typed `FileWithPreview` rather than `any`: `instanceof File` narrows a plain `any` all the way
  // down to the DOM `File`, which has no `uploaded` — so the flag read would be an error while the
  // check it guards silently kept working.
  const isPendingUpload = (f: FileWithPreview): boolean => f instanceof File && !f.uploaded;
  const uploadedIds = (files: any[]): string[] =>
    (files || [])
      .filter((f) => f && !isPendingUpload(f))
      .map((f) => f.uploadedFileId || f.fileId || f.id)
      .filter(Boolean);
  const newFilesOf = (files: any[]): File[] => (files || []).filter(isPendingUpload) as File[];
  const time = (d: any): number | null => (d ? new Date(d).getTime() : null);
  const sameIds = (a: string[], b: string[]): boolean => a.slice().sort().join(",") === b.slice().sort().join(",");
  const origFileIds = (files: any[]): string[] =>
    (files || []).map((f: any) => f.fileId || f.file?.id || f.id).filter(Boolean);

  // The two row shapes also disagree on WHERE the receipt/invoice lists live: the selector
  // publishes `receiptFiles`/`invoiceFiles`, while an untouched row still carries
  // `mapDataToForm`'s `receipts`/`invoices`. Reading only the former reported "no receipts"
  // for every untouched airbrushing and shipped `receiptIds: []`, which detached them the
  // same way the layouts were lost. Always resolve through these accessors.
  const rowReceipts = (a: any): any[] => a.receiptFiles ?? a.receipts ?? [];
  const rowInvoices = (a: any): any[] => a.invoiceFiles ?? a.invoices ?? [];
  const rowLayouts = (a: any): any[] => a.layouts ?? [];

  // ---------- Status de layout (Rascunho / Aprovado / Reprovado) ----------
  // O status viaja por DOIS canais, porque um layout que ainda não subiu não tem File ID
  // no cliente (ele nasce no servidor, durante o upload):
  //   • já persistido → mapa `fileId → status`;
  //   • recém-anexado → array na MESMA ordem dos blobs, casado por índice no servidor.
  // Sem os dois, aprovar um layout de aerografia pelo formulário da tarefa não gravava
  // nada: o plano de reconciliação só mandava `layoutIds` e o status era descartado.
  // 'DRAFT' é o default explícito dos dois lados para que a comparação abaixo seja exata.
  const statusOf = (f: any, map: Record<string, string>): string =>
    map[f.uploadedFileId] ?? map[f.fileId] ?? map[f.id] ?? f.status ?? "DRAFT";
  const rowLayoutStatuses = (a: any): Record<string, string> => {
    const map = (a.layoutStatuses ?? {}) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const f of rowLayouts(a)) {
      if (!f || isPendingUpload(f)) continue;
      const fileId = f.uploadedFileId || f.fileId || f.id;
      if (fileId) out[fileId] = statusOf(f, map);
    }
    return out;
  };
  const rowNewLayoutStatuses = (a: any): string[] => {
    const map = (a.layoutStatuses ?? {}) as Record<string, string>;
    return newFilesOf(rowLayouts(a)).map((f: any) => statusOf(f, map));
  };
  const origLayoutStatuses = (orig: any): Record<string, string> =>
    Object.fromEntries(
      (orig?.layouts || [])
        .map((l: any) => [l.fileId || l.file?.id || l.id, l.status ?? "DRAFT"])
        .filter(([fileId]: [string]) => !!fileId),
    );
  const sameStatuses = (a: Record<string, string>, b: Record<string, string>): boolean => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if (a[k] !== b[k]) return false;
    return true;
  };
  const layoutStatusesChanged = (a: any, orig: any): boolean =>
    !sameStatuses(rowLayoutStatuses(a), origLayoutStatuses(orig));

  // A brand-new row is only worth creating if it carries real data (guards the default
  // empty row `mapDataToForm` seeds so it never counts as a change / phantom airbrushing).
  const isMeaningful = (a: any): boolean =>
    a.price != null || !!a.startDate || !!a.finishDate || !!a.startedAt || !!a.finishedAt || !!a.painterId ||
    !!a.description?.trim() ||
    // Uma linha preenchida só com forma de pagamento/vencimento também é uma aerografia real.
    hasNonDefaultAirbrushingConfig(a) ||
    uploadedIds(rowReceipts(a)).length > 0 || uploadedIds(rowInvoices(a)).length > 0 || uploadedIds(rowLayouts(a)).length > 0 ||
    newFilesOf(rowReceipts(a)).length > 0 || newFilesOf(rowInvoices(a)).length > 0 || newFilesOf(rowLayouts(a)).length > 0;

  const rowChanged = (a: any, orig: any): boolean => {
    if ((a.price ?? null) !== (orig.price ?? null)) return true;
    // Without this, editing ONLY the description produces no update request at all.
    if ((a.description ?? null) !== (orig.description ?? null)) return true;
    if (a.status !== orig.status) return true;
    if ((a.paymentStatus ?? null) !== (orig.paymentStatus ?? null)) return true;
    if ((a.painterId ?? null) !== (orig.painterId ?? null)) return true;
    // Configuração de pagamento — sem estas comparações, mexer SÓ na forma de pagamento ou
    // no vencimento não gerava requisição nenhuma (a alteração sumia ao recarregar).
    if ((a.paymentMethod ?? null) !== (orig.paymentMethod ?? null)) return true;
    if ((a.dueDateRule ?? null) !== (orig.dueDateRule ?? null)) return true;
    if ((a.paymentTermDays ?? null) !== (orig.paymentTermDays ?? null)) return true;
    if ((a.dueDayOfMonth ?? null) !== (orig.dueDayOfMonth ?? null)) return true;
    if (time(a.dueDate) !== time(orig.dueDate)) return true;
    if (time(a.startDate) !== time(orig.startDate)) return true;
    if (time(a.finishDate) !== time(orig.finishDate)) return true;
    if (time(a.startedAt) !== time(orig.startedAt)) return true;
    if (time(a.finishedAt) !== time(orig.finishedAt)) return true;
    if (!sameIds(uploadedIds(rowReceipts(a)), origFileIds(orig.receipts))) return true;
    if (!sameIds(uploadedIds(rowInvoices(a)), origFileIds(orig.invoices))) return true;
    if (!sameIds(uploadedIds(rowLayouts(a)), origFileIds(orig.layouts))) return true;
    if (newFilesOf(rowReceipts(a)).length > 0 || newFilesOf(rowInvoices(a)).length > 0 || newFilesOf(rowLayouts(a)).length > 0) return true;
    // Aprovar/reprovar um layout é uma alteração REAL da linha, mesmo sem trocar arquivo
    // nenhum — sem isto o save não gerava requisição e o status voltava ao recarregar.
    if (layoutStatusesChanged(a, orig)) return true;
    return false;
  };

  // Scalar fields only. The attachment arrays are deliberately NOT part of this: the JSON
  // batch endpoint cannot carry an upload, so including them there can only ever remove
  // files — and the API now ignores them outright. Anything that touches attachments is
  // routed to the single multipart endpoint via `buildFileData` below.
  // Uma única definição, compartilhada com o assistente de aerografia e com o cadastro de
  // tarefa (`buildAirbrushingPayload`): campo novo entra lá e vale para todos os caminhos.
  const buildData = (a: any): Record<string, any> => buildAirbrushingPayload(a);

  const buildFileData = (a: any): Record<string, any> => {
    const layoutStatuses = rowLayoutStatuses(a);
    const newLayoutStatuses = rowNewLayoutStatuses(a);
    return {
      receiptIds: uploadedIds(rowReceipts(a)),
      invoiceIds: uploadedIds(rowInvoices(a)),
      layoutIds: uploadedIds(rowLayouts(a)),
      // Multipart exige o mapa embrulhado num array (o preprocess do backend desembrulha);
      // o array por índice vai cru, alinhado aos blobs de `files.layouts`.
      layoutStatuses: Object.keys(layoutStatuses).length > 0 ? [layoutStatuses] : undefined,
      newLayoutStatuses: newLayoutStatuses.length > 0 ? newLayoutStatuses : undefined,
    };
  };

  // Did the user actually change which files are attached? Only then may the attachment
  // arrays be transmitted at all — a row whose files are untouched never sends them, so a
  // hydration slip can no longer be mistaken for "the user removed everything".
  const filesChanged = (a: any, orig: any): boolean =>
    !sameIds(uploadedIds(rowReceipts(a)), origFileIds(orig.receipts)) ||
    !sameIds(uploadedIds(rowInvoices(a)), origFileIds(orig.invoices)) ||
    !sameIds(uploadedIds(rowLayouts(a)), origFileIds(orig.layouts));

  const toCreate: AirbrushingCreateOp[] = [];
  const toUpdate: AirbrushingUpdateOp[] = [];
  const keptIds = new Set<string>();

  for (const a of formList || []) {
    const files: AirbrushingFiles = {
      receipts: newFilesOf(rowReceipts(a)),
      invoices: newFilesOf(rowInvoices(a)),
      layouts: newFilesOf(rowLayouts(a)),
    };
    const orig = originalById.get(a.id);
    if (orig) {
      // Existing row: always kept; updated in place only if something actually changed
      // (preserving its status/payment/timestamps otherwise).
      keptIds.add(a.id);
      if (rowChanged(a, orig)) {
        // O endpoint em LOTE ignora `layoutIds`/`layoutStatuses` de propósito (ver
        // airbrushing.service.ts), então uma mudança só de status também precisa sair pelo
        // endpoint individual — senão o save "dá certo" e o status não muda.
        const touchesFiles = filesChanged(a, orig) || newFilesOf(rowReceipts(a)).length > 0 ||
          newFilesOf(rowInvoices(a)).length > 0 || newFilesOf(rowLayouts(a)).length > 0 ||
          layoutStatusesChanged(a, orig);
        toUpdate.push({
          id: a.id,
          data: touchesFiles ? { ...buildData(a), ...buildFileData(a) } : buildData(a),
          files,
          touchesFiles,
        });
      }
    } else if (isMeaningful(a)) {
      // A brand-new row carries its whole file set by definition.
      toCreate.push({ data: { ...buildData(a), ...buildFileData(a) }, files });
    }
  }

  // Anything in the DB the form no longer keeps is a removal.
  const toDelete = (originalList || []).map((a) => a.id).filter((id: string) => !keptIds.has(id));

  return { toCreate, toUpdate, toDelete, hasChanges: toCreate.length > 0 || toUpdate.length > 0 || toDelete.length > 0 };
}

export type AirbrushingPlan = ReturnType<typeof planAirbrushingReconciliation>;

/**
 * Uma aerografia GRAVADA na forma que `MultiAirbrushingSelector` e o planejador esperam.
 *
 * O `id` é o que faz o planejador reconhecer a linha como existente (e só atualizá-la
 * se algo mudou); sem ele toda linha carregada viraria uma criação duplicada.
 */
export function airbrushingToFormRow(a: any): Record<string, any> {
  return {
    id: a.id, // Preserve original airbrushing ID
    startDate: a.startDate ? new Date(a.startDate) : null,
    finishDate: a.finishDate ? new Date(a.finishDate) : null,
    startedAt: a.startedAt ? new Date(a.startedAt) : null,
    finishedAt: a.finishedAt ? new Date(a.finishedAt) : null,
    price: a.price,
    description: a.description ?? null,
    status: a.status,
    paymentStatus: a.paymentStatus || AIRBRUSHING_PAYMENT_STATUS.PENDING,
    // Configuração de pagamento — precisa ser semeada aqui: sem ela a linha nasce
    // vazia, o seletor a "corrige" para os padrões e o save gravaria por cima do
    // que já estava no banco.
    paymentMethod: (a as any).paymentMethod ?? null,
    dueDateRule: (a as any).dueDateRule ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH,
    paymentTermDays: (a as any).paymentTermDays ?? null,
    dueDayOfMonth: (a as any).dueDayOfMonth ?? null,
    dueDate: (a as any).dueDate ? new Date((a as any).dueDate) : null,
    painterId: a.painterId || null,
    painter: a.painter || null,
    receiptIds: a.receipts?.map((r: any) => r.id) || [],
    invoiceIds: a.invoices?.map((n: any) => n.id) || [],
    // CRITICAL: layoutIds should be File IDs (artwork.fileId), not Layout entity IDs
    layoutIds: a.layouts?.map((art: any) => art.fileId || art.file?.id || art.id) || [],
    receipts: a.receipts || [],
    invoices: a.invoices || [],
    // Map Layout entities to their backing File for display. Fall back to the fileId
    // scalar (never the Layout's own id) so thumbnails/downloads resolve the real File.
    layouts: a.layouts?.map((art: any) => art.file || (art.fileId ? { ...art, id: art.fileId } : art)) || [],
  };
}

/** A linha vazia que o seletor mostra quando a tarefa não tem aerografia nenhuma. */
export function emptyAirbrushingRow(): Record<string, any> {
  return {
    // Default empty airbrushing row
    id: `airbrushing-initial`,
    status: AIRBRUSHING_STATUS.PREPARATION,
    paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING,
    paymentMethod: null,
    dueDateRule: AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH,
    paymentTermDays: null,
    dueDayOfMonth: null,
    dueDate: null,
    price: null,
    description: null,
    startDate: null,
    finishDate: null,
    startedAt: null,
    finishedAt: null,
    painterId: null,
    painter: null,
    receiptIds: [],
    invoiceIds: [],
    layoutIds: [],
    receipts: [],
    invoices: [],
    layouts: [],
  };
}

/**
 * As aerografias da tarefa como valor inicial do formulário: as gravadas, ou a linha
 * vazia de sempre. `isMeaningful` do planejador garante que a linha vazia nunca vira
 * criação.
 */
export function airbrushingsToFormValue(list: any[] | null | undefined): Record<string, any>[] {
  return list && list.length > 0 ? list.map(airbrushingToFormRow) : [emptyAirbrushingRow()];
}

/** O cliente que o multipart da aerografia carrega — o mesmo tipo que `createAirbrushingFormData` aceita. */
export type AirbrushingCustomerInfo = Parameters<typeof createAirbrushingFormData>[2];

/**
 * Executa o plano contra a API: exclusões, atualizações e criações, nessa ordem.
 *
 * LANÇA na primeira falha — inclusive nas falhas por item que os endpoints em lote
 * relatam com `success: true` e `totalFailed > 0`. Quem chama decide o que fazer
 * (recarregar a lista, avisar, não navegar).
 */
export async function applyAirbrushingPlan(
  plan: AirbrushingPlan,
  taskId: string,
  customerInfo?: AirbrushingCustomerInfo,
): Promise<void> {
  const { toCreate, toUpdate, toDelete } = plan;
  const hasFiles = (f: AirbrushingFiles) => f.receipts.length > 0 || f.invoices.length > 0 || f.layouts.length > 0;

  // 1) Deletions (JSON batch).
  if (toDelete.length > 0) {
    const res: any = await airbrushingService.batchDeleteAirbrushings({ airbrushingIds: toDelete } as any);
    const failed = res?.data?.totalFailed ?? 0;
    if (res?.success === false || failed > 0) {
      throw new Error(`Não foi possível remover ${failed || toDelete.length} aerografia(s).`);
    }
  }

  // 2) Updates. Scalar-only edits batch as JSON (preserving untouched fields);
  //    any row whose ATTACHMENTS changed — new uploads or removals alike — goes
  //    through the single multipart endpoint, which is the only path that owns
  //    file reconciliation. The JSON batch endpoint deliberately ignores
  //    attachment arrays, so routing a file change there would silently no-op.
  const updatesNoFiles = toUpdate.filter((u) => !hasFiles(u.files) && !u.touchesFiles);
  const updatesWithFiles = toUpdate.filter((u) => hasFiles(u.files) || u.touchesFiles);
  if (updatesNoFiles.length > 0) {
    const res: any = await airbrushingService.batchUpdateAirbrushings({
      airbrushings: updatesNoFiles.map((u) => ({ id: u.id, data: u.data })),
    } as any);
    const failed = res?.data?.totalFailed ?? 0;
    if (res?.success === false || failed > 0) {
      throw new Error(`Não foi possível atualizar ${failed || updatesNoFiles.length} aerografia(s).`);
    }
  }
  for (const u of updatesWithFiles) {
    const formData = createAirbrushingFormData(u.data, u.files, customerInfo);
    await airbrushingService.updateAirbrushing(u.id, formData as any);
  }

  // 3) Creations. Same split: metadata-only → JSON batch create; new files →
  //    single multipart create. taskId links each row to this task.
  const createsNoFiles = toCreate.filter((c) => !hasFiles(c.files));
  const createsWithFiles = toCreate.filter((c) => hasFiles(c.files));
  if (createsNoFiles.length > 0) {
    const res: any = await airbrushingService.batchCreateAirbrushings({
      airbrushings: createsNoFiles.map((c) => ({ ...c.data, taskId })),
    } as any);
    const failed = res?.data?.totalFailed ?? 0;
    if (res?.success === false || failed > 0) {
      throw new Error(`Não foi possível criar ${failed || createsNoFiles.length} aerografia(s).`);
    }
  }
  for (const c of createsWithFiles) {
    const formData = createAirbrushingFormData({ ...c.data, taskId }, c.files, customerInfo);
    await airbrushingService.createAirbrushing(formData as any);
  }
}
