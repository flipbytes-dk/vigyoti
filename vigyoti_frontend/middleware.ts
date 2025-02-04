import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that don't require authentication
const publicPaths = [
  '/login', 
  '/signup', 
  '/auth', 
  '/pricing', 
  '/api/auth',
  '/api/webhooks/stripe'
];

// Paths that don't require subscription
const noSubscriptionPaths = [...publicPaths, '/pricing', '/api/stripe/create-checkout-session'];

// Paths that don't require workspace
const noWorkspacePaths = [...noSubscriptionPaths, '/onboarding/create-workspace'];

const secret = process.env.NEXTAUTH_SECRET;

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Allow Stripe webhook requests to pass through
    if (pathname === '/api/webhooks/stripe') {
      return NextResponse.next();
    }

    const token = await getToken({ req: request, secret });

    // Check if the path is public
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
    const isApiAuthPath = pathname.startsWith('/api/auth');
    const isPricingPath = pathname === '/pricing';
    const isOnboardingPath = pathname.startsWith('/onboarding');
    const isDashboardPath = pathname.startsWith('/dashboard');

    // Allow all auth API routes to pass through
    if (isApiAuthPath) {
      return NextResponse.next();
    }

    // If not authenticated, only allow public paths
    if (!token) {
      if (isPublicPath) {
        return NextResponse.next();
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // At this point user is authenticated

    // Redirect authenticated users away from auth pages
    if (isPublicPath && !isPricingPath) {
      // Don't redirect away from pricing page even if authenticated
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Check subscription for protected routes
    if (!noSubscriptionPaths.some(path => pathname.startsWith(path))) {
      // If no subscription in token, redirect to pricing
      if (!token.subscription) {
        console.log('No subscription found in token, redirecting to pricing');
        return NextResponse.redirect(new URL('/pricing', request.url));
      }

      // If subscription exists, validate it
      const subscription = token.subscription;
      const isSubscriptionActive = subscription?.status === 'active' || subscription?.status === 'trial';
      const hasValidPlan = ['solo', 'team', 'agency'].includes(subscription?.plan);
      
      // Handle serialized timestamp values (now stored as milliseconds)
      const currentPeriodEnd = typeof subscription?.currentPeriodEnd === 'number'
        ? new Date(subscription.currentPeriodEnd)
        : null;
      const hasValidDates = currentPeriodEnd && currentPeriodEnd > new Date();

      console.log('Subscription validation:', {
        isSubscriptionActive,
        hasValidPlan,
        hasValidDates,
        status: subscription?.status,
        plan: subscription?.plan,
        currentPeriodEnd: currentPeriodEnd?.toISOString(),
        now: new Date().toISOString()
      });

      if (!isSubscriptionActive || !hasValidPlan || !hasValidDates) {
        console.log('Invalid subscription state, redirecting to pricing');
        return NextResponse.redirect(new URL('/pricing', request.url));
      }

      console.log('Subscription is valid, proceeding');
    }

    // Check workspace status for protected routes
    if (!noWorkspacePaths.some(path => pathname.startsWith(path))) {
      // Check if user has any workspaces
      if (!token.hasWorkspaces) {
        console.log('No workspaces found, redirecting to create workspace');
        return NextResponse.redirect(new URL('/onboarding/create-workspace', request.url));
      }

      // Check workspace limits
      if (token.workspaceLimitExceeded) {
        console.log('Workspace limit exceeded, redirecting to upgrade');
        return NextResponse.redirect(new URL('/upgrade', request.url));
      }
    }

    // Check if the request is for an API route
    if (pathname.startsWith('/api/') && !isApiAuthPath) {
      if (!token) {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'auth/unauthorized' },
          { status: 401 }
        );
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    // For API routes, return JSON error
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Internal server error', code: 'auth/server-error' },
        { status: 500 }
      );
    }
    // For other routes, redirect to error page
    return NextResponse.redirect(new URL('/auth/error', request.url));
  }
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. _next/static (static files)
     * 2. _next/image (image optimization files)
     * 3. favicon.ico (favicon file)
     * 4. public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}; 