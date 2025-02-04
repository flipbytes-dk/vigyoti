import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { adminAuth } from '@/lib/firebase-admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { PLAN_FEATURES } from '@/types/subscription';

const db = getFirestore();

// Helper function to get plan from price ID
const getPlanFromPriceId = (priceId: string): 'solo' | 'team' | 'enterprise' => {
  const priceMap: Record<string, 'solo' | 'team' | 'enterprise'> = {
    [process.env.NEXT_PUBLIC_STRIPE_SOLO_MONTHLY_PRICE_ID!]: 'solo',
    [process.env.NEXT_PUBLIC_STRIPE_SOLO_YEARLY_PRICE_ID!]: 'solo',
    [process.env.NEXT_PUBLIC_STRIPE_TEAM_MONTHLY_PRICE_ID!]: 'team',
    [process.env.NEXT_PUBLIC_STRIPE_TEAM_YEARLY_PRICE_ID!]: 'team',
    [process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_MONTHLY_PRICE_ID!]: 'enterprise',
    [process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_YEARLY_PRICE_ID!]: 'enterprise',
  };
  return priceMap[priceId] || 'solo';
};

export async function POST(req: Request) {
  try {
    console.log('🔍 Creating checkout session...');
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log('❌ No session or email found');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    console.log('✅ Session found:', { email: session.user.email });

    // Get Firebase user ID from email
    console.log('🔍 Getting Firebase user...');
    const firebaseUser = await adminAuth.getUserByEmail(session.user.email);
    const userId = firebaseUser.uid;
    console.log('✅ Firebase user found:', { userId });

    const body = await req.json();
    const { priceId } = body;
    console.log('📦 Request body:', { priceId });

    if (!priceId) {
      console.log('❌ No priceId provided');
      return new NextResponse('Price ID is required', { status: 400 });
    }

    // Get plan type from price ID
    const planType = getPlanFromPriceId(priceId);
    console.log('📋 Plan type:', { planType });

    // Get or create Stripe customer using Admin SDK
    console.log('🔍 Getting Firebase user data...');
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    const userData = userDoc.exists ? userDoc.data() : null;
    let customerId = userData?.stripeCustomerId;
    console.log('✅ User data:', { customerId, userData });

    if (!customerId) {
      console.log('➕ Creating Stripe customer...');
      const customer = await stripe.customers.create({
        email: session.user.email,
        metadata: {
          userId: userId,
          plan: planType,
        },
      });
      customerId = customer.id;
      console.log('✅ Stripe customer created:', { customerId });

      // Update user with Stripe customer ID using Admin SDK
      console.log('📝 Updating user with Stripe customer ID...');
      await userRef.update({
        stripeCustomerId: customerId,
        updatedAt: Timestamp.now(),
      });
      console.log('✅ User updated with Stripe customer ID');
    }

    console.log('🛍️ Creating Stripe checkout session...');
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId,
        userEmail: session.user.email,
        plan: planType,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    });
    console.log('✅ Checkout session created:', { sessionId: checkoutSession.id });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('🚨 Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
} 