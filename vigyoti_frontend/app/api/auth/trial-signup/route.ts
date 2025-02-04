import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/lib/firebase/schema';
import { PLAN_FEATURES } from '@/types/subscription';
import { handleAuthError } from '@/lib/auth/errors';

const db = getFirestore();

export async function POST(req: Request) {
  try {
    console.log('Starting trial signup process...');
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || !session?.user?.email) {
      console.log('No valid session found');
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log('Session found:', { userId: session.user.id, email: session.user.email });

    // Check if user already exists
    const userRef = db.collection(COLLECTIONS.USERS).doc(session.user.id);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      console.log('User already exists:', session.user.id);
      return new NextResponse(
        JSON.stringify({ error: 'User already exists' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log('Creating new user document...');
    const now = Timestamp.now();
    const thirtyDaysFromNow = new Timestamp(
      Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      0
    );

    // Create user document with free trial plan
    const userData = {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name || session.user.email.split('@')[0],
      plan: 'free',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: thirtyDaysFromNow,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
      workspaceCount: 0,
      teamMemberCount: 0,
      credits: PLAN_FEATURES.free.aiCreditsPerMonth,
      trialEndDate: thirtyDaysFromNow,
    };

    try {
      await userRef.set(userData);
      console.log('User document created successfully');

      // Initialize credits document
      const creditsRef = db.collection(COLLECTIONS.CREDITS).doc(session.user.id);
      await creditsRef.set({
        userId: session.user.id,
        available: PLAN_FEATURES.free.aiCreditsPerMonth,
        total: PLAN_FEATURES.free.aiCreditsPerMonth,
        used: 0,
        lastRefillDate: now,
        nextRefillDate: thirtyDaysFromNow,
        canPurchaseCredits: PLAN_FEATURES.free.canBuyCredits,
        createdAt: now,
        updatedAt: now,
      });
      console.log('Credits document created successfully');

      return new NextResponse(
        JSON.stringify({
          success: true,
          message: 'Free trial started successfully',
          user: userData,
        }),
        { 
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      // Try to rollback if possible
      try {
        await userRef.delete();
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error in trial signup:', error);
    const authError = handleAuthError(error);
    
    return new NextResponse(
      JSON.stringify({ 
        error: authError.message,
        code: authError.code,
      }),
      { 
        status: authError.statusCode,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
} 