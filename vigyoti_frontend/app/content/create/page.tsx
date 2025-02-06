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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { EditProvider, useEdit } from "../../contexts/EditContext";
import { Tweet, Workspace } from '@/types/firebase';
import { Timestamp } from "firebase/firestore";
import { FirebaseService, ContentGenerationRequest } from "@/services/firebase";
import { getAuth } from "firebase/auth";
import { User } from "firebase/auth";
import { useSession } from 'next-auth/react';

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

interface GeneratedTweet {
  tweet_text: string;
  is_thread: boolean;
  thread_position?: number;
  image_url?: string;
  image_generation_details?: {
    prompt?: string;
    aspect_ratio?: string;
    style_type?: string;
    magic_prompt_option?: string;
  };
}

interface ContentGenerationResponse {
  generated_tweets: GeneratedTweet[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface TweetCardProps {
  tweet: Tweet;
  onEdit: (tweet: Tweet) => void;
  onSchedule: () => void;
  onPublish: () => void;
}

const TweetCard = ({ tweet, onEdit, onSchedule, onPublish }: TweetCardProps) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(tweet.text);
    toast.success('Tweet copied to clipboard');
  };

  const wordCount = tweet.text.length;
  const createdAt = tweet.createdAt instanceof Timestamp ? tweet.createdAt.toDate() : new Date();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start space-x-3">
        <div className="h-10 w-10 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <span className="font-bold text-gray-900">Your Name</span>
              <span className="text-gray-500">@your_handle</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-500">{formatDistanceToNow(createdAt)}</span>
            </div>
            <span className={cn(
              "text-sm font-medium rounded-full px-2 py-1",
              wordCount > 240 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
            )}>
              {wordCount}/280
            </span>
          </div>
          <div className="mt-2 text-gray-900 whitespace-pre-wrap">{tweet.text}</div>
          {tweet.imageUrl && (
            <div className="mt-3 rounded-xl overflow-hidden">
              <img 
                src={tweet.imageUrl} 
                alt="Tweet media" 
                className="w-full h-auto object-cover"
                onLoad={() => console.log('Image loaded successfully:', tweet.imageUrl)}
                onError={(e) => {
                  console.error('Image failed to load:', tweet.imageUrl);
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="mt-3 flex items-center justify-end space-x-2">
            <Button variant="ghost" size="sm" onClick={handleCopy} className="text-gray-500 hover:text-blue-500">
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(tweet)} className="text-gray-500 hover:text-blue-500">
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

interface EditTweetModalProps {
  isOpen: boolean;
  onClose: () => void;
  tweet: Tweet;
  videoSummary: string;
  onSave: (editedTweet: Tweet) => Promise<void>;
  onSchedule?: () => void;
  onPublish?: () => void;
  projectId: string;
  setGeneratedTweets?: React.Dispatch<React.SetStateAction<Tweet[]>>;
}

const EditTweetModal = ({ isOpen, onClose, tweet, videoSummary, onSave, onSchedule, onPublish, projectId, setGeneratedTweets }: EditTweetModalProps) => {
  const [editedTweet, setEditedTweet] = useState<Tweet>({
    id: tweet.id || uuidv4(),
    projectId: tweet.projectId,
    userId: tweet.userId,
    contentId: tweet.contentId || '',
    text: tweet.text,
    isThread: tweet.isThread || false,
    threadPosition: tweet.threadPosition,
    status: tweet.status || 'draft',
    imageUrl: tweet.imageUrl,
    imageMetadata: tweet.imageMetadata,
    createdAt: tweet.createdAt || Timestamp.now(),
    updatedAt: tweet.updatedAt || Timestamp.now()
  });
  const [showAddImage, setShowAddImage] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState(tweet.imageGenerationDetails?.prompt || '');
  const wordCount = editedTweet.text.length;

  const handleSave = async () => {
    try {
      await onSave(editedTweet);
      onClose();
      toast.success('Tweet saved successfully');
    } catch (error) {
      console.error('Error saving tweet:', error);
      toast.error('Failed to save tweet');
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this tweet?')) {
      onClose();
      // Mark as deleted by updating status
      onSave({ ...editedTweet, status: 'draft' });
    }
  };

  const handleImageUpload = async (file: File, tweet: Tweet) => {
    try {
      // Check file size (2MB limit per image)
      const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
      if (file.size > MAX_FILE_SIZE) {
        toast.error('Image size must be less than 2MB');
        return null;
      }

      // Check user's storage usage
      const session = await getSession() as Session | null;
      if (!session?.user?.id) {
        toast.error('Please sign in to upload images');
        return null;
      }

      const userDoc = await getDoc(doc(db, 'users', session.user.id));
      const userData = userDoc.data() as FirebaseUser;
      const currentStorageUsed = userData.usage?.storageUsed || 0;
      const storageLimit = 2; // 2GB limit

      if (currentStorageUsed >= storageLimit) {
        toast.error('Storage limit reached. Please delete some images or upgrade your plan.');
        return null;
      }

      // Calculate new storage usage
      const newStorageUsed = currentStorageUsed + (file.size / (1024 * 1024 * 1024)); // Convert bytes to GB

      if (newStorageUsed > storageLimit) {
        toast.error('This upload would exceed your storage limit');
        return null;
      }

      // Create storage reference with metadata
      const timestamp = Date.now();
      const imagePath = `users/${session.user.id}/projects/${tweet.projectId}/tweets/${tweet.id}/images/${timestamp}_${file.name}`;
      const imageRef = ref(storage, imagePath);

      // Add metadata
      const metadata = {
        contentType: file.type,
        customMetadata: {
          userId: session.user.id,
          projectId: tweet.projectId,
          tweetId: tweet.id,
          uploadType: 'user_upload',
          originalName: file.name
        }
      };

      // Upload file
      await uploadBytes(imageRef, file, metadata);
      const imageUrl = await getDownloadURL(imageRef);

      // Update user's storage usage
      await updateDoc(doc(db, 'users', session.user.id), {
        'usage.storageUsed': newStorageUsed,
        updatedAt: serverTimestamp()
      });

      return imageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
      return null;
    }
  };

  const handleImageUploadInModal = async (file: File) => {
    const imageUrl = await handleImageUpload(file, editedTweet);
    if (imageUrl) {
      setEditedTweet(prev => ({
        ...prev,
        imageUrl,
        imageMetadata: {
          ...prev.imageMetadata,
          uploadType: 'user_upload',
          originalName: file.name,
          uploadedAt: Timestamp.now()
        }
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 gap-0 bg-white">
        <div className="border-b">
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
                  <div className="text-gray-900 whitespace-pre-wrap text-xl">
                    {editedTweet.text}
                  </div>
                  {editedTweet.imageUrl && (
                    <div className="mt-4 rounded-xl overflow-hidden">
                      <img src={editedTweet.imageUrl} alt="Tweet media" className="w-full h-auto" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Image Dialog */}
        <AddImageDialog
          isOpen={showAddImage}
          onClose={() => setShowAddImage(false)}
          onUpload={handleImageUploadInModal}
          onGenerate={() => {}}
          defaultValues={editedTweet.imageMetadata}
        />
      </DialogContent>
    </Dialog>
  );
};

interface AddImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  onGenerate: (options: ImageGenerationOptions) => void;
  defaultValues?: {
    prompt?: string;
    aspect_ratio?: string;
    style_type?: string;
    magic_prompt_option?: string;
  } | null;
}

const AddImageDialog = ({ isOpen, onClose, onUpload, onGenerate, defaultValues }: AddImageDialogProps) => {
  const [method, setMethod] = useState<'upload' | 'generate'>('upload');
  const [aspectRatio, setAspectRatio] = useState<ImageGenerationOptions['aspect_ratio']>(
    (defaultValues?.aspect_ratio as ImageGenerationOptions['aspect_ratio']) || "1:1"
  );
  const [style, setStyle] = useState<ImageGenerationOptions['style_type']>(
    (defaultValues?.style_type as ImageGenerationOptions['style_type']) || "Auto"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get the tweet text and summary from the parent component's context
  const { editingTweet, videoSummary } = useEdit();

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
            >
              Upload Image
            </Button>
            <Button
              variant={method === 'generate' ? 'default' : 'outline'}
              onClick={() => setMethod('generate')}
              className="flex-1"
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
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>
          )}

          {method === 'generate' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={(value: ImageGenerationOptions['aspect_ratio']) => setAspectRatio(value)}>
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

              <Button onClick={() => {
                onGenerate({
                  prompt: '',
                  text: editingTweet?.text || '',
                  summary: videoSummary || '',
                  aspect_ratio: aspectRatio,
                  style_type: style,
                  magic_prompt_option: 'Auto',
                  negative_prompt: undefined
                });
                onClose();
              }}>
                Generate Image
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
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
  const [additionalContext, setAdditionalContext] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTweet, setEditingTweet] = useState<Tweet | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [projectId, setProjectId] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [session, setSession] = useState<Session | null>(null);

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

  const isFormValid = () => {
    return projectName.trim() !== '' && 
           sourceUrl.trim() !== '' && 
           ['short', 'long', 'thread', 'quote', 'poll'].includes(contentType) &&
           numberOfTweets > 0;
  };

  const handleImageGeneration = async (options: ImageGenerationOptions) => {
    try {
      setIsGeneratingImage(true);
      const response = await fetch(`${API_BASE_URL}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: options.prompt,
          summary: options.summary,
          aspect_ratio: options.aspect_ratio,
          style_type: options.style_type,
          magic_prompt_option: options.magic_prompt_option,
          negative_prompt: options.negative_prompt
        }),
      });

      if (!response.ok) throw new Error('Failed to generate image');
      
      const data = await response.json();
      return data.imageUrl || undefined;
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image');
      return undefined;
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const convertGeneratedTweetToFirebaseTweet = (
    tweet: GeneratedTweet,
    projectId: string,
    userId: string,
    isPremium: boolean
  ): Tweet => {
    const now = Timestamp.now();
    
    // Create the tweet object without optional fields first
    const tweetData: Tweet = {
      id: uuidv4(),
      projectId,
      userId,
      text: tweet.tweet_text,
      isThread: tweet.is_thread || false,
      status: 'draft',
      isPremiumContent: isPremium,
      createdAt: now,
      updatedAt: now
    };

    // Add optional fields only if they have values
    if (tweet.thread_position !== undefined) {
      tweetData.threadPosition = tweet.thread_position;
    }

    if (tweet.image_url) {
      tweetData.imageUrl = tweet.image_url;
    }

    if (tweet.image_generation_details) {
      tweetData.imageMetadata = {
        ...tweet.image_generation_details,
        generatedAt: now,
        type: 'ai_generated'
      };
    }

    return tweetData;
  };

  const handleGenerateContent = async () => {
    try {
      setIsLoading(true);
      setError(null);

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
        generate_image: false, // Set based on your UI
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
      
      // Prepare request body
      let requestBody: any;
      let headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // For file uploads (audio, image, document)
      if (contentRequest.file) {
        const formData = new FormData();
        formData.append('file', contentRequest.file);
        formData.append('content_type', contentRequest.content_type);
        formData.append('num_tweets', contentRequest.num_tweets.toString());
        if (contentRequest.additional_context) {
          formData.append('additional_context', contentRequest.additional_context);
        }
        formData.append('generate_image', contentRequest.generate_image.toString());
        formData.append('is_premium', contentRequest.is_premium.toString());
        requestBody = formData;
        delete headers['Content-Type'];
      } else {
        requestBody = JSON.stringify(contentRequest);
      }

      // Make the API call to generate content
      const response = await fetch(
        `${API_BASE_URL}/api/v1/content-sources/${endpoint}`,
        {
          method: 'POST',
          headers,
          body: requestBody
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate content: ${errorText}`);
      }

      const data = await response.json();
      console.log('Generated tweets response:', data);
      const generatedTweets = data.generated_tweets || [];

      // Convert generated tweets to Firebase Tweet format
      const firebaseTweets = generatedTweets.map(tweet => 
        convertGeneratedTweetToFirebaseTweet(
          tweet,
          newProjectId,
          userId,
          isPremium
        )
      );

      // Store tweets in Firestore
      if (firebaseTweets.length > 0) {
        const tweetIds = await FirebaseService.storeGeneratedTweets(
          newProjectId,
          userId,
          firebaseTweets
        );
        console.log('✅ Stored tweets with IDs:', tweetIds);
      }

      // Set tweets in state
      setTweets(firebaseTweets);
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

  const handleEditTweet = async (tweet: Tweet) => {
    try {
      if (!workspaceData) return;
      
      // Ensure we're using the Firebase Tweet interface properties
      const updatedTweet: Tweet = {
        ...tweet,
        updatedAt: Timestamp.now()
      };
      
      await FirebaseService.updateTweet(workspaceData.id, tweet.id, updatedTweet);
      toast.success('Tweet updated successfully');
      
      // Refresh tweets list
      const updatedTweets = await FirebaseService.getProjectTweets(workspaceData.id);
      setTweets(updatedTweets);
    } catch (error) {
      console.error('Error updating tweet:', error);
      toast.error('Failed to update tweet');
    }
  };

  const handleScheduleTweet = (tweet: Tweet) => {
    // Implement scheduling logic
    console.log('Schedule tweet:', tweet);
  };

  const handlePublishTweet = (tweet: Tweet) => {
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
                onChange={(e) => setNumberOfTweets(parseInt(e.target.value))}
                className={cn(
                  "bg-white border-gray-300 focus:border-blue-500",
                  numberOfTweets < 1 && "border-red-300 focus:border-red-500"
                )}
              />
              <p className="text-sm text-gray-500 mt-1">
                Number of tweets to generate (1-10)
              </p>
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
                <div className="space-y-2">
                  <div className={cn(
                    "text-sm font-medium",
                    currentStep === step.number ? "text-blue-600" : "text-gray-500"
                  )}>
                    Step {step.number}
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm text-gray-500">{step.description}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Content Source Selection or Source Input */}
          {currentStep === 1 ? (
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
          ) : (
            renderSourceInput()
          )}

          {/* Step 3: Review Generated Content */}
          {currentStep === 3 && (
            <div className="mt-8 space-y-6">
              <h2 className="text-2xl font-bold">Review Generated Content</h2>
              <div className="space-y-4">
                {tweets.map((tweet) => (
                  <TweetCard
                    key={tweet.id}
                    tweet={tweet}
                    onEdit={handleEditTweet}
                    onSchedule={() => handleScheduleTweet(tweet)}
                    onPublish={() => handlePublishTweet(tweet)}
                  />
                ))}
              </div>
            </div>
          )}

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
            isOpen={!!editingTweet}
            onClose={() => setEditingTweet(null)}
            tweet={editingTweet}
            videoSummary={''}
            onSave={handleEditTweet}
            projectId={projectName}
            setGeneratedTweets={setTweets}
          />
        )}
      </div>
    </DashboardLayout>
  );
} 