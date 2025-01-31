import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PLAN_FEATURES } from '@/types/subscription';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Implement actual credits check from your database
    // For now, return default credits based on free plan
    const currentPlan = 'free';
    const totalCredits = PLAN_FEATURES[currentPlan].aiCreditsPerMonth;

    return NextResponse.json({
      available: totalCredits,
      used: 0,
      total: totalCredits,
      resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      usageBreakdown: {
        tweets: 0,
        threads: 0,
        videos: 0,
        images: 0,
        rewrites: 0,
        storage: 0,
      },
    });
  } catch (error) {
    console.error('Error getting user credits:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 