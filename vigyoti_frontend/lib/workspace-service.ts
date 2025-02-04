import { db as adminDb } from './firebase-admin';
import { Workspace, Project } from '@/types/workspace';
import type { Workspace as FirebaseWorkspace } from '@/types/firebase';
import { Timestamp } from 'firebase-admin/firestore';

export class WorkspaceService {
  static async createWorkspace(userId: string, data: { name: string; description?: string }): Promise<Workspace> {
    try {
      console.log('Creating workspace for user:', userId, data);
      const workspaceRef = adminDb.collection('workspaces').doc();
      const now = Timestamp.now();
      
      const workspace: Workspace = {
        id: workspaceRef.id,
        ownerId: userId,
        name: data.name,
        description: data.description || 'Default workspace',
        createdAt: now,
        updatedAt: now
      };

      await workspaceRef.set(workspace);
      console.log('Created workspace:', workspace);
      
      return workspace;
    } catch (error) {
      console.error('Error creating workspace:', error);
      throw error;
    }
  }

  static async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    try {
      console.log('Fetching workspace:', workspaceId);
      const workspaceDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
      
      if (!workspaceDoc.exists) {
        console.log('Workspace not found:', workspaceId);
        return null;
      }

      const workspace = {
        id: workspaceDoc.id,
        ...workspaceDoc.data()
      } as Workspace;

      console.log('Found workspace:', workspace);
      return workspace;
    } catch (error) {
      console.error('Error getting workspace:', error);
      throw error;
    }
  }

  static async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    try {
      console.log('Fetching workspaces for user:', userId);
      const workspacesSnapshot = await adminDb.collection('workspaces')
        .where('ownerId', '==', userId)
        .get();
      
      const workspaces = workspacesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Workspace[];

      console.log('Found workspaces:', workspaces);
      return workspaces;
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