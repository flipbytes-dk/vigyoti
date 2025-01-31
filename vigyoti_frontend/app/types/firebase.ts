import { Timestamp } from 'firebase/firestore';

export interface FirebaseUser {
  id: string;
  email: string;
  name: string;
  currentWorkspaceId?: string;
  stripeCustomerId?: string;
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'cancelled' | 'expired';
    startDate: Timestamp;
    endDate: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Workspace {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Project {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  description?: string;
  sourceType: 'youtube' | 'blog' | 'audio' | 'image' | 'document' | 'custom';
  sourceUrl?: string;
  status: 'draft' | 'active' | 'archived';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Content {
  id: string;
  projectId: string;
  userId: string;
  type: 'video' | 'article' | 'audio' | 'image' | 'document' | 'text';
  originalContent: {
    url?: string;
    text?: string;
    summary?: string;
    transcript?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Tweet {
  id: string;
  projectId: string;
  userId: string;
  contentId: string;
  text: string;
  isThread: boolean;
  threadPosition?: number;
  status: 'draft' | 'scheduled' | 'published';
  scheduledFor?: Timestamp;
  publishedAt?: Timestamp;
  imageUrl?: string;
  imageMetadata?: {
    prompt: string;
    aspectRatio: string;
    styleType: string;
    storageRef: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
} 