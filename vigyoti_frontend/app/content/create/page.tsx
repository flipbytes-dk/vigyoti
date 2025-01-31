'use client';

import { useState, useRef } from 'react';
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
import { Tweet, ImageGenerationOptions } from "../../types/tweet";
import { Timestamp } from "firebase/firestore";
import { FirebaseService } from "@/services/firebase";

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

interface ContentGenerationResponse {
  video_title?: string;
  video_summary?: string;
  full_transcript?: string;
  generated_tweets: Array<{
    tweet_text: string;
    is_thread: boolean;
    thread_position?: number;
    image_url?: string;
    is_premium_content: boolean;
  }>;
  metadata: Record<string, any>;
  cost_info: {
    input_tokens: number;
    output_tokens: number;
    input_cost: number;
    output_cost: number;
    total_cost: number;
  };
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
    navigator.clipboard.writeText(tweet.tweet_text);
    toast.success('Tweet copied to clipboard');
  };

  const wordCount = tweet.tweet_text.length;

  // Debug log when tweet or image URL changes
  console.log('TweetCard render:', { tweetId: tweet.id, imageUrl: tweet.image_url });

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
              <span className="text-gray-500">{formatDistanceToNow(new Date())}</span>
            </div>
            <span className={cn(
              "text-sm font-medium rounded-full px-2 py-1",
              wordCount > 240 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
            )}>
              {wordCount}/280
            </span>
          </div>
          <div className="mt-2 text-gray-900 whitespace-pre-wrap">{tweet.tweet_text}</div>
          {tweet.image_url && (
            <div className="mt-3 rounded-xl overflow-hidden">
              <img 
                src={tweet.image_url} 
                alt="Tweet media" 
                className="w-full h-auto object-cover"
                onLoad={() => console.log('Image loaded successfully:', tweet.image_url)}
                onError={(e) => {
                  console.error('Image failed to load:', tweet.image_url);
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
  videoSummary?: string;
  onSave: (tweet: Tweet) => void;
  onSchedule: () => void;
  onPublish: () => void;
  projectId: string;
  setGeneratedTweets: React.Dispatch<React.SetStateAction<Tweet[]>>;
}

const EditTweetModal = ({ isOpen, onClose, tweet, videoSummary, onSave, onSchedule, onPublish, projectId, setGeneratedTweets }: EditTweetModalProps) => {
  const [editedTweet, setEditedTweet] = useState<Tweet>({
    ...tweet,
    id: tweet.id || uuidv4(),
    is_thread: tweet.is_thread || false,
    is_premium_content: tweet.is_premium_content || false,
  });
  const [showAddImage, setShowAddImage] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState(tweet.image_generation_details?.prompt || '');
  const wordCount = editedTweet.tweet_text.length;

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
      // Notify parent about deletion
      onSave({ ...editedTweet, deleted: true });
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      // Here you would typically upload to your image storage service
      // For now, we'll create a local URL
      const imageUrl = URL.createObjectURL(file);
      setEditedTweet({ ...editedTweet, image_url: imageUrl });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    }
  };

  const handleImageGenerate = async (options: ImageGenerationOptions) => {
    try {
      setIsGeneratingImage(true);
      
      // Get user session
      const session = await getSession() as Session | null;
      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      const userId = session.user.id;

      // Make the API request with the correct parameters
      const response = await fetch(`${API_BASE_URL}/api/v1/content-sources/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: imagePrompt || '',
          negative_prompt: options.negative_prompt || '',
          tweet_text: editedTweet.tweet_text,
          summary: videoSummary || '',
          aspect_ratio: options.aspect_ratio || "1:1",
          style_type: options.style_type || "Auto",
          magic_prompt_option: options.magic_prompt_option || "Auto"
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();
      
      // Update the tweet with the generated image
      if (data.image_url) {
        setEditedTweet({
          ...editedTweet,
          image_url: data.image_url,
          image_generation_details: {
            prompt: imagePrompt,
            tweet_text: editedTweet.tweet_text,
            summary: videoSummary || '',
            aspect_ratio: options.aspect_ratio,
            style_type: options.style_type,
            magic_prompt_option: options.magic_prompt_option
          }
        });
      }

      toast.success('Image generated successfully');
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
      setShowAddImage(false);
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
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-gray-900">Your Name</span>
                      <span className="text-gray-500">@your_handle</span>
                    </div>
                    <span className={cn(
                      "text-sm font-medium rounded-full px-3 py-1",
                      wordCount > 240 ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {wordCount}/280
                    </span>
                  </div>
                  <div>
                    <Textarea
                      value={editedTweet.tweet_text}
                      onChange={(e) => setEditedTweet({ ...editedTweet, tweet_text: e.target.value })}
                      className="min-h-[150px] text-xl bg-transparent border-none focus:ring-0 p-0 resize-none"
                      placeholder="What's happening?"
                    />
                  </div>
                  {editedTweet.image_url && (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-xl overflow-hidden">
                        <img src={editedTweet.image_url} alt="Tweet media" className="w-full h-auto" />
                      </div>
                      {editedTweet.image_generation_details && (
                        <div className="space-y-2">
                          <Label>Image Generation Prompt</Label>
                          <Textarea
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            className="min-h-[100px] text-sm"
                            placeholder="Edit the image generation prompt..."
                          />
                          <p className="text-xs text-gray-500">
                            Edit the prompt above to customize the image generation. The image will be generated without any text or writing.
                          </p>
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAddImage(true)}
                              disabled={isGeneratingImage}
                            >
                              <Wand2 className="h-4 w-4 mr-2" />
                              {isGeneratingImage ? 'Regenerating...' : 'Regenerate Image'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 hover:bg-red-50 flex-1"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <Button variant="outline" size="sm" className="hover:bg-gray-50 flex-1">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Text
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="hover:bg-blue-50 flex-1">
                  <Wand2 className="h-4 w-4 mr-2" />
                  AI Rewrite
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="hover:bg-green-50 flex-1"
                  onClick={() => setShowAddImage(true)}
                  disabled={isGeneratingImage}
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {isGeneratingImage ? 'Generating...' : 'Add Image'}
                </Button>
              </div>
            </div>
          </div>

          {/* Right side - Preview */}
          <div className="border-l">
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Preview</h3>
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
                <div className="flex items-start space-x-3 p-4">
                  <div className="h-12 w-12 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1 mb-1">
                      <span className="font-bold text-gray-900">Your Name</span>
                      <span className="text-gray-500">@your_handle</span>
                    </div>
                    <div className="text-gray-900 whitespace-pre-wrap text-xl">
                      {editedTweet.tweet_text}
                    </div>
                    {editedTweet.image_url && (
                      <div className="mt-4 rounded-xl overflow-hidden">
                        <img src={editedTweet.image_url} alt="Tweet media" className="w-full h-auto" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-6 space-y-3">
              <Button variant="outline" onClick={handleSave} className="w-full hover:bg-blue-50">
                Save Changes
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onSchedule} className="hover:bg-purple-50 flex-1">
                  Schedule
                </Button>
                <Button variant="default" onClick={onPublish} className="bg-blue-600 hover:bg-blue-700 flex-1">
                  Publish
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Add Image Dialog */}
        <AddImageDialog
          isOpen={showAddImage}
          onClose={() => setShowAddImage(false)}
          onUpload={handleImageUpload}
          onGenerate={handleImageGenerate}
          defaultValues={editedTweet.image_generation_details}
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
    aspect_ratio: string;
    style_type: string;
    magic_prompt_option: string;
  };
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
                  prompt: '',  // The backend will generate this from tweet_text and summary
                  tweet_text: editingTweet?.tweet_text || '',
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

export default function CreateContentPage() {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [contentType, setContentType] = useState('short');
  const [numberOfTweets, setNumberOfTweets] = useState('1');
  const [isPremium, setIsPremium] = useState(false);
  const { selectedWorkspace } = useWorkspace();
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedTweets, setGeneratedTweets] = useState<Tweet[]>([]);
  const [videoSummary, setVideoSummary] = useState<string>('');
  const [videoTranscript, setVideoTranscript] = useState<string>('');
  const [editingTweet, setEditingTweet] = useState<Tweet | null>(null);
  const [projectId, setProjectId] = useState<string>('');

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

  const contentTypeOptions = [
    { value: "short", label: "Short Tweet" },
    { value: "long", label: "Long Tweet" },
    { value: "thread", label: "Thread" },
    { value: "poll", label: "Poll" },
    { value: "quote", label: "Quote" }
  ];

  const handleSourceSelect = (sourceId: string) => {
    setSelectedSource(sourceId);
    if (sourceId === 'image') {
      handleImageGenerate({
        prompt: '',
        tweet_text: '',
        summary: '',
        aspect_ratio: '1:1',
        style_type: 'Auto',
        magic_prompt_option: 'Default'
      });
    }
    setCurrentStep(2);
  };

  const handleBack = () => {
    setSelectedSource(null);
    setCurrentStep(1);
    setSourceUrl('');
    setAdditionalContext('');
    setContentType('short');
    setNumberOfTweets('1');
    setIsPremium(false);
    setVideoSummary('');
    setVideoTranscript('');
    setGeneratedTweets([]);
  };

  const isFormValid = () => {
    return projectName.trim() !== '' && 
           sourceUrl.trim() !== '' && 
           contentType !== '' &&
           (contentType === 'thread' ? parseInt(numberOfTweets) > 0 : true);
  };

  const handleContentTypeChange = (value: string) => {
    setContentType(value);
  };

  const handleGenerateContent = async () => {
    try {
      const session = await getSession() as Session | null;
      if (!session?.user?.id) {
        toast.error('Please sign in to continue');
        return;
      }

      // Check usage limits
      const canGenerate = await FirebaseService.trackUsage(session.user.id, 'post', 1);
      if (!canGenerate) {
        toast.error('You have reached your monthly post limit. Please upgrade your plan.');
        return;
      }

      // Create or get project
      let projectId = '';
      if (!projectName) {
        toast.error('Please enter a project name');
        return;
      }

      const projectRef = doc(collection(db, 'projects'));
      projectId = projectRef.id;

      await setDoc(projectRef, {
        id: projectId,
        workspaceId: selectedWorkspace?.id,
        userId: session.user.id,
        name: projectName,
        description: projectDescription,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Generate content and save tweets
      // ... existing content generation code ...

      // Save generated tweets to the project
      const tweetPromises = generatedTweets.map(tweet => 
        FirebaseService.createTweet(projectId, session.user.id, tweet)
      );

      await Promise.all(tweetPromises);

      // Track credit usage
      await FirebaseService.trackUsage(session.user.id, 'credit', 10); // Assuming 10 credits per generation

      setCurrentStep(3);
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error('Failed to generate content');
    }
  };

  const handleEditTweet = (tweetToEdit: Tweet) => {
    setEditingTweet(tweetToEdit);
  };

  const handleSaveEdit = async (editedTweet: Tweet) => {
    try {
      console.log('Starting save process...', editedTweet);
      setIsLoading(true);
      
      const session = await getSession();
      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }
      
      if (!selectedWorkspace?.id) {
        throw new Error('No workspace selected');
      }

      if (!projectId) {
        throw new Error('No project ID available');
      }

      console.log('Saving tweet to Firestore...', {
        projectId,
        workspaceId: selectedWorkspace.id,
        userId: session.user.id
      });

      // Create a new tweet document in Firestore
      const tweetRef = doc(db, 'tweets', editedTweet.id || uuidv4());
      const tweetData = {
        id: tweetRef.id,
        projectId: projectId,
        workspaceId: selectedWorkspace.id,
        userId: session.user.id,
        tweet_text: editedTweet.tweet_text,
        is_thread: editedTweet.is_thread,
        thread_position: editedTweet.thread_position,
        image_url: editedTweet.image_url,
        image_generation_details: editedTweet.image_generation_details || null,
        is_premium_content: editedTweet.is_premium_content,
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('Tweet data to save:', tweetData);

      // Save to Firestore
      await setDoc(tweetRef, tweetData);
      console.log('Tweet saved to Firestore');

      // If there's an image, save it to Storage
      if (editedTweet.image_url?.startsWith('data:')) {
        console.log('Saving image to Storage...');
        try {
          const imageBuffer = Buffer.from(editedTweet.image_url.split(',')[1], 'base64');
          const imageRef = ref(storage, `users/${session.user.id}/workspaces/${selectedWorkspace.id}/projects/${projectId}/images/${tweetRef.id}.png`);
          await uploadBytes(imageRef, imageBuffer);
          
          const imageUrl = await getDownloadURL(imageRef);
          console.log('Image saved to Storage:', imageUrl);
          
          // Update the tweet with the storage URL
          await updateDoc(tweetRef, {
            image_url: imageUrl,
          });
          
          // Create media document
          const mediaRef = doc(db, 'media', uuidv4());
          await setDoc(mediaRef, {
            id: mediaRef.id,
            projectId: projectId,
            workspaceId: selectedWorkspace.id,
            userId: session.user.id,
            type: 'image',
            url: imageUrl,
            storageRef: imageRef.fullPath,
            size: imageBuffer.length,
            metadata: {
              format: 'png'
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Update the tweet in state with the new image URL
          editedTweet.image_url = imageUrl;
        } catch (error) {
          console.error('Error saving image:', error);
          toast.error('Failed to save image');
        }
      }

      // Update the tweets state with the saved tweet
      setGeneratedTweets(prev => 
        prev.map(t => t.id === editedTweet.id ? editedTweet : t)
      );

      toast.success('Tweet saved successfully');
      setEditingTweet(null); // Close the modal after saving
    } catch (error) {
      console.error('Error saving tweet:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save tweet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleTweet = () => {
    // TODO: Implement schedule functionality
    console.log('Schedule tweet');
  };

  const handlePublishTweet = () => {
    // TODO: Implement publish functionality
    console.log('Publish tweet');
  };

  const renderSourceInput = () => {
    if (!selectedSource) return null;

    if (currentStep === 3) {
      return (
        <div className="space-y-8">
          {/* Video Summary and Transcript */}
          {(videoSummary || videoTranscript) && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Video Content Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    Summary
                  </h4>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 h-[200px] overflow-y-auto shadow-inner">
                    <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{videoSummary}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    Transcript
                  </h4>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 h-[200px] overflow-y-auto shadow-inner">
                    <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{videoTranscript}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Separator */}
          {generatedTweets.length > 0 && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gray-50 px-3 text-gray-500 text-sm">Generated Content</span>
              </div>
            </div>
          )}

          {/* Generated Tweets Display */}
          {generatedTweets.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Generated Tweets</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedTweets.map((tweet, index) => (
                  <TweetCard 
                    key={index} 
                    tweet={tweet}
                    onEdit={handleEditTweet}
                    onSchedule={handleScheduleTweet}
                    onPublish={handlePublishTweet}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleBack} className="p-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold">Enter Source Details</h3>
        </div>

        <div className="space-y-6">
          <div>
            <Label htmlFor="url" className="flex items-center gap-1 mb-2">
              YouTube URL
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="url"
              placeholder="Enter YouTube video URL"
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

          <div>
            <Label htmlFor="additionalContext" className="mb-2">Additional Context (Optional)</Label>
            <Textarea
              id="additionalContext"
              placeholder="Add any specific instructions or context for content generation..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={4}
              className="bg-white border-gray-300 focus:border-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">Provide any additional instructions to guide the content generation</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="contentType" className="flex items-center gap-1">
                Content Type
                <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={contentType} 
                onValueChange={handleContentTypeChange}
              >
                <SelectTrigger id="contentType" className="bg-white">
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent>
                  {contentTypeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">Choose how you want your content to be formatted</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numberOfTweets" className="flex items-center gap-1">
                Number of Tweets
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="numberOfTweets"
                type="number"
                min="1"
                max="10"
                value={numberOfTweets}
                onChange={(e) => setNumberOfTweets(e.target.value)}
                className={cn(
                  "bg-white border-gray-300 focus:border-blue-500",
                  !numberOfTweets && "border-red-300 focus:border-red-500"
                )}
                required
              />
              <p className="text-sm text-gray-500">
                Number of tweets to generate (1-10)
              </p>
            </div>
          </div>

          {contentType === 'long' && (
            <div className="flex items-center space-x-2">
              <Switch
                id="premium-mode"
                checked={isPremium}
                onCheckedChange={setIsPremium}
              />
              <Label htmlFor="premium-mode">Enable Premium Mode</Label>
              <p className="text-sm text-gray-500 ml-2">(Allows longer content generation)</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button 
              onClick={handleGenerateContent} 
              className="gap-2"
              disabled={isLoading || !isFormValid()}
            >
              {isLoading ? 'Generating...' : 'Generate Content'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const content = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create Content with AI</h1>
          <p className="text-gray-500">Transform your content into engaging social media posts in three simple steps.</p>
        </div>
        <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <Home className="h-6 w-6 text-gray-600" />
        </Link>
      </div>

      {/* Project Details Section */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="projectName">Project Name</Label>
          <Input
            id="projectName"
            placeholder="Enter a name for your project (e.g., Product Launch Campaign)"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-white border-gray-300 focus:border-blue-500"
          />
        </div>
        <div>
          <Label htmlFor="projectDescription">Project Description</Label>
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

      {/* Steps Section */}
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
      {selectedSource ? (
        renderSourceInput()
      ) : (
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
    </div>
  );

  return (
    <DashboardLayout>
      <EditProvider editingTweet={editingTweet} videoSummary={videoSummary}>
        {content}
        {editingTweet && (
          <EditTweetModal
            isOpen={!!editingTweet}
            onClose={() => setEditingTweet(null)}
            tweet={editingTweet}
            videoSummary={videoSummary}
            onSave={handleSaveEdit}
            onSchedule={handleScheduleTweet}
            onPublish={handlePublishTweet}
            projectId={projectId}
            setGeneratedTweets={setGeneratedTweets}
          />
        )}
      </EditProvider>
    </DashboardLayout>
  );
} 