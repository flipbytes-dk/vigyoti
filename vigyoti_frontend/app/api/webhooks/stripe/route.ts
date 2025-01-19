import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { SubscriptionService } from '@/lib/subscription-service';
import { adminAuth } from '@/lib/firebase-admin';
import Stripe from 'stripe';
import { SubscriptionStatus } from '@/types/subscription';

const getPlanFromPriceId = (priceId: string): 'solo' | 'team' | 'enterprise' => {
  const priceMap: Record<string, 'solo' | 'team' | 'enterprise'> = {
    [process.env.STRIPE_SOLO_MONTHLY_PRICE_ID!]: 'solo',
    [process.env.STRIPE_SOLO_YEARLY_PRICE_ID!]: 'solo',
    [process.env.STRIPE_TEAM_MONTHLY_PRICE_ID!]: 'team',
    [process.env.STRIPE_TEAM_YEARLY_PRICE_ID!]: 'team',
    [process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID!]: 'enterprise',
    [process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID!]: 'enterprise',
  };
  return priceMap[priceId] || 'solo';
};

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('Stripe-Signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error('Error verifying webhook signature:', error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          
          const userId = session.metadata?.userId;
          const userEmail = session.metadata?.userEmail;

          if (!userId || !userEmail) {
            return new NextResponse('No user ID or email in session metadata', { status: 400 });
          }

          await SubscriptionService.createOrUpdateSubscription({
            userId,
            email: userEmail,
            name: 'Unknown',
            customerId: session.customer as string,
            subscriptionId: session.subscription as string,
            plan: getPlanFromPriceId(subscription.items.data[0].price.id),
            status: subscription.status as SubscriptionStatus,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if (!('email' in customer)) {
          throw new Error('No email found for customer');
        }

        const userRecord = await adminAuth.getUserByEmail(customer.email!);
        const priceId = subscription.items.data[0].price.id;
        const plan = getPlanFromPriceId(priceId);
        
        await SubscriptionService.createOrUpdateSubscription({
          userId: userRecord.uid,
          email: userRecord.email!,
          name: userRecord.displayName || 'Unknown',
          customerId: subscription.customer as string,
          subscriptionId: subscription.id,
          plan,
          status: subscription.status as any,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if (!('email' in customer)) {
          throw new Error('No email found for customer');
        }

        const userRecord = await adminAuth.getUserByEmail(customer.email!);
        
        await SubscriptionService.createOrUpdateSubscription({
          userId: userRecord.uid,
          email: userRecord.email!,
          name: userRecord.displayName || 'Unknown',
          customerId: subscription.customer as string,
          subscriptionId: subscription.id,
          plan: 'solo',
          status: 'canceled',
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: true,
        });
        break;
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }
} 