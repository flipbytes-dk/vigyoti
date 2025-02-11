import { Timestamp } from 'firebase/firestore';

// Base Tweet interface that matches the Firestore schema
export interface FirebaseTweet {
  id: string;
  projectId: string;
  userId: string;
  contentId?: string;
  text: string;
  isThread: boolean;
  threadPosition?: number;
  status: 'draft' | 'published' | 'scheduled';
  imageUrl?: string;
  imageMetadata?: TweetImageMetadata;
  isPremiumContent: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Client-side Tweet that allows for Date objects
export interface Tweet extends Omit<FirebaseTweet, 'createdAt' | 'updatedAt'> {
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  scheduledDate?: Date | null;
  deleted?: boolean;
}

// Image-related interfaces
export interface TweetImageMetadata {
  prompt?: string | null;
  aspectRatio?: string | null;
  styleType?: string | null;
  storageRef?: string;
  uploadType?: 'ai_generated' | 'user_upload';
  originalName?: string;
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

// API Response interfaces
export interface GeneratedTweetDetails {
  text: string;
  isThread: boolean;
  threadPosition?: number;
  imageUrl?: string;
  imageMetadata?: TweetImageMetadata;
}

export interface GeneratedTweetResponse {
  generated_tweets: GeneratedTweetDetails[];
  video_summary?: string;
  full_transcript?: string;
}

// Form and UI-related interfaces
export interface TweetFormData {
  text: string;
  isThread: boolean;
  threadPosition?: number;
  status: 'draft' | 'scheduled' | 'published';
  imageUrl?: string;
  imageMetadata?: TweetImageMetadata;
  isPremiumContent: boolean;
}

export interface TweetCardProps {
  tweet: FirebaseTweet;
  onEdit: (tweet: FirebaseTweet) => void;
  onSchedule: () => void;
  onPublish: () => void;
  setEditingTweet: (tweet: FirebaseTweet | null) => void;
}

export interface EditTweetModalProps {
  tweet: FirebaseTweet | null;
  onClose: () => void;
  onSave: (tweet: FirebaseTweet) => void;
  onGenerate: (params: ImageGenerationOptions) => Promise<void>;
  isOpen: boolean;
}

// Snake case version for API requests
export interface ApiImageGenerationOptions {
  prompt?: string;
  negative_prompt?: string;
  tweet_text: string;
  summary?: string;
  aspect_ratio: string;
  style_type: string;
  magic_prompt_option: string;
} 