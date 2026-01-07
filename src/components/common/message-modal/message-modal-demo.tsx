import * as React from "react";
import { MessageModal } from "./message-modal";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/types";

/**
 * Demo component to showcase the MessageModal functionality
 * This can be used for testing and development
 */
export function MessageModalDemo() {
  const [open, setOpen] = React.useState(false);
  const [currentDemo, setCurrentDemo] = React.useState<"single" | "multiple" | "priorities">("single");

  // Demo messages
  const singleMessage: Notification[] = [
    {
      id: "1",
      userId: "user-1",
      title: "Welcome to the System",
      body: `
        <h3>Getting Started</h3>
        <p>Thank you for joining our platform! Here are some quick tips to get you started:</p>
        <ul>
          <li>Complete your profile in the settings</li>
          <li>Explore the dashboard to see your overview</li>
          <li>Check out our documentation for detailed guides</li>
        </ul>
        <p>If you have any questions, don't hesitate to reach out to our support team!</p>
      `,
      type: "ANNOUNCEMENT",
      channel: ["IN_APP", "PUSH"],
      importance: "HIGH",
      actionType: "Learn More",
      actionUrl: "https://docs.example.com",
      scheduledAt: null,
      sentAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
  ];

  const multipleMessages: Notification[] = [
    {
      id: "1",
      userId: "user-1",
      title: "System Update Available",
      body: `
        <p>A new system update is available with the following improvements:</p>
        <ul>
          <li>Enhanced performance and speed</li>
          <li>New features for better productivity</li>
          <li>Bug fixes and security improvements</li>
        </ul>
        <p>The update will be installed automatically during off-peak hours.</p>
      `,
      type: "UPDATE",
      channel: ["IN_APP"],
      importance: "MEDIUM",
      actionType: "View Release Notes",
      actionUrl: "https://changelog.example.com",
      scheduledAt: null,
      sentAt: new Date(Date.now() - 3600000),
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 3600000),
      deletedAt: null,
    },
    {
      id: "2",
      userId: "user-1",
      title: "Scheduled Maintenance",
      body: `
        <p><strong>Important:</strong> We will be performing scheduled maintenance on:</p>
        <p style="padding: 1rem; background: #f3f4f6; border-radius: 0.5rem; margin: 1rem 0;">
          <strong>Date:</strong> Saturday, January 20, 2026<br>
          <strong>Time:</strong> 2:00 AM - 4:00 AM EST<br>
          <strong>Duration:</strong> Approximately 2 hours
        </p>
        <p>During this time, some services may be temporarily unavailable. We apologize for any inconvenience.</p>
      `,
      type: "ALERT",
      channel: ["IN_APP", "EMAIL"],
      importance: "HIGH",
      actionType: null,
      actionUrl: null,
      scheduledAt: null,
      sentAt: new Date(Date.now() - 7200000),
      createdAt: new Date(Date.now() - 7200000),
      updatedAt: new Date(Date.now() - 7200000),
      deletedAt: null,
    },
    {
      id: "3",
      userId: "user-1",
      title: "New Feature: Dark Mode",
      body: `
        <p>We're excited to announce a new feature: <strong>Dark Mode</strong>! 🌙</p>
        <p>You can now toggle between light and dark themes in your settings.</p>
        <p>Benefits of dark mode:</p>
        <ul>
          <li>Reduced eye strain in low-light environments</li>
          <li>Better battery life on OLED screens</li>
          <li>Sleek, modern appearance</li>
        </ul>
        <p>Try it out and let us know what you think!</p>
      `,
      type: "ANNOUNCEMENT",
      channel: ["IN_APP"],
      importance: "LOW",
      actionType: "Go to Settings",
      actionUrl: "/settings/appearance",
      scheduledAt: null,
      sentAt: new Date(Date.now() - 10800000),
      createdAt: new Date(Date.now() - 10800000),
      updatedAt: new Date(Date.now() - 10800000),
      deletedAt: null,
    },
  ];

  const priorityMessages: Notification[] = [
    {
      id: "1",
      userId: "user-1",
      title: "Critical Security Update",
      body: `
        <p style="color: #dc2626; font-weight: 600;">⚠️ URGENT: Security Update Required</p>
        <p>We've detected a potential security vulnerability that affects your account.</p>
        <p><strong>Action Required:</strong></p>
        <ol>
          <li>Update your password immediately</li>
          <li>Enable two-factor authentication</li>
          <li>Review recent account activity</li>
        </ol>
        <p>Your account security is our top priority. Please complete these steps as soon as possible.</p>
      `,
      type: "ALERT",
      channel: ["IN_APP", "EMAIL", "SMS"],
      importance: "HIGH",
      actionType: "Secure My Account",
      actionUrl: "/security/settings",
      scheduledAt: null,
      sentAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    {
      id: "2",
      userId: "user-1",
      title: "Monthly Report Ready",
      body: `
        <p>Your monthly performance report is now available for review.</p>
        <p>This month's highlights:</p>
        <ul>
          <li>15% increase in productivity</li>
          <li>23 tasks completed</li>
          <li>87% on-time completion rate</li>
        </ul>
        <p>Keep up the great work!</p>
      `,
      type: "GENERAL",
      channel: ["IN_APP"],
      importance: "MEDIUM",
      actionType: "View Report",
      actionUrl: "/reports/monthly",
      scheduledAt: null,
      sentAt: new Date(Date.now() - 1800000),
      createdAt: new Date(Date.now() - 1800000),
      updatedAt: new Date(Date.now() - 1800000),
      deletedAt: null,
    },
    {
      id: "3",
      userId: "user-1",
      title: "Upcoming Training Session",
      body: `
        <p>You're invited to our upcoming training session on advanced features.</p>
        <p><strong>Details:</strong></p>
        <ul>
          <li>Date: Next Tuesday, 2:00 PM</li>
          <li>Duration: 1 hour</li>
          <li>Format: Virtual (Zoom)</li>
        </ul>
        <p>RSVP by Friday to reserve your spot!</p>
      `,
      type: "REMINDER",
      channel: ["IN_APP", "EMAIL"],
      importance: "LOW",
      actionType: "RSVP Now",
      actionUrl: "/events/training-session",
      scheduledAt: null,
      sentAt: new Date(Date.now() - 3600000),
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 3600000),
      deletedAt: null,
    },
  ];

  const getMessages = () => {
    switch (currentDemo) {
      case "single":
        return singleMessage;
      case "multiple":
        return multipleMessages;
      case "priorities":
        return priorityMessages;
      default:
        return singleMessage;
    }
  };

  const handleMarkAsRead = (messageId: string) => {
    console.log("Message marked as read:", messageId);
    // In a real app, this would call the API
  };

  const handleDontShowAgain = (messageId: string) => {
    console.log("Message dismissed (don't show again):", messageId);
    // In a real app, this would save to localStorage
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Message Modal Demo</h1>
        <p className="text-muted-foreground">
          Test the message modal component with different scenarios
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-3 p-6 border rounded-lg">
          <h3 className="font-semibold">Single Message</h3>
          <p className="text-sm text-muted-foreground">
            Display one message at a time
          </p>
          <Button
            onClick={() => {
              setCurrentDemo("single");
              setOpen(true);
            }}
            className="w-full"
          >
            Show Single Message
          </Button>
        </div>

        <div className="space-y-3 p-6 border rounded-lg">
          <h3 className="font-semibold">Multiple Messages</h3>
          <p className="text-sm text-muted-foreground">
            Navigate through multiple messages
          </p>
          <Button
            onClick={() => {
              setCurrentDemo("multiple");
              setOpen(true);
            }}
            className="w-full"
          >
            Show Multiple Messages
          </Button>
        </div>

        <div className="space-y-3 p-6 border rounded-lg">
          <h3 className="font-semibold">Priority Levels</h3>
          <p className="text-sm text-muted-foreground">
            Messages with different priorities
          </p>
          <Button
            onClick={() => {
              setCurrentDemo("priorities");
              setOpen(true);
            }}
            className="w-full"
          >
            Show Priority Messages
          </Button>
        </div>
      </div>

      <div className="p-6 border rounded-lg bg-muted/30 space-y-3">
        <h3 className="font-semibold">Features to Test</h3>
        <ul className="space-y-2 text-sm">
          <li>✓ Keyboard navigation (Arrow keys, ESC)</li>
          <li>✓ Mark as read functionality</li>
          <li>✓ Don't show again option</li>
          <li>✓ Progress indicator for multiple messages</li>
          <li>✓ Different priority badges (High, Medium, Low)</li>
          <li>✓ Message types (General, System, Alert, etc.)</li>
          <li>✓ Action URLs with call-to-action buttons</li>
          <li>✓ Responsive design and animations</li>
        </ul>
      </div>

      <MessageModal
        open={open}
        onOpenChange={setOpen}
        messages={getMessages()}
        onMarkAsRead={handleMarkAsRead}
        onDontShowAgain={handleDontShowAgain}
      />
    </div>
  );
}
