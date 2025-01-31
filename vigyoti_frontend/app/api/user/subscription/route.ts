import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PLAN_FEATURES, PlanType } from '@/types/subscription';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Implement actual subscription check from your database
    // For now, return a default free subscription
    const currentPlan: PlanType = 'free';
    
    return NextResponse.json({
      id: session.user.id,
      name: currentPlan,
      status: 'active',
      features: PLAN_FEATURES[currentPlan],
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    });
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 