import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Youtube,
  Link2,
  Headphones,
  Image as ImageIcon,
  FileUp,
  FileText,
  ChevronRight
} from 'lucide-react';

interface CreateContentDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateContentDialog({ open, onClose }: CreateContentDialogProps) {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

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
    // This will be implemented in the next step
    console.log('Selected source:', sourceId);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Create Content with AI</DialogTitle>
          <p className="text-gray-500">Transform your content into engaging social media posts in three simple steps.</p>
        </DialogHeader>

        {/* Project Details Section */}
        <div className="space-y-4 mb-8">
          <div>
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              placeholder="Enter project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="projectDescription">Project Description</Label>
            <Textarea
              id="projectDescription"
              placeholder="Enter project description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Steps Section */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="space-y-2">
            <div className="text-blue-600 font-medium">Step 1</div>
            <h3 className="text-lg font-semibold">Define Source</h3>
            <p className="text-gray-500 text-sm">Choose your content source and input your content to generate Twitter posts.</p>
          </div>
          <div className="space-y-2">
            <div className="text-blue-600 font-medium">Step 2</div>
            <h3 className="text-lg font-semibold">Generate Content</h3>
            <p className="text-gray-500 text-sm">Review and edit the AI-generated Twitter posts to match your voice.</p>
          </div>
          <div className="space-y-2">
            <div className="text-blue-600 font-medium">Step 3</div>
            <h3 className="text-lg font-semibold">Review & Publish</h3>
            <p className="text-gray-500 text-sm">Schedule and publish your content to Twitter.</p>
          </div>
        </div>

        {/* Content Source Selection */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Select Content Source</h3>
          <p className="text-gray-500 mb-6">Choose the type of content you want to convert to Twitter posts</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contentSources.map((source) => (
              <button
                key={source.id}
                onClick={() => handleSourceSelect(source.id)}
                className="flex flex-col p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-gray-100">
                    <source.icon className="h-5 w-5" />
                  </div>
                  <h4 className="font-medium">{source.title}</h4>
                </div>
                <p className="text-sm text-gray-500">{source.description}</p>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 