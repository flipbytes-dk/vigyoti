import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user document to get credits information
    const userRef = doc(db, 'users', session.user.id);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const credits = userData.credits || {
      available: 0,
      used: 0,
      total: 0,
      lastRefill: null,
      nextRefill: null
    };

    return NextResponse.json({
      available: credits.available,
      used: credits.used,
      total: credits.total,
      resetDate: credits.nextRefill?.toDate(),
      usageBreakdown: userData.usage || {
        postsThisMonth: 0,
        creditsThisMonth: 0,
        storageUsed: 0
      }
    });
  } catch (error) {
    console.error('Error getting user credits:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
} 