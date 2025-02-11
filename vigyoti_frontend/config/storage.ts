import { PlanType } from '@/types/subscription';

// Storage limits in bytes
export const STORAGE_LIMITS = {
  MAX_TOTAL_STORAGE: 1 * 1024 * 1024 * 1024,  // 1GB total storage per user
  MAX_FILE_SIZE: 5 * 1024 * 1024,             // 5MB per file
} as const;

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  VIDEO: ['video/mp4', 'video/webm'],
  DOCUMENT: ['application/pdf']
} as const;

// Storage paths
export const STORAGE_PATHS = {
  PROJECTS: 'projects',
  USERS: 'users',
  TWEETS: 'tweets'
} as const;

// Storage limits by plan (in bytes)
export const PLAN_STORAGE_LIMITS: Record<PlanType, number> = {
  free: 1 * 1024 * 1024 * 1024,      // 1GB
  solo: 1 * 1024 * 1024 * 1024,      // 5GB
  team: 1 * 1024 * 1024 * 1024,     // 10GB
  agency: 1 * 1024 * 1024 * 1024    // 50GB
}; 