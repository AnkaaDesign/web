// Push Notifications API Client
// Handles registration and management of FCM device tokens

import { apiClient } from './axiosClient';

export interface RegisterTokenRequest {
  token: string;
  deviceType?: 'web' | 'ios' | 'android';
  deviceName?: string;
}

export interface RegisterTokenResponse {
  success: boolean;
  message: string;
}

export interface UnregisterTokenRequest {
  token: string;
}

export interface UnregisterTokenResponse {
  success: boolean;
  message: string;
}

/**
 * Register FCM device token with backend
 */
export async function registerDeviceToken(
  token: string,
  deviceType: 'web' | 'ios' | 'android' = 'web',
  deviceName?: string
): Promise<RegisterTokenResponse> {
  try {
    const response = await apiClient.post<RegisterTokenResponse>(
      '/push-notifications/register',
      {
        token,
        deviceType,
        deviceName: deviceName || navigator.userAgent,
      }
    );
    return response.data;
  } catch (error) {
    console.error('[Push Notifications API] Failed to register token:', error);
    throw error;
  }
}

/**
 * Unregister FCM device token from backend
 */
export async function unregisterDeviceToken(token: string): Promise<UnregisterTokenResponse> {
  try {
    const response = await apiClient.post<UnregisterTokenResponse>(
      '/push-notifications/unregister',
      { token }
    );
    return response.data;
  } catch (error) {
    console.error('[Push Notifications API] Failed to unregister token:', error);
    throw error;
  }
}

/**
 * Get all registered devices for current user
 */
export async function getRegisteredDevices(): Promise<any[]> {
  try {
    const response = await apiClient.get('/push-notifications/devices');
    return response.data;
  } catch (error) {
    console.error('[Push Notifications API] Failed to get devices:', error);
    throw error;
  }
}

/**
 * Test push notification (development only)
 */
export async function testPushNotification(
  title: string,
  body: string,
  url?: string
): Promise<void> {
  try {
    await apiClient.post('/push-notifications/test', {
      title,
      body,
      url,
    });
  } catch (error) {
    console.error('[Push Notifications API] Failed to send test notification:', error);
    throw error;
  }
}

export const pushNotificationsService = {
  registerDeviceToken,
  unregisterDeviceToken,
  getRegisteredDevices,
  testPushNotification,
};
