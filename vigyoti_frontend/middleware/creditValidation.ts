import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getFirebaseToken } from '@/lib/firebase/auth';
import { CreditService } from '@/lib/services/credit-service';
import { PLAN_FEATURES, PlanType, PlanFeatures } from '@/types/subscription';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';

// Define credit costs for different actions
export const CREDIT_COSTS = {
  tweet_generation: 1,
  thread_generation: 3,
  ai_video: 10,
  ai_image: 5,
  tweet_rewrite: 1,
  storage: 1, // per GB
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

/**
 * Middleware to validate credit availability before actions
 */
export async function validateCredits(
  req: NextRequest,
  action: CreditAction,
  quantity: number = 1
) {
  try {
    // Get NextAuth token
    const token = await getToken({ req });
    if (!token?.sub) {
      return {
        isValid: false,
        error: 'Unauthorized',
        status: 401
      };
    }

    // Get Firebase token and sign in
    await getFirebaseToken(req);

    // Calculate required credits
    const requiredCredits = CREDIT_COSTS[action] * quantity;

    // Check if user has enough credits
    const hasCredits = await CreditService.hasEnoughCredits(
      token.sub,
      requiredCredits
    );

    if (!hasCredits) {
      return {
        isValid: false,
        error: 'Insufficient credits',
        status: 403,
        requiredCredits
      };
    }

    // Get user's plan to validate against plan limits
    const userPlan = await CreditService.getUserPlan(token.sub);
    const planFeatures: PlanFeatures = PLAN_FEATURES[userPlan];

    // Validate against plan-specific limits
    switch (action) {
      case 'storage':
        if (typeof planFeatures.maxStorageGB === 'number' && quantity > planFeatures.maxStorageGB) {
          return {
            isValid: false,
            error: 'Storage limit exceeded for your plan',
            status: 403,
            limit: planFeatures.maxStorageGB
          };
        }
        break;
      
      case 'ai_video':
        if (!planFeatures.canGenerateVideos) {
          return {
            isValid: false,
            error: 'Video generation not available in your plan',
            status: 403
          };
        }
        break;

      case 'ai_image':
        if (!planFeatures.canGenerateImages) {
          return {
            isValid: false,
            error: 'Image generation not available in your plan',
            status: 403
          };
        }
        break;

      case 'tweet_generation':
        if (typeof planFeatures.maxPostsPerDay === 'number' && quantity > planFeatures.maxPostsPerDay) {
          return {
            isValid: false,
            error: 'Daily post limit exceeded for your plan',
            status: 403,
            limit: planFeatures.maxPostsPerDay
          };
        }
        break;

      case 'thread_generation':
        if (typeof planFeatures.maxThreadsPerDay === 'number' && quantity > planFeatures.maxThreadsPerDay) {
          return {
            isValid: false,
            error: 'Daily thread limit exceeded for your plan',
            status: 403,
            limit: planFeatures.maxThreadsPerDay
          };
        }
        break;
    }

    return {
      isValid: true,
      requiredCredits
    };
  } catch (error) {
    console.error('Error validating credits:', error);
    return {
      isValid: false,
      error: 'Error validating credits',
      status: 500
    };
  }
}

/**
 * Route Handler Middleware
 */
export function withCreditValidation(handler: Function, action: CreditAction) {
  return async function(req: NextRequest, ...args: any[]) {
    try {
      // Clone the request to read the body
      const clone = req.clone();
      const body = await clone.json();
      const quantity = body.quantity || 1;

      // Validate credits
      const validation = await validateCredits(req, action, quantity);
      
      if (!validation.isValid) {
        return NextResponse.json(
          { error: validation.error },
          { status: validation.status }
        );
      }

      // Add validation result to request for use in handler
      (req as any).creditValidation = validation;

      // Call the original handler
      return handler(req, ...args);
    } catch (error) {
      console.error('Error in credit validation middleware:', error);
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }
  };
} 