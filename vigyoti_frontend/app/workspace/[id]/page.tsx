'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { WorkspaceClient } from '@/lib/workspace-client';
import { Workspace, Project } from '@/types/workspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { CreateProjectDialog } from '@/components/workspace/create-project-dialog';

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);

  useEffect(() => {
    const loadWorkspaceAndProjects = async () => {
      try {
        const [workspaceData, projectsData] = await Promise.all([
          WorkspaceClient.getWorkspace(workspaceId),
          WorkspaceClient.getWorkspaceProjects(workspaceId),
        ]);
        setWorkspace(workspaceData);
        setProjects(projectsData);
      } catch (error) {
        console.error('Error loading workspace:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWorkspaceAndProjects();
  }, [workspaceId]);

  const handleCreateProject = async (name: string, description?: string) => {
    try {
      const projectId = await WorkspaceClient.createProject(workspaceId, {
        name,
        description,
      });

      if (projectId) {
        const newProject = await WorkspaceClient.getProject(projectId);
        if (newProject) {
          setProjects([...projects, newProject]);
        }
      }
      setIsCreateProjectDialogOpen(false);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Workspace not found</h1>
          <Link href="/workspaces">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workspaces
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <Link href="/workspaces">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workspaces
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{workspace.name}</h1>
        {workspace.description && (
          <p className="text-gray-600">{workspace.description}</p>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Projects</h2>
          <Button onClick={() => setIsCreateProjectDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-gray-600 mb-4">No projects yet</p>
              <Button onClick={() => setIsCreateProjectDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  {project.description && (
                    <CardDescription>{project.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => window.location.href = `/project/${project.id}`}
                  >
                    View Project
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateProjectDialog
        open={isCreateProjectDialogOpen}
        onOpenChange={setIsCreateProjectDialogOpen}
        onSubmit={handleCreateProject}
      />
    </div>
  );
} 