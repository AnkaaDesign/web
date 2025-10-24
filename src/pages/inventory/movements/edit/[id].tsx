import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";

export const EditMovementPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to batch edit with single ID
    if (id) {
      navigate(`${routes.inventory.movements.batchEdit}?ids=${id}`, { replace: true });
    }
  }, [id, navigate]);

  return null;
};
