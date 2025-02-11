import { Timestamp } from 'firebase/firestore';

export const PLAN_FEATURES = {
  free: {
    aiCreditsPerMonth: 100,
    maxPosts: 50,
    maxWorkspaces: 1,
    canBuyCredits: false,
    maxStorageGB: 1,
    canGenerateImages: false,
    maxPostsPerDay: 10,
  },
  solo: {
    aiCreditsPerMonth: 500,
    maxPosts: 200,
    maxWorkspaces: 2,
    canBuyCredits: true,
    maxStorageGB: 5,
    canGenerateImages: true,
    maxPostsPerDay: 50,
  },
  team: {
    aiCreditsPerMonth: 2000,
    maxPosts: 1000,
    maxWorkspaces: 5,
    canBuyCredits: true,
    maxStorageGB: 20,
    canGenerateImages: true,
    maxPostsPerDay: 200,
  },
  agency: {
    aiCreditsPerMonth: 5000,
    maxPosts: 5000,
    maxWorkspaces: 10,
    canBuyCredits: true,
    maxStorageGB: 100,
    canGenerateImages: true,
    maxPostsPerDay: 1000,
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
  generateTweet: number;   // Cost per single tweet generation
  generateImage: number;   // Cost per image generation
  storagePerGB: number;   // Cost per GB of storage per month
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
  generateTweet: 1,     // 1 credit per tweet
  generateImage: 5,     // 5 credits per image
  storagePerGB: 2,     // 2 credits per GB per month
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