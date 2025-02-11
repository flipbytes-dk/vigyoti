import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getFirebaseToken } from '@/lib/firebase/auth';
import { CreditService } from '@/lib/services/credit-service';
import { PLAN_FEATURES, PlanType, PlanFeatures, CREDIT_COSTS } from '@/types/subscription';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';

export type CreditAction = 'tweet_generation' | 'image_generation' | 'storage';

/**
 * Middleware to validate credit availability before actions
 */
export async function validateCredits(
  req: NextRequest,
  action: CreditAction,
  quantity: number = 1
) {
  try {
    // Get the user's session and plan
    const token = await getToken({ req });
    if (!token) {
      return {
        isValid: false,
        error: 'Unauthorized',
        status: 401
      };
    }

    // Get the user's plan features
    const planType = token.plan as PlanType;
    const planFeatures = PLAN_FEATURES[planType];

    // Calculate credit cost
    let creditCost = 0;
    switch (action) {
      case 'tweet_generation':
        creditCost = CREDIT_COSTS.generateTweet * quantity;
        break;
      case 'image_generation':
        creditCost = CREDIT_COSTS.generateImage * quantity;
        break;
      case 'storage':
        creditCost = CREDIT_COSTS.storagePerGB * quantity;
        break;
    }

    // Check if user has enough credits
    const userCredits = await CreditService.useCredits(token.sub, creditCost);
    if (!userCredits || userCredits.available < creditCost) {
      return {
        isValid: false,
        error: 'Insufficient credits',
        status: 403,
        available: userCredits?.available || 0,
        required: creditCost
      };
    }

    // Check plan-specific limits
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
      
      case 'image_generation':
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
    }

    return {
      isValid: true,
      creditCost
    };

  } catch (error) {
    console.error('Error validating credits:', error);
    return {
      isValid: false,
      error: 'Failed to validate credits',
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