import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { CreditService } from '@/lib/services/credit-service';
import { CreditUsageDoc, COLLECTIONS, UserCreditsDoc } from '@/lib/firebase/schema';
import { getFirestore, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { PLAN_FEATURES, PlanType } from '@/types/subscription';

const db = getFirestore();

// Update the CreditUsageDoc type to include refund action
type CreditAction = 'tweet_generation' | 'thread_generation' | 'ai_video' | 'ai_image' | 'tweet_rewrite' | 'storage' | 'refund';

interface CreditUsageDetails {
  count?: number;
  size?: number;
  modelUsed?: string;
  success: boolean;
  refundReason?: string;
  originalTransactionId?: string;
  reason?: string;
}

async function initializeUserCredits(userId: string, plan: PlanType): Promise<void> {
  console.log('Initializing user credits on server:', { userId, plan });
  const creditsRef = db.collection(COLLECTIONS.CREDITS).doc(userId);
  const creditsDoc = await creditsRef.get();

  if (!creditsDoc.exists) {
    console.log('Creating new credits document on server');
    const totalCredits = PLAN_FEATURES[plan].aiCreditsPerMonth;
    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);

    const newCredits: UserCreditsDoc = {
      userId,
      available: totalCredits,
      total: totalCredits,
      used: 0,
      lastRefillDate: AdminTimestamp.fromDate(now),
      nextRefillDate: AdminTimestamp.fromDate(nextMonth),
      canPurchaseCredits: PLAN_FEATURES[plan].canBuyCredits,
      createdAt: AdminTimestamp.fromDate(now),
      updatedAt: AdminTimestamp.fromDate(now),
    };

    await creditsRef.set(newCredits);
    console.log('Successfully created credits document on server');
  }
}

async function getUserPlan(userId: string): Promise<PlanType> {
  console.log('Getting user plan for userId:', userId);
  console.log('Using collection:', COLLECTIONS.USERS);
  
  const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
  console.log('User document exists?', userDoc.exists);
  
  if (!userDoc.exists) {
    console.log('User document not found in Firestore');
    throw new Error('User not found');
  }
  
  const userData = userDoc.data();
  console.log('User data:', userData);
  
  if (!userData) {
    throw new Error('User data is empty');
  }
  
  // Access the plan from the nested subscription object
  const plan = (userData.subscription?.plan || 'free') as PlanType;
  console.log('Determined user plan:', plan);
  return plan;
}

async function useCredits(
  userId: string,
  amount: number,
  action: CreditUsageDoc['action'],
  details: CreditUsageDoc['details']
): Promise<boolean> {
  try {
    const creditsRef = db.collection(COLLECTIONS.CREDITS).doc(userId);
    const usageRef = db.collection(COLLECTIONS.CREDIT_USAGE).doc();
    const now = new Date();

    // Run as a transaction
    await db.runTransaction(async (transaction) => {
      const creditsDoc = await transaction.get(creditsRef);
      if (!creditsDoc.exists) {
        throw new Error('No credits document found');
      }

      const credits = creditsDoc.data() as UserCreditsDoc;
      if (credits.available < amount) {
        throw new Error('Insufficient credits');
      }

      // Update credits
      transaction.update(creditsRef, {
        available: credits.available - amount,
        used: credits.used + amount,
        updatedAt: AdminTimestamp.fromDate(now),
      });

      // Record usage
      const usage: CreditUsageDoc = {
        id: usageRef.id,
        userId,
        amount,
        action,
        details,
        timestamp: AdminTimestamp.fromDate(now),
      };
      transaction.set(usageRef, usage);
    });

    return true;
  } catch (error) {
    console.error('Error using credits:', error);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('Session:', session);
    
    if (!session?.user?.id) {
      console.log('No user ID in session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Processing request for user:', session.user.id);
    
    const body = await req.json();
    console.log('Request body:', body);
    
    const { action, amount, details } = body;

    // Validate required fields
    if (!action || !amount || !details) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate action type
    const validActions: CreditUsageDoc['action'][] = [
      'tweet_generation',
      'thread_generation',
      'ai_video',
      'ai_image',
      'tweet_rewrite',
      'storage'
    ];
    
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action type' },
        { status: 400 }
      );
    }

    // Get user's current plan
    const userPlan = await getUserPlan(session.user.id);
    console.log('User plan:', userPlan, 'User ID:', session.user.id);

    // Initialize credits if they don't exist (using server-side function)
    await initializeUserCredits(session.user.id, userPlan);

    // Use credits (using server-side function)
    const success = await useCredits(
      session.user.id,
      amount,
      action,
      details
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to process credit transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing credit transaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get transaction history
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Processing request for user:', session.user.id);

    // Get user's current plan
    const userPlan = await getUserPlan(session.user.id);
    console.log('User plan:', userPlan, 'User ID:', session.user.id);

    // Initialize credits if they don't exist
    await initializeUserCredits(session.user.id, userPlan);

    // Get credit history using server-side query
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const usageRef = db.collection(COLLECTIONS.CREDIT_USAGE);
    const query = usageRef
      .where('userId', '==', session.user.id)
      .orderBy('timestamp', 'desc')
      .limit(limit);
    
    console.log('Executing credit history query...');
    let snapshot;
    try {
      snapshot = await query.get();
    } catch (queryError) {
      console.error('Error executing query:', queryError instanceof Error ? queryError.message : 'Unknown query error');
      
      // Check if the error is due to missing index
      if (queryError instanceof Error && queryError.message.includes('FAILED_PRECONDITION') && queryError.message.includes('index')) {
        return NextResponse.json({ 
          error: 'Credit history is being initialized. Please try again in a few minutes.',
          isIndexing: true,
          message: 'The system is creating necessary database indexes. This is a one-time operation that may take a few minutes.'
        }, { status: 503 });  // 503 Service Unavailable
      }
      
      return NextResponse.json({ error: 'Failed to retrieve credit history' }, { status: 500 });
    }
    
    if (snapshot.empty) {
      console.log('No credit history found');
      return NextResponse.json([]);
    }

    console.log('Processing', snapshot.docs.length, 'credit history records');
    const history = [];
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        console.log('Processing document ID:', doc.id);
        
        // Safely handle timestamp conversions
        let timestamp = null;
        let refundedAt = null;
        
        if (data.timestamp && typeof data.timestamp.toDate === 'function') {
          timestamp = data.timestamp.toDate().toISOString();
        }
        if (data.refundedAt && typeof data.refundedAt.toDate === 'function') {
          refundedAt = data.refundedAt.toDate().toISOString();
        }
        
        history.push({
          ...data,
          id: doc.id,
          timestamp,
          refundedAt,
        });
      } catch (docError) {
        console.error('Error processing document:', doc.id, docError instanceof Error ? docError.message : 'Unknown document error');
        // Continue processing other documents
        continue;
      }
    }

    console.log('Successfully processed credit history, found', history.length, 'records');
    return NextResponse.json(history);
  } catch (error) {
    // Simplified error logging
    console.error('Error in credit history:', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json({
      error: 'Failed to retrieve credit history',
      timestamp: new Date().toISOString(),
    }, { 
      status: 500 
    });
  }
}

// Refund credits
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { transactionId, amount, reason } = body;

    if (!transactionId || !amount || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: transactionId, amount, and reason are required' },
        { status: 400 }
      );
    }

    // Get the original transaction
    const transactionRef = db.collection(COLLECTIONS.CREDIT_USAGE).doc(transactionId);
    const transactionDoc = await transactionRef.get();

    if (!transactionDoc.exists) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const transaction = transactionDoc.data() as CreditUsageDoc;

    // Verify the transaction belongs to the user
    if (transaction.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to refund this transaction' },
        { status: 403 }
      );
    }

    // Verify refund amount doesn't exceed original transaction amount
    if (amount > transaction.amount) {
      return NextResponse.json(
        { error: 'Refund amount cannot exceed original transaction amount' },
        { status: 400 }
      );
    }

    const creditsRef = db.collection(COLLECTIONS.CREDITS).doc(session.user.id);
    const refundRef = db.collection(COLLECTIONS.CREDIT_USAGE).doc();
    const now = AdminTimestamp.fromDate(new Date());

    // Run as a transaction
    await db.runTransaction(async (t) => {
      const creditsDoc = await t.get(creditsRef);
      if (!creditsDoc.exists) {
        throw new Error('No credits document found');
      }

      const credits = creditsDoc.data() as UserCreditsDoc;

      // Update credits
      t.update(creditsRef, {
        available: credits.available + amount,
        used: credits.used - amount,
        updatedAt: now,
      });

      // Record refund
      const refund: CreditUsageDoc = {
        id: refundRef.id,
        userId: session.user.id,
        amount: -amount, // Negative amount to indicate refund
        action: 'refund' as CreditAction,
        details: {
          originalTransactionId: transactionId,
          refundReason: reason,
          success: true
        },
        timestamp: now,
      };
      t.set(refundRef, refund);

      // Update original transaction to mark as refunded
      t.update(transactionRef, {
        refunded: true,
        refundedAt: now,
        refundAmount: amount,
        refundReason: reason,
      });
    });

    return NextResponse.json({ 
      success: true,
      message: 'Credits refunded successfully'
    });
  } catch (error) {
    console.error('Error processing credit refund:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 