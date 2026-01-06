# Push Notifications - Quick Usage Guide

## How to Send Notifications from Backend

### 1. Send to Specific User

```typescript
// Backend code example
import { messaging } from 'firebase-admin/messaging';

async function sendNotificationToUser(userId: string, notification: {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}) {
  // Get user's FCM tokens from database
  const tokens = await getUserFCMTokens(userId);

  if (tokens.length === 0) {
    console.log('User has no registered devices');
    return;
  }

  const message = {
    notification: {
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/logo.png',
    },
    data: {
      url: notification.url || '/',
      timestamp: new Date().toISOString(),
    },
    tokens: tokens, // Send to all user's devices
  };

  const response = await messaging().sendEachForMulticast(message);

  console.log(`Successfully sent to ${response.successCount} devices`);
  console.log(`Failed to send to ${response.failureCount} devices`);

  // Clean up invalid tokens
  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      // Remove invalid token from database
      removeInvalidToken(tokens[idx]);
    }
  });
}
```

### 2. Send to Multiple Users

```typescript
async function sendNotificationToMultipleUsers(
  userIds: string[],
  notification: {
    title: string;
    body: string;
    url?: string;
  }
) {
  for (const userId of userIds) {
    await sendNotificationToUser(userId, notification);
  }
}
```

### 3. Send to Topic (Broadcast)

```typescript
async function sendNotificationToTopic(
  topic: string,
  notification: {
    title: string;
    body: string;
    url?: string;
  }
) {
  const message = {
    notification: {
      title: notification.title,
      body: notification.body,
      icon: '/logo.png',
    },
    data: {
      url: notification.url || '/',
    },
    topic: topic, // e.g., 'all-users', 'admins', 'sector-1'
  };

  const response = await messaging().send(message);
  console.log('Successfully sent to topic:', response);
}
```

## Frontend Usage Examples

### 1. Manual Permission Request

```typescript
import { initializePushNotifications } from '@/lib/push-notifications';

// In a settings page or button click
async function enableNotifications() {
  const success = await initializePushNotifications();

  if (success) {
    toast.success('Notificações ativadas com sucesso!');
  } else {
    toast.error('Não foi possível ativar as notificações');
  }
}
```

### 2. Check Permission Status

```typescript
import {
  hasNotificationPermission,
  isNotificationPermissionDenied
} from '@/lib/push-notifications';

function NotificationSettings() {
  const hasPermission = hasNotificationPermission();
  const isDenied = isNotificationPermissionDenied();

  if (isDenied) {
    return (
      <div>
        <p>Notificações bloqueadas. Ative nas configurações do navegador.</p>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <button onClick={enableNotifications}>
        Ativar Notificações
      </button>
    );
  }

  return <p>Notificações ativas</p>;
}
```

### 3. Send Test Notification

```typescript
import { testPushNotification } from '@/api-client/push-notifications';

async function sendTestNotification() {
  try {
    await testPushNotification(
      'Notificação de Teste',
      'Esta é uma notificação de teste do sistema.',
      '/dashboard'
    );
    toast.success('Notificação de teste enviada!');
  } catch (error) {
    toast.error('Erro ao enviar notificação de teste');
  }
}
```

### 4. Get User's Devices

```typescript
import { getRegisteredDevices } from '@/api-client/push-notifications';

async function showUserDevices() {
  try {
    const devices = await getRegisteredDevices();
    console.log('Registered devices:', devices);
    // Display in UI
  } catch (error) {
    console.error('Failed to get devices:', error);
  }
}
```

## Common Notification Scenarios

### 1. Task Assignment Notification

```typescript
// Backend
await sendNotificationToUser(assignedUserId, {
  title: 'Nova Tarefa Atribuída',
  body: `Você foi atribuído à tarefa: ${taskName}`,
  url: `/producao/agenda/detalhes/${taskId}`,
});
```

### 2. Order Status Update

```typescript
// Backend
await sendNotificationToUser(customerId, {
  title: 'Pedido Atualizado',
  body: `Seu pedido #${orderId} foi atualizado para: ${newStatus}`,
  url: `/estoque/pedidos/detalhes/${orderId}`,
});
```

### 3. Approval Request

```typescript
// Backend
await sendNotificationToUser(managerId, {
  title: 'Solicitação de Aprovação',
  body: `${userName} solicitou aprovação para ${itemName}`,
  url: `/administracao/aprovacoes/${requestId}`,
});
```

### 4. System Alert

```typescript
// Backend - send to all admins
await sendNotificationToTopic('admins', {
  title: 'Alerta do Sistema',
  body: 'Backup do banco de dados concluído com sucesso',
  url: '/servidor/backup',
});
```

## Database Schema Example

### User FCM Tokens Table

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

## Backend API Implementation Example

```typescript
// routes/push-notifications.ts
import { Router } from 'express';
import { messaging } from 'firebase-admin/messaging';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Register device token
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { token, deviceType = 'web', deviceName } = req.body;
    const userId = req.user.id;

    // Save to database
    await db.query(
      'INSERT INTO user_fcm_tokens (user_id, token, device_type, device_name) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE last_used_at = NOW()',
      [userId, token, deviceType, deviceName]
    );

    res.json({ success: true, message: 'Token registered successfully' });
  } catch (error) {
    console.error('Error registering token:', error);
    res.status(500).json({ success: false, message: 'Failed to register token' });
  }
});

// Unregister device token
router.post('/unregister', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    await db.query(
      'DELETE FROM user_fcm_tokens WHERE user_id = ? AND token = ?',
      [userId, token]
    );

    res.json({ success: true, message: 'Token unregistered successfully' });
  } catch (error) {
    console.error('Error unregistering token:', error);
    res.status(500).json({ success: false, message: 'Failed to unregister token' });
  }
});

// Get registered devices
router.get('/devices', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const devices = await db.query(
      'SELECT id, device_type, device_name, created_at, last_used_at FROM user_fcm_tokens WHERE user_id = ?',
      [userId]
    );

    res.json(devices);
  } catch (error) {
    console.error('Error getting devices:', error);
    res.status(500).json({ success: false, message: 'Failed to get devices' });
  }
});

// Send test notification
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { title, body, url } = req.body;
    const userId = req.user.id;

    // Get user's tokens
    const tokens = await db.query(
      'SELECT token FROM user_fcm_tokens WHERE user_id = ?',
      [userId]
    );

    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No registered devices found'
      });
    }

    const message = {
      notification: { title, body },
      data: { url: url || '/' },
      tokens: tokens.map(t => t.token),
    };

    const response = await messaging().sendEachForMulticast(message);

    res.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ success: false, message: 'Failed to send notification' });
  }
});

export default router;
```

## Environment Setup

### Backend Firebase Admin SDK

```typescript
// firebase-admin-config.ts
import * as admin from 'firebase-admin';

const serviceAccount = require('./path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const messaging = admin.messaging();
```

### Get Service Account Key

1. Go to Firebase Console
2. Project Settings > Service Accounts
3. Click "Generate new private key"
4. Save the JSON file securely (DO NOT commit to git)
5. Add to .gitignore

## Testing Checklist

- [ ] Firebase configuration is correct
- [ ] Service worker is registered
- [ ] Permission request appears on first login
- [ ] FCM token is generated
- [ ] Token is saved to backend database
- [ ] Foreground notifications show as toasts
- [ ] Background notifications show as system notifications
- [ ] Clicking notification navigates to correct URL
- [ ] Multiple devices per user work correctly
- [ ] Invalid tokens are cleaned up
- [ ] HTTPS is configured (or localhost for dev)

## Troubleshooting Quick Fixes

### "Permission denied"
- User needs to enable in browser settings
- Clear site data and try again
- Check if notifications are blocked at OS level

### "Service worker not found"
- Check if file exists at `/firebase-messaging-sw.js`
- Rebuild the app
- Clear browser cache

### "Token not registering"
- Check backend API endpoint
- Verify authentication token is valid
- Check backend logs for errors

### "Notifications not showing"
- Verify Firebase config is correct
- Check service worker console for errors
- Ensure app is on HTTPS (or localhost)
- Check if notifications are muted in OS settings
