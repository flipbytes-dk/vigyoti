import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { adminAuth } from '../../../../lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ status: 'unauthenticated' });
    }

    // Get Firebase user by email
    const firebaseUser = await adminAuth.getUserByEmail(session.user.email);
    const userId = firebaseUser.uid;

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ status: 'unsubscribed' });
    }

    const userData = userDoc.data();
    const subscription = userData?.subscription;

    if (!subscription) {
      return NextResponse.json({ status: 'unsubscribed' });
    }

    // Check if subscription is active
    if (subscription.status === 'active') {
      return NextResponse.json({ 
        status: 'active',
        plan: subscription.plan,
        credits: userData?.credits
      });
    }

    return NextResponse.json({ status: 'unsubscribed' });
  } catch (error) {
    console.error('Error in user status check:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
} 