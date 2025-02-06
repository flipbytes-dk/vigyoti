import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { PlanType, SubscriptionStatus, PLAN_FEATURES } from '@/types/subscription';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '@/services/firebase';

const db = getFirestore();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const getPlanFromPriceId = (priceId: string): PlanType => {
  const priceMap: Record<string, PlanType> = {
    [process.env.STRIPE_SOLO_MONTHLY_PRICE_ID!]: 'solo',
    [process.env.STRIPE_SOLO_YEARLY_PRICE_ID!]: 'solo',
    [process.env.STRIPE_TEAM_MONTHLY_PRICE_ID!]: 'team',
    [process.env.STRIPE_TEAM_YEARLY_PRICE_ID!]: 'team',
  };
  return priceMap[priceId] || 'free';
};

// Handle subscription created or updated
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  console.log('🔄 Processing subscription change:', subscription.id);
  
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0].price.id;
  const status = subscription.status;
  
  console.log('📝 Subscription details:', { customerId, priceId, status });
  
  // Get user by stripeCustomerId
  const usersRef = db.collection('users');
  const userSnapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();
  
  if (userSnapshot.empty) {
    console.error('❌ No user found with Stripe customer ID:', customerId);
    return;
  }

  const userDoc = userSnapshot.docs[0];
  const userData = userDoc.data();
  const userId = userDoc.id;
  
  console.log('👤 Found user:', userId);

  // Map price ID to plan type
  const planMap: Record<string, PlanType> = {
    [process.env.STRIPE_SOLO_MONTHLY_PRICE_ID!]: 'solo',
    [process.env.STRIPE_SOLO_YEARLY_PRICE_ID!]: 'solo',
    [process.env.STRIPE_TEAM_MONTHLY_PRICE_ID!]: 'team',
    [process.env.STRIPE_TEAM_YEARLY_PRICE_ID!]: 'team',
    [process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID!]: 'agency',
    [process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID!]: 'agency'
  };

  const plan = planMap[priceId] || 'free';
  const now = Timestamp.now();

  console.log('📋 Mapped plan:', plan);

  try {
    // Initialize or update user subscription data
    const isNewSubscription = !userData.subscription;
    const subscriptionData = {
      subscription: {
        plan,
        status,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        currentPeriodStart: Timestamp.fromMillis(subscription.current_period_start * 1000),
        currentPeriodEnd: Timestamp.fromMillis(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: now
      },
      credits: {
        available: PLAN_FEATURES[plan].aiCreditsPerMonth,
        total: PLAN_FEATURES[plan].aiCreditsPerMonth,
        used: userData.credits?.used || 0,
        lastRefill: now,
        nextRefill: Timestamp.fromMillis(subscription.current_period_end * 1000),
      },
      usage: isNewSubscription ? {
        postsThisMonth: 0,
        creditsThisMonth: 0,
        storageUsed: 0
      } : userData.usage,
      updatedAt: now
    };

    await userDoc.ref.update(subscriptionData);
    console.log('✅ Updated user subscription:', subscriptionData);

    // Create default workspace if none exists
    const workspacesSnapshot = await db.collection('workspaces')
      .where('ownerId', '==', userId)
      .get();

    if (workspacesSnapshot.empty) {
      try {
        console.log('📁 Creating default workspace for user');
        const workspaceId = await FirebaseService.createWorkspace(
          userId, 
          'My Workspace',
          'Default workspace created with your subscription'
        );
        console.log('✅ Created default workspace:', workspaceId);

        // Create default project
        const projectId = await FirebaseService.createProject(
          userId,
          workspaceId,
          {
            name: 'My First Project',
            description: 'Get started with your first project'
          }
        );
        console.log('✅ Created default project:', projectId);
      } catch (error) {
        console.error('❌ Error creating default workspace/project:', error);
        // Don't throw error here, as we want the subscription to succeed even if workspace creation fails
      }
    }

    // Update credits document
    const creditsRef = db.collection('credits').doc(userId);
    await creditsRef.set({
      userId,
      available: PLAN_FEATURES[plan].aiCreditsPerMonth,
      total: PLAN_FEATURES[plan].aiCreditsPerMonth,
      used: userData.credits?.used || 0,
      lastRefillDate: now,
      nextRefillDate: Timestamp.fromMillis(subscription.current_period_end * 1000),
      canPurchaseCredits: PLAN_FEATURES[plan].canBuyCredits,
      updatedAt: now,
      usageBreakdown: userData.credits?.usageBreakdown || {
        tweets: 0,
        threads: 0,
        videos: 0,
        images: 0,
        rewrites: 0,
        storage: 0,
      }
    }, { merge: true });

    console.log('✅ Updated credits document');
  } catch (error) {
    console.error('❌ Error updating subscription data:', error);
    throw error;
  }
}

// Handle the webhook event
export async function POST(req: Request) {
  try {
    console.log('📥 Received webhook request');
    const payload = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('❌ No stripe signature found');
      return new Response('No signature', { status: 400 });
    }

    console.log('🔐 Verifying webhook signature');
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    console.log('📨 Processing webhook event:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        // Handle subscription deletion
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .get();
        
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          await userDoc.ref.update({
            'subscription.status': 'canceled',
            'subscription.updatedAt': Timestamp.now(),
          });
          console.log('✅ Updated subscription status to canceled');
        }
        break;
    }

    console.log('✅ Successfully processed webhook event');
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error handling webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook handler failed' }), 
      { status: 400 }
    );
  }
} 