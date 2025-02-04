import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { WorkspaceService } from '@/lib/workspace-service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Getting workspaces for user:', session.user.id);
    const workspaces = await WorkspaceService.getUserWorkspaces(session.user.id);
    console.log('Found workspaces:', workspaces);

    return NextResponse.json(workspaces);
  } catch (error) {
    console.error('Error getting workspaces:', error);
    return NextResponse.json(
      { error: 'Failed to get workspaces' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    if (!data.name) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      );
    }

    console.log('Creating workspace:', data);
    const workspace = await WorkspaceService.createWorkspace(session.user.id, data);
    console.log('Created workspace:', workspace);

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Error creating workspace:', error);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }
} 