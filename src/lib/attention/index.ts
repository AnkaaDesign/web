// =====================================================
// Attention system — public barrel
// =====================================================
// Blink/bip a row, a detail page, or a single field from configurable rules or
// manual/server-pushed warnings. See ATTENTION_SYSTEM_PLAN.md.

export { AttentionProvider } from "./attention-context";
export { AttentionField } from "./attention-field";
export {
  useAttention,
  useAttentionField,
  useAttentionVersion,
  useMarkAttentionViewed,
  useRegisterAttentionEntities,
  useAnnouncePresence,
  usePresenceVersion,
  attentionRowClass,
  attentionRowClassFor,
  attentionFieldClass,
  presenceRowClassFor,
} from "./use-attention";
export { useEntityPresence, getEntityPresence } from "./presence";
export type { PresenceEditor } from "./presence";
export { useSendWarning } from "./send-warning";
export type { SendWarningTarget } from "./send-warning";
export { emitEntityChanged as notifyAttentionEntityChanged } from "./attention-socket";
export {
  addPushedAttention,
  setPushedAttentions,
  dismissPushedAttention,
  snooze as snoozeAttention,
  configureAckStore,
  setRules,
  getAttentionCountsByType,
} from "./engine";
export type { PushedAttention } from "./engine";
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
