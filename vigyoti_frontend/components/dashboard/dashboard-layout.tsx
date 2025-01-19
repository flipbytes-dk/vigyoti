'use client';

import { useState } from 'react';
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

interface SidebarItem {
  title: string;
  items: {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const sidebarItems: SidebarItem[] = [
  {
    title: 'Content',
    items: [
      { title: 'My Projects', href: '/dashboard/projects', icon: FileEdit },
      { title: 'Drafts', href: '/dashboard/drafts', icon: FileEdit },
      { title: 'Scheduled', href: '/dashboard/scheduled', icon: Clock },
      { title: 'Published', href: '/dashboard/published', icon: CheckCircle },
    ],
  },
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

  const userInitials = session?.user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || '??';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white px-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Image
              src="/vigyoti.png"
              alt="Vigyoti Logo"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-blue-600">{workspaceName}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session?.user?.image || ''} />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <span className="hidden md:inline-block">{session?.user?.name}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/api/auth/signout" className="flex items-center text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed left-0 z-40 h-[calc(100vh-4rem)] w-64 border-r bg-white transition-transform",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex h-full flex-col gap-2 p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Button className="w-full justify-start gap-2" variant="secondary">
                  <Plus className="h-4 w-4" />
                  Create a New Post
                </Button>
                <Button className="w-full justify-start gap-2" variant="outline">
                  <Sparkles className="h-4 w-4" />
                  Generate posts with AI
                </Button>
              </div>

              {sidebarItems.map((section, index) => (
                <div key={section.title} className={cn("space-y-2", index > 0 && "pt-4")}>
                  <h3 className="px-2 text-xs font-semibold uppercase text-gray-500">
                    {section.title}
                  </h3>
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
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className={cn(
          "flex-1 transition-all",
          isSidebarOpen ? "ml-64" : "ml-0"
        )}>
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
} 