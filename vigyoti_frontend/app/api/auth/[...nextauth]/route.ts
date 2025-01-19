import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import { adminAuth } from "@/lib/firebase-admin";

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
      if (account?.provider === 'google') {
        try {
          // Try to get the user from Firebase
          try {
            await adminAuth.getUserByEmail(user.email!);
          } catch (error) {
            // If user doesn't exist in Firebase, create them
            await adminAuth.createUser({
              email: user.email!,
              displayName: user.name!,
              photoURL: user.image,
              uid: user.id, // This will be their Google sub
            });
          }
          return true;
        } catch (error) {
          console.error("Error in signIn callback:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === 'google' && profile) {
        token.uid = profile.sub; // Store the Google sub as uid
        token.email = profile.email;
        token.name = profile.name;
        token.picture = profile.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.uid as string; // Use the Google sub as the user ID
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
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