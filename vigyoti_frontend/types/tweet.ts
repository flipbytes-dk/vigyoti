export interface Tweet {
  id: string;
  tweet_text: string;
  status: 'draft' | 'scheduled' | 'published';
  scheduled_date?: Date | null;
  image_url?: string | null;
  image_generation_details?: {
    prompt?: string;
    aspect_ratio?: string;
    style_type?: string;
    magic_prompt_option?: string;
  } | null;
  thread_position?: number;
  is_thread: boolean;
  is_premium_content: boolean;
  deleted?: boolean;
}

export interface ImageGenerationOptions {
  prompt: string;
  tweet_text: string;
  summary: string;
  aspect_ratio: '1:1' | '9:16' | '16:9';
  style_type: 'Auto' | 'General' | 'Realistic' | 'Design' | 'Render 3D' | 'Anime';
  magic_prompt_option: string;
  negative_prompt?: string;
}

export interface TweetResponse {
  tweet_text: string;
  is_thread: boolean;
  thread_position: number;
  is_premium_content: boolean;
  image_url: string | null;
  image_generation_details: {
    prompt?: string;
    aspect_ratio?: string;
    style_type?: string;
    magic_prompt_option?: string;
  } | null;
}

export interface TweetFormData {
  tweet_text: string;
  is_thread: boolean;
  thread_position: number;
  is_premium_content: boolean;
  image_url?: string;
  image_generation_details?: {
    prompt?: string;
    aspect_ratio?: string;
    style_type?: string;
    magic_prompt_option?: string;
  };
  status: 'draft' | 'scheduled' | 'published';
  scheduled_date?: Date;
} 