/**
 * SocketReconnectHandler Component
 *
 * Listens for socket reconnection failures and shows a user-friendly
 * notification prompting them to refresh the page.
 *
 * Uses a unique toast ID to prevent duplicate connection error toasts.
 */

import { useEffect } from 'react';
import { toast as sonnerToast } from 'sonner';

// Unique toast ID for connection error toasts - prevents duplicates
const CONNECTION_ERROR_TOAST_ID = 'socket-connection-error';

export function SocketReconnectHandler(): null {
  useEffect(() => {
    const handleReconnectFailed = (event: Event) => {
      const customEvent = event as CustomEvent<{ message: string }>;

      // Dismiss any existing connection error toast before showing a new one
      sonnerToast.dismiss(CONNECTION_ERROR_TOAST_ID);

      // Use raw sonner toast since we need the action button
      sonnerToast.error('Conexão perdida', {
        id: CONNECTION_ERROR_TOAST_ID,
        description: customEvent.detail?.message || 'Não foi possível restabelecer a conexão. Por favor, atualize a página.',
        duration: Infinity, // Keep showing until user acts
        action: {
          label: 'Atualizar',
          onClick: () => {
            window.location.reload();
          },
        },
      });
    };

    // Listen for socket reconnection failures
    window.addEventListener('socket:reconnect-failed', handleReconnectFailed);

    // Cleanup
    return () => {
      window.removeEventListener('socket:reconnect-failed', handleReconnectFailed);
    };
  }, []);

  return null;
}
