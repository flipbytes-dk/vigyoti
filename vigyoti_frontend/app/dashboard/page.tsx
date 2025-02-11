'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { WorkspaceClient } from '@/lib/workspace-client';
import { Workspace, Project } from '@/types/workspace';
import { UserCredits } from '@/types/subscription';
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
import { Timestamp } from 'firebase/firestore';
import { StorageUsageService } from '@/services/storage-usage';
import { cn } from '@/lib/utils';
import { UserSubscription } from '@/types/subscription';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface MetricDataPoint {
  name: string;
  value: number;
}

interface CreditUsageItem {
  name: string;
  value: number;
}

interface RecentActivity {
  type: string;
  timestamp: Timestamp;
  details: string;
  credits?: number;
}

interface DashboardUsage {
  creditsUsedTweets: number;
  creditsUsedThreads: number;
  creditsUsedVideos: number;
  creditsUsedImages: number;
  postsThisMonth: number;
  threadsThisMonth: number;
  imagesThisMonth: number;
  videosThisMonth: number;
}

interface ExtendedUserSubscription extends UserSubscription {
  recentActivity?: RecentActivity[];
  usage?: DashboardUsage;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<ExtendedUserSubscription | null>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageUsage, setStorageUsage] = useState<{
    used: number;
    total: number;
    percentage: number;
  } | null>(null);

  const [creditUsageData, setCreditUsageData] = useState<CreditUsageItem[]>([
    { name: 'Tweets', value: 0 },
    { name: 'Threads', value: 0 },
    { name: 'AI Videos', value: 0 },
    { name: 'AI Images', value: 0 }
  ]);

  const [metrics, setMetrics] = useState<MetricDataPoint[]>([
    { name: 'Tweets', value: 0 },
    { name: 'Threads', value: 0 },
    { name: 'Images', value: 0 },
    { name: 'Videos', value: 0 }
  ]);

  const [loadingMessage, setLoadingMessage] = useState('Initializing dashboard...');
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (session?.user?.id) {
        try {
          setLoadingMessage('Connecting to your account...');
          setLoadingProgress(10);
          
          // Get user document from Firestore to get subscription details
          const userRef = doc(db, 'users', session.user.id);
          const userDoc = await getDoc(userRef);
          
          setLoadingMessage('Loading user profile...');
          setLoadingProgress(30);
          
          if (!userDoc.exists()) {
            setLoadingMessage('Setting up your account for the first time...');
            // Create default user data if it doesn't exist
            const defaultUserData = {
              id: session.user.id,
              email: session.user.email,
              name: session.user.name,
              subscription: {
                plan: 'free',
                status: 'trial',
                startDate: Timestamp.now(),
                endDate: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
                trialEnd: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
              },
              usage: {
                postsThisMonth: 0,
                creditsThisMonth: 0,
                storageUsed: 0
              },
              credits: {
                available: 100,
                used: 0,
                total: 100,
                lastRefill: Timestamp.now(),
                nextRefill: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
              },
              workspaces: [],
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            };
            await setDoc(userRef, defaultUserData);
            console.log('✅ Created new user document with default values');
          }

          const userData = userDoc.exists() ? userDoc.data() : null;
          console.log('👤 User data:', userData);

          if (!userData) {
            throw new Error('Failed to load user data');
          }

          setLoadingMessage('Loading your workspaces...');
          setLoadingProgress(50);
          
          // Load workspaces directly from user data
          const userWorkspaces = userData.workspaces || [];
          let workspacesData: Workspace[] = [];
          
          if (userWorkspaces.length > 0) {
            setLoadingMessage('Fetching workspace details...');
            // Fetch workspace details
            const workspaceDocs = await Promise.all(
              userWorkspaces.map((wsId: string) => 
                getDoc(doc(db, 'workspaces', wsId))
              )
            );
            workspacesData = workspaceDocs
              .filter(doc => doc.exists())
              .map(doc => ({ id: doc.id, ...doc.data() } as Workspace));
          }

          setLoadingMessage('Calculating storage usage...');
          setLoadingProgress(70);
          
          // Get storage usage
          const storage = await StorageUsageService.getStorageUsage(session.user.id)
            .catch(() => ({ 
              used: userData.usage?.storageUsed || 0, 
              total: 1024 * 1024 * 1024, // 1GB default
              percentage: ((userData.usage?.storageUsed || 0) / (1024 * 1024 * 1024)) * 100 
            }));

          setLoadingMessage('Preparing subscription data...');
          setLoadingProgress(80);
          
          // Set subscription data
          const subscriptionData = {
            ...userData.subscription,
            usage: userData.usage || {
              postsThisMonth: 0,
              creditsThisMonth: 0,
              storageUsed: 0,
              threadsThisMonth: 0,
              imagesThisMonth: 0,
              videosThisMonth: 0
            }
          };

          // Create properly typed credits object
          const userCredits: UserCredits = {
            userId: session.user.id,
            available: userData.credits?.available || 0,
            used: userData.credits?.used || 0,
            total: userData.credits?.total || 0,
            lastRefillDate: userData.credits?.lastRefill?.toMillis() || Date.now(),
            nextRefillDate: userData.credits?.nextRefill?.toMillis() || Date.now() + (30 * 24 * 60 * 60 * 1000),
            usageBreakdown: {
              tweets: userData.usage?.postsThisMonth || 0,
              threads: userData.usage?.threadsThisMonth || 0,
              videos: userData.usage?.videosThisMonth || 0,
              images: userData.usage?.imagesThisMonth || 0,
              rewrites: 0,
              storage: userData.usage?.storageUsed || 0
            }
          };

          console.log('📊 Dashboard data loaded:', {
            subscription: subscriptionData,
            credits: userCredits,
            workspaces: workspacesData,
            storage
          });

          setSubscription(subscriptionData);
          setCredits(userCredits);
          setWorkspaces(workspacesData);
          setStorageUsage(storage);

          // Update credit usage distribution
          setCreditUsageData([
            { name: 'Tweets', value: userData.usage?.postsThisMonth || 0 },
            { name: 'Threads', value: userData.usage?.threadsThisMonth || 0 },
            { name: 'AI Videos', value: userData.usage?.videosThisMonth || 0 },
            { name: 'AI Images', value: userData.usage?.imagesThisMonth || 0 }
          ]);

          // Set activity metrics
          setMetrics([
            { name: 'Tweets', value: userData.usage?.postsThisMonth || 0 },
            { name: 'Threads', value: userData.usage?.threadsThisMonth || 0 },
            { name: 'Images', value: userData.usage?.imagesThisMonth || 0 },
            { name: 'Videos', value: userData.usage?.videosThisMonth || 0 }
          ]);

          setLoadingMessage('Loading your projects...');
          setLoadingProgress(90);
          
          if (workspacesData.length > 0) {
            const defaultWorkspace = workspacesData[0];
            setSelectedWorkspace(defaultWorkspace);
            
            // Fetch projects for the default workspace
            const projectsQuery = query(
              collection(db, 'projects'),
              where('workspaceId', '==', defaultWorkspace.id),
              where('userId', '==', session.user.id)
            );
            const projectsSnap = await getDocs(projectsQuery);
            const projectsData = projectsSnap.docs.map(doc => ({ 
              id: doc.id, 
              ...doc.data() 
            })) as Project[];
            setProjects(projectsData);
          }

          setLoadingMessage('Almost there...');
          setLoadingProgress(95);
          
        } catch (error) {
          console.error('Error loading dashboard data:', error);
          setLoadingMessage('Something went wrong while loading your dashboard...');
        } finally {
          setLoadingProgress(100);
          setLoading(false);
        }
      }
    };

    loadDashboardData();
  }, [session?.user?.id]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  // Helper function to safely calculate percentage
  const calculatePercentage = (used: number, total: number) => {
    if (!total || !used) return 0;
    const percentage = (used / total) * 100;
    return isNaN(percentage) ? 0 : percentage;
  };

  // Helper function to safely display numbers
  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return 0;
    return num;
  };

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: Timestamp | undefined | null) => {
    if (!timestamp) return 'N/A';
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const dashboardContent = (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {session?.user?.name || 'User'}!</h1>
          <p className="text-gray-500">Here's what's happening with your workspaces.</p>
        </div>
        <Button onClick={() => router.push('/content/create')}>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Content with AI
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Subscription Plan</CardTitle>
            <Zap className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{subscription?.plan || 'Free'}</div>
            <p className="text-xs text-gray-500">
              {subscription?.currentPeriodEnd
                ? `Valid until ${formatTimestamp(subscription.currentPeriodEnd)}`
                : subscription?.status === 'trial'
                  ? `Trial ends on ${formatTimestamp(subscription.trialEnd)}`
                  : 'No active subscription'}
            </p>
            {subscription?.status === 'past_due' && (
              <p className="text-xs text-red-500 mt-1">
                Your subscription payment is past due. Please update your payment method.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available Credits</CardTitle>
            <Sparkles className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {credits?.used || 0}/{credits?.total || 0}
            </div>
            <Progress 
              value={calculatePercentage(credits?.used || 0, credits?.total || 100)} 
              className={cn(
                "mt-2",
                credits?.used && credits.total && (credits.used / credits.total) >= 0.9 
                  ? "bg-red-200" 
                  : credits?.used && credits.total && (credits.used / credits.total) >= 0.75 
                  ? "bg-yellow-200" 
                  : "bg-blue-200"
              )}
            />
            <p className="text-xs text-gray-500 mt-1">
              {credits?.available || 0} credits remaining
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
            <div className="text-2xl font-bold">
              {StorageUsageService.formatStorageSize(storageUsage?.used || 0)}
            </div>
            <Progress 
              value={storageUsage?.percentage || 0}
              className={cn(
                "mt-2",
                storageUsage?.percentage && storageUsage.percentage >= 90 
                  ? "bg-red-200" 
                  : storageUsage?.percentage && storageUsage.percentage >= 75 
                  ? "bg-yellow-200" 
                  : "bg-blue-200"
              )}
            />
            <p className="text-xs text-gray-500 mt-1">
              {((storageUsage?.percentage || 0)).toFixed(1)}% of {StorageUsageService.formatStorageSize(storageUsage?.total || 0)} used
            </p>
            {storageUsage?.percentage && storageUsage.percentage >= 90 && (
              <p className="text-xs text-red-500 mt-1">Storage almost full!</p>
            )}
            {storageUsage?.percentage && storageUsage.percentage >= 75 && storageUsage.percentage < 90 && (
              <p className="text-xs text-yellow-500 mt-1">Storage usage high</p>
            )}
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
            <CardTitle>Activity Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
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
            {subscription?.recentActivity?.map((activity: RecentActivity, index: number) => (
              <div key={index} className="flex items-center">
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center",
                  activity.type === 'tweet' ? "bg-blue-100" : "bg-green-100"
                )}>
                  {activity.type === 'tweet' ? (
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-green-600" />
                  )}
                </div>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium">{activity.details}</p>
                  <p className="text-xs text-gray-500">{formatTimestamp(activity.timestamp)}</p>
                </div>
                <div className="ml-auto font-medium">
                  {activity.credits ? (
                    <span className="text-red-500">-{activity.credits} credits</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">Loading your dashboard...</h3>
            <p className="text-sm text-gray-500">{loadingMessage}</p>
          </div>
          <div className="max-w-md w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-4">
            <div 
              className="h-full bg-blue-500 transition-all duration-500 ease-in-out" 
              style={{ width: `${loadingProgress}%` }} 
            />
          </div>
          <p className="text-xs text-gray-400">{loadingProgress}% complete</p>
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