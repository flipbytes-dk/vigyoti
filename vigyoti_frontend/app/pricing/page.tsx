'use client';

import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Plan {
  name: string;
  price: {
    monthly: string;
    yearly: string;
  };
  priceIds?: {
    monthly?: string;
    yearly?: string;
  };
  features: string[];
}

const plans: Plan[] = [
  {
    name: 'Free Trial',
    price: {
      monthly: '$0',
      yearly: '$0',
    },
    features: [
      'One workspace',
      'Up to 10 posts per month',
      '25 credits per month',
      'Basic scheduling',
      'Image and video support',
    ],
  },
  {
    name: 'Solo',
    price: {
      monthly: '$29',
      yearly: '$290',
    },
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_SOLO_MONTHLY_PRICE_ID,
      yearly: process.env.NEXT_PUBLIC_STRIPE_SOLO_YEARLY_PRICE_ID,
    },
    features: [
      'One workspace',
      'One project',
      '100 credits per month',
      'Basic analytics',
      'Profile assessment',
    ],
  },
  {
    name: 'Team',
    price: {
      monthly: '$79',
      yearly: '$790',
    },
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_TEAM_MONTHLY_PRICE_ID,
      yearly: process.env.NEXT_PUBLIC_STRIPE_TEAM_YEARLY_PRICE_ID,
    },
    features: [
      '5 workspaces',
      '3 projects per workspace',
      '500 credits per month',
      'Advanced analytics',
      'Profile assessment',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: {
      monthly: '$199',
      yearly: '$1990',
    },
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
      yearly: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
    },
    features: [
      'Unlimited workspaces',
      'Unlimited projects',
      '2000 credits per month',
      'Enterprise analytics',
      'Profile assessment',
      'Priority support',
      'Custom integrations',
    ],
  },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const router = useRouter();

  const handleSubscribe = async (priceId?: string) => {
    if (!session?.user) {
      signIn();
      return;
    }

    if (!priceId) {
      // Free trial signup
      try {
        const response = await fetch('/api/auth/trial-signup', {
          method: 'POST',
        });
        
        if (response.ok) {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error starting trial:', error);
      }
      return;
    }

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Simple, transparent pricing
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          Choose the plan that best fits your needs
        </p>
      </div>

      <div className="mt-8 flex justify-center">
        <div className="relative">
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`${
                billingInterval === 'monthly'
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-gray-50'
              } relative w-32 rounded-md py-2 text-sm font-medium text-gray-700`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`${
                billingInterval === 'yearly'
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-gray-50'
              } relative ml-2 w-32 rounded-md py-2 text-sm font-medium text-gray-700`}
            >
              Yearly (10% off)
            </button>
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm"
          >
            <h3 className="text-2xl font-semibold text-gray-900">{plan.name}</h3>
            <p className="mt-4 text-sm text-gray-500">
              Perfect for {plan.name.toLowerCase()} users and small teams
            </p>
            <p className="mt-8">
              <span className="text-4xl font-bold tracking-tight text-gray-900">
                {billingInterval === 'monthly'
                  ? plan.price.monthly
                  : plan.price.yearly}
              </span>
              <span className="text-base font-medium text-gray-500">
                /{billingInterval}
              </span>
            </p>
            <Button
              className="mt-8 w-full"
              onClick={() =>
                handleSubscribe(
                  billingInterval === 'monthly'
                    ? plan.priceIds?.monthly
                    : plan.priceIds?.yearly
                )
              }
            >
              Get started
            </Button>
            <ul className="mt-8 space-y-4">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start">
                  <Check className="h-5 w-5 flex-shrink-0 text-green-500" />
                  <span className="ml-3 text-sm text-gray-500">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
} 