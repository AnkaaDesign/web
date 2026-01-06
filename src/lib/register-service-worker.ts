/**
 * Service Worker Registration Utility
 * Registers the Firebase Cloud Messaging service worker
 */

/**
 * Register the Firebase Messaging service worker
 * This should be called early in the application lifecycle
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Service Worker] Not supported in this browser');
    }
    return null;
  }

  try {
    // Register the service worker
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      {
        scope: '/',
      }
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Service Worker] Registered successfully:', registration);
    }

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Service Worker] Ready');
    }

    return registration;
  } catch (error) {
    console.error('[Service Worker] Registration failed:', error);
    return null;
  }
}

/**
 * Unregister all service workers (useful for cleanup)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    for (const registration of registrations) {
      await registration.unregister();
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Service Worker] Unregistered all service workers');
    }

    return true;
  } catch (error) {
    console.error('[Service Worker] Unregistration failed:', error);
    return false;
  }
}

/**
 * Check if service worker is registered
 */
export async function isServiceWorkerRegistered(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    return registration !== undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Get the current service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    return registration || null;
  } catch (error) {
    console.error('[Service Worker] Failed to get registration:', error);
    return null;
  }
}

/**
 * Update the service worker (useful when deploying new versions)
 */
export async function updateServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');

    if (!registration) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Service Worker] No registration found to update');
      }
      return false;
    }

    await registration.update();

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Service Worker] Updated successfully');
    }

    return true;
  } catch (error) {
    console.error('[Service Worker] Update failed:', error);
    return false;
  }
}
