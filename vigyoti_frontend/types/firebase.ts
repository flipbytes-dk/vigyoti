import { Timestamp } from 'firebase/firestore';

export interface FirebaseUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  currentWorkspaceId?: string;
  stripeCustomerId?: string;
  subscription?: {
    plan: 'free' | 'solo' | 'team' | 'agency';
    status: 'trial' | 'active' | 'canceled' | 'past_due';
    startDate: Timestamp;
    endDate: Timestamp;
    trialEnd?: Timestamp;
  };
  usage?: {
    postsThisMonth: number;
    creditsThisMonth: number;
    storageUsed: number;
  };
  credits: {
    available: number;
    used: number;
    total: number;
    lastRefill: Timestamp;
    nextRefill: Timestamp;
  };
  workspaces: string[]; // Array of workspace IDs
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Project {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  description?: string;
  sourceType?: string;
  sourceUrl?: string;
  status: 'draft' | 'scheduled' | 'published';
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
  contentId?: string;
  text: string;
  isThread: boolean;
  threadPosition?: number;
  status: 'draft' | 'published' | 'scheduled';
  imageUrl?: string;
  imageMetadata?: {
    prompt?: string | null;
    aspectRatio?: string | null;
    styleType?: string | null;
    storageRef?: string;
    uploadType?: 'ai_generated' | 'user_upload';
    originalName?: string;
  };
  isPremiumContent: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
} 