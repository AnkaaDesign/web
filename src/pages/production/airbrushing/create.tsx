import { useSearchParams } from "react-router-dom";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { AirbrushingForm } from "@/components/production/airbrushing/form/airbrushing-form";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const AirbrushingCreate = () => {
  const [searchParams] = useSearchParams();

  // Optional deep-link: pre-select a task via ?taskId=
  const taskId = searchParams.get("taskId");

  // Track page for analytics
  usePageTracker({ title: "Aerografia - Criar" });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL]}>
      <AirbrushingForm mode="create" initialTaskId={taskId || undefined} />
    </PrivilegeRoute>
  );
};
