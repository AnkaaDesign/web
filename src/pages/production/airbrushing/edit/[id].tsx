import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { AirbrushingForm } from "@/components/production/airbrushing/form/airbrushing-form";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const AirbrushingEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Redirect if no ID is provided
  useEffect(() => {
    if (!id) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[AirbrushingEdit] No ID provided, redirecting to list");
      }
      navigate(routes.production.airbrushings.root);
    }
  }, [id, navigate]);

  // Track page for analytics
  usePageTracker({ title: "Aerografia - Editar" });

  if (!id) return null;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL]}>
      <AirbrushingForm mode="edit" airbrushingId={id} />
    </PrivilegeRoute>
  );
};
