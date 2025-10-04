import { Navigate } from "react-router-dom";
import { routes } from "../../constants";

export function AuthenticationPage() {
  // Redirect to login as the default authentication page
  return <Navigate to={routes.authentication.login} replace />;
}
