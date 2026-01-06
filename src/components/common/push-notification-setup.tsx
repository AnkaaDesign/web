import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  initializePushNotifications,
  setupPushNotifications,
  hasNotificationPermission,
  isNotificationPermissionDenied,
} from '@/lib/push-notifications';
import { toast } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';

const NOTIFICATION_PERMISSION_ASKED_KEY = 'push_notification_permission_asked';

/**
 * Component that handles push notification setup
 * - Requests permission on first login (only once)
 * - Sets up foreground message handlers
 * - Handles notification clicks
 */
export function PushNotificationSetup() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Only run if user is authenticated and we haven't initialized yet
    if (!isAuthenticated || !user || initialized) {
      return;
    }

    // Setup foreground message handler with navigation
    setupPushNotifications((url) => {
      if (url) {
        // Navigate to the URL from notification
        try {
          const urlObj = new URL(url, window.location.origin);
          navigate(urlObj.pathname + urlObj.search + urlObj.hash);
        } catch (error) {
          // If URL parsing fails, just navigate to the path
          navigate(url);
        }
      }
    });

    // Check if we've already asked for permission
    const hasAskedForPermission = localStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY);

    // If permission is already granted, just initialize
    if (hasNotificationPermission()) {
      initializePushNotifications()
        .then((success) => {
          if (success && process.env.NODE_ENV !== 'production') {
            console.log('[Push Notifications] Successfully initialized');
          }
        })
        .catch((error) => {
          console.error('[Push Notifications] Failed to initialize:', error);
        });
      setInitialized(true);
      return;
    }

    // If permission was denied, don't ask again
    if (isNotificationPermissionDenied()) {
      setInitialized(true);
      return;
    }

    // If we haven't asked yet, show a toast to ask for permission
    if (!hasAskedForPermission) {
      // Wait a bit after login to ask for permission (better UX)
      const timer = setTimeout(() => {
        toast.info(
          'Notificações Push',
          'Gostaria de receber notificações importantes?',
          {
            duration: 10000,
            action: {
              label: 'Ativar',
              onClick: async () => {
                // Mark that we asked
                localStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');

                // Request permission and initialize
                const success = await initializePushNotifications();

                if (success) {
                  toast.success(
                    'Notificações Ativadas',
                    'Você receberá notificações importantes do sistema.'
                  );
                } else {
                  // Check if it was denied
                  if (isNotificationPermissionDenied()) {
                    toast.warning(
                      'Notificações Bloqueadas',
                      'Você pode ativar as notificações nas configurações do navegador.'
                    );
                  }
                }
              },
            },
            cancel: {
              label: 'Agora não',
              onClick: () => {
                // Mark that we asked
                localStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
              },
            },
          }
        );
      }, 3000); // Wait 3 seconds after login

      setInitialized(true);

      return () => clearTimeout(timer);
    }

    setInitialized(true);
  }, [isAuthenticated, user, initialized, navigate]);

  // This component doesn't render anything
  return null;
}
