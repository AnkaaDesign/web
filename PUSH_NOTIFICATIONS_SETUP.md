# Push Notifications Setup Guide

This guide explains how to set up and use Firebase Cloud Messaging (FCM) for web push notifications.

## Table of Contents

- [Overview](#overview)
- [Firebase Setup](#firebase-setup)
- [Environment Configuration](#environment-configuration)
- [Service Worker Configuration](#service-worker-configuration)
- [How It Works](#how-it-works)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

The application uses Firebase Cloud Messaging (FCM) to deliver push notifications to users' browsers. Notifications work in two modes:

1. **Foreground**: When the app is open, notifications appear as toast messages
2. **Background**: When the app is closed or in another tab, notifications appear as system notifications

## Firebase Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

### 2. Add a Web App

1. In your Firebase project, click the web icon (</>) to add a web app
2. Register your app with a nickname (e.g., "Ankaa Web")
3. Copy the Firebase configuration values

### 3. Enable Cloud Messaging

1. In Firebase Console, go to **Project Settings** > **Cloud Messaging**
2. Under **Web Push certificates**, click **Generate key pair**
3. Copy the **VAPID key** (also called Web Push certificate)

### 4. Get Your Configuration Values

You'll need these values from Firebase Console:

- **API Key**: Project Settings > General > Your apps > Web app config
- **Project ID**: Project Settings > General
- **Messaging Sender ID**: Project Settings > Cloud Messaging
- **App ID**: Project Settings > General > Your apps > Web app config
- **VAPID Key**: Project Settings > Cloud Messaging > Web Push certificates

## Environment Configuration

### 1. Update .env Files

Add the following variables to your `.env.development`, `.env.staging`, and `.env.production` files:

```env
# Firebase Cloud Messaging (Push Notifications)
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_VAPID_KEY=your-vapid-key
```

Replace the placeholder values with your actual Firebase configuration.

### 2. Example Configuration

```env
VITE_FIREBASE_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_FIREBASE_PROJECT_ID=ankaa-production
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
VITE_FIREBASE_VAPID_KEY=BNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Service Worker Configuration

The service worker file is located at `/public/firebase-messaging-sw.js`.

**Important**: Before deploying, you need to update the Firebase configuration in the service worker:

1. Open `/public/firebase-messaging-sw.js`
2. Replace the placeholder values with your actual Firebase config:

```javascript
firebase.initializeApp({
  apiKey: 'YOUR_ACTUAL_API_KEY',
  projectId: 'YOUR_ACTUAL_PROJECT_ID',
  messagingSenderId: 'YOUR_ACTUAL_SENDER_ID',
  appId: 'YOUR_ACTUAL_APP_ID',
});
```

> **Note**: The service worker cannot access environment variables directly, so you must hard-code these values or use a build-time replacement script.

### Build-Time Replacement (Recommended)

For a more automated approach, you can create a build script that replaces the placeholders:

```javascript
// In your build script
const serviceWorkerContent = fs.readFileSync('public/firebase-messaging-sw.js', 'utf8');
const replaced = serviceWorkerContent
  .replace('VITE_FIREBASE_API_KEY', process.env.VITE_FIREBASE_API_KEY)
  .replace('VITE_FIREBASE_PROJECT_ID', process.env.VITE_FIREBASE_PROJECT_ID)
  .replace('VITE_FIREBASE_MESSAGING_SENDER_ID', process.env.VITE_FIREBASE_MESSAGING_SENDER_ID)
  .replace('VITE_FIREBASE_APP_ID', process.env.VITE_FIREBASE_APP_ID);
fs.writeFileSync('dist/firebase-messaging-sw.js', replaced);
```

## How It Works

### User Flow

1. **First Login**: User logs in for the first time
2. **Permission Request**: After 3 seconds, a toast appears asking if they want to enable notifications
3. **User Accepts**: Browser shows native permission dialog
4. **Token Generated**: FCM generates a unique device token
5. **Token Registered**: Token is sent to backend at `/push-notifications/register`
6. **Ready**: User can now receive push notifications

### Notification Display

#### Foreground (App Open)

When the app is open:
- Notifications appear as toast messages using Sonner
- Click "Abrir" to navigate to the notification URL
- Automatically dismissed after 8 seconds

#### Background (App Closed)

When the app is closed or in another tab:
- System notification appears
- Click notification to open/focus app and navigate to URL
- Handled by service worker

### Permission States

- **Granted**: User can receive notifications
- **Denied**: User blocked notifications (can be changed in browser settings)
- **Default**: User hasn't been asked yet

## Testing

### 1. Test Notification API

Use the test endpoint to send a notification:

```javascript
import { testPushNotification } from '@/api-client/push-notifications';

// Send test notification
await testPushNotification(
  'Test Notification',
  'This is a test message',
  '/dashboard'
);
```

### 2. Test from Firebase Console

1. Go to Firebase Console > Cloud Messaging
2. Click "Send test message"
3. Enter your FCM token (check browser console for token)
4. Send the message

### 3. Check Browser Console

Look for these log messages:

```
[Firebase] Initialized
[Push Notifications] FCM Token obtained: [token]
[Push Notifications] Token registered with backend
[firebase-messaging-sw.js] Received background message
```

## Troubleshooting

### Notifications Not Showing

1. **Check Browser Support**
   - Notifications are supported in Chrome, Firefox, Edge, and Safari 16+
   - Not supported in private/incognito mode

2. **Check Permission**
   - Ensure notification permission is granted
   - Check browser settings: chrome://settings/content/notifications

3. **Check Service Worker**
   - Open DevTools > Application > Service Workers
   - Verify service worker is registered and active

4. **Check Console Logs**
   - Look for Firebase initialization errors
   - Check for token generation errors

### Token Not Registering

1. **Check Environment Variables**
   - Verify all Firebase env vars are set correctly
   - Check VAPID key is correct

2. **Check Service Worker Config**
   - Ensure service worker has correct Firebase config
   - Rebuild if you changed the config

3. **Check Backend Endpoint**
   - Verify `/push-notifications/register` endpoint exists
   - Check backend logs for errors

### Background Notifications Not Working

1. **Check Service Worker**
   - Ensure service worker is registered
   - Check for JavaScript errors in service worker

2. **Check HTTPS**
   - Service workers require HTTPS (or localhost)
   - Notifications won't work on HTTP sites

3. **Check Browser Focus**
   - Background notifications only show when app is not in focus
   - Try opening another tab or minimizing browser

## API Reference

### Push Notification Functions

```typescript
// Request permission and get FCM token
const token = await requestPermission();

// Register token with backend
await registerDeviceToken(token);

// Setup foreground message handler
setupPushNotifications((url) => {
  // Handle notification click
  navigate(url);
});

// Initialize everything
const success = await initializePushNotifications();

// Check permission status
const hasPermission = hasNotificationPermission();
const isDenied = isNotificationPermissionDenied();
```

### Backend API Endpoints

```typescript
// Register device token
POST /push-notifications/register
Body: { token: string, deviceType: 'web' | 'ios' | 'android', deviceName?: string }

// Unregister device token
POST /push-notifications/unregister
Body: { token: string }

// Get registered devices
GET /push-notifications/devices

// Send test notification (development only)
POST /push-notifications/test
Body: { title: string, body: string, url?: string }
```

## Best Practices

1. **Ask at the Right Time**: Don't ask for permission immediately. Wait until the user has used the app and understands its value.

2. **Handle Denial Gracefully**: If user denies permission, don't keep asking. Provide a way to enable it later in settings.

3. **Clear Messaging**: Explain why notifications are useful before asking for permission.

4. **Test Thoroughly**: Test both foreground and background notifications on multiple browsers.

5. **Error Handling**: Always handle errors gracefully. Some users may have notifications blocked at the OS level.

## Security Notes

1. **VAPID Key**: Keep your VAPID key secure. Don't commit it to public repositories.

2. **Token Storage**: FCM tokens are sensitive. Store them securely on your backend.

3. **HTTPS Required**: Push notifications require HTTPS in production (localhost is exempt for development).

4. **Validate Backend**: Always validate that notification requests come from authenticated users.

## Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Notifications Guide](https://web.dev/push-notifications-overview/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notification)
