import { useEffect, useState } from 'react';
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
 * Component that handles deep link redirects from universal links
 * When a user clicks a universal link like https://ankaadesign.com.br/app/task/123
 * or https://ankaadesign.com.br/task/123 and the mobile app isn't installed,
 * this component redirects them to the correct web application route.
 *
 * Supported URL patterns:
 * - /app/:entityType/:id (universal link format from iOS/Android)
 * - /:entityType/:id (direct entity link)
 *
 * For mobile users, it also shows an option to open in the app.
 */
export function DeepLinkRedirect() {
  const { entityType: entityTypeParam, id: idParam } = useParams<{ entityType?: string; id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [showAppPrompt, setShowAppPrompt] = useState(false);
  const [targetRoute, setTargetRoute] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<string>('');
  const [entityId, setEntityId] = useState<string>('');

  useEffect(() => {
    // Extract entity type and ID from the URL path
    // Handles both /app/:entityType/:id and /:entityType/:id patterns
    const pathParts = location.pathname.split('/').filter(Boolean);

    let extractedEntityType: string;
    let extractedId: string;

    // Check if path starts with 'app' (universal link format: /app/task/123)
    if (pathParts[0]?.toLowerCase() === 'app' && pathParts.length >= 3) {
      extractedEntityType = pathParts[1];
      extractedId = pathParts[2];
    } else if (entityTypeParam && idParam) {
      // Route params from /app/:entityType/:id pattern
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

    // If on mobile, show the app prompt briefly before redirecting
    if (isMobileDevice()) {
      setShowAppPrompt(true);
      // Auto-redirect after a short delay if user doesn't interact
      const timeout = setTimeout(() => {
        navigate(route, { replace: true });
      }, 3000);
      return () => clearTimeout(timeout);
    } else {
      // Desktop: redirect immediately
      navigate(route, { replace: true });
    }
  }, [location.pathname, entityTypeParam, idParam, navigate]);

  const handleOpenInApp = () => {
    // Try to open the custom URL scheme
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
              Detectamos que voce esta em um dispositivo movel. Deseja abrir este conteudo no aplicativo Ankaa Design?
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
