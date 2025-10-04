import { AirbrushingForm } from "./airbrushing-form";

interface AirbrushingCreateFormProps {
  initialTaskId?: string;
  onSuccess?: (airbrushing: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function AirbrushingCreateForm({ initialTaskId, onSuccess, onCancel, className }: AirbrushingCreateFormProps) {
  return <AirbrushingForm mode="create" initialTaskId={initialTaskId} onSuccess={onSuccess} onCancel={onCancel} className={className} />;
}
