import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '../../../../lib/stripe';
import { FirebaseService } from '../../../../services/firebase';
import { Timestamp } from 'firebase/firestore';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = headers().get('stripe-signature')!;

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new NextResponse('Webhook Error', { status: 400 });
    }

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

        // Update user subscription and customer ID in Firestore
        await FirebaseService.updateUser(userId, {
          stripeCustomerId: customerId,
          subscription: {
            plan: plan as 'free' | 'pro' | 'enterprise',
            status: 'active',
            startDate: Timestamp.fromMillis(subscription.current_period_start * 1000),
            endDate: Timestamp.fromMillis(subscription.current_period_end * 1000),
          },
        });

        console.log('Updated user subscription:', {
          userId,
          customerId,
          plan,
          status: 'active',
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
              plan: updatedPlan as 'free' | 'pro' | 'enterprise',
              status: updatedSubscription.status === 'active' ? 'active' : 'expired',
              startDate: Timestamp.fromMillis(updatedSubscription.current_period_start * 1000),
              endDate: Timestamp.fromMillis(updatedSubscription.current_period_end * 1000),
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
              status: 'cancelled',
              startDate: Timestamp.now(),
              endDate: Timestamp.fromMillis(deletedSubscription.current_period_end * 1000),
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