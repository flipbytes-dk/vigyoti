'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    const checkUserStatus = async () => {
      console.log('🔍 Checking user status...', { status, session });
      
      if (status === 'loading') {
        console.log('⏳ Auth status is still loading...');
        return;
      }

      if (status === 'unauthenticated') {
        console.log('❌ User is not authenticated, redirecting to signin...');
        router.push('/auth/signin');
        return;
      }

      if (session) {
        console.log('✅ User is authenticated with session:', { 
          email: session.user?.email,
          name: session.user?.name 
        });
        
        try {
          // First check if user exists in Firebase
          console.log('🔍 Checking if user exists in Firebase...');
          let retries = 0;
          let userData;
          
          while (retries < 3) {
            const userResponse = await fetch('/api/auth/user');
            userData = await userResponse.json();
            console.log('📥 Firebase user check response:', userData);

            if (userData.error === 'user_not_found' && retries < 2) {
              console.log(`➕ User not found in Firebase, attempt ${retries + 1}/3`);
              if (retries === 0) {
                // Only create user on first attempt
                console.log('Creating new user...');
                const createResponse = await fetch('/api/auth/user', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: session.user?.email,
                    name: session.user?.name,
                    image: session.user?.image
                  })
                });
                userData = await createResponse.json();
                console.log('✨ Firebase user creation response:', userData);
              }
              retries++;
              await delay(1000); // Wait 1 second before retrying
            } else {
              break; // Exit loop if user found or max retries reached
            }
          }

          // Now check subscription status
          console.log('💳 Checking subscription status...');
          const response = await fetch('/api/user/status');
          const data = await response.json();
          console.log('📊 Subscription status:', data);

          switch (data.status) {
            case 'unsubscribed':
              console.log('🏷️ User has no subscription, redirecting to pricing...');
              router.push('/pricing');
              break;
            case 'active':
              console.log('✅ User has active subscription, redirecting to dashboard...');
              router.push('/dashboard');
              break;
            default:
              console.error('❓ Unknown user status:', data.status);
              router.push('/dashboard');
          }
        } catch (error) {
          console.error('🚨 Error in user status check:', error);
          router.push('/dashboard');
        }
      }
    };

    checkUserStatus();
  }, [session, status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
