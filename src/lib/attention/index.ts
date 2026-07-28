// =====================================================
// Attention system — public barrel
// =====================================================
// Blink/bip a row, a detail page, or a single field from configurable rules or
// manual/server-pushed warnings. See ATTENTION_SYSTEM_PLAN.md.

export { AttentionProvider } from "./attention-context";
export {
  useAttention,
  useAttentionEntity,
  useAttentionField,
  useAttentionVersion,
  useRegisterAttentionEntities,
  useAnnouncePresence,
  useAnnouncePresenceForIds,
  hasOtherEditors,
  editLockReasonFor,
  useEditLock,
  usePresenceVersion,
  attentionRowClass,
  attentionRowClassFor,
  attentionFieldClass,
  presenceRowClassFor,
} from "./use-attention";
export { useEntityPresence, getEntityPresence, getOtherEditors, formatEditingSince } from "./presence";
export type { PresenceEditor } from "./presence";
export { IsEditingBadge, useOtherEditors } from "./presence-badge";
export { checkOtherEditors, describeEditors } from "./presence-guard";
export type { PresenceGuardResult } from "./presence-guard";
export { useSaveConflictGuard } from "./save-conflict-dialog";
export type { SaveConflictGuard } from "./save-conflict-dialog";
export { useSendWarning, canSendAttentionWarning } from "./send-warning";
export type { SendWarningTarget } from "./send-warning";
export { emitEntityChanged as notifyAttentionEntityChanged } from "./attention-socket";
export {
  addPushedAttention,
  setPushedAttentions,
  dismissPushedAttention,
  snooze as snoozeAttention,
  configureAckStore,
  setRules,
  setRemoteMatches,
  getAttentionSnapshot,
} from "./engine";
export type { PushedAttention, AttentionTypeSnapshot, RemoteMatchRef } from "./engine";
export { ATTENTION_SUMMARY_KEY } from "./use-attention-summary";
export { useAttentionSurface, useAttentionSurfaceTypes } from "./surface";
export { ATTENTION_ENTITIES, ATTENTION_ACTIVE_TYPES, attentionEntityDescriptor, attentionAudience } from "./entities";
export type { AttentionEntityDescriptor } from "./entities";
export { ATTENTION_RULES, ATTENTION_RULES_BY_ID } from "./rules";
export type {
  AttentionRule,
  AttentionMatch,
  AttentionState,
  AttentionEntityType,
  AttentionTarget,
  AttentionCadence,
  AttentionAckPolicy,
  AttentionTone,
  PredicateNode,
} from "./types";
