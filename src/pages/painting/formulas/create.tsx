import { Navigate } from "react-router-dom";
import { routes } from "../../../constants";

export default function FormulaCreate() {
  // Redirect to paint catalog since formulas are now created through paint edit
  return <Navigate to={routes.painting.catalog.root} replace />;
}
