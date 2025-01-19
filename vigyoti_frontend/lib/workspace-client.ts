import { Workspace, Project } from '@/types/workspace';

export class WorkspaceClient {
  static async getWorkspaces(): Promise<Workspace[]> {
    const response = await fetch('/api/workspaces');
    if (!response.ok) {
      throw new Error('Failed to fetch workspaces');
    }
    return response.json();
  }

  static async createWorkspace(name: string, description?: string): Promise<string> {
    const response = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!response.ok) {
      throw new Error('Failed to create workspace');
    }
    const { workspaceId } = await response.json();
    return workspaceId;
  }

  static async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const response = await fetch(`/api/workspace/${workspaceId}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch workspace');
    }
    return response.json();
  }

  static async updateWorkspace(workspaceId: string, updates: { name: string }): Promise<Workspace> {
    const response = await fetch(`/api/workspace/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error('Failed to update workspace');
    }
    return response.json();
  }

  static async getWorkspaceProjects(workspaceId: string): Promise<Project[]> {
    const response = await fetch(`/api/workspace/${workspaceId}/projects`);
    if (!response.ok) {
      throw new Error('Failed to fetch workspace projects');
    }
    return response.json();
  }

  static async createProject(workspaceId: string, project: { name: string; description?: string }): Promise<string> {
    const response = await fetch(`/api/workspace/${workspaceId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (!response.ok) {
      throw new Error('Failed to create project');
    }
    const { projectId } = await response.json();
    return projectId;
  }

  static async getProject(projectId: string): Promise<Project | null> {
    const response = await fetch(`/api/project/${projectId}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch project');
    }
    return response.json();
  }

  static async updateProject(projectId: string, updates: { name: string; description?: string }): Promise<Project> {
    const response = await fetch(`/api/project/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error('Failed to update project');
    }
    return response.json();
  }
} 