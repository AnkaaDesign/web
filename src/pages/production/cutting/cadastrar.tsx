import { useSearchParams } from "react-router-dom";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { CutCreateWizard } from "@/components/production/cut/form/cut-create-wizard";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const CutCreatePage = () => {
  const [searchParams] = useSearchParams();

  // Optional deep-link: pre-select a task via ?taskId=
  const taskId = searchParams.get("taskId");

  usePageTracker({ title: "Recorte - Criar" });

  // PLAN cuts are created by DESIGNER / ADMIN (mirrors canCreateCuts + API POST /cuts).
  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.DESIGNER]}>
      <CutCreateWizard initialTaskId={taskId || undefined} />
    </PrivilegeRoute>
  );
};
