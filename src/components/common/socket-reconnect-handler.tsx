/**
 * SocketReconnectHandler Component
 *
 * Listens for socket reconnection failures and shows a user-friendly
 * notification prompting them to refresh the page.
 */

import { useEffect } from 'react';
import { toast } from 'sonner';

export function SocketReconnectHandler(): null {
  useEffect(() => {
    const handleReconnectFailed = (event: Event) => {
      const customEvent = event as CustomEvent<{ message: string }>;

      toast.error('Conexão perdida', {
        description: customEvent.detail.message || 'Não foi possível restabelecer a conexão. Por favor, atualize a página.',
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
