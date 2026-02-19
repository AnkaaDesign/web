/**
 * Shared notification deduplication module
 * Prevents the same notification from showing multiple toasts
 * (e.g., when both socket and push notifications fire for the same event)
 */

// Track shown notification IDs to prevent duplicates
const shownNotificationIds = new Set<string>();
const SHOWN_NOTIFICATION_TTL = 60000; // Clear after 1 minute

/**
 * Check if a notification should be shown (hasn't been shown recently)
 * @param notificationId - Unique identifier for the notification
 * @returns true if the notification should be shown, false if it's a duplicate
 */
export function shouldShowNotification(notificationId: string): boolean {
  if (shownNotificationIds.has(notificationId)) {
    return false;
  }

  shownNotificationIds.add(notificationId);
  setTimeout(() => {
    shownNotificationIds.delete(notificationId);
  }, SHOWN_NOTIFICATION_TTL);

  return true;
}

/**
 * Generate a notification key from title and body (for push notifications without ID)
 */
export function generateNotificationKey(title: string, body?: string): string {
  return `${title}:${body || ''}`.toLowerCase().trim();
}

/**
 * Check if a notification by title/body should be shown
 */
export function shouldShowNotificationByContent(title: string, body?: string): boolean {
  const key = generateNotificationKey(title, body);
  return shouldShowNotification(key);
}

/**
 * Clear all tracked notifications (useful for testing)
 */
export function clearShownNotifications(): void {
  shownNotificationIds.clear();
}
