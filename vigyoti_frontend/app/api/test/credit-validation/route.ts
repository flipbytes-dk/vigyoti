import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { withCreditValidation } from '@/middleware/creditValidation';

async function handler(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // The creditValidation result is attached to the request by the middleware
    const validation = (req as any).creditValidation;
    const body = await req.json();

    return NextResponse.json({
      message: 'Credit validation passed',
      requiredCredits: validation.requiredCredits,
      action: body.action,
      quantity: body.quantity || 1,
      userId: token.sub
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Invalid request body',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 400 
    });
  }
}

// Create handlers for different actions
export const POST = withCreditValidation(handler, 'tweet_generation');
export const PUT = withCreditValidation(handler, 'thread_generation');
export const PATCH = withCreditValidation(handler, 'ai_video');
export const DELETE = withCreditValidation(handler, 'ai_image'); 