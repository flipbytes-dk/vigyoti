import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { adminAuth } from '../lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

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

    // Get Firebase user by email
    console.log('🔍 Getting Firebase user...');
    const firebaseUser = await adminAuth.getUserByEmail(session.user.email);
    const userId = firebaseUser.uid;
    console.log('✅ Firebase user found:', { userId });

    // Get user data from Firestore
    console.log('🔍 Getting user data from Firestore...');
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('❌ No user document found, redirecting to pricing');
      redirect('/pricing');
    }

    const userData = userDoc.data();
    console.log('✅ User data retrieved:', { subscription: userData?.subscription });

    // Check subscription status
    const subscription = userData?.subscription;
    const isSubscriptionActive = subscription?.status === 'active';
    const hasValidPlan = ['solo', 'team', 'enterprise'].includes(subscription?.plan);

    console.log('📊 Subscription status:', { 
      isActive: isSubscriptionActive, 
      plan: subscription?.plan,
      hasValidPlan
    });

    if (!subscription || !isSubscriptionActive || !hasValidPlan) {
      console.log('❌ No active subscription found, redirecting to pricing');
      redirect('/pricing');
    }

    // User has an active subscription, redirect to dashboard
    console.log('✅ Active subscription found, redirecting to dashboard');
    redirect('/dashboard');
  } catch (error: any) {
    // Check if this is a Next.js redirect error
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error; // Re-throw redirect "errors" to let Next.js handle them
    }
    
    // Log and handle actual errors
    console.error('🚨 Error in home page:', error);
    redirect('/pricing');
  }

  // This return is never reached due to redirects, but needed for TypeScript
  return null;
}
