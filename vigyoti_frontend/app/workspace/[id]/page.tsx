'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { WorkspaceClient } from '@/lib/workspace-client';
import { Workspace, Project } from '@/types/workspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Loader2, ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { CreateProjectDialog } from '@/components/workspace/create-project-dialog';
import { Input } from '@/components/ui/input';
import { EditProjectDialog } from '@/components/workspace/edit-project-dialog';

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  useEffect(() => {
    const loadWorkspaceAndProjects = async () => {
      try {
        const [workspaceData, projectsData] = await Promise.all([
          WorkspaceClient.getWorkspace(workspaceId),
          WorkspaceClient.getWorkspaceProjects(workspaceId),
        ]);
        setWorkspace(workspaceData);
        setNewName(workspaceData?.name || '');
        setProjects(projectsData);
        setError(null);
      } catch (error) {
        console.error('Error loading workspace:', error);
        setError('Failed to load workspace. Please try again.');
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
      setError(null);
    } catch (error) {
      console.error('Error creating project:', error);
      setError('Failed to create project. Please try again.');
    }
  };

  const handleUpdateName = async () => {
    if (!workspace || !newName.trim()) return;
    try {
      const updatedWorkspace = await WorkspaceClient.updateWorkspace(workspaceId, { name: newName.trim() });
      setWorkspace(updatedWorkspace);
      setIsEditingName(false);
      setError(null);
    } catch (error) {
      console.error('Error updating workspace name:', error);
      setError('Failed to update workspace name. Please try again.');
    }
  };

  const handleUpdateProject = async (projectId: string, name: string, description?: string) => {
    try {
      const updatedProject = await WorkspaceClient.updateProject(projectId, { name, description });
      setProjects(projects.map(p => p.id === projectId ? updatedProject : p));
      setEditingProject(null);
      setError(null);
    } catch (error) {
      console.error('Error updating project:', error);
      setError('Failed to update project. Please try again.');
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-8">
        {isEditingName ? (
          <div className="flex gap-2 items-center">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-3xl font-bold h-12"
              placeholder="Enter workspace name"
            />
            <Button onClick={handleUpdateName} disabled={!newName.trim() || newName === workspace.name}>
              Save
            </Button>
            <Button variant="outline" onClick={() => {
              setIsEditingName(false);
              setNewName(workspace.name);
            }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{workspace.name}</h1>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsEditingName(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
        {workspace.description && (
          <p className="text-gray-600 mt-2">{workspace.description}</p>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{project.name}</CardTitle>
                      {project.description && (
                        <CardDescription>{project.description}</CardDescription>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setEditingProject(project)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
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

      <EditProjectDialog
        open={editingProject !== null}
        onOpenChange={(open) => !open && setEditingProject(null)}
        project={editingProject}
        onSubmit={handleUpdateProject}
      />
    </div>
  );
} 