/**
 * Real-world examples of MessageBlockRenderer usage
 *
 * These examples demonstrate common patterns and use cases
 * for rendering message content in your application.
 */

import type { MessageBlock } from './types';

/**
 * Example 1: Welcome Message
 * A typical onboarding or welcome message with mixed content
 */
export const welcomeMessageBlocks: MessageBlock[] = [
  {
    type: 'heading',
    level: 1,
    content: 'Welcome to Our Platform!',
    id: 'welcome-title',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: "We're excited to have you here. Let's get started with a quick tour of the features." },
    ],
  },
  {
    type: 'heading',
    level: 2,
    content: 'Getting Started',
  },
  {
    type: 'list',
    ordered: true,
    items: [
      [
        { type: 'bold', content: 'Complete your profile' },
        { type: 'text', content: ' - Add your basic information and preferences' },
      ],
      [
        { type: 'bold', content: 'Explore the dashboard' },
        { type: 'text', content: ' - Familiarize yourself with the main features' },
      ],
      [
        { type: 'bold', content: 'Join a team' },
        { type: 'text', content: ' - Collaborate with others in your organization' },
      ],
    ],
  },
  {
    type: 'button',
    text: 'Complete Profile',
    variant: 'default',
    url: '/profile',
  },
  {
    type: 'button',
    text: 'Skip for Now',
    variant: 'ghost',
    onClick: () => console.log('Skipped'),
  },
];

/**
 * Example 2: Blog Post / Article
 * A rich content article with images, quotes, and formatting
 */
export const blogPostBlocks: MessageBlock[] = [
  {
    type: 'heading',
    level: 1,
    content: 'The Future of Web Development',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'Web development is evolving at an ' },
      { type: 'italic', content: 'unprecedented pace' },
      { type: 'text', content: '. New frameworks, tools, and paradigms emerge constantly, reshaping how we build for the web.' },
    ],
  },
  {
    type: 'image',
    src: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200&h=600&fit=crop',
    alt: 'Modern web development setup',
    caption: 'A modern developer workspace',
  },
  {
    type: 'heading',
    level: 2,
    content: 'Key Trends',
  },
  {
    type: 'list',
    ordered: false,
    items: [
      [
        { type: 'bold', content: 'Server Components' },
        { type: 'text', content: ' - Rendering on the server for better performance' },
      ],
      [
        { type: 'bold', content: 'Edge Computing' },
        { type: 'text', content: ' - Bringing computation closer to users' },
      ],
      [
        { type: 'bold', content: 'TypeScript Adoption' },
        { type: 'text', content: ' - Type safety becoming the standard' },
      ],
    ],
  },
  {
    type: 'quote',
    content: [
      { type: 'text', content: 'The best way to predict the future is to invent it.' },
    ],
    author: 'Alan Kay',
  },
  {
    type: 'divider',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'Learn more about these trends in our ' },
      { type: 'link', content: 'comprehensive guide', url: '/guides/web-dev-trends' },
      { type: 'text', content: '.' },
    ],
  },
];

/**
 * Example 3: Notification / Alert Message
 * A simple notification with action buttons
 */
export const notificationBlocks: MessageBlock[] = [
  {
    type: 'heading',
    level: 3,
    content: 'New Update Available',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'Version ' },
      { type: 'bold', content: '2.0' },
      { type: 'text', content: ' is now available with new features and improvements.' },
    ],
  },
  {
    type: 'list',
    ordered: false,
    items: [
      [{ type: 'text', content: 'Improved performance' }],
      [{ type: 'text', content: 'New dark mode theme' }],
      [{ type: 'text', content: 'Bug fixes and stability improvements' }],
    ],
  },
  {
    type: 'button',
    text: 'Update Now',
    variant: 'default',
    onClick: () => console.log('Update clicked'),
  },
  {
    type: 'button',
    text: 'View Changelog',
    variant: 'outline',
    url: '/changelog',
  },
];

/**
 * Example 4: Help Documentation
 * Technical documentation with code examples and instructions
 */
export const documentationBlocks: MessageBlock[] = [
  {
    type: 'heading',
    level: 1,
    content: 'API Authentication Guide',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'This guide explains how to authenticate requests to our API using ' },
      { type: 'bold', content: 'API keys' },
      { type: 'text', content: ' or ' },
      { type: 'bold', content: 'OAuth 2.0' },
      { type: 'text', content: '.' },
    ],
  },
  {
    type: 'heading',
    level: 2,
    content: 'Using API Keys',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'API keys are the simplest way to authenticate. Follow these steps:' },
    ],
  },
  {
    type: 'list',
    ordered: true,
    items: [
      [{ type: 'text', content: 'Generate an API key from your dashboard' }],
      [{ type: 'text', content: 'Include the key in the Authorization header' }],
      [{ type: 'text', content: 'Make your API request' }],
    ],
  },
  {
    type: 'quote',
    content: [
      { type: 'bold', content: 'Important: ' },
      { type: 'text', content: 'Never share your API key or commit it to version control. Store it securely in environment variables.' },
    ],
  },
  {
    type: 'divider',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'For more information, visit our ' },
      { type: 'link', content: 'API documentation', url: '/docs/api' },
      { type: 'text', content: '.' },
    ],
  },
];

/**
 * Example 5: Email Newsletter
 * A newsletter-style message with sections and CTAs
 */
export const newsletterBlocks: MessageBlock[] = [
  {
    type: 'heading',
    level: 1,
    content: 'Monthly Product Updates - January 2026',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'Happy New Year! Here are the latest updates from our team.' },
    ],
  },
  {
    type: 'divider',
  },
  {
    type: 'heading',
    level: 2,
    content: 'New Features',
  },
  {
    type: 'list',
    ordered: false,
    items: [
      [
        { type: 'bold', content: 'Advanced Analytics' },
        { type: 'text', content: ' - Deep insights into your data' },
      ],
      [
        { type: 'bold', content: 'Team Collaboration' },
        { type: 'text', content: ' - Work together in real-time' },
      ],
      [
        { type: 'bold', content: 'Mobile App' },
        { type: 'text', content: ' - Now available on iOS and Android' },
      ],
    ],
  },
  {
    type: 'image',
    src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=600&fit=crop',
    alt: 'Analytics dashboard preview',
    caption: 'New analytics dashboard with real-time insights',
  },
  {
    type: 'divider',
  },
  {
    type: 'heading',
    level: 2,
    content: 'Featured Article',
  },
  {
    type: 'quote',
    content: [
      { type: 'text', content: '10 Tips to Boost Your Productivity in 2026' },
    ],
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'Learn practical strategies to make the most of your time and achieve your goals.' },
    ],
  },
  {
    type: 'button',
    text: 'Read Article',
    variant: 'default',
    url: '/blog/productivity-tips-2026',
  },
  {
    type: 'divider',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'Questions or feedback? ' },
      { type: 'link', content: 'Contact our support team', url: '/support' },
      { type: 'text', content: '.' },
    ],
  },
];

/**
 * Example 6: Tutorial / Step-by-Step Guide
 * Educational content with clear steps and visual aids
 */
export const tutorialBlocks: MessageBlock[] = [
  {
    type: 'heading',
    level: 1,
    content: 'How to Create Your First Project',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'Follow this ' },
      { type: 'bold', content: 'step-by-step guide' },
      { type: 'text', content: ' to create your first project in just a few minutes.' },
    ],
  },
  {
    type: 'heading',
    level: 2,
    content: 'Step 1: Create a New Project',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'Click the ' },
      { type: 'bold', content: 'New Project' },
      { type: 'text', content: ' button in your dashboard.' },
    ],
  },
  {
    type: 'button',
    text: 'New Project',
    variant: 'default',
    onClick: () => console.log('Create project'),
  },
  {
    type: 'heading',
    level: 2,
    content: 'Step 2: Configure Settings',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'Choose your project settings:' },
    ],
  },
  {
    type: 'list',
    ordered: false,
    items: [
      [{ type: 'text', content: 'Project name and description' }],
      [{ type: 'text', content: 'Privacy settings (public or private)' }],
      [{ type: 'text', content: 'Team members to collaborate with' }],
    ],
  },
  {
    type: 'heading',
    level: 2,
    content: 'Step 3: Start Building',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: "You're all set! Begin adding content to your project." },
    ],
  },
  {
    type: 'quote',
    content: [
      { type: 'bold', content: 'Pro Tip: ' },
      { type: 'text', content: 'Use templates to get started faster. Browse our template library for inspiration.' },
    ],
  },
];

/**
 * Example 7: Simple Announcement
 * Brief announcement with minimal content
 */
export const announcementBlocks: MessageBlock[] = [
  {
    type: 'heading',
    level: 2,
    content: 'Scheduled Maintenance',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'We will be performing scheduled maintenance on ' },
      { type: 'bold', content: 'Saturday, January 15th from 2:00 AM to 4:00 AM EST' },
      { type: 'text', content: '. During this time, the service may be temporarily unavailable.' },
    ],
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'We apologize for any inconvenience. For updates, check our ' },
      { type: 'link', content: 'status page', url: '/status' },
      { type: 'text', content: '.' },
    ],
  },
];
