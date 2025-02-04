import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { FirebaseService } from '@/services/firebase';
import { Timestamp } from 'firebase/firestore';
import { PlanType, SubscriptionStatus } from '@/types/subscription';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  try {
    const payload = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      throw new Error('No stripe signature found');
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    const session = event.data.object as any;

    switch (event.type) {
      case 'customer.created':
        // Log the customer creation
        console.log('Customer created:', session.id);
        break;

      case 'checkout.session.completed':
        const userId = session.metadata.userId;
        const subscriptionId = session.subscription;
        const customerId = session.customer;

        // Get subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const plan = subscription.items.data[0].price.nickname?.toLowerCase() || 'free';
        const priceId = subscription.items.data[0].price.id;

        // Update user subscription and customer ID in Firestore
        await FirebaseService.updateUser(userId, {
          stripeCustomerId: customerId,
          subscription: {
            plan: plan as PlanType,
            status: subscription.status === 'active' ? 'active' : 'trial',
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            currentPeriodStart: Timestamp.fromMillis(subscription.current_period_start * 1000),
            currentPeriodEnd: Timestamp.fromMillis(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            updatedAt: Timestamp.now()
          },
        });

        console.log('Updated user subscription:', {
          userId,
          customerId,
          plan,
          status: subscription.status,
        });
        break;

      case 'customer.subscription.updated':
        const updatedSubscription = session as any;
        const customer = await stripe.customers.retrieve(updatedSubscription.customer);
        const userData = await FirebaseService.getUserByStripeCustomerId(updatedSubscription.customer);

        if (userData) {
          const updatedPlan = updatedSubscription.items.data[0].price.nickname?.toLowerCase() || 'free';
          await FirebaseService.updateUser(userData.id, {
            subscription: {
              plan: updatedPlan as PlanType,
              status: updatedSubscription.status === 'active' ? 'active' : 'past_due',
              stripeSubscriptionId: updatedSubscription.id,
              stripePriceId: updatedSubscription.items.data[0].price.id,
              currentPeriodStart: Timestamp.fromMillis(updatedSubscription.current_period_start * 1000),
              currentPeriodEnd: Timestamp.fromMillis(updatedSubscription.current_period_end * 1000),
              cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
              updatedAt: Timestamp.now()
            },
          });

          console.log('Updated subscription:', {
            userId: userData.id,
            plan: updatedPlan,
            status: updatedSubscription.status,
          });
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = session as any;
        const deletedCustomer = await stripe.customers.retrieve(deletedSubscription.customer);
        const deletedUserData = await FirebaseService.getUserByStripeCustomerId(deletedSubscription.customer);

        if (deletedUserData) {
          await FirebaseService.updateUser(deletedUserData.id, {
            subscription: {
              plan: 'free',
              status: 'canceled',
              stripeSubscriptionId: deletedSubscription.id,
              stripePriceId: deletedSubscription.items.data[0].price.id,
              currentPeriodStart: Timestamp.now(),
              currentPeriodEnd: Timestamp.fromMillis(deletedSubscription.current_period_end * 1000),
              cancelAtPeriodEnd: deletedSubscription.cancel_at_period_end,
              updatedAt: Timestamp.now()
            },
          });

          console.log('Cancelled subscription:', {
            userId: deletedUserData.id,
            status: 'cancelled',
          });
        }
        break;
    }

    return new NextResponse('Webhook received', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new NextResponse('Webhook Error', { status: 400 });
  }
} 