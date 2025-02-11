import { Timestamp } from 'firebase/firestore';

export const PLAN_FEATURES = {
  free: {
    aiCreditsPerMonth: 100,
    maxPosts: 50,
    maxWorkspaces: 1,
    canBuyCredits: false,
  },
  solo: {
    aiCreditsPerMonth: 500,
    maxPosts: 200,
    maxWorkspaces: 2,
    canBuyCredits: true,
  },
  team: {
    aiCreditsPerMonth: 2000,
    maxPosts: 1000,
    maxWorkspaces: 5,
    canBuyCredits: true,
  },
  agency: {
    aiCreditsPerMonth: 5000,
    maxPosts: 5000,
    maxWorkspaces: 10,
    canBuyCredits: true,
  }
} as const;

export type PlanType = keyof typeof PLAN_FEATURES;
export type SubscriptionStatus = 'trial' | 'active' | 'canceled' | 'past_due';

export interface UserSubscription {
  userId: string;
  email: string;
  name: string;
  customerId?: string;
  subscriptionId?: string;
  plan: PlanType;
  status: SubscriptionStatus;
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: Timestamp;
  updatedAt: Timestamp;
  usageThisMonth?: {
    posts: number;
    credits: number;
    storage: number;
  };
}

export interface UserCredits {
  userId: string;
  available: number;
  used: number;
  total: number;
  lastRefillDate: number;
  nextRefillDate: number;
  usageBreakdown: {
    tweets: number;
    threads: number;
    videos: number;
    images: number;
    rewrites: number;
    storage: number;
  };
}

export interface PlanFeatures {
  maxWorkspaces: number | 'unlimited';
  maxTeamMembers: number | 'unlimited';
  postsPerMonth: number | 'unlimited';
  scheduling: boolean;
  addImages: boolean;
  addVideos: boolean;
  aiCreditsPerMonth: number;
  canBuyCredits: boolean;
  activityLogs: boolean;
  maxStorageGB: number | 'unlimited';
  canGenerateVideos: boolean;
  canGenerateImages: boolean;
  maxPostsPerDay: number | 'unlimited';
  maxThreadsPerDay: number | 'unlimited';
}

export interface SubscriptionPlan {
  id: string;
  name: PlanType;
  status: 'active' | 'inactive';
  features: PlanFeatures;
  currentPeriodEnd: Date;
}

export interface CreditCost {
  generateTweets: number;  // 10 credits for 10 tweets
  generateThread: number;  // 10 credits for 1 thread
  generateVideo: number;   // 20 credits for 1 AI video
  generateImage: number;   // 2 credits for 1 AI image
  rewriteGPT: number;     // 1 credit for 1 rewrite
  rewriteClaude: number;  // 1 credit for 1 rewrite
  storagePerGB: number;   // 2 credits per 1GB per month
}

export interface CreditUsage {
  available: number;
  used: number;
  total: number;
  resetDate: Date;
  usageBreakdown: {
    tweets: number;
    threads: number;
    videos: number;
    images: number;
    rewrites: number;
    storage: number;
  };
}

export const CREDIT_COSTS: CreditCost = {
  generateTweets: 10,    // 10 credits for 10 tweets
  generateThread: 10,    // 10 credits for 1 thread
  generateVideo: 20,     // 20 credits for 1 AI video
  generateImage: 2,      // 2 credits for 1 AI image
  rewriteGPT: 1,        // 1 credit for 1 rewrite
  rewriteClaude: 1,     // 1 credit for 1 rewrite
  storagePerGB: 2,      // 2 credits per 1GB per month
};

// Workspace limits by plan
export const PLAN_WORKSPACE_LIMITS = {
  free: 1,
  solo: 1,
  team: 2,
  enterprise: Infinity,
} as const;

// Post limits by plan
export const PLAN_POST_LIMITS = {
  free: 10,
  solo: Infinity,
  team: Infinity,
  agency: Infinity
} as const;

// Team member limits by plan
export const PLAN_MEMBER_LIMITS = {
  free: 1,
  solo: 1,
  team: 2,
  enterprise: Infinity,
} as const; 