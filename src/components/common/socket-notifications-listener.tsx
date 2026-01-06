/**
 * SocketNotificationsListener Component
 *
 * This component is responsible for initializing the Socket.io connection
 * and listening to real-time notification events. It should be placed at
 * the root level of the application, inside the AuthProvider context.
 */

import { useNotificationSocket } from '@/hooks/use-notification-socket';

export function SocketNotificationsListener(): null {
  // Initialize socket connection and notification listeners
  useNotificationSocket();

  // This component doesn't render anything
  return null;
}
