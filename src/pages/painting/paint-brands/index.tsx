import { Navigate } from "react-router-dom";
import { routes } from "../../../constants";

// Redirect to list page by default
export default function PaintBrandsIndexPage() {
  return <Navigate to={routes.painting.paintBrands.list} replace />;
}
