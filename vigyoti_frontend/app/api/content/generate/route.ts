import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { auth } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    // Verify session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Firebase token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    try {
      const token = authHeader.split('Bearer ')[1];
      await auth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get request data
    const data = await request.json();
    const { projectId, sourceUrl, contentType, numberOfTweets, additionalContext, isPremium } = data;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Call your content generation service
    // For now, let's return some mock data
    const mockTweets = Array.from({ length: numberOfTweets || 1 }, (_, i) => ({
      tweet_text: `Generated tweet ${i + 1} about ${sourceUrl || 'custom content'}. ${additionalContext || ''}`,
      is_thread: contentType === 'thread',
      thread_position: i + 1,
      is_premium_content: isPremium || false,
      image_url: null,
      image_generation_details: null
    }));

    return NextResponse.json({
      success: true,
      generated_tweets: mockTweets
    });

  } catch (error) {
    console.error('Error in content generation:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
} 