import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';
import { adminAuth } from '@/lib/firebase-admin';

// Simple in-memory lock to prevent concurrent user creation
const userCreationLocks = new Map<string, boolean>();

export async function GET() {
  try {
    console.log('📥 GET /api/auth/user - Checking session...');
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      console.log('❌ No valid session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Looking up Firebase user by email:', session.user.email);
    try {
      const user = await adminAuth.getUserByEmail(session.user.email);
      console.log('✅ Firebase user found:', { uid: user.uid, email: user.email });
      return NextResponse.json(user);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.log('❓ User not found in Firebase');
        return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    console.error('🚨 Error in GET /api/auth/user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    console.log('📥 POST /api/auth/user - Checking session...');
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      console.log('❌ No valid session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, name, image } = await req.json();
    
    // Check if there's an ongoing creation for this email
    if (userCreationLocks.get(email)) {
      console.log('⏳ User creation already in progress for:', email);
      return NextResponse.json({ error: 'creation_in_progress' }, { status: 409 });
    }

    // Set lock
    userCreationLocks.set(email, true);
    console.log('🔒 Acquired lock for:', email);

    try {
      console.log('➕ Attempting to create Firebase user:', { email, name });

      // Double-check user doesn't exist
      try {
        const existingUser = await adminAuth.getUserByEmail(email);
        console.log('⚠️ User already exists in Firebase:', { uid: existingUser.uid, email: existingUser.email });
        return NextResponse.json(existingUser);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // Proceed with user creation
          const user = await adminAuth.createUser({
            email,
            displayName: name,
            photoURL: image,
            emailVerified: true,
          });
          console.log('✨ New Firebase user created:', { uid: user.uid, email: user.email });
          return NextResponse.json(user);
        }
        throw error;
      }
    } finally {
      // Release lock
      userCreationLocks.delete(email);
      console.log('🔓 Released lock for:', email);
    }
  } catch (error) {
    console.error('🚨 Error in POST /api/auth/user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 