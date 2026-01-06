# Push Notifications Setup Checklist

Use this checklist to ensure proper setup and deployment of push notifications.

## Prerequisites

- [ ] Node.js and npm installed
- [ ] Firebase account created
- [ ] Backend server ready
- [ ] HTTPS configured (or using localhost for development)

## Firebase Configuration

### 1. Firebase Console Setup

- [ ] Login to [Firebase Console](https://console.firebase.google.com/)
- [ ] Create new project or select existing project
- [ ] Note the project name/ID

### 2. Add Web App

- [ ] Click "Add app" and select Web (</>)
- [ ] Register app with a nickname (e.g., "Ankaa Web - Production")
- [ ] Copy Firebase config values
- [ ] Click "Continue to console"

### 3. Enable Cloud Messaging

- [ ] Go to Project Settings > Cloud Messaging
- [ ] Under "Web Push certificates", click "Generate key pair"
- [ ] Copy the VAPID key
- [ ] Save all configuration values

### 4. Configuration Values Collected

- [ ] API Key: `AIza...`
- [ ] Project ID: `your-project-id`
- [ ] Messaging Sender ID: `123456789012`
- [ ] App ID: `1:123456789012:web:abc123...`
- [ ] VAPID Key: `BN...` (long string)

## Environment Configuration

### 1. Update .env Files

- [ ] Open `.env.development`
- [ ] Add Firebase environment variables:
  ```env
  VITE_FIREBASE_API_KEY=your-api-key
  VITE_FIREBASE_PROJECT_ID=your-project-id
  VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
  VITE_FIREBASE_APP_ID=your-app-id
  VITE_FIREBASE_VAPID_KEY=your-vapid-key
  ```
- [ ] Repeat for `.env.staging`
- [ ] Repeat for `.env.production`

### 2. Update Service Worker

- [ ] Open `/public/firebase-messaging-sw.js`
- [ ] Replace placeholder values with actual Firebase config:
  ```javascript
  firebase.initializeApp({
    apiKey: 'YOUR_ACTUAL_API_KEY',
    projectId: 'YOUR_ACTUAL_PROJECT_ID',
    messagingSenderId: 'YOUR_ACTUAL_SENDER_ID',
    appId: 'YOUR_ACTUAL_APP_ID',
  });
  ```
- [ ] Save the file
- [ ] **Important**: Do this for each environment (dev, staging, prod)

## Backend Setup

### 1. Database Schema

- [ ] Create `user_fcm_tokens` table:
  ```sql
  CREATE TABLE user_fcm_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    device_type ENUM('web', 'ios', 'android') DEFAULT 'web',
    device_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token (token)
  );
  ```
- [ ] Run migration
- [ ] Verify table was created

### 2. Firebase Admin SDK

- [ ] Go to Firebase Console > Project Settings > Service Accounts
- [ ] Click "Generate new private key"
- [ ] Download JSON file (e.g., `serviceAccountKey.json`)
- [ ] **Important**: Add to `.gitignore`
- [ ] Store securely on backend server
- [ ] Initialize Firebase Admin SDK in backend:
  ```javascript
  const admin = require('firebase-admin');
  const serviceAccount = require('./serviceAccountKey.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  ```

### 3. API Endpoints

Implement these endpoints:

- [ ] `POST /push-notifications/register`
  - [ ] Accepts: `{ token, deviceType, deviceName }`
  - [ ] Validates user is authenticated
  - [ ] Saves token to database
  - [ ] Returns success response

- [ ] `POST /push-notifications/unregister`
  - [ ] Accepts: `{ token }`
  - [ ] Validates user is authenticated
  - [ ] Removes token from database
  - [ ] Returns success response

- [ ] `GET /push-notifications/devices`
  - [ ] Validates user is authenticated
  - [ ] Returns user's registered devices
  - [ ] Returns array of devices

- [ ] `POST /push-notifications/test` (optional, dev only)
  - [ ] Accepts: `{ title, body, url }`
  - [ ] Validates user is authenticated
  - [ ] Sends test notification
  - [ ] Returns success response

## Frontend Setup

### 1. Dependencies

- [ ] Run `npm install`
- [ ] Verify `firebase` package installed
- [ ] Check for any peer dependency warnings

### 2. Build

- [ ] Run `npm run build`
- [ ] Verify build completes successfully
- [ ] Check `dist/firebase-messaging-sw.js` exists
- [ ] Verify service worker has correct Firebase config

### 3. Development Testing

- [ ] Run `npm run dev`
- [ ] Open browser to `http://localhost:5173`
- [ ] Open DevTools > Console
- [ ] Check for Firebase initialization messages
- [ ] Check for service worker registration

## Testing

### 1. Permission Flow

- [ ] Clear browser data for the site
- [ ] Login to application
- [ ] Wait 3 seconds
- [ ] Verify permission toast appears
- [ ] Click "Ativar"
- [ ] Verify browser permission dialog appears
- [ ] Click "Allow"
- [ ] Check console for FCM token
- [ ] Verify token sent to backend

### 2. Foreground Notifications

- [ ] Keep app open and focused
- [ ] Send test notification from backend or Firebase Console
- [ ] Verify toast appears with title and body
- [ ] Verify "Abrir" button shows if URL provided
- [ ] Click "Abrir" and verify navigation
- [ ] Verify toast auto-dismisses after 8 seconds

### 3. Background Notifications

- [ ] Send notification from backend or Firebase Console
- [ ] Minimize browser or switch to another tab
- [ ] Verify system notification appears
- [ ] Click notification
- [ ] Verify browser opens/focuses
- [ ] Verify navigation to correct URL

### 4. Multi-Device

- [ ] Login on Chrome
- [ ] Login on Firefox (or another browser)
- [ ] Send notification
- [ ] Verify both devices receive notification
- [ ] Check backend database for multiple tokens

### 5. Permission States

Test these scenarios:

- [ ] User allows permission → Notifications work
- [ ] User denies permission → No error, graceful handling
- [ ] User ignores permission → Can enable later in settings
- [ ] User blocks then unblocks → Works after unblock

### 6. Error Handling

- [ ] Missing Firebase config → App still works, no notifications
- [ ] Invalid VAPID key → Error logged, app still works
- [ ] Backend endpoint fails → Error logged, app still works
- [ ] Service worker fails → Error logged, app still works
- [ ] Network offline → Graceful failure, retry on reconnect

## Browser Testing

Test on all supported browsers:

- [ ] Chrome (desktop)
- [ ] Edge (desktop)
- [ ] Firefox (desktop)
- [ ] Safari 16+ (macOS 13+)
- [ ] Opera (desktop)

Verify for each:
- [ ] Service worker registers
- [ ] Permission request appears
- [ ] Foreground notifications show
- [ ] Background notifications show
- [ ] Navigation works on click

## Production Deployment

### 1. Pre-Deployment

- [ ] All tests passing
- [ ] Firebase config in production `.env` file
- [ ] Service worker has production Firebase config
- [ ] Backend endpoints deployed
- [ ] Database migration completed
- [ ] Firebase Admin SDK configured on backend
- [ ] HTTPS configured and working

### 2. Deployment

- [ ] Build production bundle: `npm run build`
- [ ] Verify `dist/firebase-messaging-sw.js` exists
- [ ] Deploy frontend to hosting
- [ ] Deploy backend API
- [ ] Verify service worker accessible at `https://yourdomain.com/firebase-messaging-sw.js`

### 3. Post-Deployment

- [ ] Open production URL
- [ ] Verify HTTPS is working
- [ ] Login with test account
- [ ] Complete permission flow
- [ ] Send test notification
- [ ] Verify foreground notification
- [ ] Verify background notification
- [ ] Check browser console for errors
- [ ] Check backend logs for errors
- [ ] Monitor for first few hours

### 4. Monitoring

Set up monitoring for:

- [ ] Service worker registration errors
- [ ] FCM token registration errors
- [ ] Notification delivery failures
- [ ] Invalid token cleanup
- [ ] Backend endpoint errors
- [ ] User permission denial rate

## Security Checklist

- [ ] VAPID key not committed to git
- [ ] Service account key not committed to git
- [ ] Service account key stored securely
- [ ] HTTPS enabled in production
- [ ] Backend endpoints require authentication
- [ ] Token validation on backend
- [ ] Rate limiting on notification endpoints
- [ ] Input validation on notification content
- [ ] XSS protection on notification data
- [ ] CORS configured correctly

## Documentation

- [ ] Read `PUSH_NOTIFICATIONS_SETUP.md`
- [ ] Read `PUSH_NOTIFICATIONS_IMPLEMENTATION.md`
- [ ] Read `src/lib/PUSH_NOTIFICATIONS_USAGE.md`
- [ ] Document any custom changes
- [ ] Update team wiki/docs
- [ ] Train team on usage

## Troubleshooting

If issues occur, check:

- [ ] Browser console for errors
- [ ] Service worker console (DevTools > Application > Service Workers)
- [ ] Network tab for failed requests
- [ ] Backend logs
- [ ] Firebase Console > Cloud Messaging > Reports
- [ ] Environment variables are correct
- [ ] Service worker has correct config
- [ ] Database has correct schema
- [ ] HTTPS is enabled
- [ ] Notifications not blocked at OS level

## Rollback Plan

If notifications fail in production:

- [ ] Document the issue
- [ ] Check if app still functions without notifications ✓
- [ ] Disable notification prompt if needed (remove `<PushNotificationSetup />`)
- [ ] Fix issue in staging
- [ ] Re-deploy when fixed
- [ ] Notify users of fix

## Success Criteria

All of these should be true:

- [ ] Users can enable/disable notifications
- [ ] Foreground notifications show as toasts
- [ ] Background notifications show as system notifications
- [ ] Clicking notifications navigates correctly
- [ ] Multiple devices per user work
- [ ] Permission denial handled gracefully
- [ ] App works even if Firebase is down
- [ ] No errors in production console
- [ ] Backend successfully stores tokens
- [ ] Notifications delivered within 5 seconds
- [ ] Clean token management (invalid tokens removed)

## Completion

- [ ] All checklist items completed
- [ ] Tests passing on all browsers
- [ ] Production deployment successful
- [ ] Team trained on usage
- [ ] Documentation complete
- [ ] Monitoring in place
- [ ] Users receiving notifications successfully

---

**Setup Date**: ___________
**Completed By**: ___________
**Production URL**: ___________
**Firebase Project**: ___________
**Notes**: ___________
