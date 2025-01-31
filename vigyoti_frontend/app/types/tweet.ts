export interface ImageGenerationOptions {
  prompt?: string;
  negative_prompt?: string;
  tweet_text: string;
  summary?: string;
  aspect_ratio: string;
  style_type: string;
  magic_prompt_option: string;
}

export interface ImageGenerationDetails {
  prompt: string;
  negative_prompt?: string;
  tweet_text: string;
  summary: string;
  aspect_ratio: string;
  style_type: string;
  magic_prompt_option: string;
}

export interface Tweet {
  id: string;
  tweet_text: string;
  is_thread: boolean;
  thread_position?: number;
  image_url?: string;
  is_premium_content: boolean;
  image_generation_details?: ImageGenerationDetails;
  deleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string;
  projectId?: string;
  status?: 'draft' | 'scheduled' | 'published';
  scheduledFor?: Date;
} 