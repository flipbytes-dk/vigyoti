Below are **very detailed instructions** for building the **React/Next.js** application called `Vigyoti`. These instructions incorporate the following:

- The **original** project requirements for an AI-based tweet generation and scheduling tool.
- Additional **implementation notes** regarding logging, project structure, server-side API calls, environment variables, error handling, **type safety**, **API client initialization**, **data fetching**, **Next.js configuration**, and **CORS** management.

---

## Table of Contents

1. [Important Implementation Notes](#important-implementation-notes)
   1. [0. Adding Logs](#0-adding-logs)
   2. [1. Project Setup](#1-project-setup)
   3. [2. Server-side API Calls](#2-server-side-api-calls)
   4. [3. Environment Variables](#3-environment-variables)
   5. [4. Error Handling and Logging](#4-error-handling-and-logging)
   6. [5. Type Safety](#5-type-safety)
   7. [6. API Client Initialization](#6-api-client-initialization)
   8. [7. Data Fetching in Components](#7-data-fetching-in-components)
   9. [8. Next.js Configuration](#8-nextjs-configuration)
   10. [9. CORS and API Routes](#9-cors-and-api-routes)

2. [Overview](#overview)
3. [Tech Stack and Requirements](#tech-stack-and-requirements)
4. [Project Structure](#project-structure)
5. [Installation & Configuration](#installation--configuration)
   1. [Environment Variables](#environment-variables-1)
   2. [Stripe Setup](#stripe-setup)
   3. [API Endpoints](#api-endpoints)
6. [UI/UX and Theming](#uiux-and-theming)
   1. [Using ShadCN](#using-shadcn)
   2. [Tailwind CSS Configuration](#tailwind-css-configuration)
   3. [Lucide Icons](#lucide-icons)
7. [Authentication & Authorization](#authentication--authorization)
8. [Subscription and Payment Flow](#subscription-and-payment-flow)
   1. [Subscription Plans](#subscription-plans)
   2. [Managing Credits](#managing-credits)
9. [Workspaces & Projects](#workspaces--projects)
10. [Dashboard](#dashboard)
11. [Tweet Generation Flow](#tweet-generation-flow)
    1. [Supported Input Sources](#supported-input-sources)
    2. [Tweet Types](#tweet-types)
    3. [Tweet Generation UI](#tweet-generation-ui)
    4. [Editing & Regenerating Tweets](#editing--regenerating-tweets)
    5. [Media Attachments](#media-attachments)
    6. [Scheduling Tweets](#scheduling-tweets)
12. [Profile Assessment Module](#profile-assessment-module)
13. [Analytics Module](#analytics-module)
14. [User Background & Niche Definition](#user-background--niche-definition)
15. [AI-based Topic & Hashtag Suggestions](#ai-based-topic--hashtag-suggestions)
16. [Storage Constraints & Data Management](#storage-constraints--data-management)
17. [Implementation Details](#implementation-details)
18. [Summary & Next Steps](#summary--next-steps)

---

## 1. Important Implementation Notes

### 0. Adding Logs
- Always add **server-side logs** to your code so we can debug potential issues.
- Ensure logs are descriptive and capture key execution points (incoming requests, errors, etc.).

### 1. Project Setup
- The skeletal structure for the next.js app is already created and is available in the `./vigyoti_frontend/` folder and you should consider this as the root of the frontend project.
- **All new components** go in `./components` at the root (not in `app`), named like `example-component.tsx`.
- **All new pages** go in `./app`.
- Use the **Next.js 14** App Router.
- All **data fetching** should be done in a **server component** and passed down as props to client components.
- **Client components** that use React hooks (`useState`, `useEffect`, etc.) must have `'use client'` at the top.

### 2. Server-side API Calls
- Interactions with external APIs (OpenAI, YouTube, etc.) must be performed **server-side**.
- Create dedicated API routes in `pages/api` for each external API.
- Client-side components fetch data through these routes, **not** directly from external APIs.

### 3. Environment Variables
- Store sensitive data (API keys, credentials) in **environment variables**.
- Use `.env.local` for local dev (listed in `.gitignore`).
- For production, set environment variables on the hosting platform (e.g., Vercel).
- Access environment variables only in server-side code or API routes.

### 4. Error Handling and Logging
- Implement **comprehensive error handling** in both client and server code.
- Log errors on the **server side** (e.g., `console.error` or a logging tool).
- Show **user-friendly** error messages on the client side (no raw stack traces).

### 5. Type Safety
- Use **TypeScript** interfaces (or types) for all data structures, especially **API responses**.
- Avoid using `any`; define **proper types** for variables, function parameters, and return values.
- Ensure consistent usage of `interface` or `type` to describe shapes of data fetched from the backend.

### 6. API Client Initialization
- Initialize API clients (OpenAI, external data sources, etc.) in **server-side code only**.
- If a specialized client library is used, ensure it is properly **instantiated** and **authorized** before making requests.
- Keep API client logic centralized so it can be easily maintained and updated.

### 7. Data Fetching in Components
- Prefer **server components** for data fetching in Next.js 14, where possible.
- Where client-side fetching is needed, use React hooks (e.g., `useEffect`, `useSWR`).
- Implement **loading states** and **error handling** for all data fetching operations in the UI.

### 8. Next.js Configuration
- Use `next.config.mjs` (or `.js` if needed) for environment-specific config.
- Use the `env` property in `next.config.mjs` to make any environment variables available to the application if absolutely necessary (but remember not to expose sensitive keys).
- Configure any advanced Next.js settings (e.g., image optimization, rewrites, redirects) here.

### 9. CORS and API Routes
- Use Next.js **API routes** to avoid CORS issues with external APIs.
- Configure or implement appropriate request **validation** and guard against malicious inputs.
- If you need external services to call your API routes, set up the relevant **CORS** rules.

---

## 2. Overview

We are building a **paid application** that enables users to:
- **Subscribe** (via Stripe) to one of three plans: Solo, Team, or Agency.
- Generate **Twitter content** using AI (text, images, scheduling).
- Organize their work in **workspaces** and **projects**.
- Perform **profile assessments** and get **analytics** for their tweets.
- Use **AI-based** suggestions for topics and hashtags.

The **backend** is a FastAPI service that already exists, providing REST endpoints for authentication, tweet generation, scheduling, analytics, and more. The backend exists in the `./vigyoti_backend/` folder and you should consider this as the root of the backend project.

---

## 3. Tech Stack and Requirements

**Frontend**:
- **React** with **Next.js** (v14, App Router).
- **ShadCN** for UI components.
- **Tailwind CSS** for styling.
- **Lucide icons** for icons.
- **TypeScript** for type safety.

**Backend**:
- **FastAPI** (already implemented).
- **OpenAI GPT-4o** and other AI/ML services (transcription, content extraction).

**Payments**:
- **Stripe** for subscriptions and payment management.

**Data Storage**:
- Each user has a configurable **storage limit** (GB). Tweets, images, videos, and other data count toward this quota.

---

## 4. Project Structure

The project is already structured and you should consider the `./vigyoti_frontend/` folder as the root of the frontend project. These are the level 1 contents of the frontend project:

```
.
├── README.md
├── app
├── components.json
├── lib
├── next-env.d.ts
├── next.config.mjs
├── node_modules
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```
These are the contents of the `./app` folder:

```
.
├── favicon.ico
├── fonts
│   ├── GeistMonoVF.woff
│   └── GeistVF.woff
├── globals.css
├── layout.tsx
└── page.tsx
```
- **Components**: keep them in `./components`.
- **Server components** and pages in `./app`.
- **Dedicated API routes** in `./pages/api`.

---

## 5. Installation & Configuration

### 5.1 Environment Variables

Create `.env.local` with variables:
```
    NEXT_PUBLIC_API_BASE_URL=
    STRIPE_SECRET_KEY=
    STRIPE_PUBLIC_KEY=
    NEXTAUTH_SECRET=
    NEXTAUTH_URL=
    TWITTER_API_KEY=
    TWITTER_API_SECRET=
```
- Keep `.env.local` in `.gitignore`.
- Access these variables only in server-side code or `pages/api` routes, unless absolutely necessary for client usage (e.g., public domain references).

### 5.2 Stripe Setup

    1. Install `stripe` (`npm i stripe`).
    2. In `lib/stripe.ts`:

    ```ts
    import Stripe from 'stripe';

    export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2022-11-15',
    });
    ```

    3.	Create a webhook endpoint in pages/api/webhooks/stripe.ts to handle Stripe events (e.g., subscription updates).

### 5.3 API Endpoints
- FastAPI offers:
    - Auth routes
    - Tweet generation
    - Scheduling
    - Analytics
    - Profile assessment
- Next.js: create pages/api/* routes for any additional data wrangling or to avoid CORS by proxying requests to the FastAPI.
- Client will call these API routes, never the external service directly.

## 6. UI/UX and Theming

### 6.1 Using ShadCN
	•	Follow the ShadCN UI docs for styling consistent, accessible components.
	•	Keep shared components in ./components/ui.
    •	For installing components use this format: `npx shadcn@latest add button`

### 6.2 Tailwind CSS Configuration
	1.	Install Tailwind, PostCSS, Autoprefixer:
    `npm i -D tailwindcss postcss autoprefixer`
    2.	Setup tailwind.config.js with ShadCN and Next.js content paths.
	3.	Import Tailwind in `styles/globals.css`.

### 6.3 Lucide Icons
	•	Install lucide-react and import icons as needed:
    `npm i lucide-react`
    `import { Twitter, Youtube } from 'lucide-react';`

## 7. Authentication & Authorization
	•	Use NextAuth or a custom approach to validate user credentials with the FastAPI backend.
	•	On successful login, store user’s subscription plan and credit information.
	•	Gate features based on plan type or remaining credits.

## 8. Subscription and Payment Flow

### 8.1 Subscription Plans
	•	Solo, Team, Agency (configurable credit allocations, prices).
	•	Display these plans in a pricing page with a Subscribe button that triggers Stripe Checkout.

### 8.2 Managing Credits
	•	Each plan grants monthly credits (e.g., 100, 500, 2000).
	•	Decrement credits upon content generation or other usage.
	•	Display remaining credits in user’s dashboard.
	•	Prompt upgrade or purchase add-ons when credits are low or exhausted.

### 8.3 Credit Usage
The usage for credit is as explained in the csv below:
```
Description, ,Credits Needed
Generate tweets using any source (10 tweets),, 10 credits
Generate 1 thread using any source (10 tweets),, 10 credits
Generate 1 AI video using open AI SORA,, 20 credits
Generate 1 AI image ,,2 credits
Rewrite 1 AI tweet using GPT 4.0,, 1 credits
Storage 1 GB, ,2 credits per month
Rewrite 1 AI tweet using Claude,, 1 credits
Storage 2 GB, ,4 credits per month
```

## 9. Workspaces & Projects
	•	Workspaces: top-level container for user’s projects.
	•	Projects: each workspace can have multiple projects.
	•	A default workspace and project is created on registration.
	•	The user’s Dashboard should display or link to these.
    •	A `Solo` user will have one workspace and only one project in it.
    •	A `Team` user will have 5 workspaces and each can have 3 projects in it.
    •	An `Agency` user will have unlimited workspaces and unlimited projects in each workspace.

## 10. Dashboard
	•	The initial page after login.
	•	Show user’s subscription status, credits, and quick actions (Generate Tweet, Analytics, Profile Assessment).
	•	Provide navigation to Workspaces/Projects.

## 11. Tweet Generation Flow

### 11.1 Supported Input Sources
	1.	YouTube (via transcript)
	2.	Blog post (via Firecrawl)
	3.	Audio (via Whisper)
	4.	Image (GPT-4o vision)
	5.	Document (docx/PDF)
	6.	Custom text

### 11.2 Tweet Types
	•	Short, Long, Thread, Poll, Q&A, Comparison, Guides, Cheatsheets (as requested).

### 11.3 Tweet Generation UI
	•	Prompt user for source, tweet type, optional extra instructions.
	•	Display up to 10 suggestions in separate Cards.

### 11.4 Editing & Regenerating Tweets
	•	Each card has Edit and Regenerate.
	•	Regenerate consumes credits again.

### 11.5 Media Attachments
	•	Attach or upload images/videos to the tweet.
	•	Monitor user’s storage usage limit.

### 11.6 Scheduling Tweets
	•	User picks date/time.
	•	Must have a valid Twitter API key in settings.
	•	The backend handles final posting at the scheduled time.

## 12. Profile Assessment Module
	•	Evaluate user’s Twitter profile photo, banner, and bio, scoring each (0–10).
	•	Provide suggestions for improvement (AI-based).
    •	Further details are provided in `bio.md`

## 13. Analytics Module
	•	Shows how tweets performed (retweets, likes, profile visits).
	•	AI-based analysis: which topics, formats do best.
	•	Present data via charts or tables.

##14. User Background & Niche Definition
	•	Let the user define their background/niche/goals.
	•	The AI uses this to tailor topic and hashtag suggestions.

## 15. AI-based Topic & Hashtag Suggestions
	•	Based on user’s background/niche, fetch trending topics/hashtags via AI or external data sources.
	•	Display them in a “Suggestions” panel.

## 16. Storage Constraints & Data Management
	•	Each plan has a max GB limit for files (images, videos, docs).
	•	Show usage progress in the dashboard.
	•	Prevent or warn the user when nearing or exceeding the limit.

## 17. Implementation Details
	1.	React Components:
        •	Store them in ./components.
        •	Use server components for data fetching if feasible.
        •	Add 'use client' in client components with hooks.
	2.	State Management:
        •	Local state with React hooks or a library (Zustand/Recoil).
        •	Global user/session state with NextAuth or a combination of SSR + context.
	3.	API Integration:
        •	Use pages/api/* as proxy if needed to handle external API calls (e.g., CORS).
        •	Ensure robust error handling and logging (server logs, user notifications).
	4.	Error Handling:
        •	Try/catch around important logic.
        •	Log server errors (with context) and show user-friendly messages in the UI.
	5.	Scheduling:
        •	The backend stores scheduling data; a cron or queue triggers posts at the correct time.
        •	The frontend only handles UI for scheduling (date/time selection) and passes it to the backend.
	6.	Profile Assessment:
        •	Let the user set or confirm their Twitter handle.
        •	Fetch data from Twitter’s API, then AI calculates scores and suggestions.
	7.	Analytics:
        •	Possibly from Twitter analytics API or your own tracking system.
        •	Visualize metrics in charts or tables.
	    •	Provide AI-based textual insights.
	8.	Topic & Hashtag Suggestions:
        •	Input user’s niche, query AI or external data for relevant suggestions.
        •	Show them as clickable tags or a list the user can pick from.
	9.	Testing:
        •	Thoroughly test all flows, especially subscription logic and tweet scheduling.
        •	Test storage limits, error conditions, and concurrency (multiple tweet generations).

18. Summary & Next Steps

Summary:
These instructions detail the entire React/Next.js front-end with ShadCN and Tailwind. They include:
	•	Logging, error handling, environment variables.
	•	TypeScript best practices for type safety.
	•	API client initialization in server code.
	•	Data fetching patterns for Next.js 14.
	•	Subscription flow with Stripe.
	•	AI-based tweet generation, scheduling, profile assessments, and analytics.

Next Steps:
	1.	Initialize the Next.js 14 project with TypeScript, Tailwind, ShadCN, Lucide.
	2.	Set up environment variables in .env.local and NextAuth (if used).
	3.	Implement subscription and payment pages using Stripe and webhooks.
	4.	Build the workspace/project structure and the tweet generation flows (server and client).
	5.	Integrate with FastAPI endpoints (through Next.js API routes).
	6.	Test all features thoroughly—particularly scheduling, analytics, storage usage, and error handling.
	7.	Deploy to a production environment (e.g., Vercel), ensuring environment variables are securely set and logs are captured.

By following these instructions, any team of developers or software agents should be able to fully implement the front-end application, meeting all functional and architectural requirements.