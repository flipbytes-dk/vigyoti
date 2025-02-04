import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { PlanType, PLAN_FEATURES } from '@/types/subscription';
import { auth } from 'firebase-admin';
import { adminDb } from '@/lib/firebase/admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

export async function POST(req: NextRequest) {
  try {
    // Get session and validate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log('No session or user ID found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await req.json();
    const plan = body.plan as PlanType;
    
    if (!plan || !PLAN_FEATURES[plan]) {
      console.log('Invalid plan provided:', plan);
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    console.log('Processing plan change for user:', session.user.id, 'to plan:', plan);

    // Get references
    const userRef = db.collection('users').doc(session.user.id);
    
    // Verify user exists
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      console.log('User document not found:', session.user.id);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = Timestamp.now();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    const nextMonthTimestamp = Timestamp.fromDate(nextMonth);

    try {
      // Calculate new credits based on plan
      const totalCredits = PLAN_FEATURES[plan].aiCreditsPerMonth;

      // Update user document with both subscription and credits
      await userRef.set({
        subscription: {
          plan,
          status: 'active',
          startDate: now,
          endDate: nextMonthTimestamp,
          updatedAt: now,
        },
        credits: {
          total: totalCredits,
          used: 0,
          lastRefillDate: now
        }
      }, { merge: true });

      // Then update credits collection
      const creditsRef = db.collection('credits').doc(session.user.id);
      const creditsDoc = await creditsRef.get();

      if (!creditsDoc.exists) {
        console.log('Creating new credits document');
        await creditsRef.set({
          userId: session.user.id,
          available: totalCredits,
          total: totalCredits,
          used: 0,
          lastRefillDate: now,
          nextRefillDate: nextMonthTimestamp,
          canPurchaseCredits: PLAN_FEATURES[plan].canBuyCredits,
          createdAt: now,
          updatedAt: now,
          usageBreakdown: {
            tweets: 0,
            threads: 0,
            videos: 0,
            images: 0,
            rewrites: 0,
            storage: 0,
          }
        });
      } else {
        console.log('Updating existing credits document');
        await creditsRef.set({
          available: totalCredits,
          total: totalCredits,
          used: 0,
          lastRefillDate: now,
          nextRefillDate: nextMonthTimestamp,
          canPurchaseCredits: PLAN_FEATURES[plan].canBuyCredits,
          updatedAt: now,
        }, { merge: true });
      }

      console.log('Successfully updated subscription and credits');
      return NextResponse.json({ 
        success: true,
        message: `Successfully changed plan to ${plan} with ${totalCredits} credits`
      });
    } catch (updateError) {
      console.error('Update failed:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update subscription',
        details: updateError instanceof Error ? updateError.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    // Safely handle the error object
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in subscription API:', { error: errorMessage });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage 
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRef = db.collection('users').doc(session.user.id);
    await userRef.set({
      subscription: {
        status: 'canceled',
        updatedAt: Timestamp.now(),
      }
    }, { merge: true });

    return NextResponse.json({ message: 'Subscription canceled' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error canceling subscription:', { error: errorMessage });
    return NextResponse.json({ 
      error: 'Error canceling subscription',
      details: errorMessage 
    }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRef = db.collection('users').doc(session.user.id);
    await userRef.set({
      subscription: {
        status: 'active',
        updatedAt: Timestamp.now(),
      }
    }, { merge: true });

    return NextResponse.json({ message: 'Subscription reactivated' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error reactivating subscription:', { error: errorMessage });
    return NextResponse.json({ 
      error: 'Error reactivating subscription',
      details: errorMessage 
    }, { status: 500 });
  }
} 