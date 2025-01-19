'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { WorkspaceClient } from '@/lib/workspace-client';
import { Workspace, Project } from '@/types/workspace';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/user/status');
        const data = await response.json();
        
        if (data.workspace) {
          setWorkspace(data.workspace);
          setWorkspaceName(data.workspace.name);
          const projectsData = await WorkspaceClient.getWorkspaceProjects(data.workspace.id);
          setProjects(projectsData);
        }
      } catch (error) {
        console.error('Error loading workspace:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleUpdateWorkspace = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      await fetch(`/api/workspace/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workspaceName }),
      });
      // Update local state
      setWorkspace({ ...workspace, name: workspaceName });
    } catch (error) {
      console.error('Error updating workspace:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout workspaceName={workspace?.name}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-4">Settings</h1>
          <p className="text-gray-600">Manage your workspace and project settings.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Workspace Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspaceName">Workspace Name</Label>
              <div className="flex gap-2">
                <Input
                  id="workspaceName"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Enter workspace name"
                />
                <Button 
                  onClick={handleUpdateWorkspace}
                  disabled={!workspaceName.trim() || saving || workspaceName === workspace?.name}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projects.map((project) => (
                <div key={project.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-gray-600">{project.description}</p>
                    )}
                  </div>
                  <Button variant="outline" onClick={() => {}}>Edit</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
} 