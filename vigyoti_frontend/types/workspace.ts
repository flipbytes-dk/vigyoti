export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  workspaceId: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  ownerId: string;
  members?: string[]; // Array of user IDs who have access to this workspace
}

export type WorkspaceWithProjects = Workspace & {
  projects: Project[];
} 