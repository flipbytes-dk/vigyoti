export interface Tweet {
  id: string;
  text: string;
  status: 'draft' | 'scheduled' | 'published';
  scheduledDate?: Date | null;
  imageUrl?: string | null;
  imageGenerationDetails?: {
    prompt?: string;
    aspectRatio?: string;
    styleType?: string;
    magicPromptOption?: string;
  } | null;
  threadPosition?: number;
  isThread: boolean;
  isPremiumContent: boolean;
  deleted?: boolean;
  projectId?: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
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
  imageGenerationDetails: {
    prompt?: string;
    aspectRatio?: string;
    styleType?: string;
    magicPromptOption?: string;
  } | null;
}

export interface TweetFormData {
  text: string;
  isThread: boolean;
  threadPosition: number;
  isPremiumContent: boolean;
  imageUrl?: string;
  imageGenerationDetails?: {
    prompt?: string;
    aspectRatio?: string;
    styleType?: string;
    magicPromptOption?: string;
  };
  status: 'draft' | 'scheduled' | 'published';
  scheduledDate?: Date;
} 