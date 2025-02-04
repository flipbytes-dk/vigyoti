import { auth } from '@/lib/firebase-admin';
import { NextAuthOptions } from 'next-auth';
import { User, Account, Profile } from 'next-auth';
import { AdapterUser } from 'next-auth/adapters';
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { UserSubscriptionDoc, COLLECTIONS } from "@/lib/firebase/schema";
import { PlanType, SubscriptionStatus, PLAN_FEATURES } from "@/types/subscription";
import { FieldValue } from "firebase-admin/firestore";
import { redirect } from "next/navigation";

interface FirestoreUser {
  email: string;
  name: string;
  subscription?: {
    plan: 'free' | 'solo' | 'team' | 'agency';
    status: 'trial' | 'active' | 'canceled' | 'past_due';
    currentPeriodStart: Timestamp;
    currentPeriodEnd: Timestamp;
    cancelAtPeriodEnd: boolean;
    updatedAt: Timestamp;
  };
  workspaces?: string[];
}

const db = getFirestore();

// Extend the built-in types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      subscription?: {
        plan: 'free' | 'solo' | 'team' | 'agency';
        status: 'trial' | 'active' | 'canceled' | 'past_due';
        currentPeriodEnd: number;
        currentPeriodStart: number;
      };
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    email: string;
    name: string;
    picture?: string;
    subscription?: {
      plan: 'free' | 'solo' | 'team' | 'agency';
      status: 'trial' | 'active' | 'canceled' | 'past_due';
      currentPeriodEnd: number;
      currentPeriodStart: number;
    };
    hasWorkspaces: boolean;
  }
}

async function signInCallback({ user, account }: { 
  user: User | AdapterUser; 
  account: Account | null; 
  profile?: Profile 
}): Promise<boolean> {
  try {
    console.log('Starting sign-in process for:', user.email);
    
    // Try to get the existing Firebase user
    let firebaseUser;
    try {
      firebaseUser = await auth.getUserByEmail(user.email!);
      console.log('Found existing Firebase user:', firebaseUser.uid);
      
      // Set the user.id to the Firebase UID to ensure consistency
      user.id = firebaseUser.uid;
      console.log('Updated user.id to Firebase UID:', user.id);
      
    } catch (error: any) {
      // Only create a new user if the error is user-not-found
      if (error.code === 'auth/user-not-found') {
        console.log('Creating new Firebase user for:', user.email);
        firebaseUser = await auth.createUser({
          email: user.email!,
          displayName: user.name || undefined,
          photoURL: user.image || undefined,
        });
        user.id = firebaseUser.uid;
      } else {
        throw error; // Re-throw other errors
      }
    }

    // Create a custom token for the user
    await auth.createCustomToken(firebaseUser.uid);
    
    // Return success
    return true;
  } catch (error) {
    console.error('Error in signIn callback:', error);
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    signIn: signInCallback,
    async jwt({ token, user }) {
      try {
        // Set basic user info
        if (user) {
          // Ensure we're using the Firebase UID
          token.uid = user.id; // This will now be the Firebase UID from signInCallback
          token.email = user.email;
          token.name = user.name || '';
          token.picture = user.image || '';
          console.log('JWT callback - set token.uid to:', token.uid);
        }

        // Get user data from Firestore
        if (token.uid) {
          console.log('Fetching Firestore data for user:', token.uid);
          const userDoc = await db.collection('users').doc(token.uid).get();
          
          if (userDoc.exists) {
            const userData = userDoc.data() as FirestoreUser;
            console.log('Found user data:', userData);

            // Check subscription status
            if (userData?.subscription) {
              const subscription = userData.subscription;
              const now = Date.now();
              const periodEnd = subscription.currentPeriodEnd.toMillis();

              if (subscription.status === 'active' && periodEnd > now) {
                token.subscription = {
                  plan: subscription.plan,
                  status: subscription.status,
                  currentPeriodEnd: periodEnd,
                  currentPeriodStart: subscription.currentPeriodStart.toMillis(),
                };
                console.log('Valid subscription found:', token.subscription);
              } else {
                console.log('Subscription not active or expired:', {
                  status: subscription.status,
                  periodEnd,
                  now
                });
              }
            } else {
              console.log('No subscription data found in user document');
            }

            // Set workspace info
            token.hasWorkspaces = Array.isArray(userData.workspaces) && userData.workspaces.length > 0;
          } else {
            console.log('No Firestore document found for user:', token.uid);
          }
        }

        return token;
      } catch (error) {
        console.error('Error in JWT callback:', error);
        return token;
      }
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.uid;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.picture;
        
        if (token.subscription) {
          session.user.subscription = token.subscription;
          console.log('Added subscription to session:', token.subscription);
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 