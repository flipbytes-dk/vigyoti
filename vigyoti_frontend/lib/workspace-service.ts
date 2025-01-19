import { adminDb } from './firebase-admin';
import { Workspace, Project } from '@/types/workspace';

export class WorkspaceService {
  static async createWorkspace(workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const workspaceRef = await adminDb.collection('workspaces').add({
        ...workspace,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return workspaceRef.id;
    } catch (error) {
      console.error('Error creating workspace:', error);
      throw error;
    }
  }

  static async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    try {
      const workspaceDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
      if (!workspaceDoc.exists) {
        return null;
      }
      return { id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace;
    } catch (error) {
      console.error('Error getting workspace:', error);
      throw error;
    }
  }

  static async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    try {
      const workspacesSnapshot = await adminDb.collection('workspaces')
        .where('ownerId', '==', userId)
        .get();
      
      return workspacesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Workspace[];
    } catch (error) {
      console.error('Error getting user workspaces:', error);
      throw error;
    }
  }

  static async updateWorkspace(workspaceId: string, updates: Partial<Workspace>): Promise<void> {
    try {
      await adminDb.collection('workspaces').doc(workspaceId).update({
        ...updates,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Error updating workspace:', error);
      throw error;
    }
  }

  static async deleteWorkspace(workspaceId: string): Promise<void> {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  static async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const projectRef = await adminDb.collection('projects').add({
        ...project,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return projectRef.id;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  static async getProject(projectId: string): Promise<Project | null> {
    try {
      const projectDoc = await adminDb.collection('projects').doc(projectId).get();
      if (!projectDoc.exists) {
        return null;
      }
      return { id: projectDoc.id, ...projectDoc.data() } as Project;
    } catch (error) {
      console.error('Error getting project:', error);
      throw error;
    }
  }

  static async getWorkspaceProjects(workspaceId: string): Promise<Project[]> {
    try {
      const projectsSnapshot = await adminDb.collection('projects')
        .where('workspaceId', '==', workspaceId)
        .get();
      
      return projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
    } catch (error) {
      console.error('Error getting workspace projects:', error);
      throw error;
    }
  }

  static async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    try {
      await adminDb.collection('projects').doc(projectId).update({
        ...updates,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  static async deleteProject(projectId: string): Promise<void> {
    // Implementation needed
    throw new Error('Method not implemented');
  }
} 