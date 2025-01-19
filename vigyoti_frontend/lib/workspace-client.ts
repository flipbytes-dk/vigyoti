import { Workspace, Project } from '@/types/workspace';

export class WorkspaceClient {
  static async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const response = await fetch(`/api/workspace/${workspaceId}`);
    if (!response.ok) return null;
    return response.json();
  }

  static async getUserWorkspaces(): Promise<Workspace[]> {
    const response = await fetch('/api/workspaces');
    if (!response.ok) return [];
    return response.json();
  }

  static async createWorkspace(workspace: { name: string; description?: string }): Promise<string | null> {
    const response = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspace),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.workspaceId;
  }

  static async getWorkspaceProjects(workspaceId: string): Promise<Project[]> {
    const response = await fetch(`/api/workspace/${workspaceId}/projects`);
    if (!response.ok) return [];
    return response.json();
  }

  static async createProject(workspaceId: string, project: { name: string; description?: string }): Promise<string | null> {
    const response = await fetch(`/api/workspace/${workspaceId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.projectId;
  }

  static async getProject(projectId: string): Promise<Project | null> {
    const response = await fetch(`/api/project/${projectId}`);
    if (!response.ok) return null;
    return response.json();
  }
} 