// Generic, performant, server-persisted detail-page system — the detail-page analog of
// the DataTable system (components/ui/datatable). See detail-page.tsx for the entry point.

export { DetailPage } from "./detail-page";
export type { DetailPageProps, DetailPageNavigation } from "./detail-page";

export { useDetailLayout } from "./use-detail-layout";
export type { UseDetailLayoutParams, UseDetailLayoutResult, ResolvedSection, ManagerSection } from "./use-detail-layout";

export { useDetailPreferences } from "./use-detail-preferences";
export type { UseDetailPreferencesResult } from "./use-detail-preferences";

export { useRecordNavigation } from "./use-record-navigation";
export type { RecordNavigation, UseRecordNavigationParams } from "./use-record-navigation";

export { useFieldGate } from "./use-field-gate";

export { InlineEditField } from "./inline-edit-field";
export { DetailSection } from "./detail-section";
export { DetailCustomizeManager } from "./detail-customize-manager";

export { defineEnum } from "./enum-field-registry";
export { enumBadge, enumLabel, enumOptions, enumTriggerClass, enumVariant, renderFieldValue } from "./inline-widgets";

export type {
  FieldDataType,
  EnumEditConfig,
  InlineEditDef,
  DetailFieldDef,
  DetailSectionDef,
  PersistedDetailConfig,
  PrivilegeGate,
  ExportCellValue,
} from "./detail-page-types";
