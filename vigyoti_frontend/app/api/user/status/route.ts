import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { SubscriptionService } from '@/lib/subscription-service';
import { WorkspaceService } from '@/lib/workspace-service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ status: 'unauthenticated' });
    }

    // Check subscription status
    const subscription = await SubscriptionService.getSubscription(session.user.id);
    
    if (!subscription || subscription.status !== 'active') {
      return NextResponse.json({ status: 'unsubscribed' });
    }

    // Get or create default workspace
    let workspaces = await WorkspaceService.getUserWorkspaces(session.user.id);
    let defaultWorkspace;

    if (workspaces.length === 0) {
      // Create default workspace
      const workspaceId = await WorkspaceService.createWorkspace({
        name: session.user.name + "'s Workspace",
        description: 'Default workspace',
        ownerId: session.user.id,
      });

      // Create default project
      await WorkspaceService.createProject({
        name: 'My First Project',
        description: 'Welcome to your first project!',
        workspaceId,
      });

      defaultWorkspace = await WorkspaceService.getWorkspace(workspaceId);
    } else {
      defaultWorkspace = workspaces[0];
    }

    return NextResponse.json({
      status: 'active',
      workspace: defaultWorkspace,
    });
  } catch (error) {
    console.error('Error checking user status:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
} 