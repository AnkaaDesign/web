import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { routes } from "@/constants";
import { isMobile } from "@/utils/platform";

/**
 * Mobile-usage guard.
 *
 * The full web app is desktop-oriented; on phones/tablets we steer visitors to
 * the public /install landing page (which can deep-link into the native app via
 * its "Abrir o app" button using the original path as `?from=`).
 *
 * Exemptions (never redirected) — these are public/shareable or part of the
 * install/open flow itself, so they must remain reachable on mobile:
 *   - /install                  (the destination — prevents redirect loops)
 *   - /autenticacao/*           (auth + password-reset callbacks opened from email)
 *   - /cliente/*                (customer-shared budget / service-report links)
 *   - /certificado-residuos/*   (public waste-certificate share links)
 *   - /politica-de-privacidade  (public legal page, required by the stores)
 *
 * Desktop is never affected. The redirect is `replace` so the back button does
 * not bounce the user straight back into the guarded route.
 */
const MOBILE_ALLOWED_PREFIXES = [
  routes.install, // "/install"
  "/autenticacao",
  "/cliente",
  "/certificado-residuos",
  routes.privacyPolicy, // "/politica-de-privacidade"
];

function isAllowedOnMobile(pathname: string): boolean {
  return MOBILE_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function MobileUsageGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isMobile()) return;
    if (isAllowedOnMobile(location.pathname)) return;

    const from = encodeURIComponent(`${location.pathname}${location.search}`);
    navigate(`${routes.install}?from=${from}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return null;
}

export default MobileUsageGuard;
