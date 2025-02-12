'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import {
  Youtube,
  Link2,
  Headphones,
  Image as ImageIcon,
  FileUp,
  FileText,
  Home,
  ArrowLeft,
  Copy,
  Edit,
  Calendar,
  Send,
  Trash2,
  Wand2,
  ImagePlus,
  Save,
  Clock,
  SendHorizontal
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatDistanceToNow } from 'date-fns';
import { getSession } from "next-auth/react";
import { doc, setDoc, updateDoc, serverTimestamp, getDoc, collection } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { EditProvider, useEdit } from "../../contexts/EditContext";
import { Tweet as FirebaseTweet, Workspace } from '@/types/firebase';
import type { Tweet } from '@/types/tweets';
import { Timestamp } from "firebase/firestore";
import { FirebaseService, ContentGenerationRequest } from "@/services/firebase";
import { getAuth } from "firebase/auth";
import { User } from "firebase/auth";
import { useSession } from 'next-auth/react';
import { CREDIT_COSTS } from '@/types/subscription';
import { StorageUsageService } from '@/services/storage-usage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface ImageGenerationOptions {
  prompt: string;
  text: string;
  summary: string;
  aspect_ratio: '1:1' | '9:16' | '16:9';
  style_type: 'Auto' | 'General' | 'Realistic' | 'Design' | 'Render 3D' | 'Anime';
  magic_prompt_option: string;
  negative_prompt?: string;
}

interface Session {
  user?: {
    id: string;
    currentWorkspaceId?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    subscription?: {
      plan: 'solo' | 'team' | 'enterprise';
      status: 'active' | 'cancelled' | 'expired';
      startDate: any;
      endDate: any;
    };
  };
}

interface GeneratedTweetDetails {
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

interface GeneratedTweetResponse {
  generated_tweets: GeneratedTweetDetails[];
}

interface TweetCardProps {
  tweet: FirebaseTweet;
  onEdit: (tweet: FirebaseTweet) => void;
  onSchedule: () => void;
  onPublish: () => void;
  setEditingTweet: (tweet: FirebaseTweet | null) => void;
}

// Add type definition for markdown components
type ComponentType = Components[keyof Components];

const markdownComponents: Components = {
  p: ({ children, ...props }) => <p className="mb-2" {...props}>{children}</p>,
  h1: ({ children, ...props }) => <h1 className="text-xl font-bold mb-2" {...props}>{children}</h1>,
  h2: ({ children, ...props }) => <h2 className="text-lg font-bold mb-2" {...props}>{children}</h2>,
  h3: ({ children, ...props }) => <h3 className="text-base font-bold mb-2" {...props}>{children}</h3>,
  ul: ({ children, ...props }) => <ul className="list-disc ml-4 mb-2" {...props}>{children}</ul>,
  ol: ({ children, ...props }) => <ol className="list-decimal ml-4 mb-2" {...props}>{children}</ol>,
  li: ({ children, ...props }) => <li className="mb-1" {...props}>{children}</li>,
  a: ({ href, children, ...props }) => (
    <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2" {...props}>{children}</blockquote>
  ),
  code: ({ children, ...props }) => <code className="bg-gray-100 px-1 rounded" {...props}>{children}</code>,
  pre: ({ children, ...props }) => <pre className="bg-gray-100 p-2 rounded my-2 overflow-x-auto" {...props}>{children}</pre>,
  em: ({ children, ...props }) => <em className="italic" {...props}>{children}</em>,
  strong: ({ children, ...props }) => <strong className="font-bold" {...props}>{children}</strong>,
};

const TweetCard = ({ tweet, onEdit, onSchedule, onPublish, setEditingTweet, className }: TweetCardProps & { className?: string }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(tweet.text);
    toast.success('Tweet copied to clipboard');
  };

  const handleEdit = () => {
    setEditingTweet(tweet);
  };

  const wordCount = tweet.text.length;
  const createdAt = tweet.createdAt instanceof Timestamp ? tweet.createdAt.toDate() : new Date();

  return (
    <div className={cn(
      "bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors w-full flex flex-col min-w-0",
      className
    )}>
      <div className="flex items-start space-x-3 flex-grow min-w-0">
        <div className="h-10 w-10 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col h-full">
          {/* Header section */}
          <div className="flex items-center justify-between h-[60px] flex-wrap gap-2">
            <div className="flex items-center flex-wrap gap-1">
              <span className="font-bold text-gray-900 text-sm truncate">Your Name</span>
              <span className="text-gray-500 text-sm truncate">@your_handle</span>
              <span className="text-gray-500 text-sm">·</span>
              <span className="text-gray-500 text-sm truncate">{formatDistanceToNow(createdAt)}</span>
            </div>
            <span className={cn(
              "text-xs font-medium rounded-full px-2 py-1 whitespace-nowrap",
              wordCount > 240 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
            )}>
              {wordCount}/280
            </span>
          </div>
          
          {/* Content section */}
          <div className="mt-2 text-gray-900 break-words text-[15px] leading-normal prose prose-sm max-w-none flex-grow">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]} 
              components={markdownComponents}
            >
              {tweet.text}
            </ReactMarkdown>
          </div>
          
          {/* Image section */}
          {tweet.imageUrl && (
            <div className="mt-3 rounded-xl overflow-hidden relative">
              <div className="relative aspect-[1.91/1] max-h-[290px]">
                <img 
                  src={tweet.imageUrl} 
                  alt="Tweet media" 
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                  onLoad={() => console.log('Image loaded successfully:', tweet.imageUrl)}
                  onError={(e) => {
                    console.error('Image failed to load:', tweet.imageUrl);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Actions section - fixed height and proper alignment */}
          <div className="mt-3 flex items-center justify-end gap-1 pt-2 border-t border-gray-100">
            <Button variant="ghost" size="sm" onClick={handleCopy} className="text-gray-500 hover:text-blue-500">
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={handleEdit} className="text-gray-500 hover:text-blue-500">
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onSchedule} className="text-gray-500 hover:text-blue-500">
              <Calendar className="h-4 w-4 mr-1" />
              Schedule
            </Button>
            <Button variant="ghost" size="sm" onClick={onPublish} className="text-gray-500 hover:text-blue-500">
              <Send className="h-4 w-4 mr-1" />
              Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TweetFormData {
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

interface EditTweetModalProps {
  tweet: FirebaseTweet | null;
  onClose: () => void;
  onSave: (tweet: FirebaseTweet) => void;
  onGenerate: (options: ImageGenerationOptions) => Promise<void>;
  handleEditTweet: (tweet: FirebaseTweet) => Promise<void>;
  isOpen: boolean;
}

const EditTweetModal: React.FC<EditTweetModalProps> = ({ 
  tweet, 
  onClose, 
  onSave,
  onGenerate,
  handleEditTweet,
  isOpen
}) => {
  const [editingTweet, setEditingTweet] = useState<FirebaseTweet | null>(tweet);
  const [showAddImage, setShowAddImage] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [videoSummary, setVideoSummary] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | '16:9'>('1:1');
  const [style, setStyle] = useState<'Auto' | 'General' | 'Realistic' | 'Design' | 'Render 3D' | 'Anime'>('Auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');

  // Update local state when tweet prop changes
  useEffect(() => {
    setEditingTweet(tweet);
    setCustomPrompt(tweet?.imageMetadata?.prompt || '');
  }, [tweet]);

  // Reset image loading state when editingTweet changes
  useEffect(() => {
    if (editingTweet?.imageUrl) {
      setIsImageLoading(true);
    }
  }, [editingTweet?.imageUrl]);

  const handleTextChange = (text: string) => {
    if (!editingTweet) return;
    setEditingTweet({
      ...editingTweet,
      text,
      updatedAt: Timestamp.now()
    });
  };

  const handleSave = async () => {
    try {
      if (!editingTweet) return;
      await onSave(editingTweet);
      toast.success('Tweet saved successfully');
      onClose();
    } catch (error) {
      console.error('Error saving tweet:', error);
      toast.error('Failed to save tweet');
    }
  };

  const handleRegenerateImage = async () => {
    if (!editingTweet) return;
    setIsGeneratingImage(true);
    try {
      // Check user session and credits
      const session = await getSession() as Session | null;
      if (!session?.user?.id) {
        throw new Error('Please sign in to generate images');
      }

      // Check if user has enough credits for image generation
      const hasCredits = await FirebaseService.checkUserCredits(session.user.id);
      if (!hasCredits) {
        throw new Error('Insufficient credits to generate image');
      }

      // Get Firebase auth token
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Authentication failed');
      }

      // Generate image through API - directly using the custom prompt
      const response = await fetch(`${API_BASE_URL}/api/v1/content-sources/generate-image`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: customPrompt, // Directly use the custom prompt
          tweet_text: editingTweet.text,
          summary: editingTweet.text.substring(0, 100),
          aspect_ratio: editingTweet.imageMetadata?.aspectRatio as '1:1' | '9:16' | '16:9' || '1:1',
          style_type: editingTweet.imageMetadata?.styleType as 'Auto' | 'General' | 'Realistic' | 'Design' | 'Render 3D' | 'Anime' || 'Auto',
          magic_prompt_option: 'Auto',
          negative_prompt: undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Image generation error:', errorData);
        throw new Error('Failed to generate image');
      }
      
      const data = await response.json();
      console.log('Image generation response:', data);

      if (data.image_url) {
        // Download the generated image
        const imageResponse = await fetch(data.image_url);
        const imageBlob = await imageResponse.blob();

        // Create storage path
        const timestamp = Date.now();
        const storageRef = `projects/${editingTweet.projectId}/tweets/${editingTweet.id}/images/generated_${timestamp}.png`;
        const imageRef = ref(storage, storageRef);

        // Upload to Firebase Storage
        await uploadBytes(imageRef, imageBlob, {
          contentType: 'image/png',
          customMetadata: {
            uploadType: 'ai_generated',
            prompt: customPrompt, // Use the custom prompt in metadata
            aspectRatio: editingTweet.imageMetadata?.aspectRatio || '1:1',
            styleType: editingTweet.imageMetadata?.styleType || 'Auto'
          }
        });

        // Get the storage URL
        const imageUrl = await getDownloadURL(imageRef);

        // Deduct credits for image generation
        await FirebaseService.deductCredits(session.user.id, CREDIT_COSTS.generateImage, 'images');

        // Update tweet with new image
        const updatedTweet: FirebaseTweet = {
          ...editingTweet,
          imageUrl,
          imageMetadata: {
            prompt: customPrompt, // Use the custom prompt in tweet metadata
            aspectRatio: editingTweet.imageMetadata?.aspectRatio || '1:1',
            styleType: editingTweet.imageMetadata?.styleType || 'Auto',
            storageRef,
            uploadType: 'ai_generated'
          }
        };

        await handleEditTweet(updatedTweet);
        setEditingTweet(updatedTweet);
        toast.success('Image regenerated successfully with custom prompt');
      } else {
        throw new Error('No image URL in response');
      }
      setIsEditingPrompt(false);
    } catch (error) {
      console.error('Error regenerating image:', error);
      toast.error('Failed to regenerate image: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleImageGeneration = async (options: ImageGenerationOptions) => {
    try {
      setIsGeneratingImage(true);
      console.log('Generating image with options:', options);
      
      // Check user session and credits
      const session = await getSession() as Session | null;
      if (!session?.user?.id) {
        throw new Error('Please sign in to generate images');
      }

      // Check if user has enough credits for image generation
      const hasCredits = await FirebaseService.checkUserCredits(session.user.id);
      if (!hasCredits) {
        throw new Error('Insufficient credits to generate image');
      }

      // Get Firebase auth token
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Authentication failed');
      }

      // Generate image through API
      const response = await fetch(`${API_BASE_URL}/api/v1/content-sources/generate-image`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tweet_text: options.text,
          summary: options.summary,
          aspect_ratio: options.aspect_ratio,
          style_type: options.style_type,
          magic_prompt_option: options.magic_prompt_option,
          negative_prompt: options.negative_prompt
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Image generation error:', errorData);
        throw new Error('Failed to generate image');
      }
      
      const data = await response.json();
      console.log('Image generation response:', data);

      if (data.image_url && editingTweet) {
        // Download the generated image
        const imageResponse = await fetch(data.image_url);
        const imageBlob = await imageResponse.blob();

        // Create storage path
        const timestamp = Date.now();
        const storageRef = `projects/${editingTweet.projectId}/tweets/${editingTweet.id}/images/generated_${timestamp}.png`;
        const imageRef = ref(storage, storageRef);

        // Upload to Firebase Storage
        await uploadBytes(imageRef, imageBlob, {
          contentType: 'image/png',
          customMetadata: {
            uploadType: 'ai_generated',
            prompt: data.image_prompt,
            aspectRatio: options.aspect_ratio,
            styleType: options.style_type
          }
        });

        // Get the storage URL
        const imageUrl = await getDownloadURL(imageRef);

        // Deduct credits for image generation
        await FirebaseService.deductCredits(session.user.id, CREDIT_COSTS.generateImage, 'images');

        // Update tweet with new image
        const updatedTweet: FirebaseTweet = {
          ...editingTweet,
          imageUrl,
          imageMetadata: {
            prompt: data.image_prompt,
            aspectRatio: options.aspect_ratio,
            styleType: options.style_type,
            storageRef,
            uploadType: 'ai_generated'
          }
        };

        await handleEditTweet(updatedTweet);
        setEditingTweet(updatedTweet);
        toast.success('Image generated and saved successfully');
      } else {
        throw new Error('No image URL in response');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!editingTweet) return;
    setIsUploading(true);
    try {
      // Validate file size (2MB limit)
      const MAX_FILE_SIZE = 2 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        toast.error('Image size must be less than 2MB');
        return;
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
        return;
      }

      // Check user session
      const session = await getSession() as Session | null;
      if (!session?.user?.id) {
        toast.error('Please sign in to upload images');
        return;
      }

      // Check storage usage before upload
      await StorageUsageService.trackFileUpload(session.user.id, file.size);

      // Create storage path
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storageRef = `projects/${editingTweet.projectId}/tweets/${editingTweet.id}/images/upload_${timestamp}_${safeFileName}`;
      const imageRef = ref(storage, storageRef);

      // Upload to Firebase Storage with metadata
      await uploadBytes(imageRef, file, {
        contentType: file.type,
        customMetadata: {
          uploadType: 'user_upload',
          originalName: file.name,
          userId: session.user.id,
          projectId: editingTweet.projectId,
          tweetId: editingTweet.id,
          fileSize: file.size.toString()
        }
      });

      // Get the storage URL
      const imageUrl = await getDownloadURL(imageRef);

      // Create a clean version of the tweet for update
      const { imageMetadata: _, ...tweetWithoutImage } = editingTweet;
      
      const updatedTweet: FirebaseTweet = {
        ...tweetWithoutImage,
        imageUrl,
        imageMetadata: {
          uploadType: 'user_upload' as const,
          originalName: file.name,
          storageRef
        }
      };

      await handleEditTweet(updatedTweet);
      setEditingTweet(updatedTweet);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      if (error instanceof Error && error.message.includes('Storage limit exceeded')) {
        toast.error(error.message);
      } else {
        toast.error('Failed to upload image: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Add a function to handle image deletion
  const handleImageDelete = async (tweet: FirebaseTweet) => {
    if (!tweet.imageMetadata?.storageRef) return;
    
    try {
      const session = await getSession() as Session | null;
      if (!session?.user?.id) {
        toast.error('Please sign in to delete images');
        return;
      }

      // Get the file size before deletion
      const fileSize = await StorageUsageService.calculateFileSize(tweet.imageMetadata.storageRef);

      // Delete from storage
      const imageRef = ref(storage, tweet.imageMetadata.storageRef);
      await deleteObject(imageRef);

      // Update storage usage
      await StorageUsageService.trackFileDeletion(session.user.id, fileSize);

      // Update tweet
      const updatedTweet: FirebaseTweet = {
        ...tweet,
        imageUrl: undefined,
        imageMetadata: undefined
      };

      await handleEditTweet(updatedTweet);
      setEditingTweet(updatedTweet);
      toast.success('Image deleted successfully');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  if (!editingTweet) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 gap-0 bg-white max-h-[90vh] overflow-y-auto">
        <div className="border-b sticky top-0 bg-white z-10">
          <DialogHeader className="px-6 py-4">
            <DialogTitle className="text-xl font-bold">Edit Tweet</DialogTitle>
          </DialogHeader>
        </div>
        
        <div className="grid grid-cols-2">
          {/* Left side - Tweet Editor */}
          <div className="p-6">
            <div className="bg-white">
              <div className="flex items-start space-x-3">
                <div className="h-12 w-12 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1 mb-1">
                    <span className="font-bold text-gray-900">Your Name</span>
                    <span className="text-gray-500">@your_handle</span>
                  </div>
                  <Textarea
                    value={editingTweet.text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    className="w-full min-h-[100px] text-xl border-none focus:ring-0 resize-none"
                    placeholder="What's happening?"
                  />
                  {editingTweet.imageUrl && (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-xl overflow-hidden relative group">
                        {isImageLoading && (
                          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                          </div>
                        )}
                        <img 
                          src={editingTweet.imageUrl} 
                          alt="Tweet media" 
                          className="w-full h-auto"
                          onLoad={() => {
                            console.log('Image loaded successfully:', editingTweet.imageUrl);
                            setIsImageLoading(false);
                          }}
                          onError={(e) => {
                            console.error('Image failed to load:', editingTweet.imageUrl);
                            setIsImageLoading(false);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        {(isGeneratingImage || isUploading) && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setEditingTweet({ ...editingTweet, imageUrl: undefined, imageMetadata: undefined })}
                            disabled={isGeneratingImage || isUploading}
                          >
                            Remove Image
                          </Button>
                        </div>
                      </div>

                      {/* Image Prompt Section - Updated to make prompt directly editable */}
                      <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <Label>Image Generation Prompt</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsEditingPrompt(!isEditingPrompt);
                              if (!isEditingPrompt) {
                                setCustomPrompt(editingTweet.imageMetadata?.prompt || '');
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {isEditingPrompt ? 'Cancel Edit' : 'Edit Prompt'}
                          </Button>
                        </div>
                        {isEditingPrompt ? (
                          <div className="space-y-2">
                            <Textarea
                              value={customPrompt}
                              onChange={(e) => setCustomPrompt(e.target.value)}
                              placeholder="Edit the prompt for image generation..."
                              className="min-h-[100px] mt-2"
                              disabled={isGeneratingImage}
                              autoFocus
                            />
                            <Button
                              onClick={handleRegenerateImage}
                              disabled={isGeneratingImage || !customPrompt.trim()}
                              className="w-full"
                            >
                              {isGeneratingImage ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Regenerating Image...
                                </>
                              ) : (
                                <>
                                  <Wand2 className="h-4 w-4 mr-2" />
                                  Regenerate with New Prompt
                                </>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 whitespace-pre-wrap mt-2 p-2 rounded bg-white">
                            {editingTweet.imageMetadata?.prompt || 'No prompt available'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddImage(true)}
                      disabled={!!editingTweet.imageUrl}
                    >
                      <ImagePlus className="h-4 w-4 mr-2" />
                      Add Image
                    </Button>
                    <span className={cn(
                      "text-sm font-medium",
                      editingTweet.text.length > 240 ? "text-red-500" : "text-gray-500"
                    )}>
                      {editingTweet.text.length}/280
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Preview */}
          <div className="border-l p-6 bg-gray-50">
            <h3 className="font-semibold mb-4">Tweet Preview</h3>
            <TweetCard
              tweet={editingTweet}
              onEdit={() => {}}
              onSchedule={() => {}}
              onPublish={() => {}}
              setEditingTweet={() => {}}
              className="h-full"
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t sticky bottom-0 bg-white z-10">
          <div className="flex justify-between w-full">
            <Button variant="destructive" onClick={() => {
              if (window.confirm('Are you sure you want to delete this tweet?')) {
                onSave({ ...editingTweet, status: 'draft' });
                onClose();
              }
            }}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <div className="space-x-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </div>
        </DialogFooter>

        {/* Add Image Dialog */}
        <AddImageDialog
          isOpen={showAddImage}
          onClose={() => setShowAddImage(false)}
          onUpload={handleImageUpload}
          onGenerate={handleImageGeneration}
          defaultValues={editingTweet?.imageMetadata}
          tweet={editingTweet}
        />
      </DialogContent>
    </Dialog>
  );
};

interface AddImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  onGenerate: (options: ImageGenerationOptions) => Promise<{ image_prompt?: string } | void>;
  defaultValues?: {
    prompt?: string | null;
    aspectRatio?: string | null;
    styleType?: string | null;
    storageRef?: string;
    uploadType?: 'ai_generated' | 'user_upload';
    originalName?: string;
  } | null;
  tweet: FirebaseTweet;
}

const AddImageDialog = ({ 
  isOpen, 
  onClose, 
  onUpload, 
  onGenerate, 
  defaultValues,
  tweet 
}: AddImageDialogProps) => {
  const [method, setMethod] = useState<'upload' | 'generate'>('upload');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<ImageGenerationOptions['aspect_ratio']>(
    (defaultValues?.aspectRatio as ImageGenerationOptions['aspect_ratio']) || "1:1"
  );
  const [style, setStyle] = useState<ImageGenerationOptions['style_type']>(
    (defaultValues?.styleType as ImageGenerationOptions['style_type']) || "Auto"
  );
  const [generatedPrompt, setGeneratedPrompt] = useState<string>(defaultValues?.prompt || '');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string>(defaultValues?.prompt || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset states when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setGeneratedPrompt(defaultValues?.prompt || '');
      setCustomPrompt(defaultValues?.prompt || '');
      setIsEditingPrompt(false);
    }
  }, [isOpen, defaultValues?.prompt]);

  const handleGenerate = async () => {
    if (!tweet) return;
    
    setIsGenerating(true);
    try {
      const response = await onGenerate({
        prompt: customPrompt || generatedPrompt || '',
        text: tweet.text,
        summary: tweet.text.substring(0, 100),
        aspect_ratio: aspectRatio,
        style_type: style,
        magic_prompt_option: 'Auto',
        negative_prompt: undefined
      });
      
      // Update the generated prompt if we get a new one from the API
      if (response?.image_prompt) {
        setGeneratedPrompt(response.image_prompt);
        setCustomPrompt(response.image_prompt);
      }
      
      onClose();
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Image</DialogTitle>
          <DialogDescription>
            Choose whether to upload an image or generate one using AI
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant={method === 'upload' ? 'default' : 'outline'}
              onClick={() => setMethod('upload')}
              className="flex-1"
              disabled={isGenerating}
            >
              Upload Image
            </Button>
            <Button
              variant={method === 'generate' ? 'default' : 'outline'}
              onClick={() => setMethod('generate')}
              className="flex-1"
              disabled={isGenerating}
            >
              Generate with AI
            </Button>
          </div>

          {method === 'upload' && (
            <div className="space-y-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                disabled={isGenerating}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>
          )}

          {method === 'generate' && (
            <div className="space-y-4">
              {/* Prompt Section */}
              {generatedPrompt && (
                <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label>AI Generated Prompt</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {isEditingPrompt ? 'Cancel Edit' : 'Edit Prompt'}
                    </Button>
                  </div>
                  {isEditingPrompt ? (
                    <Textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Edit the prompt for image generation..."
                      className="min-h-[100px] mt-2"
                      disabled={isGenerating}
                    />
                  ) : (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap mt-2">{generatedPrompt}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select 
                  value={aspectRatio} 
                  onValueChange={(value: ImageGenerationOptions['aspect_ratio']) => setAspectRatio(value)}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select aspect ratio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">Square (1:1)</SelectItem>
                    <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                    <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Image Style</Label>
                <Select 
                  value={style} 
                  onValueChange={(value) => setStyle(value as ImageGenerationOptions['style_type'])}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Auto">Auto (Recommended)</SelectItem>
                    <SelectItem value="General">General</SelectItem>
                    <SelectItem value="Realistic">Realistic</SelectItem>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Render 3D">3D Render</SelectItem>
                    <SelectItem value="Anime">Anime</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">Choose a style that best matches your content</p>
              </div>

              <Button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Image...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    {isEditingPrompt ? 'Generate with Custom Prompt' : 'Generate Image'}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function CreateContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [contentType, setContentType] = useState<'short' | 'long' | 'thread' | 'quote' | 'poll'>('short');
  const [numberOfTweets, setNumberOfTweets] = useState(1);
  const [debouncedNumberOfTweets, setDebouncedNumberOfTweets] = useState(1);
  const [isNumberOfTweetsValid, setIsNumberOfTweetsValid] = useState(true);
  const [additionalContext, setAdditionalContext] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTweet, setEditingTweet] = useState<FirebaseTweet | null>(null);
  const [tweets, setTweets] = useState<FirebaseTweet[]>([]);
  const [projectId, setProjectId] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [videoSummary, setVideoSummary] = useState<string>('');
  const [fullTranscript, setFullTranscript] = useState<string>('');

  const { data: sessionData } = useSession();
  const { selectedWorkspace: workspaceData } = useWorkspace();

  const steps = [
    {
      number: 1,
      title: 'Define Source',
      description: 'Choose your content source and input your content to generate Twitter posts.',
    },
    {
      number: 2,
      title: 'Generate Content',
      description: 'Review and edit the AI-generated Twitter posts to match your voice.',
    },
    {
      number: 3,
      title: 'Review & Publish',
      description: 'Schedule and publish your content to Twitter.',
    },
  ];

  const contentSources = [
    {
      id: 'youtube',
      title: 'YouTube Video',
      description: 'Convert YouTube video content to Twitter posts',
      icon: Youtube,
    },
    {
      id: 'blog',
      title: 'Blog/Article URL',
      description: 'Convert web article content to Twitter posts',
      icon: Link2,
    },
    {
      id: 'audio',
      title: 'Audio File',
      description: 'Convert audio content to Twitter posts',
      icon: Headphones,
    },
    {
      id: 'image',
      title: 'Image',
      description: 'Generate Twitter posts from images',
      icon: ImageIcon,
    },
    {
      id: 'document',
      title: 'Document',
      description: 'Convert document content to Twitter posts',
      icon: FileUp,
    },
    {
      id: 'custom',
      title: 'Custom Text',
      description: 'Write your own text to generate Twitter posts',
      icon: FileText,
    },
  ];

  const handleSourceSelect = (sourceId: string) => {
    setSelectedSource(sourceId);
    if (sourceId === 'image') {
      setSourceUrl(''); // Reset source URL when switching to image
      toast.info('Please upload an image in the next step');
    }
    setCurrentStep(2);
  };

  const handleBack = () => {
    setSelectedSource('');
    setCurrentStep(1);
    setSourceUrl('');
    setAdditionalContext('');
    setContentType('short');
    setNumberOfTweets(1);
    setIsPremium(false);
    setTweets([]);
  };

  // Add debounce effect for number of tweets
  useEffect(() => {
    const timer = setTimeout(() => {
      const parsedValue = parseInt(numberOfTweets.toString());
      if (!isNaN(parsedValue) && parsedValue >= 1 && parsedValue <= 10) {
        setDebouncedNumberOfTweets(parsedValue);
        setIsNumberOfTweetsValid(true);
      } else {
        setIsNumberOfTweetsValid(false);
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [numberOfTweets]);

  const isFormValid = () => {
    return projectName.trim() !== '' && 
           sourceUrl.trim() !== '' && 
           ['short', 'long', 'thread', 'quote', 'poll'].includes(contentType) &&
           isNumberOfTweetsValid &&
           debouncedNumberOfTweets >= 1;
  };

  const handleImageGeneration = async (options: ImageGenerationOptions): Promise<void> => {
    try {
      setIsGeneratingImage(true);
      console.log('Generating image with options:', options);
      
      // Check user session and credits
      const session = await getSession() as Session | null;
      if (!session?.user?.id) {
        throw new Error('Please sign in to generate images');
      }

      // Check if user has enough credits for image generation
      const hasCredits = await FirebaseService.checkUserCredits(session.user.id);
      if (!hasCredits) {
        throw new Error('Insufficient credits to generate image');
      }

      // Get Firebase auth token
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Authentication failed');
      }

      // Generate image through API
      const response = await fetch(`${API_BASE_URL}/api/v1/content-sources/generate-image`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tweet_text: options.text,
          summary: options.summary,
          aspect_ratio: options.aspect_ratio,
          style_type: options.style_type,
          magic_prompt_option: options.magic_prompt_option,
          negative_prompt: options.negative_prompt
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Image generation error:', errorData);
        throw new Error('Failed to generate image');
      }
      
      const data = await response.json();
      console.log('Image generation response:', data);

      if (data.image_url && editingTweet) {
        // Download the generated image
        const imageResponse = await fetch(data.image_url);
        const imageBlob = await imageResponse.blob();

        // Create storage path
        const timestamp = Date.now();
        const storageRef = `projects/${editingTweet.projectId}/tweets/${editingTweet.id}/images/generated_${timestamp}.png`;
        const imageRef = ref(storage, storageRef);

        // Upload to Firebase Storage
        await uploadBytes(imageRef, imageBlob, {
          contentType: 'image/png',
          customMetadata: {
            uploadType: 'ai_generated',
            prompt: data.image_prompt,
            aspectRatio: options.aspect_ratio,
            styleType: options.style_type
          }
        });

        // Get the storage URL
        const imageUrl = await getDownloadURL(imageRef);

        // Deduct credits for image generation
        await FirebaseService.deductCredits(session.user.id, CREDIT_COSTS.generateImage, 'images');

        // Update tweet with new image
        const updatedTweet: FirebaseTweet = {
          ...editingTweet,
          imageUrl,
          imageMetadata: {
            prompt: data.image_prompt,
            aspectRatio: options.aspect_ratio,
            styleType: options.style_type,
            storageRef,
            uploadType: 'ai_generated'
          }
        };

        await handleEditTweet(updatedTweet);
        setEditingTweet(updatedTweet);
        toast.success('Image generated and saved successfully');
      } else {
        throw new Error('No image URL in response');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!editingTweet) return;
    try {
      // Validate file size (2MB limit)
      const MAX_FILE_SIZE = 2 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        toast.error('Image size must be less than 2MB');
        return;
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
        return;
      }

      // Check user session
      const session = await getSession() as Session | null;
      if (!session?.user?.id) {
        toast.error('Please sign in to upload images');
        return;
      }

      // Check storage usage before upload
      await StorageUsageService.trackFileUpload(session.user.id, file.size);

      // Create storage path
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storageRef = `projects/${editingTweet.projectId}/tweets/${editingTweet.id}/images/upload_${timestamp}_${safeFileName}`;
      const imageRef = ref(storage, storageRef);

      // Upload to Firebase Storage with metadata
      await uploadBytes(imageRef, file, {
        contentType: file.type,
        customMetadata: {
          uploadType: 'user_upload',
          originalName: file.name,
          userId: session.user.id,
          projectId: editingTweet.projectId,
          tweetId: editingTweet.id,
          fileSize: file.size.toString()
        }
      });

      // Get the storage URL
      const imageUrl = await getDownloadURL(imageRef);

      // Create a clean version of the tweet for update
      const { imageMetadata: _, ...tweetWithoutImage } = editingTweet;
      
      const updatedTweet: FirebaseTweet = {
        ...tweetWithoutImage,
        imageUrl,
        imageMetadata: {
          uploadType: 'user_upload' as const,
          originalName: file.name,
          storageRef
        }
      };

      await handleEditTweet(updatedTweet);
      setEditingTweet(updatedTweet);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      if (error instanceof Error && error.message.includes('Storage limit exceeded')) {
        toast.error(error.message);
      } else {
        toast.error('Failed to upload image: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  };

  const handleImageDelete = async (tweet: FirebaseTweet) => {
    if (!tweet.imageMetadata?.storageRef) return;
    
    try {
      const session = await getSession() as Session | null;
      if (!session?.user?.id) {
        toast.error('Please sign in to delete images');
        return;
      }

      // Get the file size before deletion
      const fileSize = await StorageUsageService.calculateFileSize(tweet.imageMetadata.storageRef);

      // Delete from storage
      const imageRef = ref(storage, tweet.imageMetadata.storageRef);
      await deleteObject(imageRef);

      // Update storage usage
      await StorageUsageService.trackFileDeletion(session.user.id, fileSize);

      // Update tweet
      const updatedTweet: FirebaseTweet = {
        ...tweet,
        imageUrl: undefined,
        imageMetadata: undefined
      };

      await handleEditTweet(updatedTweet);
      setEditingTweet(updatedTweet);
      toast.success('Image deleted successfully');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const convertGeneratedTweetToFirebaseTweet = (
    tweet: GeneratedTweetDetails,
    projectId: string,
    userId: string,
    isPremium: boolean
  ): FirebaseTweet => {
    const now = Timestamp.now();
    return {
      id: uuidv4(),
      projectId,
      userId,
      contentId: '',
      text: tweet.text || '',
      isThread: tweet.isThread || false,
      threadPosition: tweet.threadPosition,
      status: 'draft',
      imageUrl: tweet.imageUrl,
      imageMetadata: tweet.imageMetadata ? {
        prompt: tweet.imageMetadata.prompt,
        aspectRatio: tweet.imageMetadata.aspectRatio,
        styleType: tweet.imageMetadata.styleType,
        storageRef: tweet.imageMetadata.storageRef || '',
        uploadType: 'ai_generated' as const,
        originalName: ''
      } : undefined,
      isPremiumContent: isPremium,
      createdAt: now,
      updatedAt: now
    };
  };

  const handleGenerateContent = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setVideoSummary('');
      setFullTranscript('');

      const session = await getSession() as Session | null;
      if (!session?.user?.id) {
        toast.error('Please sign in to continue');
        return;
      }

      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast.error('Authentication failed');
        return;
      }

      const userId = session.user.id;
      const workspaceId = workspaceData?.id;

      // Create project first
      if (!projectName) {
        toast.error('Please enter a project name');
        return;
      }

      const projectRef = doc(collection(db, 'projects'));
      const newProjectId = projectRef.id;

      await setDoc(projectRef, {
        id: newProjectId,
        workspaceId,
        userId,
        name: projectName,
        description: projectDescription,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setProjectId(newProjectId);

      // Prepare content generation request
      const contentRequest: ContentGenerationRequest = {
        url: sourceUrl,
        content_type: contentType,
        num_tweets: numberOfTweets,
        additional_context: additionalContext,
        generate_image: false,
        is_premium: isPremium,
        project_id: newProjectId,
        workspace_id: workspaceId || '',
        user_id: userId
      };

      // Track usage first
      const usageTracked = await FirebaseService.trackUsage(
        userId,
        selectedSource,
        contentRequest,
        token
      );

      if (!usageTracked) {
        throw new Error('Failed to track usage. Please check your credits and try again.');
      }

      // Get the appropriate endpoint
      const endpoint = FirebaseService.getEndpointForContentType(selectedSource);
      
      // Make the API call to generate content
      const response = await fetch(
        `${API_BASE_URL}/api/v1/content-sources/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(contentRequest)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate content: ${errorText}`);
      }

      const data = await response.json();
      console.log('Generated tweets response:', data);

      // Store video summary and transcript if available
      if (data.video_summary) {
        setVideoSummary(data.video_summary);
      }
      if (data.full_transcript) {
        setFullTranscript(data.full_transcript);
      }

      // Create Firestore document references first
      const tweetRefs = data.generated_tweets.map(() => doc(collection(db, 'projects', newProjectId, 'tweets')));

      // Map the generated tweets to FirebaseTweet format using the pre-generated document IDs
      const formattedTweets: FirebaseTweet[] = data.generated_tweets.map((tweet: any, index: number) => {
        const tweetRef = tweetRefs[index];
        const tweetText = tweet.tweet_text || tweet.text || '';
        
        // Create a clean tweet object without undefined values
        const tweetData: FirebaseTweet = {
          id: tweetRef.id,
          projectId: newProjectId,
          userId,
          contentId: '',
          text: tweetText,
          isThread: Boolean(tweet.is_thread || tweet.isThread),
          threadPosition: tweet.thread_position || tweet.threadPosition || index + 1,
          status: 'draft',
          isPremiumContent: isPremium,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        // Only add optional fields if they exist and are not null/undefined
        if (tweet.image_url || tweet.imageUrl) {
          tweetData.imageUrl = tweet.image_url || tweet.imageUrl;
        }

        if (tweet.image_metadata || tweet.imageMetadata) {
          const metadata = tweet.image_metadata || tweet.imageMetadata;
          tweetData.imageMetadata = {
            prompt: metadata.prompt || null,
            aspectRatio: metadata.aspectRatio || null,
            styleType: metadata.styleType || null,
            storageRef: metadata.storageRef || null,
            uploadType: metadata.uploadType || 'ai_generated',
            originalName: metadata.originalName || null
          };
        }

        return tweetData;
      });

      console.log('Formatted tweets:', formattedTweets);

      // Store tweets in Firestore using the pre-generated document references
      await Promise.all(formattedTweets.map((tweet, index) => {
        // Create a clean version of the tweet for Firestore
        const firestoreData = Object.entries(tweet).reduce((acc, [key, value]) => {
          if (value !== undefined) {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, any>);
        
        return setDoc(tweetRefs[index], firestoreData);
      }));

      // Update local state with the formatted tweets
      setTweets(formattedTweets);
      setCurrentStep(3);
      toast.success('Content generated successfully!');
    } catch (error) {
      console.error('Error generating content:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate content');
      toast.error(error instanceof Error ? error.message : 'Failed to generate content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTweet = async (editedTweet: FirebaseTweet) => {
    try {
      if (!editedTweet.projectId || !editedTweet.id) {
        console.error('Missing projectId or tweetId:', editedTweet);
        toast.error('Invalid tweet data');
        return;
      }

      console.log('Updating tweet:', { 
        projectId: editedTweet.projectId, 
        tweetId: editedTweet.id, 
        editedTweet 
      });
      
      // Update Firestore using the existing tweet ID
      const tweetDocRef = doc(db, 'projects', editedTweet.projectId, 'tweets', editedTweet.id);
      
      // Create a clean update object without undefined values
      const updateData = {
        text: editedTweet.text,
        isThread: editedTweet.isThread,
        threadPosition: editedTweet.threadPosition,
        status: editedTweet.status,
        imageUrl: editedTweet.imageUrl || null,
        imageMetadata: editedTweet.imageMetadata || null,
        isPremiumContent: editedTweet.isPremiumContent,
        updatedAt: Timestamp.now()
      };

      await updateDoc(tweetDocRef, updateData);
      
      // Update UI state
      setTweets(prevTweets => 
        prevTweets.map(t => t.id === editedTweet.id ? editedTweet : t)
      );
      
      toast.success('Tweet updated successfully');
    } catch (error) {
      console.error('Error updating tweet:', error);
      toast.error('Failed to update tweet');
    }
  };

  const handleScheduleTweet = (tweet: FirebaseTweet) => {
    // Implement scheduling logic
    console.log('Schedule tweet:', tweet);
  };

  const handlePublishTweet = (tweet: FirebaseTweet) => {
    // Implement publishing logic
    console.log('Publish tweet:', tweet);
  };

  const renderSourceInput = () => {
    if (!selectedSource) return null;

    return (
      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleBack} className="p-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold">Enter Source Details</h3>
        </div>
        
        <div className="space-y-8">
          {/* Project Details */}
          <div className="space-y-6">
            <div>
              <Label htmlFor="projectName" className="text-base flex items-center gap-1 mb-3">
                Project Name
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="projectName"
                placeholder="Enter a name for your project (e.g., Product Launch Campaign)"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className={cn(
                  "bg-white border-gray-300 focus:border-blue-500",
                  !projectName.trim() && "border-red-300 focus:border-red-500"
                )}
              />
              {!projectName.trim() && (
                <p className="text-sm text-red-500 mt-1">Project name is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="projectDescription" className="text-base mb-3 block">Project Description</Label>
              <Textarea
                id="projectDescription"
                placeholder="Describe your project's goals and content strategy"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={3}
                className="bg-white border-gray-300 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Source URL */}
          <div>
            <Label htmlFor="url" className="text-base flex items-center gap-1 mb-3">
              Source URL
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="url"
              placeholder="Enter source URL"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className={cn(
                "bg-white border-gray-300 focus:border-blue-500",
                !sourceUrl.trim() && "border-red-300 focus:border-red-500"
              )}
              required
            />
            {!sourceUrl.trim() && (
              <p className="text-sm text-red-500 mt-1">URL is required</p>
            )}
          </div>

          {/* Content Type and Number of Tweets */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <Label htmlFor="contentType" className="text-base flex items-center gap-1 mb-3">
                Content Type
                <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={contentType}
                onValueChange={(value) => setContentType(value as 'short' | 'long' | 'thread' | 'quote' | 'poll')}
              >
                <SelectTrigger id="contentType" className="bg-white">
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short Tweet</SelectItem>
                  <SelectItem value="long">Long Tweet</SelectItem>
                  <SelectItem value="thread">Thread</SelectItem>
                  <SelectItem value="quote">Quote Tweet</SelectItem>
                  <SelectItem value="poll">Poll</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="numberOfTweets" className="text-base flex items-center gap-1 mb-3">
                Number of Tweets
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="numberOfTweets"
                type="number"
                min={1}
                max={10}
                value={numberOfTweets}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty value during typing
                  if (value === '') {
                    setNumberOfTweets(value as any);
                    return;
                  }
                  const numValue = parseInt(value);
                  if (!isNaN(numValue)) {
                    setNumberOfTweets(numValue);
                  }
                }}
                className={cn(
                  "bg-white border-gray-300 focus:border-blue-500",
                  !isNumberOfTweetsValid && "border-red-300 focus:border-red-500"
                )}
              />
              <div className="mt-1">
                <p className="text-sm text-gray-500">
                  Number of tweets to generate (1-10)
                </p>
                {!isNumberOfTweetsValid && (
                  <p className="text-sm text-red-500 mt-1">
                    Please enter a number between 1 and 10
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Additional Context */}
          <div>
            <Label htmlFor="additionalContext" className="text-base mb-3 block">Additional Context (Optional)</Label>
            <Textarea
              id="additionalContext"
              placeholder="Add any specific instructions or context for content generation..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={4}
              className="bg-white border-gray-300 focus:border-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Provide any additional instructions to guide the content generation
            </p>
          </div>

          {/* Premium Mode Toggle */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="premium-mode" className="text-base font-medium">Premium Mode</Label>
                <p className="text-sm text-gray-600">Enable advanced features and longer content generation</p>
              </div>
              <Switch
                id="premium-mode"
                checked={isPremium}
                onCheckedChange={setIsPremium}
              />
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleGenerateContent}
              disabled={isLoading || !isFormValid()}
              className="gap-2 min-w-[200px]"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5" />
                  Generate Content
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderVideoContent = () => {
    if (!videoSummary && !fullTranscript) return null;

    return (
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h4 className="text-lg font-semibold mb-4">Video Summary</h4>
          <div className="h-[300px] overflow-y-auto prose prose-sm max-w-none">
            {videoSummary || 'No summary available'}
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h4 className="text-lg font-semibold mb-4">Video Transcript</h4>
          <div className="h-[300px] overflow-y-auto prose prose-sm max-w-none whitespace-pre-wrap">
            {fullTranscript || 'No transcript available'}
          </div>
        </div>
      </div>
    );
  };

  const renderGeneratedContent = () => {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setCurrentStep(2)} className="p-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold">Review Generated Content</h3>
        </div>
        
        {renderVideoContent()}
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
          {tweets.map((tweet) => (
            <div key={tweet.id} className="w-full">
              <TweetCard
                tweet={tweet}
                onEdit={handleEditTweet}
                onSchedule={() => handleScheduleTweet(tweet)}
                onPublish={() => handlePublishTweet(tweet)}
                setEditingTweet={setEditingTweet}
                className="h-full"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Create Content with AI</h1>
              <p className="text-gray-500">Transform your content into engaging social media posts in three simple steps.</p>
            </div>
            <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Home className="h-6 w-6 text-gray-600" />
            </Link>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((step) => (
              <Card
                key={step.number}
                className={cn(
                  "p-6 transition-all duration-200 hover:shadow-md border-gray-200",
                  currentStep === step.number
                    ? "ring-2 ring-blue-500 shadow-lg bg-blue-50"
                    : currentStep > step.number
                    ? "bg-gray-50"
                    : "bg-white shadow-sm hover:border-blue-200"
                )}
              >
                <div className={cn(
                  "text-sm font-medium",
                  currentStep === step.number ? "text-blue-600" : "text-gray-500"
                )}>
                  Step {step.number}
                </div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.description}</p>
              </Card>
            ))}
          </div>

          {/* Content based on current step */}
          {currentStep === 1 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Select Content Source</h3>
              <p className="text-gray-500 mb-6">Choose the type of content you want to convert to Twitter posts</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contentSources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => handleSourceSelect(source.id)}
                    className="flex flex-col p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left bg-white shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-blue-50">
                        <source.icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <h4 className="font-medium">{source.title}</h4>
                    </div>
                    <p className="text-sm text-gray-500">{source.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && renderSourceInput()}
          {currentStep === 3 && renderGeneratedContent()}

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 p-4 mt-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Tweet Modal */}
        {editingTweet && (
          <EditTweetModal
            tweet={editingTweet}
            onClose={() => setEditingTweet(null)}
            onSave={handleEditTweet}
            onGenerate={handleImageGeneration}
            handleEditTweet={handleEditTweet}
            isOpen={!!editingTweet}
          />
        )}
      </div>
    </DashboardLayout>
  );
} 