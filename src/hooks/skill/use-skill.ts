// packages/hooks/src/use-skill.ts
//
// Skill catalogue hooks (BEHAVIORAL / SAFETY / PRODUCTIVITY groupings of Topics).
// CRUD + batch via createEntityHooks factory.

import {
  getSkills,
  getSkillById,
  createSkill,
  updateSkill,
  deleteSkill,
  batchCreateSkills,
  batchUpdateSkills,
  batchDeleteSkills,
} from "../../api-client";
import type {
  SkillGetManyFormData,
  SkillCreateFormData,
  SkillUpdateFormData,
  SkillBatchCreateFormData,
  SkillBatchUpdateFormData,
  SkillBatchDeleteFormData,
  SkillIncludes,
  SkillGetManyResponse,
  SkillGetUniqueResponse,
  SkillCreateResponse,
  SkillUpdateResponse,
  SkillDeleteResponse,
  SkillBatchCreateResponse,
  SkillBatchUpdateResponse,
  SkillBatchDeleteResponse,
  Skill,
} from "../../types";
import { skillKeys, topicKeys, assessmentKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Service adapter for the factory
// =====================================================

const skillServiceAdapter = {
  getMany: (params?: SkillGetManyFormData) => getSkills(params || {}),
  getById: (id: string, params?: any) => getSkillById(id, params),
  create: (data: SkillCreateFormData, include?: SkillIncludes) =>
    createSkill(data, include ? { include } : undefined),
  update: (id: string, data: SkillUpdateFormData, include?: SkillIncludes) =>
    updateSkill(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteSkill(id),
  batchCreate: (data: SkillBatchCreateFormData, include?: SkillIncludes) =>
    batchCreateSkills(data, include ? { include } : undefined),
  batchUpdate: (data: SkillBatchUpdateFormData, include?: SkillIncludes) =>
    batchUpdateSkills(data, include ? { include } : undefined),
  batchDelete: (data: SkillBatchDeleteFormData) => batchDeleteSkills(data),
};

// =====================================================
// Base hooks via factory
// =====================================================

const baseSkillHooks = createEntityHooks<
  SkillGetManyFormData,
  SkillGetManyResponse,
  SkillGetUniqueResponse,
  SkillCreateFormData,
  SkillCreateResponse,
  SkillUpdateFormData,
  SkillUpdateResponse,
  SkillDeleteResponse,
  SkillBatchCreateFormData,
  SkillBatchCreateResponse<Skill>,
  SkillBatchUpdateFormData,
  SkillBatchUpdateResponse<Skill>,
  SkillBatchDeleteFormData,
  SkillBatchDeleteResponse
>({
  queryKeys: skillKeys,
  service: skillServiceAdapter,
  staleTime: 1000 * 60 * 10, // 10 min — catalogue rarely changes
  relatedQueryKeys: [topicKeys, assessmentKeys], // topics & assessments cache mentions skills
});

// Standard exports
export const useSkillsInfinite = baseSkillHooks.useInfiniteList;
export const useSkills = baseSkillHooks.useList;
export const useSkill = baseSkillHooks.useDetail;
export const useSkillMutations = baseSkillHooks.useMutations;
export const useSkillBatchMutations = baseSkillHooks.useBatchMutations;
