import { AIRBRUSHING_STATUS_LABELS } from "../constants";
import { AIRBRUSHING_STATUS } from "../constants";

export function getAirbrushingStatusLabel(status: AIRBRUSHING_STATUS): string {
  return AIRBRUSHING_STATUS_LABELS[status] || status;
}
