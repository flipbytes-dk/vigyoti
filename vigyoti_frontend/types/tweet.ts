import { Tweet as FirebaseTweet } from './firebase';
import { Timestamp } from 'firebase/firestore';

// Client-side Tweet interface that extends the Firebase Tweet
export interface Tweet extends Omit<FirebaseTweet, 'createdAt' | 'updatedAt'> {
  text: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  scheduledDate?: Date | null;
  deleted?: boolean;
}

// Interface for tweet generation response
export interface GeneratedTweetDetails {
  text: string;
  isThread: boolean;
  threadPosition?: number;
  imageUrl?: string;
  imageMetadata?: {
    prompt?: string;
    aspectRatio?: string;
    styleType?: string;
    storageRef?: string;
    uploadType?: 'ai_generated' | 'user_upload';
  };
}

export interface GeneratedTweetResponse {
  generated_tweets: GeneratedTweetDetails[];
}

export interface TweetFormData {
  text: string;
  isThread: boolean;
  threadPosition?: number;
  status: 'draft' | 'scheduled' | 'published';
  imageUrl?: string;
  imageMetadata?: {
    prompt?: string;
    aspectRatio?: string;
    styleType?: string;
    storageRef?: string;
    uploadType?: 'ai_generated' | 'user_upload';
    originalName?: string;
  };
  isPremiumContent: boolean;
}

export interface ImageGenerationOptions {
  prompt: string;
  text: string;
  summary: string;
  aspectRatio: '1:1' | '9:16' | '16:9';
  styleType: 'Auto' | 'General' | 'Realistic' | 'Design' | 'Render 3D' | 'Anime';
  magicPromptOption: string;
  negativePrompt?: string;
}

export interface TweetResponse {
  text: string;
  isThread: boolean;
  threadPosition: number;
  isPremiumContent: boolean;
  imageUrl: string | null;
  imageMetadata: {
    prompt?: string;
    aspectRatio?: string;
    styleType?: string;
    storageRef?: string;
    uploadType?: 'ai_generated' | 'user_upload';
    originalName?: string;
  } | null;
} 