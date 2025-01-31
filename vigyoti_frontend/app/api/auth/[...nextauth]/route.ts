import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import { adminAuth } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { UserSubscriptionDoc, COLLECTIONS } from "@/lib/firebase/schema";
import { PlanType, SubscriptionStatus } from "@/types/subscription";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const db = getFirestore();

// Extend the built-in types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      subscription?: UserSubscriptionDoc;
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    email: string;
    name: string;
    picture?: string;
    subscription?: UserSubscriptionDoc;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false; // Require email
      
      if (account?.provider === 'google') {
        try {
          console.log('Starting sign-in process for:', user.email);
          
          // Try to get the user from Firebase
          let firebaseUser;
          try {
            firebaseUser = await adminAuth.getUserByEmail(user.email);
            console.log('Existing Firebase user found:', firebaseUser.uid);
          } catch (error) {
            console.log('Creating new Firebase user for:', user.email);
            // If user doesn't exist in Firebase, create them
            firebaseUser = await adminAuth.createUser({
              email: user.email,
              displayName: user.name || user.email.split('@')[0],
              photoURL: user.image || '',
            });
          }

          // Store the Firebase UID in the user object
          user.id = firebaseUser.uid;
          console.log('Set user.id to Firebase UID:', firebaseUser.uid);

          // Verify the user document exists
          const userDocRef = await db.collection(COLLECTIONS.USERS).doc(firebaseUser.uid).get();
          if (!userDocRef.exists) {
            console.log('User document missing, creating it now...');
            // Create the user document if it doesn't exist
            const now = Timestamp.now();
            const thirtyDaysFromNow = new Timestamp(
              Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
              0
            );

            const userDoc = {
              userId: firebaseUser.uid,
              email: user.email,
              name: user.name || user.email.split('@')[0],
              plan: 'solo' as PlanType,
              status: 'active' as SubscriptionStatus,
              currentPeriodStart: now,
              currentPeriodEnd: thirtyDaysFromNow,
              cancelAtPeriodEnd: false,
              createdAt: now,
              updatedAt: now,
              workspaceCount: 0,
              teamMemberCount: 0,
            };

            await db.collection(COLLECTIONS.USERS).doc(firebaseUser.uid).set(userDoc);
            console.log('Created missing user document with ID:', firebaseUser.uid);
          }

          console.log('Sign-in successful for user:', firebaseUser.uid);
          return true;
        } catch (error) {
          console.error("Error in signIn callback:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, account, profile, user }) {
      if (account?.provider === 'google' && user) {
        // Ensure we're using the Firebase UID
        token.uid = user.id; // This will be the Firebase UID we set in signIn
        token.email = user.email || '';
        token.name = user.name || '';
        token.picture = user.image || '';
        console.log('JWT callback - set token.uid to:', token.uid);
      }

      // Get subscription status from Firestore using Firebase UID
      if (token.uid) {
        try {
          console.log('Fetching user doc for UID:', token.uid);
          const userDoc = await db.collection(COLLECTIONS.USERS).doc(token.uid).get();
          
          if (userDoc.exists) {
            const userData = userDoc.data() as UserSubscriptionDoc;
            token.subscription = userData;
            console.log('Found user subscription:', userData);
          } else {
            console.log('No user document found for UID:', token.uid);
          }
        } catch (error) {
          console.error("Error fetching subscription status:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        // Use the Firebase UID from the token
        session.user.id = token.uid;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.picture || '';
        session.user.subscription = token.subscription;
        console.log('Session callback - set user.id to:', token.uid);
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // If the URL is not the base URL, respect the requested URL
      if (url !== baseUrl) {
        return url;
      }
      
      // Otherwise, redirect to the home page which will handle the routing logic
      return baseUrl;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 