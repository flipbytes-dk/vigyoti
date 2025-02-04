import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { adminAuth } from '../lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/lib/firebase/schema';

const db = getFirestore();

export default async function Home() {
  try {
    console.log('🔍 Checking authentication status...');
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      console.log('❌ No authenticated session found, redirecting to signin');
      redirect('/auth/signin');
    }

    console.log('✅ User authenticated:', { email: session.user.email });

    try {
      // Get Firebase user by email
      console.log('🔍 Getting Firebase user...');
      const firebaseUser = await adminAuth.getUserByEmail(session.user.email);
      const userId = firebaseUser.uid;
      console.log('✅ Firebase user found:', { userId });

      // Get user data from Firestore
      console.log('🔍 Getting user data from Firestore...');
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
      
      if (!userDoc.exists) {
        console.log('❌ No user document found, redirecting to pricing');
        redirect('/pricing');
      }

      const userData = userDoc.data();
      console.log('✅ User data retrieved:', userData);

      // Check if user has Stripe customer ID
      if (!userData?.stripeCustomerId) {
        console.log('❌ No Stripe customer ID found, redirecting to pricing');
        redirect('/pricing');
      }

      // Check subscription status
      const subscription = userData?.subscription;
      const isSubscriptionActive = subscription?.status === 'active';
      const hasValidPlan = ['solo', 'team'].includes(subscription?.plan);
      const hasValidSubscriptionDates = subscription?.startDate && subscription?.endDate && 
        subscription.endDate.toMillis() > Date.now();

      console.log('📊 Subscription status:', { 
        isActive: isSubscriptionActive, 
        plan: subscription?.plan,
        hasValidPlan,
        hasValidSubscriptionDates,
        endDate: subscription?.endDate?.toDate()
      });

      // Check subscription record
      const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
      const hasSubscriptionRecord = subscriptionDoc.exists;
      
      console.log('📄 Subscription record:', {
        exists: hasSubscriptionRecord,
        data: subscriptionDoc.exists ? subscriptionDoc.data() : null
      });

      // Check credits
      const creditsDoc = await db.collection('credits').doc(userId).get();
      const creditsData = creditsDoc.exists ? creditsDoc.data() : null;
      const hasValidCredits = creditsData && 
        creditsData.available > 0 && 
        creditsData.nextRefillDate && 
        creditsData.nextRefillDate.toMillis() > Date.now();

      console.log('💳 Credits status:', { 
        exists: creditsDoc.exists,
        credits: creditsData?.available || 0,
        nextRefill: creditsData?.nextRefillDate?.toDate(),
        hasValidCredits
      });

      // Validate all required conditions
      if (!subscription || 
          !isSubscriptionActive || 
          !hasValidPlan || 
          !hasValidSubscriptionDates || 
          !hasSubscriptionRecord || 
          !hasValidCredits) {
        console.log('❌ Invalid subscription state, redirecting to pricing');
        redirect('/pricing');
      }

      // If everything is valid, redirect to dashboard
      console.log('✅ User has valid subscription and credits, redirecting to dashboard');
      redirect('/dashboard');
    } catch (error: any) {
      console.error('🚨 Error in home page:', error);
      if (error.code === 'auth/user-not-found') {
        console.log('❌ Firebase user not found, redirecting to signin');
        redirect('/auth/signin');
      }
      throw error;
    }
  } catch (error) {
    console.error('🚨 Unhandled error:', error);
    redirect('/auth/error');
  }
}
