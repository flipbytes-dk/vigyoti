export type SubscriptionPlan = 'solo' | 'team' | 'enterprise';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid';

export interface UserSubscription {
  userId: string;
  email: string;
  name: string;
  customerId: string;
  subscriptionId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
}

export interface UserCredits {
  userId: string;
  totalCredits: number;
  usedCredits: number;
  lastRefillDate: number;
}

export interface CreditUsage {
  userId: string;
  amount: number;
  action: 'tweet_generation' | 'thread_generation' | 'ai_video' | 'ai_image' | 'tweet_rewrite' | 'storage';
  timestamp: number;
  metadata?: Record<string, any>;
}

// Credit costs for different actions
export const CREDIT_COSTS = {
  tweet_generation: 10, // 10 tweets
  thread_generation: 10, // 10 tweets
  ai_video: 20,
  ai_image: 2,
  tweet_rewrite: 1,
  storage_1gb: 2,
  storage_2gb: 4,
} as const;

// Monthly credit allocations by plan
export const PLAN_CREDITS = {
  solo: 100,
  team: 500,
  enterprise: 2000,
} as const; 