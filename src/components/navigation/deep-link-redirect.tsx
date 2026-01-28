import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { routes } from '@/constants';

/**
 * Deep link entity types and their corresponding web routes
 * These map the simplified deep link paths to actual web application routes
 */
const DEEP_LINK_ROUTES: Record<string, (id: string) => string> = {
  // Production
  task: (id) => routes.production.preparation.details(id),
  // Inventory
  order: (id) => routes.inventory.orders.details(id),
  item: (id) => routes.inventory.products.details(id),
  // Service Orders
  'service-order': (id) => routes.production.schedule.details(id),
  serviceorder: (id) => routes.production.schedule.details(id), // Without hyphen
  // Users/Employees
  user: (id) => routes.administration.collaborators.details(id),
  // Customers
  customer: (id) => routes.administration.customers.details(id),
  // Suppliers
  supplier: (id) => routes.inventory.suppliers.details(id),
  // Notifications
  notification: (id) => routes.administration.notifications.details(id),
  // Borrows/Loans
  borrow: (id) => routes.inventory.loans.details(id),
  // Maintenance
  maintenance: (id) => routes.inventory.maintenance.details(id),
  // Financial
  financial: (id) => routes.financial.customers.details(id),
};

/**
 * Detects if the user is on a mobile device
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Component that handles deep link redirects from universal links.
 *
 * When a user clicks a universal link like https://ankaadesign.com.br/app/task/123
 * and the mobile app is NOT installed (so universal links / app links didn't intercept),
 * this component:
 *
 * 1. On mobile: Immediately attempts to open the app via custom scheme (ankaadesign://).
 *    Shows a prompt with options to open in app or continue in browser.
 * 2. On desktop: Redirects immediately to the correct web application route.
 *
 * Supported URL patterns:
 * - /app/:entityType/:id (universal link format from iOS/Android)
 * - /:entityType/:id (direct entity link)
 */
export function DeepLinkRedirect() {
  const { entityType: entityTypeParam, id: idParam } = useParams<{ entityType?: string; id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [showAppPrompt, setShowAppPrompt] = useState(false);
  const [targetRoute, setTargetRoute] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<string>('');
  const [entityId, setEntityId] = useState<string>('');
  const attemptedAppOpen = useRef(false);

  useEffect(() => {
    // Extract entity type and ID from the URL path
    const pathParts = location.pathname.split('/').filter(Boolean);

    let extractedEntityType: string;
    let extractedId: string;

    // Check if path starts with 'app' (universal link format: /app/task/123)
    if (pathParts[0]?.toLowerCase() === 'app' && pathParts.length >= 3) {
      extractedEntityType = pathParts[1];
      extractedId = pathParts[2];
    } else if (entityTypeParam && idParam) {
      extractedEntityType = entityTypeParam;
      extractedId = idParam;
    } else if (pathParts.length >= 2) {
      // Direct entity link format: /task/123
      extractedEntityType = pathParts[0];
      extractedId = pathParts[1];
    } else {
      console.warn('[DeepLink] Could not extract entity type and ID from path:', location.pathname);
      navigate('/', { replace: true });
      return;
    }

    setEntityType(extractedEntityType);
    setEntityId(extractedId);

    if (!extractedEntityType || !extractedId) {
      navigate('/', { replace: true });
      return;
    }

    const routeGenerator = DEEP_LINK_ROUTES[extractedEntityType.toLowerCase()];

    if (!routeGenerator) {
      console.warn(`[DeepLink] Unknown entity type: ${extractedEntityType}`);
      navigate('/', { replace: true });
      return;
    }

    // Generate the target route
    const route = routeGenerator(extractedId);
    setTargetRoute(route);

    if (isMobileDevice()) {
      // On mobile: immediately try to open the app via custom scheme
      // If the app is installed, it will open. If not, nothing happens
      // and we show the prompt with fallback options.
      if (!attemptedAppOpen.current) {
        attemptedAppOpen.current = true;
        const deepLinkUrl = `ankaadesign://${extractedEntityType}/${extractedId}`;

        // Use an iframe to attempt opening the custom scheme silently
        // This avoids the "can't open page" error on some browsers
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = deepLinkUrl;
        document.body.appendChild(iframe);

        // Also try window.location as fallback for some browsers
        setTimeout(() => {
          window.location.href = deepLinkUrl;
        }, 100);

        // Clean up iframe
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 2000);
      }

      setShowAppPrompt(true);

      // Auto-redirect to web after a delay if the app didn't open
      const timeout = setTimeout(() => {
        navigate(route, { replace: true });
      }, 4000);
      return () => clearTimeout(timeout);
    } else {
      // Desktop: redirect immediately to the web route
      navigate(route, { replace: true });
    }
  }, [location.pathname, entityTypeParam, idParam, navigate]);

  const handleOpenInApp = () => {
    const deepLinkUrl = `ankaadesign://${entityType}/${entityId}`;
    window.location.href = deepLinkUrl;
  };

  const handleContinueInBrowser = () => {
    if (targetRoute) {
      navigate(targetRoute, { replace: true });
    }
  };

  // Show mobile app prompt
  if (showAppPrompt && isMobileDevice()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Abrir no Aplicativo?</h1>
            <p className="text-muted-foreground">
              Detectamos que você está em um dispositivo móvel. Deseja abrir este conteúdo no aplicativo Ankaa Design?
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleOpenInApp}
              className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Abrir no Aplicativo
            </button>

            <button
              onClick={handleContinueInBrowser}
              className="w-full py-3 px-4 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
            >
              Continuar no Navegador
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Redirecionando automaticamente em alguns segundos...
          </p>
        </div>
      </div>
    );
  }

  // Loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}
