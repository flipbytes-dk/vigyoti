'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { WorkspaceService } from '@/lib/workspace-service';
import { Workspace } from '@/types/workspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Loader2 } from 'lucide-react';
import { CreateWorkspaceDialog } from './create-workspace-dialog';

export function WorkspaceList() {
  const { data: session } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    const loadWorkspaces = async () => {
      if (session?.user?.id) {
        try {
          const userWorkspaces = await WorkspaceService.getUserWorkspaces(session.user.id);
          setWorkspaces(userWorkspaces);
        } catch (error) {
          console.error('Error loading workspaces:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadWorkspaces();
  }, [session?.user?.id]);

  const handleCreateWorkspace = async (name: string, description?: string) => {
    if (!session?.user?.id) return;

    try {
      const workspaceId = await WorkspaceService.createWorkspace({
        name,
        description,
        ownerId: session.user.id,
      });

      const newWorkspace = await WorkspaceService.getWorkspace(workspaceId);
      if (newWorkspace) {
        setWorkspaces([...workspaces, newWorkspace]);
      }
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating workspace:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Your Workspaces</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Workspace
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map((workspace) => (
          <Card key={workspace.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>{workspace.name}</CardTitle>
              {workspace.description && (
                <CardDescription>{workspace.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => window.location.href = `/workspace/${workspace.id}`}>
                View Workspace
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateWorkspaceDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateWorkspace}
      />
    </div>
  );
} 