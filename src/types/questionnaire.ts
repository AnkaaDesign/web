// types/questionnaire.ts
//
// Self-fill Questionnaire domain types (web mirror of api/src/types/questionnaire.ts).
//   - A QuestionnaireGroup (the "main group") groups one or more
//     QuestionnaireQuestions (the assessable items, with a description).
//   - A QuestionnaireQuestion has one or more QuestionnaireOptions (possible
//     answers, each with a numeric `value`, by convention 0..5).
//   - A Questionnaire is a campaign that, when opened, spawns one
//     QuestionnaireEntry PER targeted user. The respondent fills it for
//     THEMSELVES (no separate evaluator).

import type {
  BaseEntity,
  BaseGetUniqueResponse,
  BaseGetManyResponse,
  BaseCreateResponse,
  BaseUpdateResponse,
  BaseDeleteResponse,
} from "./common";
import type {
  ORDER_BY_DIRECTION,
  QUESTIONNAIRE_STATUS,
  QUESTIONNAIRE_ENTRY_STATUS,
} from "../constants";
import type { User, UserIncludes } from "./user";

export type QuestionnaireStatus = QUESTIONNAIRE_STATUS;
export type QuestionnaireEntryStatus = QUESTIONNAIRE_ENTRY_STATUS;

// =====================
// Entities
// =====================

export interface QuestionnaireOption extends BaseEntity {
  questionId: string;
  order: number;
  value: number; // by convention 0..5
  label: string;
  description?: string | null;
  question?: QuestionnaireQuestion;
}

export interface QuestionnaireQuestion extends BaseEntity {
  groupId: string;
  order: number;
  title: string;
  description: string;
  helpText?: string | null;
  isActive: boolean;
  deletedAt?: Date | null;

  group?: QuestionnaireGroup;
  options?: QuestionnaireOption[];
  links?: QuestionnaireQuestionLink[];
  answers?: QuestionnaireAnswer[];

  _count?: { options?: number; answers?: number };
}

export interface QuestionnaireGroup extends BaseEntity {
  name: string;
  description?: string | null;
  order: number;
  isActive: boolean;
  deletedAt?: Date | null;

  questions?: QuestionnaireQuestion[];

  _count?: { questions?: number };
}

export interface QuestionnaireUser {
  questionnaireId: string;
  userId: string;
  questionnaire?: Questionnaire;
  user?: User;
}

export interface QuestionnaireQuestionLink {
  questionnaireId: string;
  questionId: string;
  questionnaire?: Questionnaire;
  question?: QuestionnaireQuestion;
}

export interface QuestionnaireAnswer extends BaseEntity {
  entryId: string;
  questionId: string;
  value: number;
  comment?: string | null;

  entry?: QuestionnaireEntry;
  question?: QuestionnaireQuestion;
}

export interface QuestionnaireEntry extends BaseEntity {
  questionnaireId: string;
  respondentId: string;
  status: QuestionnaireEntryStatus;
  startedAt?: Date | null;
  submittedAt?: Date | null;
  notes?: string | null;
  deletedAt?: Date | null;

  questionnaire?: Questionnaire;
  respondent?: User;
  answers?: QuestionnaireAnswer[];

  _count?: { answers?: number };
}

export interface Questionnaire extends BaseEntity {
  name: string;
  description?: string | null;
  periodStart: Date;
  periodEnd: Date;
  status: QuestionnaireStatus;
  createdById: string;
  targetAllUsers: boolean;
  isAnonymous: boolean;
  deletedAt?: Date | null;

  createdBy?: User;
  targetUsers?: QuestionnaireUser[];
  questions?: QuestionnaireQuestionLink[];
  entries?: QuestionnaireEntry[];

  _count?: { targetUsers?: number; questions?: number; entries?: number };
}

// =====================
// Include Types
// =====================

export interface QuestionnaireOptionIncludes {
  question?: boolean;
}

export interface QuestionnaireQuestionIncludes {
  group?: boolean;
  options?: boolean | { include?: QuestionnaireOptionIncludes };
  links?: boolean;
  answers?: boolean;
  _count?: boolean | { select?: { options?: boolean; answers?: boolean } };
}

export interface QuestionnaireGroupIncludes {
  questions?: boolean | { include?: QuestionnaireQuestionIncludes };
  _count?: boolean | { select?: { questions?: boolean } };
}

export interface QuestionnaireEntryIncludes {
  questionnaire?: boolean;
  respondent?: boolean | { include?: UserIncludes };
  answers?: boolean | { include?: { question?: boolean } };
  _count?: boolean | { select?: { answers?: boolean } };
}

export interface QuestionnaireIncludes {
  createdBy?: boolean | { include?: UserIncludes };
  questions?: boolean | { include?: { question?: boolean | { include?: QuestionnaireQuestionIncludes } } };
  entries?: boolean | { include?: QuestionnaireEntryIncludes };
  _count?: boolean | { select?: { questions?: boolean; entries?: boolean } };
}

// =====================
// OrderBy
// =====================

export interface QuestionnaireGroupOrderBy {
  id?: ORDER_BY_DIRECTION;
  name?: ORDER_BY_DIRECTION;
  order?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
}
export interface QuestionnaireQuestionOrderBy {
  id?: ORDER_BY_DIRECTION;
  groupId?: ORDER_BY_DIRECTION;
  order?: ORDER_BY_DIRECTION;
  title?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
}
export interface QuestionnaireOrderBy {
  id?: ORDER_BY_DIRECTION;
  name?: ORDER_BY_DIRECTION;
  status?: ORDER_BY_DIRECTION;
  periodStart?: ORDER_BY_DIRECTION;
  periodEnd?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
}
export interface QuestionnaireEntryOrderBy {
  id?: ORDER_BY_DIRECTION;
  status?: ORDER_BY_DIRECTION;
  startedAt?: ORDER_BY_DIRECTION;
  submittedAt?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
}

// =====================
// Response Interfaces
// =====================

export interface QuestionnaireGroupGetUniqueResponse extends BaseGetUniqueResponse<QuestionnaireGroup> {}
export interface QuestionnaireGroupGetManyResponse extends BaseGetManyResponse<QuestionnaireGroup> {}
export interface QuestionnaireGroupCreateResponse extends BaseCreateResponse<QuestionnaireGroup> {}
export interface QuestionnaireGroupUpdateResponse extends BaseUpdateResponse<QuestionnaireGroup> {}
export interface QuestionnaireGroupDeleteResponse extends BaseDeleteResponse {}

export interface QuestionnaireQuestionGetUniqueResponse extends BaseGetUniqueResponse<QuestionnaireQuestion> {}
export interface QuestionnaireQuestionGetManyResponse extends BaseGetManyResponse<QuestionnaireQuestion> {}
export interface QuestionnaireQuestionCreateResponse extends BaseCreateResponse<QuestionnaireQuestion> {}
export interface QuestionnaireQuestionUpdateResponse extends BaseUpdateResponse<QuestionnaireQuestion> {}
export interface QuestionnaireQuestionDeleteResponse extends BaseDeleteResponse {}
export interface QuestionnaireOptionsUpsertResponse extends BaseGetUniqueResponse<QuestionnaireOption[]> {}

export interface QuestionnaireGetUniqueResponse extends BaseGetUniqueResponse<Questionnaire> {}
export interface QuestionnaireGetManyResponse extends BaseGetManyResponse<Questionnaire> {}
export interface QuestionnaireCreateResponse extends BaseCreateResponse<Questionnaire> {}
export interface QuestionnaireUpdateResponse extends BaseUpdateResponse<Questionnaire> {}
export interface QuestionnaireDeleteResponse extends BaseDeleteResponse {}

export interface QuestionnaireEntryGetUniqueResponse extends BaseGetUniqueResponse<QuestionnaireEntry> {}
export interface QuestionnaireEntryGetManyResponse extends BaseGetManyResponse<QuestionnaireEntry> {}
export interface QuestionnaireEntryUpdateResponse extends BaseUpdateResponse<QuestionnaireEntry> {}

// =====================
// Aggregated results (anonymous) — NO respondent identities
// =====================

export interface QuestionnaireResultsQuestion {
  id: string;
  title: string;
  description?: string | null;
  helpText?: string | null;
  order: number;
  group: { id: string; name: string } | null;
  options: { value: number; label: string }[];
  /** Map of option value (as string) -> count of answers with that value. */
  distribution: Record<string, number>;
  answeredCount: number;
  average: number | null;
  commentCount: number;
}

export interface QuestionnaireResults {
  questionnaireId: string;
  name: string;
  isAnonymous: boolean;
  totalEntries: number;
  respondedCount: number;
  questions: QuestionnaireResultsQuestion[];
}

export interface QuestionnaireResultsResponse extends BaseGetUniqueResponse<QuestionnaireResults> {}

// =====================
// Form Data Types
// =====================

export interface QuestionnaireGroupCreateFormData {
  name: string;
  description?: string | null;
  order: number;
  isActive?: boolean;
}
export interface QuestionnaireGroupUpdateFormData {
  name?: string;
  description?: string | null;
  order?: number;
  isActive?: boolean;
}

export interface QuestionnaireOptionFormData {
  order: number;
  value: number;
  label: string;
  description?: string | null;
}

export interface QuestionnaireQuestionCreateFormData {
  groupId: string;
  order: number;
  title: string;
  description: string;
  helpText?: string | null;
  isActive?: boolean;
  options?: QuestionnaireOptionFormData[];
}
export interface QuestionnaireQuestionUpdateFormData {
  groupId?: string;
  order?: number;
  title?: string;
  description?: string;
  helpText?: string | null;
  isActive?: boolean;
}
export interface QuestionnaireOptionsUpsertFormData {
  options: QuestionnaireOptionFormData[];
}

export interface QuestionnaireCreateFormData {
  name: string;
  description?: string | null;
  periodStart: Date;
  periodEnd: Date;
  targetAllUsers?: boolean;
  isAnonymous?: boolean;
  userIds?: string[];
  questionIds?: string[];
  groupIds?: string[];
}
export interface QuestionnaireUpdateFormData {
  name?: string;
  description?: string | null;
  periodStart?: Date;
  periodEnd?: Date;
  targetAllUsers?: boolean;
  isAnonymous?: boolean;
  userIds?: string[];
  questionIds?: string[];
  groupIds?: string[];
}

export interface QuestionnaireAnswerFormData {
  questionId: string;
  value: number;
  comment?: string | null;
}
export interface QuestionnaireEntryAnswersUpsertFormData {
  answers: QuestionnaireAnswerFormData[];
}
export interface QuestionnaireEntryUpdateFormData {
  notes?: string | null;
}

// =====================
// GetMany Form Data
// =====================

export interface QuestionnaireGroupGetManyFormData {
  page?: number;
  limit?: number;
  take?: number;
  skip?: number;
  where?: any;
  orderBy?: QuestionnaireGroupOrderBy | QuestionnaireGroupOrderBy[];
  include?: QuestionnaireGroupIncludes;
  searchingFor?: string;
  isActive?: boolean;
}
export interface QuestionnaireQuestionGetManyFormData {
  page?: number;
  limit?: number;
  take?: number;
  skip?: number;
  where?: any;
  orderBy?: QuestionnaireQuestionOrderBy | QuestionnaireQuestionOrderBy[];
  include?: QuestionnaireQuestionIncludes;
  searchingFor?: string;
  groupId?: string;
  groupIds?: string[];
  isActive?: boolean;
}
export interface QuestionnaireGetManyFormData {
  page?: number;
  limit?: number;
  take?: number;
  skip?: number;
  where?: any;
  orderBy?: QuestionnaireOrderBy | QuestionnaireOrderBy[];
  include?: QuestionnaireIncludes;
  searchingFor?: string;
  status?: QuestionnaireStatus | QuestionnaireStatus[];
  createdById?: string;
}
export interface QuestionnaireEntryGetManyFormData {
  page?: number;
  limit?: number;
  take?: number;
  skip?: number;
  where?: any;
  orderBy?: QuestionnaireEntryOrderBy | QuestionnaireEntryOrderBy[];
  include?: QuestionnaireEntryIncludes;
  status?: QuestionnaireEntryStatus | QuestionnaireEntryStatus[];
  questionnaireId?: string;
  respondentId?: string | "me";
}

// =====================
// Query Form Data
// =====================

export interface QuestionnaireGroupQueryFormData {
  include?: QuestionnaireGroupIncludes;
}
export interface QuestionnaireQuestionQueryFormData {
  include?: QuestionnaireQuestionIncludes;
}
export interface QuestionnaireQueryFormData {
  include?: QuestionnaireIncludes;
}
export interface QuestionnaireEntryQueryFormData {
  include?: QuestionnaireEntryIncludes;
}
