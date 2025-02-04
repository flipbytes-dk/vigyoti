# Vigyoti Project Memory

## Project Overview
Vigyoti is a web application that helps users generate and manage social media content using AI. The application has a modern architecture with a Next.js frontend and a Python FastAPI backend.

## Data Storage Architecture

### Firebase Storage
- Used for storing media files (images, videos)
- Organized by user/workspace/project:
  ```
  storage/
  ├── users/
  │   └── {userId}/
  │       └── workspaces/
  │           └── {workspaceId}/
  │               └── projects/
  │                   └── {projectId}/
  │                       ├── images/
  │                       │   └── {imageId}.{ext}
  │                       └── videos/
  │                           └── {videoId}.{ext}
  ```

### Firestore Collections
```typescript
// Workspaces Collection
workspaces: {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  createdAt: timestamp;
  updatedAt: timestamp;
}

// Projects Collection
projects: {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  createdAt: timestamp;
  updatedAt: timestamp;
}

// Tweets Collection
tweets: {
  id: string;
  projectId: string;
  workspaceId: string;
  userId: string;
  tweet_text: string;
  is_thread: boolean;
  thread_position?: number;
  image_url?: string;
  image_generation_details?: {
    prompt: string;
    aspect_ratio: string;
    style_type: string;
    magic_prompt_option: string;
    negative_prompt?: string;
  };
  is_premium_content: boolean;
  status: 'draft' | 'scheduled' | 'published';
  scheduledFor?: timestamp;
  publishedAt?: timestamp;
  createdAt: timestamp;
  updatedAt: timestamp;
}

// Media Collection
media: {
  id: string;
  projectId: string;
  workspaceId: string;
  userId: string;
  type: 'image' | 'video';
  url: string;
  storageRef: string;
  size: number;
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    format: string;
  };
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

### Storage Flow
1. When a user generates/uploads media:
   - File is uploaded to Firebase Storage in the appropriate path
   - Entry is created in the media collection
   - Media URL is stored with the tweet

2. When editing a tweet:
   - Existing media details are loaded from Firestore
   - Updates are saved to both Storage and Firestore
   - Old media is cleaned up if replaced

3. Storage Limits:
   - Track usage in user's profile
   - Implement cleanup for unused media
   - Enforce plan-specific storage limits

### Best Practices
1. Use Firebase Storage Rules to secure media access
2. Implement media cleanup for deleted tweets
3. Use transaction for related updates
4. Cache frequently accessed media URLs
5. Compress images before storage
6. Track and manage storage quotas

## Project Structure

### Frontend (`vigyoti_frontend/`)
- Built with Next.js 13+ using the App Router
- Uses TypeScript for type safety
- Implements a modern component-based architecture

Key directories:
```
vigyoti_frontend/
├── app/                    # Next.js app directory (App Router)
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── content/           # Content creation pages
│   └── dashboard/         # Dashboard pages
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components
│   ├── dashboard/        # Dashboard-specific components
│   └── workspace/        # Workspace-related components
├── lib/                   # Utility functions and services
└── public/               # Static assets
```

### Backend (`vigyoti_backend/`)
- Built with FastAPI
- Uses Python for AI content generation
- Implements RESTful API endpoints

## Key Features

### Authentication Flow
- Uses NextAuth.js for authentication
- Implements sign-in with email/password
- Handles user session management
- Redirects users based on authentication state

### Dashboard Layout
- Responsive sidebar navigation
- Collapsible menu sections
- User workspace selection
- Quick access to content generation

### Content Generation
1. **Project Creation**
   - Users can create named projects
   - Projects are organized within workspaces
   - Support for project descriptions

2. **Content Source Selection**
   - Multiple content source options:
     - YouTube videos
     - Blog/Article URLs
     - Audio files
     - Images
     - Documents
     - Custom text

3. **Generation Process**
   - Three-step workflow:
     1. Define Source
     2. Generate Content
     3. Review & Publish
   - Support for different content types:
     - Short Tweet
     - Long Tweet
     - Thread
     - Poll
     - Quote
   - Configurable number of tweets (1-10)
   - Premium mode for longer content

4. **Content Display**
   - Video content analysis with summary and transcript
   - Generated tweets in card format
   - Tweet management options:
     - Copy: Quick copy of tweet text to clipboard
     - Edit: Opens a modal with advanced editing capabilities
     - Schedule: Schedule tweet for later posting
     - Publish: Immediate publishing to Twitter

### Tweet Editing Interface
1. **Modal Layout**
   - Split view design with editor and preview panels
   - Real-time preview of changes
   - Character count display with color-coded feedback

2. **Editing Features**
   - Direct text editing with character limit validation
   - Tweet action buttons:
     - Delete: Remove the tweet
     - Edit Text: Direct text modification
     - AI Rewrite: AI-assisted content rewriting
     - Add Image: Media attachment capability
   - Preview panel with final appearance
   - Action buttons for:
     - Save Changes: Update tweet content
     - Schedule: Plan tweet timing
     - Publish: Direct posting

### Tweet Management Features
1. **Tweet Deletion**
   - Confirmation dialog before deletion
   - Immediate UI update after deletion
   - Success notification feedback
   - State management for deleted tweets

2. **Image Handling**
   - Dual approach to image addition:
     - Direct file upload with preview
     - AI-based image generation
   - Image generation options:
     - Aspect ratio selection (square, portrait, landscape)
     - Context-aware generation using tweet text and summary
   - Upload features:
     - File type validation
     - Local preview before saving
     - Error handling for failed uploads

3. **Modal Interactions**
   - Nested dialogs for complex actions
   - Loading states during image generation
   - Clear user feedback for actions
   - Proper state management between parent/child modals

## UI/UX Patterns

### Twitter-Like Design Elements
1. **Modal Design**
   - Clean, minimal interface with pure white background
   - Subtle borders for section separation
   - Larger text size (text-xl) for better readability
   - Simplified button design without icons for primary actions
   - Consistent spacing and padding
   - Twitter-style placeholder text ("What's happening?")
   - Character counter with subtle background colors

2. **Visual Hierarchy**
   - Bold headings for clear section identification
   - Subtle shadows for depth without overwhelming
   - Light borders for container definition
   - Proper spacing between elements (mb-1, mt-4, etc.)
   - Consistent text sizes across similar elements
   - Clear distinction between interactive and static elements

3. **Button Styling**
   - Minimal design for secondary actions
   - Bold, filled style for primary actions
   - Hover states that match Twitter's interaction patterns
   - Equal width buttons in groups
   - Reduced visual noise by removing unnecessary icons
   - Contextual colors for different actions (red for delete, blue for publish)

## Best Practices Learned
1. **Modal Design**
   - Split view for complex editing interfaces
   - Live preview for immediate feedback
   - Clear separation of editing and preview areas
   - Consistent action button placement

2. **State Management**
   - Separate state for edited content
   - Preview updates based on changes
   - Modal open/close state handling
   - Form validation state

3. **User Feedback**
   - Character count visualization
   - Color-coded status indicators
   - Clear action labeling
   - Immediate visual feedback for actions

4. **Action Button Organization**
   - Group related actions together
   - Use visual separators for different action types
   - Maintain consistent spacing (pt-6, gap-4)
   - Apply contextual hover states for better UX
   - Right-align primary actions
   - Use borders to define action areas
   - Implement hierarchical button styling

5. **File Handling**
   - Use of FileReader for image uploads
   - Local URL creation for previews
   - Proper cleanup of object URLs
   - Image type validation

6. **Modal Management**
   - Nested dialog handling
   - State management between modals
   - Loading state handling
   - Error state management

## API Integration

### Frontend to Backend Communication
- Base URL configuration through environment variables
- API endpoint: `/api/v1/content-sources/youtube-to-twitter`
- Request payload structure:
```typescript
{
  url: string;
  content_type: string;
  num_tweets: number;
  additional_context?: string;
  generate_image: boolean;
  is_premium: boolean;
}
```

### Response Structure
```typescript
interface ContentGenerationResponse {
  video_title?: string;
  video_summary?: string;
  full_transcript?: string;
  generated_tweets: Array<{
    tweet_text: string;
    is_thread: boolean;
    thread_position?: number;
    image_url?: string;
    is_premium_content: boolean;
  }>;
  metadata: Record<string, any>;
  cost_info: {
    input_tokens: number;
    output_tokens: number;
    input_cost: number;
    output_cost: number;
    total_cost: number;
  };
}
```

### Image Generation Endpoint
```typescript
interface ImageGenerationRequest {
  tweet_text: string;
  summary: string;
  aspect_ratio: "square" | "portrait" | "landscape";
}

interface ImageGenerationResponse {
  image_url: string;
}
```

## Lessons Learned

1. **State Management**
   - Importance of clearing state when navigating between steps
   - Need for proper error handling in API calls
   - Managing loading states for better UX

2. **UI/UX Considerations**
   - Visual feedback for current step in multi-step processes
   - Clear separation between different types of content
   - Importance of proper spacing and visual hierarchy

3. **API Integration**
   - Proper error handling for API responses
   - Logging for debugging API calls
   - Structured response handling

4. **Form Validation**
   - Required field validation
   - Visual indicators for validation state
   - Clear error messages

5. **Component Design**
   - Reusable components for common UI elements
   - Proper prop typing with TypeScript
   - Consistent styling patterns

6. **File Handling**
   - Use of FileReader for image uploads
   - Local URL creation for previews
   - Proper cleanup of object URLs
   - Image type validation

7. **Modal Management**
   - Nested dialog handling
   - State management between modals
   - Loading state handling
   - Error state management

## Future Improvements
1. Implement edit functionality for generated tweets
2. Add scheduling capabilities
3. Implement direct publishing to Twitter
4. Add analytics for content performance
5. Enhance error handling and user feedback

## Environment Configuration
Required environment variables:
```
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:8000"
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Next.js Import and Dependency Management Learnings

### Package Imports vs Local Components
1. When using npm packages, import them directly using their package name:
   ```typescript
   // Correct
   import { Toaster } from 'sonner';
   
   // Incorrect (for npm packages)
   import { Toaster } from '@/components/ui/sonner';
   ```

2. The `@/` path alias in Next.js points to your project's root directory. Use it only for local components and modules, not for npm packages.

### Troubleshooting Import Issues
1. Build Cache Management:
   - Clear the `.next` folder when experiencing persistent import errors
   - Run `npm install` or `yarn install` to ensure dependencies are properly installed
   - Restart the development server after clearing cache

2. Common Import Error Solutions:
   - Verify the package is properly listed in package.json
   - Check for correct import syntax
   - Remove conflicting local implementations of package components
   - Clear build cache if issues persist

### Best Practices
1. Prefer direct package imports over wrapper components unless custom functionality is needed
2. Keep local component names distinct from package component names to avoid confusion
3. Regularly update dependencies to ensure compatibility
4. Document any custom implementations or modifications of third-party components

## Path Alias Configuration in Next.js
- When using path aliases (like @/*) in Next.js projects, ensure the tsconfig.json paths are correctly configured
- The paths configuration should match your project structure
- Common issue: path aliases not working due to incorrect base directory configuration
- Solution: Configure paths in tsconfig.json to point to the correct base directory
- Remember to restart the development server after making changes to tsconfig.json

## Project Structure Organization
- Maintain clear separation between frontend and backend code
- Keep all frontend-related files within vigyoti_frontend directory
- Keep all backend-related files within vigyoti_backend directory
- Store project-level documentation at the root level
- Benefits:
  - Clearer organization and separation of concerns
  - Easier dependency management
  - Simplified deployment process
  - Better maintainability
  - Clearer import paths and module resolution

## Next.js 14+ Async APIs
- Some Next.js 14+ APIs like headers() return Promises and must be awaited
- Common async APIs include:
  - headers()
  - cookies()
  - useSelectedLayoutSegment()
- Best practices:
  - Always await these APIs before accessing their methods
  - Check the Next.js documentation for API changes between versions
  - Use proper error handling with async operations
  - Remember that async operations can only be used in Server Components or async functions

## Authentication Redirect Best Practices
- Avoid redirect loops by carefully considering all path conditions
- Key considerations:
  1. Allow authentication callback paths (/auth/*) even when authenticated
  2. Allow public paths for unauthenticated users
  3. Consider the root path (/) separately
  4. Use specific conditions for redirects
- Common pitfalls:
  1. Redirecting from login page creates infinite loops
  2. Not handling auth callback paths properly
  3. Over-aggressive redirect conditions
- Best practices:
  1. Maintain a clear list of public paths
  2. Use startsWith() for path matching
  3. Add specific exceptions for special paths
  4. Test both authenticated and unauthenticated flows

## Next.js 14+ Route Handler Best Practices
- Dynamic route parameters should be accessed through context.params
- Route handler function parameters:
  ```typescript
  export async function GET(
    req: Request,
    context: { params: { [key: string]: string } }
  )
  ```
- Common patterns for API endpoints:
  1. Authentication check using getServerSession
  2. Parameter validation
  3. Error handling with appropriate status codes
  4. Consistent response format

## API Response Structure
- User Subscription Response:
  ```typescript
  {
    status: 'active' | 'inactive',
    plan: string,
    features: {
      maxProjects: number,
      maxWorkspaces: number,
      aiImageGeneration: boolean,
      premiumTemplates: boolean
    },
    currentPeriodEnd: Date
  }
  ```
- User Credits Response:
  ```typescript
  {
    available: number,
    used: number,
    total: number,
    resetDate: Date
  }
  ```

## Subscription and Credits System

### Plan Tiers
1. Free Plan:
   - 1 workspace
   - 10 posts per month
   - 25 AI credits
   - Basic features

2. Solo Plan:
   - 1 workspace
   - Unlimited posts
   - 500 AI credits
   - Can buy additional credits

3. Team Plan:
   - 2 workspaces
   - 2 team members
   - 2000 AI credits
   - All Solo features

4. Agency Plan:
   - Unlimited workspaces
   - Unlimited team members
   - 5000 AI credits
   - Activity logs
   - All Team features

### Credit System
1. Action Costs:
   - 10 credits: Generate 10 tweets
   - 10 credits: Generate 1 thread
   - 20 credits: Generate 1 AI video
   - 2 credits: Generate 1 AI image
   - 1 credit: Rewrite 1 tweet (GPT/Claude)
   - 2 credits: 1GB storage per month

2. Usage Tracking:
   - Track by category (tweets, threads, videos, etc.)
   - Monthly reset based on billing cycle
   - Storage credits calculated monthly
   - Separate counters for different AI models

### Implementation Notes
1. Credit Validation:
   - Check available credits before actions
   - Reserve credits for ongoing operations
   - Release unused credits
   - Track usage history

2. Plan Limits:
   - Enforce workspace limits
   - Track monthly post usage
   - Monitor team member count
   - Manage storage quotas

3. Upgrade/Downgrade:
   - Prorate credits on plan change
   - Handle feature availability
   - Manage team access changes
   - Storage limit adjustments
