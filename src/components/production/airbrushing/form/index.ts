export { AirbrushingForm } from "./airbrushing-form";
export { AirbrushingCreateForm } from "./airbrushing-create-form";
export { AirbrushingFormFields } from "./airbrushing-form-fields";
// Bloco de campos compartilhado por cadastro e edição (e pelas linhas do MultiAirbrushingSelector).
export { AirbrushingFields, type AirbrushingFieldValues, type AirbrushingFieldErrors } from "./airbrushing-fields";
// Revisão em 3 seções (Tarefa · Aerografia · Pagamento) — mesma definição para cadastro e edição.
export {
  buildAirbrushingReviewSections,
  AirbrushingReviewRows,
  AirbrushingLayoutPreviews,
  type AirbrushingReviewRow,
  type AirbrushingReviewSections,
} from "./airbrushing-review-rows";
export { TaskSelector } from "./task-selector";
