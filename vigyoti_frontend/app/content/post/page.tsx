'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { Home, ImagePlus, Send } from 'lucide-react';

export default function CreatePostPage() {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [tweetContent, setTweetContent] = useState('');

  const handleCreatePost = () => {
    // This will be implemented in the next step
    console.log('Creating post:', { projectName, projectDescription, tweetContent });
  };

  const content = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create New Post</h1>
          <p className="text-gray-500">Compose and schedule your Twitter posts.</p>
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

      {/* Tweet Composer */}
      <Card className="p-6 space-y-4 bg-white shadow-sm hover:shadow-md">
        <div>
          <Label htmlFor="tweetContent">Compose Your Tweet</Label>
          <Textarea
            id="tweetContent"
            placeholder="What's happening?"
            value={tweetContent}
            onChange={(e) => setTweetContent(e.target.value)}
            rows={4}
            className="bg-white border-gray-300 focus:border-blue-500 mt-2"
          />
          <div className="text-right text-sm text-gray-500 mt-1">
            {280 - tweetContent.length} characters remaining
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" className="gap-2">
            <ImagePlus className="h-4 w-4" />
            Add Media
          </Button>
          <Button onClick={handleCreatePost} className="gap-2">
            <Send className="h-4 w-4" />
            Create Post
          </Button>
        </div>
      </Card>
    </div>
  );

  return (
    <DashboardLayout>
      {content}
    </DashboardLayout>
  );
} 