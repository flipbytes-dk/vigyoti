'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { WorkspaceClient } from '@/lib/workspace-client';
import { Workspace, Project } from '@/types/workspace';
import { UserSubscription, UserCredits } from '@/types/subscription';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import {
  BarChart3,
  Zap,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Image as ImageIcon,
  MessageSquare,
  HardDrive
} from 'lucide-react';

// We'll use a chart library like recharts
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (session?.user?.id) {
        try {
          const [userSubscription, userCredits, userWorkspaces] = await Promise.all([
            fetch('/api/user/subscription').then(res => res.json()),
            fetch('/api/user/credits').then(res => res.json()),
            WorkspaceClient.getWorkspaces()
          ]);

          setSubscription(userSubscription);
          setCredits(userCredits);
          setWorkspaces(userWorkspaces);

          if (userWorkspaces.length > 0) {
            const defaultWorkspace = userWorkspaces[0];
            setSelectedWorkspace(defaultWorkspace);
            const workspaceProjects = await WorkspaceClient.getWorkspaceProjects(defaultWorkspace.id);
            setProjects(workspaceProjects);
          }
        } catch (error) {
          console.error('Error loading dashboard data:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadDashboardData();
  }, [session?.user?.id]);

  // Sample data for charts
  const creditUsageData = [
    { name: 'Tweets', value: 45 },
    { name: 'Threads', value: 20 },
    { name: 'AI Videos', value: 15 },
    { name: 'AI Images', value: 20 }
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const activityData = [
    { date: 'Mon', tweets: 4, threads: 2 },
    { date: 'Tue', tweets: 3, threads: 1 },
    { date: 'Wed', tweets: 7, threads: 3 },
    { date: 'Thu', tweets: 5, threads: 2 },
    { date: 'Fri', tweets: 6, threads: 4 },
    { date: 'Sat', tweets: 2, threads: 1 },
    { date: 'Sun', tweets: 3, threads: 2 }
  ];

  const dashboardContent = (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {session?.user?.name}!</h1>
          <p className="text-gray-500">Here's what's happening with your workspaces.</p>
        </div>
        <Button onClick={() => router.push('/content/create')}>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Content with AI
        </Button>
      </div>

      {/* Subscription & Credits Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Subscription Plan</CardTitle>
            <Zap className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{subscription?.plan || 'Free'}</div>
            <p className="text-xs text-gray-500">
              {subscription?.status === 'active' ? 'Active until ' : 'Expired'}
              {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available Credits</CardTitle>
            <Sparkles className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credits ? credits.totalCredits - credits.usedCredits : 0}</div>
            <Progress 
              value={credits ? (credits.usedCredits / credits.totalCredits) * 100 : 0} 
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              {credits?.usedCredits} used of {credits?.totalCredits} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Workspaces</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspaces.length}</div>
            <p className="text-xs text-gray-500">
              {projects.length} active projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.2 GB</div>
            <Progress value={60} className="mt-2" />
            <p className="text-xs text-gray-500 mt-1">
              60% of 2GB limit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Credit Usage Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Credit Usage Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={creditUsageData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {creditUsageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="tweets" fill="#8884d8" name="Tweets" />
                <Bar dataKey="threads" fill="#82ca9d" name="Threads" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium">Generated 10 tweets</p>
                <p className="text-xs text-gray-500">2 hours ago in Project X</p>
              </div>
              <div className="ml-auto font-medium">-10 credits</div>
            </div>
            <div className="flex items-center">
              <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-green-600" />
              </div>
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium">Generated AI image</p>
                <p className="text-xs text-gray-500">5 hours ago in Project Y</p>
              </div>
              <div className="ml-auto font-medium">-2 credits</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {dashboardContent}
    </DashboardLayout>
  );
} 