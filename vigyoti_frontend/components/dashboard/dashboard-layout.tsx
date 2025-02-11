'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileEdit,
  Clock,
  CheckCircle,
  Users,
  Calendar,
  Settings,
  CreditCard,
  BarChart,
  HelpCircle,
  Share2,
  Plus,
  Sparkles,
  ChevronDown,
  LogOut,
  FileText,
  Send,
  Briefcase,
  ChevronRight,
  FolderKanban
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WorkspaceClient } from '@/lib/workspace-client';
import { Workspace, Project } from '@/types/workspace';

interface SidebarSection {
  title: string;
  items: {
    title: string;
    href: string;
    icon: any;
  }[];
}

const sidebarSections = [
  {
    title: 'Posts Scheduling',
    items: [
      { title: 'Groups', href: '/dashboard/groups', icon: Users },
      { title: 'Group Timings', href: '/dashboard/group-timings', icon: Clock },
      { title: 'Group Calendar', href: '/dashboard/group-calendar', icon: Calendar },
    ],
  },
  {
    title: 'Workspace Settings',
    items: [
      { title: 'My Profile', href: '/dashboard/profile', icon: Settings },
      { title: 'Workspaces', href: '/workspaces', icon: LayoutDashboard },
      { title: 'Team members', href: '/dashboard/team', icon: Users },
      { title: 'Integrations', href: '/dashboard/integrations', icon: Share2 },
    ],
  },
  {
    title: 'Billing and Usage',
    items: [
      { title: 'Billing', href: '/dashboard/billing', icon: CreditCard },
      { title: 'Credit Usage', href: '/dashboard/credits', icon: BarChart },
      { title: 'Earn Free AI Credits', href: '/dashboard/earn-credits', icon: Sparkles },
    ],
  },
  {
    title: 'Resources',
    items: [
      { title: 'Affiliate (30%)', href: '/dashboard/affiliate', icon: Share2 },
      { title: 'Join our community', href: '/dashboard/community', icon: Users },
      { title: 'How to Videos', href: '/dashboard/tutorials', icon: HelpCircle },
      { title: 'Feature Requests', href: '/dashboard/features', icon: Plus },
      { title: 'Must See FAQ\'s', href: '/dashboard/faq', icon: HelpCircle },
    ],
  },
];

export default function DashboardLayout({
  children,
  workspaceName = 'My Workspace',
}: {
  children: React.ReactNode;
  workspaceName?: string;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { data: session } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Content': true,
    'Posts Scheduling': true,
    'Workspace Settings': true
  });

  useEffect(() => {
    const loadWorkspacesAndProjects = async () => {
      if (session?.user?.id) {
        try {
          const userWorkspaces = await WorkspaceClient.getWorkspaces();
          setWorkspaces(userWorkspaces);
          
          if (userWorkspaces.length > 0) {
            const defaultWorkspace = userWorkspaces[0];
            setSelectedWorkspace(defaultWorkspace);
            
            const workspaceProjects = await WorkspaceClient.getWorkspaceProjects(defaultWorkspace.id);
            setProjects(workspaceProjects);
          }
        } catch (error) {
          console.error('Error loading workspaces:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadWorkspacesAndProjects();
  }, [session?.user?.id]);

  const handleWorkspaceChange = async (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    try {
      const workspaceProjects = await WorkspaceClient.getWorkspaceProjects(workspace.id);
      setProjects(workspaceProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const userInitials = session?.user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || '??';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <div className="fixed top-0 right-0 left-0 z-50 h-16 bg-white border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {/* Workspace Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <span>{selectedWorkspace?.name || workspaceName}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => handleWorkspaceChange(workspace)}
                  className="flex items-center justify-between"
                >
                  <span>{workspace.name}</span>
                  {selectedWorkspace?.id === workspace.id && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link href="/workspaces/new" className="flex items-center">
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Workspace
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side user menu */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="text-gray-700">
            <Link href="/dashboard/credits" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>Credits</span>
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || ''} />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-medium">{session?.user?.name}</p>
                <p className="text-xs text-gray-500">{session?.user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link href="/dashboard/profile" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <Link href="/api/auth/signout" className="flex items-center">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex pt-16"> {/* Add padding-top to account for the fixed header */}
        {/* Sidebar */}
        <aside className={cn(
          "fixed left-0 z-40 h-[calc(100vh-4rem)] w-64 border-r bg-white transition-transform overflow-y-auto",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex h-full flex-col gap-2 p-4">
            <div className="space-y-4">
              <div className="px-3 py-2">
                <Link href="/content/post">
                  <Button variant="secondary" className="w-full justify-start">
                    <Plus className="mr-2 h-4 w-4" />
                    Create a New Post
                  </Button>
                </Link>
              </div>
              <div className="px-3 py-2">
                <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                  Content
                </h2>
                <div className="space-y-1">
                  <Link href="/content/create">
                    <Button variant="ghost" className="w-full justify-start">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Create Content
                    </Button>
                  </Link>
                  <Link href="/dashboard/projects">
                    <Button variant="ghost" className="w-full justify-start">
                      <FolderKanban className="mr-2 h-4 w-4" />
                      My Projects
                    </Button>
                  </Link>
                  <Link href="/dashboard/drafts">
                    <Button variant="ghost" className="w-full justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      Drafts
                    </Button>
                  </Link>
                  <Link href="/dashboard/scheduled">
                    <Button variant="ghost" className="w-full justify-start">
                      <Clock className="mr-2 h-4 w-4" />
                      Scheduled
                    </Button>
                  </Link>
                  <Link href="/dashboard/published">
                    <Button variant="ghost" className="w-full justify-start">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Published
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Navigation Sections */}
              {sidebarSections.map((section, index) => (
                <div key={section.title} className={cn("space-y-2", index > 0 && "pt-4")}>
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="flex w-full items-center justify-between px-2 text-xs font-semibold uppercase text-gray-500 hover:text-gray-900"
                  >
                    <span>{section.title}</span>
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-transform",
                      expandedSections[section.title] && "rotate-90"
                    )} />
                  </button>
                  {expandedSections[section.title] && (
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <Link key={item.href} href={item.href}>
                          <span className={cn(
                            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium",
                            pathname === item.href
                              ? "bg-gray-100 text-gray-900"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          )}>
                            <item.icon className="h-4 w-4" />
                            {item.title}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className={cn(
          "flex-1 transition-all duration-200",
          isSidebarOpen ? "ml-64" : "ml-0"
        )}>
          <div className="container mx-auto p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
} 