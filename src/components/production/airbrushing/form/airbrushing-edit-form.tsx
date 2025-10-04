import { AirbrushingForm } from "./airbrushing-form";

interface AirbrushingEditFormProps {
  airbrushingId: string;
  onSuccess?: (airbrushing: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function AirbrushingEditForm({ airbrushingId, onSuccess, onCancel, className }: AirbrushingEditFormProps) {
  return <AirbrushingForm mode="edit" airbrushingId={airbrushingId} onSuccess={onSuccess} onCancel={onCancel} className={className} />;
}
