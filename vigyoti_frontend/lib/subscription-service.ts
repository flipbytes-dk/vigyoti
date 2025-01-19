import { adminDb } from './firebase-admin';
import type { UserSubscription, UserCredits, CreditUsage, SubscriptionPlan } from '@/types/subscription';
import { PLAN_CREDITS } from '@/types/subscription';
import { SubscriptionStatus } from '@/types/subscription';

export class SubscriptionService {
  static async createOrUpdateSubscription(subscription: {
    userId: string;
    email: string;
    name: string;
    customerId: string;
    subscriptionId: string;
    plan: 'solo' | 'team' | 'enterprise';
    status: SubscriptionStatus;
    currentPeriodStart: number;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
  }) {
    try {
      await adminDb.collection('subscriptions').doc(subscription.userId).set(subscription, { merge: true });
    } catch (error) {
      console.error('Error creating/updating subscription:', error);
      throw error;
    }
  }

  static async getSubscription(userId: string) {
    try {
      const subscriptionDoc = await adminDb.collection('subscriptions').doc(userId).get();
      if (!subscriptionDoc.exists) {
        return null;
      }
      return subscriptionDoc.data();
    } catch (error) {
      console.error('Error getting subscription:', error);
      throw error;
    }
  }

  static async initializeCredits(userId: string, plan: SubscriptionPlan) {
    const creditsRef = adminDb.collection('credits').doc(userId);
    const creditsSnap = await creditsRef.get();
    
    const monthlyCredits = PLAN_CREDITS[plan];
    
    if (!creditsSnap.exists) {
      // New user: initialize credits
      await creditsRef.set({
        userId,
        totalCredits: monthlyCredits,
        usedCredits: 0,
        lastRefillDate: Date.now(),
      });
    } else {
      // Existing user: check if it's time for monthly refill
      const credits = creditsSnap.data() as UserCredits;
      const lastRefill = new Date(credits.lastRefillDate);
      const now = new Date();
      
      if (lastRefill.getMonth() !== now.getMonth() || lastRefill.getFullYear() !== now.getFullYear()) {
        // It's a new month, refill credits
        await creditsRef.update({
          totalCredits: monthlyCredits,
          usedCredits: 0,
          lastRefillDate: Date.now(),
        });
      }
    }
  }

  static async getUserCredits(userId: string): Promise<UserCredits | null> {
    const docRef = adminDb.collection('credits').doc(userId);
    const docSnap = await docRef.get();
    return docSnap.exists ? (docSnap.data() as UserCredits) : null;
  }

  static async useCredits(userId: string, amount: number, action: CreditUsage['action'], metadata?: Record<string, any>): Promise<boolean> {
    const creditsRef = adminDb.collection('credits').doc(userId);
    const creditsSnap = await creditsRef.get();
    
    if (!creditsSnap.exists) {
      return false;
    }

    const credits = creditsSnap.data() as UserCredits;
    const remainingCredits = credits.totalCredits - credits.usedCredits;

    if (remainingCredits < amount) {
      return false;
    }

    // Update credits
    await creditsRef.update({
      usedCredits: credits.usedCredits + amount,
    });

    // Log usage
    await adminDb.collection('credit-usage').add({
      userId,
      amount,
      action,
      timestamp: Date.now(),
      metadata,
    });

    return true;
  }

  static async getRemainingCredits(userId: string): Promise<number> {
    const credits = await this.getUserCredits(userId);
    if (!credits) return 0;
    return credits.totalCredits - credits.usedCredits;
  }
} 